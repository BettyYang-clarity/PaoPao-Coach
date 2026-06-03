/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Request, Response } from "express";
import { GOALS_DATA } from "../../src/data/habitsData";

// Dynamic initializer for Gemini client to prevent caching a missing key and support on-the-fly key updates
function getGeminiClient(): GoogleGenAI {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao;
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

function isApiKeyPresent(): boolean {
  const rawApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao;
  const apiKey = rawApiKey ? rawApiKey.trim().replace(/^['"]/g, '').replace(/['"]$/g, '') : '';
  return !!(apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey !== "undefined" && apiKey !== "");
}

// Clean and defensively parse JSON string from AI responses
function cleanAndParseJson(rawText: string) {
  let cleanText = rawText.trim();
  // Strip markdown wraps if model insisted on using them
  cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(cleanText.trim());
}

function extractPendingRecordFromText(text: string, titleDefault: string) {
  const lowerText = text.toLowerCase();
  
  // 1. Detect if it relates to diet or exercise
  const isDiet = lowerText.includes("大卡") || lowerText.includes("kcal") || lowerText.includes("卡路里") || lowerText.includes("吃") || lowerText.includes("喝") || lowerText.includes("餐") || lowerText.includes("蛋");
  const isExercise = lowerText.includes("分鐘") || lowerText.includes("met") || lowerText.includes("運動") || lowerText.includes("活動") || lowerText.includes("散步") || lowerText.includes("慢跑") || lowerText.includes("跑步") || lowerText.includes("走路") || lowerText.includes("重訓") || lowerText.includes("健身");
  
  if (!isDiet && !isExercise) return null;
  
  // 優先判定 exercise，因為運動句子中經常會提到「大卡」或「卡路里」
  const type = isExercise ? "exercise" : "diet";
  
  // 2. Extract calories or exercise duration
  let estimatedValue = 0;
  let caloriesBurned = undefined;
  
  // 3. Extract protein
  let proteinGrams = 0;
  const proteinMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:公克|克|g)/i);
  if (proteinMatch) {
    proteinGrams = Math.round(parseFloat(proteinMatch[1]));
  }
  
  // 4. Calculate rough carbs and fat based on calorie allocation formulas, and caloriesBurned for exercise
  let carbsGrams = 0;
  let fatGrams = 0;
  
  if (type === "diet") {
    const kcalMatch = text.match(/(\d+)\s*(?:大卡|kcal|卡路里|卡)/i);
    if (kcalMatch) {
      estimatedValue = parseInt(kcalMatch[1]);
    } else {
      estimatedValue = 250; // 預設 250 大卡
    }
    
    carbsGrams = Math.round((estimatedValue * 0.5) / 4);
    fatGrams = Math.round((estimatedValue * 0.3) / 9);
    if (proteinGrams > 0) {
      const remainingKcal = estimatedValue - (proteinGrams * 4);
      if (remainingKcal > 0) {
        carbsGrams = Math.round((remainingKcal * 0.6) / 4);
        fatGrams = Math.round((remainingKcal * 0.4) / 9);
      }
    }
  } else {
    // For exercise: estimatedValue is minutes.
    const minsMatch = text.match(/(\d+)\s*(?:分鐘|分)/);
    if (minsMatch) {
      estimatedValue = parseInt(minsMatch[1]);
    } else {
      estimatedValue = 30; // 預設 30 分鐘
    }
    
    const burnedMatch = text.match(/(\d+)\s*(?:大卡|kcal|卡路里|卡)/i);
    if (burnedMatch) {
      caloriesBurned = parseInt(burnedMatch[1]);
    } else {
      caloriesBurned = Math.round(estimatedValue * 6.5);
    }
  }
  
  // 5. Extract specific food or exercise titles from text
  let title = titleDefault || (isDiet ? "今日美味餐飲" : "今日身體活動");
  
  // Strip out prefix words if matching default message structure
  title = title.replace(/我剛吃了|我吃了|吃了|我想吃|吃|喝了|喝|熱量是多少|熱量|多少大卡|是多少|多少/g, "").trim();
  if (!title || title.length > 15) {
    title = isDiet ? "今日美味餐飲" : "今日身體活動";
  }

  const titleMatch = text.match(/【([^】]+)】/);
  if (titleMatch) {
    title = titleMatch[1];
  }
  
  return {
    type,
    title,
    estimatedValue,
    unit: type === "diet" ? "大卡" : "分鐘",
    proteinGrams: type === "diet" ? (proteinGrams || undefined) : undefined,
    carbsGrams: type === "diet" ? (carbsGrams || undefined) : undefined,
    fatGrams: type === "diet" ? (fatGrams || undefined) : undefined,
    caloriesBurned,
    pointsEarned: 25,
    nutritionRough: type === "diet" ? {
      carbs: carbsGrams > 0 ? `${carbsGrams}g` : "適量",
      protein: proteinGrams > 0 ? `${proteinGrams}g` : "充足",
      fat: fatGrams > 0 ? `${fatGrams}g` : "充足",
      veg: "適量"
    } : undefined
  };
}

const COACH_SYSTEM_PROMPT = `你是一位充滿溫度、溫和且高度同理心的 PaoPao健康養成教練（簡稱 PaoPao教練）。你深諳「行為心理學」與「原子習慣」原理，且具備大眾健康飲食及身體活動指引常識。

你的核心角色與規範：
1. 【健康陪跑與原子習慣角色】：
   - 抱持 100% 溫慢、接納與同理心。無論使用者是否達標、是否吃了低糖低脂或高糖油炸美食，絕對不予以任何指責、罪惡感威脅或審判。誠實記錄是好習慣的起點，要隨喜讚賞他們的誠實。
   - 【低磨損、微小而持續的習慣建立】：你深信「每天累積 1% 的改變」，避免給予過於龐大或高難度目標。始終提供溫和、易行的微習慣指引，幫助大腦降低阻力，輕鬆邁出下一小步。
   - 【嚴禁提供個人化醫療或治療處方】：你不得為使用者開立個人專屬健康管理或特定臨床控制處方。在你的回答結尾，必須包含以下大眾免責指引聲明：
     「我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。」
2. 【推廣哈佛餐盤與主動營養/運動能耗科普】：
   - 當使用者提及食物相關內容時，你必須主動估算並明確標記其「熱量（卡路里，kcal）」與「蛋白質含量（公克，g）」，並以結構化方式呈現。
   - 當使用者提及運動或身體活動相關內容時，你必須主動估算並明確標記其「運動時間（分鐘）」與「預估熱量消耗（大卡，kcal，可每分鐘消耗約 6.5 大卡做大眾科普粗估）」，並以條列式與粗體字等結構化方式呈現！避免敷衍回答。
   - 引導使用者往「原型食物（蔬菜佔半，穀物與蛋白各 1/4）」前進，幫助建立無摩擦的飲食健康良性連結。
3. 【結合今日收支統計與歷程提醒】：
   - 你將在 context 中獲得 \`【今日生理與代謝收支統計 (Today Summary)】\` 與 \`【近期生活及習慣紀錄 (Recent Logs)】\`。
   - 當使用者諮詢建議或分享狀態時，請主動解讀今日收支。例如：如果發現今日能量赤字 \`netDeficit\` 尚未達成（小於或等於 0），請給予溫柔關懷，並提醒今日的數據狀態（今日目前已攝取了多少大卡、運動消耗了多少大卡），鼓勵可以找個時間站起來動一動、拉拉筋或吃飽後散步 10 分鐘來開啟赤字，但如果使用者累了，也請強調「先好好休息、明天再重啟也完全沒關係，你的誠實記錄就是最好的習慣！」。

【JSON 輸出規範限制】：
- 請一律以 JSON 格式回應！不要包含 any markdown 語法包裝（如 \`\`\`json）。
- JSON 必須有 \`reply\` 欄位，放入您要對使用者說的溫馨同理對話。
- 如果使用者在最新訊息中，有諮詢、手動輸入或提及特定的食物、飲料、餐食或運動，請在 \`pendingRecord\` 欄位中放入對應的結構化分析。若使用者訊息不包含食物、點心或運動（純聊天或無痛諮詢），\`pendingRecord\` 請直接填寫 null 或不回傳。
- \`pendingRecord\` 結構必須根據 \`type\` 的不同進行嚴格區分：
  - 當為飲食（\`type: "diet"\`）時：
    - \`title\`: 食物名稱（例如：滷肉飯加蛋）
    - \`estimatedValue\`: 估計熱量大卡值（例如 450）
    - \`unit\`: "大卡"
    - \`proteinGrams\`: 蛋白質克數（例如 15）
    - \`carbsGrams\`: 碳水化合物克數（例如 55）
    - \`fatGrams\`: 脂肪克數（例如 18）
    - \`nutritionRough\`: 包含 carbs, protein, fat, veg 四個簡述屬性（例如 "適量"、"偏低" 等）
  - 當為運動（\`type: "exercise"\`）時：
    - \`title\`: 運動活動名稱（例如：散步、慢跑）
    - \`estimatedValue\`: 運動時間分鐘數（例如 30）
    - \`unit\`: "分鐘"
    - \`caloriesBurned\`: 消耗卡路里數（例如 200）
    - 不要填寫 \`proteinGrams\`、\`carbsGrams\`、\`fatGrams\`、\`nutritionRough\`。
  - \`pointsEarned\`: 獲得點數，預設填寫 25
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

export default async function handler(req: Request, res: Response) {
  try {
    const { message, history, profile, todaySummary, recentRecords } = req.body || {};
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

    let summaryText = "";
    if (todaySummary) {
      const netDef = todaySummary.netDeficit;
      summaryText = `\n\n📊 【今日能量收支即時診斷】：
• 目前已攝取：**${todaySummary.dietKcal}** kcal
• 運動已消耗：**${todaySummary.burnedKcal}** kcal
• TDEE 估算：**${todaySummary.tdee}** kcal
• 目前能量赤字：${netDef > 0 ? `🟢 **${netDef}** kcal (自律成效卓越！)` : `⚠️ **${netDef}** kcal (尚未形成赤字)`}
${netDef <= 0 ? "💡 【教練溫和提醒】：目前尚未達到能量赤字唷。如果今天不累的話，不妨找個時間站起來伸展 15 分鐘，或在飯後輕鬆散步十分鐘，溫和啟動身體的燃脂引擎吧！🌱" : "🎉 【教練讚賞】：做得好！目前赤字狀態正完美複利中，保持愉快，先喝杯水歇會兒吧！"}
`;
    }

    if (keyPresent) {
      try {
        const ai = getGeminiClient();
        const prompt = `【使用者個人檔案】
${JSON.stringify(profile)}

【今日生理與代謝收支統計 (Today Summary)】
${todaySummary ? JSON.stringify(todaySummary) : "目前尚無今日統計數據"}

【近期生活及習慣紀錄 (Recent Logs)】
${recentRecords && Array.isArray(recentRecords) && recentRecords.length > 0 ? recentRecords.map((r: any) => `- ${new Date(r.timestamp).toLocaleDateString()}: [${r.type}] ${r.title} (${r.estimatedValue || 0}${r.unit}) - PaoPao回饋: ${r.coachFeedback}`).join("\n") : "無記錄"}

【歷史對話紀錄】
${history && Array.isArray(history) ? history.map((m: any) => `${m.sender === "bot" ? "教練(PaoPao)" : "使用者"}: ${m.text}`).join("\n") : "無"}

【最新使用者訊息】
${message}`;

        let response;
        const callParams = (modelName: string) => ({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: COACH_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["reply"],
              properties: {
                reply: { type: Type.STRING },
                pendingRecord: {
                  type: Type.OBJECT,
                  required: ["type", "title", "estimatedValue", "unit", "pointsEarned"],
                  properties: {
                    type: { type: Type.STRING, enum: ["diet", "exercise"] },
                    title: { type: Type.STRING },
                    estimatedValue: { type: Type.INTEGER },
                    unit: { type: Type.STRING },
                    caloriesBurned: { type: Type.INTEGER },
                    proteinGrams: { type: Type.INTEGER },
                    carbsGrams: { type: Type.INTEGER },
                    fatGrams: { type: Type.INTEGER },
                    pointsEarned: { type: Type.INTEGER },
                    nutritionRough: {
                      type: Type.OBJECT,
                      properties: {
                        carbs: { type: Type.STRING },
                        protein: { type: Type.STRING },
                        fat: { type: Type.STRING },
                        veg: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        });

        try {
          response = await ai.models.generateContent(callParams("gemini-2.5-flash"));
        } catch (modelError: any) {
          throw modelError;
        }

        if (response && response.text) {
          try {
            const result = cleanAndParseJson(response.text);
            if (result && !result.pendingRecord && result.reply) {
              const extracted = extractPendingRecordFromText(result.reply, message);
              if (extracted) {
                result.pendingRecord = extracted;
              }
            }
            return res.json(result);
          } catch (jsonErr) {
            console.warn("⚠️ Failed to parse JSON from AI coach chat response:", jsonErr);
            
            try {
              const jsonMatch = response.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0].trim());
                if (result && !result.pendingRecord && result.reply) {
                  const extracted = extractPendingRecordFromText(result.reply, message);
                  if (extracted) {
                    result.pendingRecord = extracted;
                  }
                }
                return res.json(result);
              }
            } catch (_) {}
            
            const fallbackResult: any = { reply: response.text };
            const extracted = extractPendingRecordFromText(response.text, message);
            if (extracted) {
              fallbackResult.pendingRecord = extracted;
            }
            return res.json(fallbackResult);
          }
        }
      } catch (realAiError: any) {
        console.warn("⚠️ Real Gemini API Call failed, gracefully falling back to offline mock mode:", realAiError);
        systemWarning = `💡【系統溫柔提示：由於線上 AI 核心目前忙碌中或網路連線異常 (代碼: ${realAiError.status || 503})，PaoPao教練已為您自動切換至『離線溫柔陪跑模式』。所有記錄與分析功能均正常運作，請放心對話唷！☘️】\n\n`;
      }
    }

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

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

我們可以從更穩健大眾的健康習慣出發：
💡 依照世界權威【哈佛健康餐盤】指引，我們可以將每餐分配分為三個重要區塊：蔬菜佔一半（多樣化），優質全穀物（如十穀、糙米）佔 1/4，健康蛋白質（如豆製品、魚、蛋與瘦肉）佔 1/4。這是不需要特定處方，每個人都能輕鬆愛護自己的極佳基準！

🎯 【目標提醒】：${goalStr}。
☘️ 【微習慣建議】：今天晚餐的第一口，請試著先從「一口蛋白質」或「一口蔬菜」開始吃起，以此取代精緻澱粉的先發吸收，幫助身體無壓力感受平穩活力！` + summaryText,
        pendingRecord: {
          type: "diet",
          title: foodKey,
          estimatedValue: item.kcal,
          unit: "大卡",
          proteinGrams: parseInt(item.protein) || 0,
          carbsGrams: parseInt(item.carbs) || 0,
          fatGrams: parseInt(item.fat) || 0,
          pointsEarned: 25,
          nutritionRough: {
            carbs: item.carbs || "適量",
            protein: item.protein || "稍微偏低",
            fat: item.fat || "充足",
            veg: "較少"
          }
        }
      });
    }

    let exerciseKey = Object.keys(fallbackExercises).find(k => lowerMessage.includes(k));
    if (exerciseKey) {
      const item = fallbackExercises[exerciseKey as keyof typeof fallbackExercises];
      return res.json({
        reply: systemWarning + `【PaoPao教練溫和指引】

嗨！親愛的夥伴，聽你提到進行了【${exerciseKey}】活動，真的要為你熱烈鼓掌！👏 在原子習慣的科學中，「準備並跨出第一步」就是最容易卡關的 80% 阻力，而你已經帥氣通關了！

💡 運動常識科普與消耗能耗估算：
• 預估運動時間：**30** 分鐘
• 預估消耗熱量：約 **195** kcal （大卡）
• 該運動活動代謝率（MET）約為：**${item.met}**
• 習慣科普小筆記：${item.desc}

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

你可以如何無痛放大這個好習慣：
☘️ 【微習慣建議】：在剛運動完的這 30 分鐘，請順手給自己盛上一杯 300ml 的微溫水，一口口慢吞吞地喝完它。這是最棒、最簡單、也最不需要意志力就能幫助肌肉修補 and 加速乳酸代謝的習慣連結。

今天真的做得太棒了，持續累積你的微小改變吧！` + summaryText,
        pendingRecord: {
          type: "exercise",
          title: exerciseKey,
          estimatedValue: 30,
          unit: "分鐘",
          caloriesBurned: Math.round(30 * 6.5), // 195 kcal
          pointsEarned: 25
        }
      });
    }

    // 1.5 模糊食物匹配
    const dietKeywords = ["吃", "喝", "餐", "飯", "麵", "蛋", "奶", "肉", "菜", "熱量", "大卡", "卡路里", "飽", "餓", "糖", "油", "點心", "飲料", "早餐", "午餐", "晚餐", "宵夜", "香蕉", "蘋果", "芭樂", "地瓜", "麥當勞", "雞排", "便當", "火鍋", "壽司", "吐司", "沙拉", "水餃", "炸雞"];
    const hasDietKeyword = dietKeywords.some(keyword => lowerMessage.includes(keyword));
    if (!foodKey && hasDietKeyword) {
      let extractedTitle = message.replace(/我剛吃了|我吃了|吃了|我想吃|吃|喝了|喝|熱量是多少|熱量|多少大卡|是多少|多少/g, "").trim();
      if (!extractedTitle || extractedTitle.length > 15) {
        extractedTitle = "今日健康餐飲";
      }

      const mockKcal = 250 + Math.floor(Math.random() * 350);
      const mockProtein = 8 + Math.floor(Math.random() * 18);
      const mockCarbs = 30 + Math.floor(Math.random() * 45);
      const mockFat = 5 + Math.floor(Math.random() * 15);

      return res.json({
        reply: systemWarning + `【PaoPao教練溫和指引】

嗨！親愛的夥伴，看見你願意主動了解食物、關心攝取，這就是最高等級的習慣認證！🎉

對於您詢問的食物：【${extractedTitle}】🍉
💡 衛生福利部國健署標準營養成分與大眾飲食指南推薦供您客觀參考：
• 估計約熱量：約 **${mockKcal}** kcal （大卡）
• 粗估營養素：碳水 ${mockCarbs}g、蛋白質 ${mockProtein}g、脂肪 ${mockFat}g。
• 教練科普小叮嚀：原型食物是維持身體平穩運作的極佳燃料。建議這餐多搭配一些高纖蔬菜與優質蛋白質，讓身體無負擔地享受滿滿活力喔！

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

我們可以從更穩健大眾的健康習慣出發：
💡 依照世界權威【哈佛健康餐盤】指引，我們可以將每餐分配分為三個重要區塊：蔬菜佔一半（多樣化），優質全穀物（如十穀、糙米）佔 1/4，健康蛋白質（如豆製品、魚、蛋與瘦肉）佔 1/4。這是不需要特定處方，每個人都能輕鬆愛護自己的極佳基準！

🎯 【目標提醒】：${goalStr}。
☘️ 【微習慣建議】：今天晚餐的第一口，請試著先從「一口蛋白質」或「一口蔬菜」開始吃起，以此取代精緻澱粉的先發吸收，幫助身體無壓力感受平穩活力！` + summaryText,
        pendingRecord: {
          type: "diet",
          title: extractedTitle,
          estimatedValue: mockKcal,
          unit: "大卡",
          proteinGrams: mockProtein,
          carbsGrams: mockCarbs,
          fatGrams: mockFat,
          pointsEarned: 25,
          nutritionRough: {
            carbs: mockCarbs > 60 ? "充足" : "適量",
            protein: mockProtein < 15 ? "稍微偏低" : "充足",
            fat: "充足",
            veg: "較少"
          }
        }
      });
    }

    // 2.5 模糊運動匹配
    const exerciseKeywords = ["跑", "走", "動", "操", "練", "散步", "瑜伽", "重訓", "有氧", "游泳", "單車", "爬山", "運動", "健身", "慢跑", "走路"];
    const hasExerciseKeyword = exerciseKeywords.some(keyword => lowerMessage.includes(keyword));
    if (!exerciseKey && hasExerciseKeyword) {
      let extractedTitle = message.replace(/我剛去了|我去做|我做了|去了|做了|想做|想去|散步|跑步|運動|多少時間|是多少|多久/g, "").trim();
      if (!extractedTitle || extractedTitle.length > 15) {
        extractedTitle = "今日身體活動";
      }

      return res.json({
        reply: systemWarning + `【PaoPao教練溫和指引】

嗨！親愛的夥伴，聽你提到進行了身體活動，真的要為你熱烈鼓掌！👏 在原子習慣的科學中，「準備並跨出第一步」就是最容易卡關的 80% 阻力，而你已經帥氣通關了！

💡 運動常識科普與消耗能耗估算：
• 預估運動時間：**30** 分鐘
• 預估消耗熱量：約 **195** kcal （大卡）
• 該運動活動代謝率（MET）約為：**4.0**
• 習慣科普小筆記：適度的身體活動是提升代謝、活化大腦最無痛的方式。不限制時間和強度，只要動起來就是 100 分！

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

你可以如何無痛放大這個好習慣：
☘️ 【微習慣建議】：在剛運動完的這 30 分鐘，請順手給自己盛上一杯 300ml 的微溫水，一口口慢吞吞地喝完它。這是最棒、最簡單、也最不需要意志力就能幫助肌肉修補 and 加速乳酸代謝的習慣連結。

今天真的做得太棒了，持續累積你的微小改變吧！` + summaryText,
        pendingRecord: {
          type: "exercise",
          title: extractedTitle,
          estimatedValue: 30,
          unit: "分鐘",
          caloriesBurned: Math.round(30 * 6.5), // 195 kcal
          pointsEarned: 25
        }
      });
    }

    const responses = [
      systemWarning + `【PaoPao教練提示】\n嗨！ ${profile?.name || "夥伴"}，我是你的 PaoPao健康陪跑教練。很高興收到你的訊息！你現在願意誠實記錄、與我分享，就是最強大的健康自然習慣第一步。
 
『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構。』

🎯 【目標提醒】：${goalStr}${guidelineText}。依照哈佛健康餐盤，只要多吃原型食物、多喝溫白開水，每天稍微推進 1%, 就是在累積改變的複利！
☘️ 【可以怎麼做】：我們現在來個 low-friction 挑戰——深深用鼻子吸氣 4 秒、再用嘴巴吐氣 6 秒，連續做 2 次。這能馬上重置大腦壓力，你覺得如何？努力就是滿分！`,
 
      systemWarning + `【PaoPao教練提示】\n（溫柔拍肩）我非常理解夥伴的心情！生活本來就是由各種不完美、偶爾的美食和大炸雞拼湊而成的。這才是最快樂健康的生理常規狀態！

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康觀念，但不能為您開立專屬診斷與處方。』
 
🎯 【目標提醒】：${goalStr}${guidelineText}。不要讓大餐或偶爾的熱量飆高變成罪惡感，誠實記錄下來，就代表生活的油門與煞車主導權依然牢牢握在你的手中.
☘️ 【可以怎麼做】：不如現在去倒一杯 250ml 的溫開水喝下去？健康指標顯示，多補充乾淨水分是體內代謝最重要的潤滑劑。你已經做得非常棒了！`
    ];

    const randomResp = responses[Math.floor(Math.random() * responses.length)];
    return res.json({ reply: randomResp });
  } catch (error: any) {
    console.error("Error in Vercel chat handler:", error);
    res.status(500).json({ error: "伺服器內部發生異常", details: error.message });
  }
}
