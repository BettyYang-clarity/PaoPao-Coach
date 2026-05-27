/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { GOALS_DATA } from "../data/habitsData";
import { getActionableGuide } from "../data/actionableGuides";

// Dynamic initializer for Gemini client to prevent caching a missing key and support on-the-fly key updates
function getGeminiClient(): GoogleGenAI {
  const rawKey = process.env.GEMINI_API_KEY;
  const key = rawKey ? rawKey.trim().replace(/^['"]|['"]$/g, '') : '';
  if (!key) {
    console.warn("⚠️ Warning: GEMINI_API_KEY is not set. The coach features will run in mock mode.");
  }
  return new GoogleGenAI({
    apiKey: key || "MOCK_KEY",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Convert base64 data to inline part for Gemini
function base64ToPart(base64Str: string, mimeType: string) {
  const base64Data = base64Str.includes("base64,")
    ? base64Str.split("base64,")[1]
    : base64Str;
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };
}

// System instruction for general High-EQ Chat
const COACH_SYSTEM_PROMPT = `你是一位充滿溫度、溫和且高度同理心的 PaoPao健康養成教練（簡稱 PaoPao教練）。你深諳「行為心理學」與「原子習慣」原理，且具備大眾健康飲食及身體活動指引常識。

你的核心角色與規範：
1. 【健康陪跑與原子習慣角色】：
   - 抱持 100% 溫慢、接納與同理心。無論使用者是否達標、是否吃了低糖低脂或高糖油炸美食，絕對不予以任何指責、罪惡感威脅或審判。誠實記錄是好習慣的起點，要隨喜讚賞他們的誠實。
   - 【低磨損、微小而持續的習慣建立】：你深信「每天累積 1% 的改變」，避免給予過於龐大或高難度的目標。始終提供溫和、易行的微習慣指引，幫助大腦降低阻力，輕鬆邁出下一小步。
   - 【嚴禁提供個人化醫療或治療處方】：你不得為使用者開立個人專屬健康管理或特定臨床控制處方。在你的回答結尾，必須包含以下大眾免責指引聲明：
     「我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。」
2. 【哈佛健康餐盤推廣】：
   - 引導使用者往「原型食物」、「蔬菜佔半、優質全穀與健康蛋白各佔四分之一」的大眾健康基礎前進，而非斤斤計較於複雜的熱量與克數。
`;

// System instruction for Image Analyzer
const IMAGE_ANALYZER_PROMPT = `
you're PaoPao教練, a warm, high-EQ image analyzer. 你是一位專門分析健康飲食和活動照片的 AI 專家。
請根據使用者上傳的照片，判斷並回傳符合規範的 JSON 物件。不要輸出任何 Markdown 標記（如 \`\`\`json 標記），請直接回傳純 JSON 字串。
`;

const fallbackFoods: Record<string, { kcal: number; protein: string; carbs: string; fat: string; desc: string }> = {
  香蕉: {
    kcal: 90,
    protein: "1.1g",
    carbs: "23g",
    fat: "0.3g",
    desc: "香蕉富含鉀離子與快速吸收的碳水化合物，是運動前後補充能量的絕佳聖品！"
  },
  滷肉飯: {
    kcal: 650,
    protein: "18g",
    carbs: "75g",
    fat: "30g",
    desc: "滷肉飯油脂與精緻澱粉較高，建議搭配一盤燙青菜與滷蛋，來增加纖維與優質蛋白質的平衡。"
  },
  珍珠奶茶: {
    kcal: 550,
    protein: "3g",
    carbs: "80g",
    fat: "15g",
    desc: "珍珠奶茶含糖與精緻澱粉較高，偶爾享受沒關係，建議搭配無糖綠茶或微糖無糖豆漿，更能享受茶香與更輕盈的美味組合！"
  },
  牛排: {
    kcal: 400,
    protein: "35g",
    carbs: "0g",
    fat: "28g",
    desc: "牛排富含豐富的優質蛋白質與鐵質，對肌肉修復及體力維持有絕佳效果，記得搭配豐富蔬菜喔！"
  }
};

const fallbackExercises = {
  慢跑: { met: 8.0, desc: "慢跑是極佳的心肺訓練，能大幅提升心肺耐力與熱量消耗。記得維持平穩呼吸，步伐保持輕盈喔！" },
  散步: { met: 3.0, desc: "散步是低磨損的極佳日常活動，能有效促進餐後血糖平穩與放鬆心情。每天多走 500 步就是很好的累積！" },
  瑜伽: { met: 2.5, desc: "瑜伽著重於呼吸與身體的覺察，能伸展關節、舒緩情緒。" },
  游泳: { met: 7.0, desc: "游泳是全身性的無衝擊有氧運動，對關節非常友善，能同時強化與鍛鍊肌肉群。" },
  重訓: { met: 5.0, desc: "阻力訓練（重訓）是提升肌肉量與基礎代謝的關鍵。" },
  騎單車: { met: 6.0, desc: "騎單車能鍛鍊下肢大肌群，也是非常安靜的有氧活動。" }
};

function isApiKeyPresent(): boolean {
  const rawApiKey = process.env.GEMINI_API_KEY;
  const apiKey = rawApiKey ? rawApiKey.trim().replace(/^['"]/g, '').replace(/['"]$/g, '') : '';
  return !!(apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey !== "undefined" && apiKey !== "");
}

/**
 * Register all API routes on the given Express app.
 * This function is free of any Vite / dev-server dependencies
 * so it can be safely used in both local dev and Vercel serverless.
 */
export async function handleCoachChat(req: any, res: any) {
  try {
    const { message, history, profile } = req.body;
    const lowerMessage = message?.toLowerCase() || "";
    const goalStr = profile?.customGoal || "維持健康生活方式";
    const guidelineText = profile?.selectedHabits && profile.selectedHabits.length > 0
      ? `，並為您精選了 ${profile.selectedHabits.length} 個微原子習慣`
      : "";

    const keyPresent = isApiKeyPresent();

    let systemWarning = "";
    if (!keyPresent) {
      systemWarning = "⚠️ 【系統診斷：尚未設定您的 GEMINI_API_KEY 金鑰。此為自主託管的 Vercel 佈署，請至您的 Vercel 專案 Dashboard ➔ Settings ➔ Environment Variables 新增名為 `GEMINI_API_KEY` 的環境變數即可啟用真實的 AI 智慧教練！暫時為您啟用高品質原子習慣模擬對話。】\n\n";
    }

    if (keyPresent) {
      try {
        const ai = getGeminiClient();
        const prompt = `【使用者個人檔案】
${JSON.stringify(profile)}

【歷史對話紀錄】
${history && Array.isArray(history) ? history.map((m: any) => `${m.sender === "bot" ? "教練(PaoPao)" : "使用者"}: ${m.text}`).join("\n") : "無"}

【最新使用者訊息】
${message}`;

        let response;
        try {
          // 優先嘗試使用 gemini-3.5-flash
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT
            }
          });
        } catch (modelError: any) {
          console.warn("⚠️ gemini-3.5-flash failed, trying gemini-2.5-flash fallback:", modelError);
          // 次要嘗試使用 gemini-2.5-flash
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT
            }
          });
        }

        if (response && response.text) {
          return res.json({ reply: response.text });
        }
      } catch (realAiError: any) {
        console.error("⚠️ Real Gemini API Call failed:", realAiError);
        const errorMsg = `❌ 【AI 教練連線失敗】\n很抱歉，教練與 AI 核心失去連線。這通常是由於金鑰設定問題或額度限制引起的。\n\n💡 偵錯與診斷資訊：\n- 錯誤內容：${realAiError.message || JSON.stringify(realAiError)}\n- 金鑰狀態：已設定 (長度: ${process.env.GEMINI_API_KEY?.trim().length} 字元)\n\n請檢查您的 Vercel 專案 Settings -> Environment Variables 中的 GEMINI_API_KEY。設定完畢後，請重新部署以套用。`;
        return res.json({ reply: errorMsg });
      }
    }

    // --- FALLBACK MOCK ENGINE ---
    // 1. Check for diet matches
    let foodKey = Object.keys(fallbackFoods).find(k => lowerMessage.includes(k));
    if (foodKey) {
      const item = fallbackFoods[foodKey];
      return res.json({
        reply: systemWarning + `【PaoPao教練溫和指引】

嗨！親愛的夥伴，看見你願意主動了解食物、關心攝取，這就是最高等級的習慣認證！🎉

對於您詢問的食物：【${foodKey}】🍉
💡 衛生福利部國健署標準營養成分與大眾飲食指南推薦供您客觀參考：
• 估計約熱量：約 **${item.kcal}** kcal （大卡）
• 粗估營養素：碳水 ${item.carbs}、蛋白質 ${item.protein}、脂肪 ${item.fat}。
• 教練科普小叮嚀：${item.desc}

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

我們可以從更穩健大眾的健康習慣出發：
💡 依照世界權威【哈佛健康餐盤】指引，我們可以將每餐分配分為三個重要區塊：蔬菜佔一半（多樣化），優質全穀物（如十穀、糙米）佔 1/4，健康蛋白質（如豆製品、魚、蛋與瘦肉）佔 1/4。這是不需要特定處方，每個人都能輕鬆愛護自己的極佳基準！

🎯 【目標提醒】：${goalStr}。
☘️ 【微習慣建議】：今天晚餐的第一口，請試著先從「一口蛋白質」或「一口蔬菜」開始吃起，以此取代精緻澱粉的先發吸收，幫助身體無壓力感受平穩活力！`
      });
    }

    // 2. Check for exercise matches
    let exerciseKey = Object.keys(fallbackExercises).find(k => lowerMessage.includes(k));
    if (exerciseKey) {
      const item = fallbackExercises[exerciseKey as keyof typeof fallbackExercises];
      return res.json({
        reply: systemWarning + `【PaoPao教練溫和指引】

嗨！親愛的夥伴，聽你提到進行了【${exerciseKey}】活動，真的要為你熱烈鼓掌！👏 在原子習慣的科學中，「準備並跨出第一步」就是最容易卡關的 80% 阻力，而你已經帥氣通關了！

💡 運動常識科普與代謝率（MET）估算：
• 該運動活動代謝率（MET）約為：**${item.met}**
• 習慣科普小筆記：${item.desc}

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

你可以如何無痛放大這個好習慣：
☘️ 【微習慣建議】：在剛運動完的這 30 分鐘，請順手給自己盛上一杯 300ml 的微溫水，一口口慢吞吞地喝完它。這是最棒、最簡單、也最不需要意志力就能幫助肌肉修補和加速乳酸代謝的習慣連結。

今天真的做得太棒了，持續累積你的微小改變吧！`
      });
    }

    const responses = [
      systemWarning + `【PaoPao教練提示】\n嗨！ ${profile?.name || "夥伴"}，我是你的 PaoPao健康陪跑教練。很高興收到你的訊息！你現在願意誠實記錄、與我分享，就是最強大的健康自然習慣第一步。
 
『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構。』

🎯 【目標提醒】：${goalStr}${guidelineText}。依照哈佛健康餐盤，只要多吃原型食物、多喝溫白開水，每天稍微推進 1%, 就是在累積改變的複利！
☘️ 【可以怎麼做】：我們現在來個低磨損挑戰——深深用鼻子吸氣 4 秒、再用嘴巴吐氣 6 秒，連續做 2 次。這能馬上重置大腦壓力，你覺得如何？努力就是滿分！`,
 
      systemWarning + `【PaoPao教練提示】\n（溫柔拍肩）我非常理解夥伴的心情！生活本來就是由各種不完美、偶爾的美食和大炸雞拼湊而成的。這才是最快樂健康的生理常規狀態！

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康觀念，但不能為您開立專屬診斷與處方。』
 
🎯 【目標提醒】：${goalStr}${guidelineText}。不要讓大餐或偶爾的熱量飆高變成罪惡感，誠實記錄下來，就代表生活的油門與煞車主導權依然牢牢握在你的手中。
☘️ 【可以怎麼做】：不如現在去倒一杯 250ml 的溫開水喝下去？健康指標顯示，多補充乾淨水分是體內代謝最重要的潤滑劑。你已經做得非常棒了！`
    ];

    const randomResp = responses[Math.floor(Math.random() * responses.length)];
    return res.json({ reply: randomResp });
  } catch (error) {
    console.error("Error in /api/coach/chat:", error);
    res.status(500).json({ error: "教練現在有點累，請稍後再試！" });
  }
}

export async function handleAnalyzeImage(req: any, res: any) {
  try {
    const { image, profile } = req.body;
    if (!image) {
      return res.status(400).json({ error: "請提供圖片資料" });
    }

    const keyPresent = isApiKeyPresent();

    const getMockResponse = () => {
      const isExercise = image.includes("exercise") || Math.random() > 0.5;
      if (isExercise) {
        return {
          type: "exercise",
          estimatedValue: 30,
          unit: "分鐘",
          nutritionRough: {
            carbs: "無直接攝取",
            protein: "增肌必備",
            fat: "消耗效率良好",
            veg: "多補充電解質"
          },
          pointsEarned: 25,
          coachFeedback: "哇！看見你如此熱情地活動身體，這項了不起的主動選擇就是愛你自己的最好證明！我們不限運動強度，僅此登錄誠實行動就為你帶來充滿活力的多巴胺加分！今天直接獲得 **25 點健康加分**！今天的微小加分任務：來杯 300ml 的微溫水補充代謝消耗！"
        };
      } else {
        return {
          type: "diet",
          estimatedValue: 450,
          unit: "大卡",
          nutritionRough: {
            carbs: "適量 (好活力來源)",
            protein: "稍微偏低 (建議加顆蛋)",
            fat: "充足 (維持腦部健康)",
            veg: "較少 (多夾一片青菜)"
          },
          pointsEarned: 25,
          coachFeedback: "哇！看到你在食物前停下、拍照並誠實記錄，這個細小的動作在原子習慣中，價值等同於 200 分的堅持！不完美也非常美味，這餐提供你源源不絕的活力多巴胺。我們今天直接獲得 **25 點健康加分**！今天的微小加分任務：來杯 300ml 的水或無糖茶，幫你新陳代謝、清除油膩，你已經做得超級棒囉！"
        };
      }
    };

    if (keyPresent) {
      try {
        const ai = getGeminiClient();
        // Call real Gemini model with image data
        const part = base64ToPart(image, "image/jpeg");
        const contentsText = `使用者個人檔案: ${JSON.stringify(profile)}。請根據圖片分析，回傳符合 schema 的 JSON 格式。`;
        
        let response;
        const callParams = (modelName: string) => ({
          model: modelName,
          contents: [part, { text: contentsText }],
          config: {
            systemInstruction: IMAGE_ANALYZER_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["type", "estimatedValue", "unit", "nutritionRough", "pointsEarned", "coachFeedback"],
              properties: {
                type: { type: Type.STRING, enum: ["diet", "exercise"] },
                estimatedValue: { type: Type.INTEGER },
                unit: { type: Type.STRING },
                nutritionRough: {
                  type: Type.OBJECT,
                  required: ["carbs", "protein", "fat", "veg"],
                  properties: {
                    carbs: { type: Type.STRING },
                    protein: { type: Type.STRING },
                    fat: { type: Type.STRING },
                    veg: { type: Type.STRING }
                  }
                },
                proteinGrams: { type: Type.INTEGER },
                pointsEarned: { type: Type.INTEGER },
                coachFeedback: { type: Type.STRING }
              }
            }
          }
        });

        try {
          // 優先嘗試 gemini-3.5-flash
          response = await ai.models.generateContent(callParams("gemini-3.5-flash"));
        } catch (modelError: any) {
          console.warn("⚠️ gemini-3.5-flash image analysis failed, trying gemini-2.5-flash fallback:", modelError);
          // 次要嘗試 gemini-2.5-flash
          response = await ai.models.generateContent(callParams("gemini-2.5-flash"));
        }

        if (response && response.text) {
          const result = JSON.parse(response.text.trim() || "{}");
          return res.json(result);
        }
      } catch (realAiError: any) {
        console.error("⚠️ Real Gemini Image Analyzer failed:", realAiError);
        // 如果 AI 圖片分析失敗，直接將錯誤拋回給前端，以便診斷
        return res.status(500).json({ 
          error: "AI 圖片分析失敗，已暫停 Mock 模擬", 
          details: realAiError.message || JSON.stringify(realAiError),
          diagnostics: `金鑰狀態: 已設定 (長度: ${process.env.GEMINI_API_KEY?.trim().length} 字元)`
        });
      }
    }

    return res.json(getMockResponse());
  } catch (error: any) {
    console.error("Error in /api/coach/analyze-image:", error);
    res.status(500).json({ error: "分析圖片時發生錯誤。" });
  }
}

export async function handleSuggestTasks(req: any, res: any) {
  try {
    const { profile } = req.body;
    const selectedHabits = profile?.selectedHabits || [];

    const tasks: any[] = [];
    let idx = 0;

    selectedHabits.forEach((sh: any) => {
      let foundHabit: any = null;
      let goalName = "習慣";

      for (const g of GOALS_DATA) {
        const matchingHabit = g.habits.find(item => item.id === sh.habitId);
        if (matchingHabit) {
          foundHabit = matchingHabit;
          goalName = g.name;
          break;
        }
      }

      if (foundHabit) {
        const lvLabels: Record<number, string> = { 1: "Lv1 超容易", 2: "Lv2 普通", 3: "Lv3 進階" };
        const challengeText = foundHabit.levels[sh.level as 1 | 2 | 3] || foundHabit.levels[1];
        const actionableText = getActionableGuide(foundHabit.id, foundHabit.category);
        tasks.push({
          id: `t-pref-${foundHabit.id}-${sh.level}-${idx++}`,
          title: `【${goalName} ｜ ${foundHabit.name} ${lvLabels[sh.level as 1 | 2 | 3] || "Lv1"}】 ${challengeText} ➔ 👉 實際執行：${actionableText}`,
          category: foundHabit.category,
          completed: false,
          points: sh.level === 1 ? 15 : sh.level === 2 ? 25 : 35,
          suggestion: foundHabit.suggestion
         });
      }
    });

    // Fallback completely to general_health default tasks only if they literally haven't selected anything
    if (tasks.length === 0) {
      const general = GOALS_DATA.find(g => g.id === "general_health");
      if (general) {
        general.habits.slice(0, 3).forEach((h) => {
          tasks.push({
            id: `t-fallback-${h.id}-1-${idx++}`,
            title: `【維持健康 ｜ ${h.name} Lv1 超容易】 ${h.levels[1]} ➔ 👉 實際執行：${getActionableGuide(h.id, h.category)}`,
            category: h.category,
            completed: false,
            points: 15,
            suggestion: h.suggestion
          });
        });
      }
    }

    res.json({ tasks });
  } catch (error: any) {
    console.error("Error in /api/coach/suggest-tasks:", error);
    res.status(500).json({ error: "無法推薦微習慣任務", details: error.message });
  }
}

/**
 * Register all API routes on the given Express app.
 * This function is free of any Vite / dev-server dependencies
 * so it can be safely used in both local dev and Vercel serverless.
 */
export function registerApiRoutes(app: express.Express) {
  // 1. High-EQ AI Coach Chat Endpoint
  app.post(["/api/coach/chat", "/coach/chat"], handleCoachChat);

  // 2. High-EQ Image Analyzer Endpoint
  app.post(["/api/coach/analyze-image", "/coach/analyze-image"], handleAnalyzeImage);

  // 3. Simulated/Dynamic Personalized Micro-Habits Recommender strictly synchronized with profile selectedHabits
  app.post(["/api/coach/suggest-tasks", "/coach/suggest-tasks"], handleSuggestTasks);
}
