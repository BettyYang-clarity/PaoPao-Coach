/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { GOALS_DATA } from "./src/data/habitsData";
import { getActionableGuide } from "./src/data/actionableGuides";

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for uploading food images in base64 format
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Lazy initializer for Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not set. The coach features will run in mock mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
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
const COACH_SYSTEM_PROMPT = `
you're PaoPao教練, a warm, high-EQ coach. 你是一位充滿溫度、溫和且高度同理心的 PaoPao教練。你深諳「行為心理學」與「原子習慣」原理，且具備大眾健康飲食及身體活動指引常識。

你的核心角色與規範：
1. 【健康陪跑與原子習慣角色】：
   - 抱持 100% 溫暖、接納與同理心。無論使用者是否達標、是否吃了高糖油炸美食，絕對不予以任何指責、罪惡感威脅或審判。誠實記錄是好習慣的起點，要隨喜讚賞他們的誠實。
   - 【嚴禁提供個人化治療處方】：你不得為使用者進行臨床醫療診斷、不得提供任何個別的「個人化臨床飲食治療方案或特定配方飲食」。
   - 當使用者詢問個人特定疾病菜單、診斷、或要求專屬減脂餐時，必須先謙和發出聲明：
     『我是您的健康陪跑夥伴 PaoPao教練，我可以提供您大眾健康與營養常識科普引導，但不能提供專屬醫療診斷與個人化臨床治療處方。如有特定疾病、特殊控制需求，請務必諮詢執業醫師、實體營養師等專業醫療團隊。』
   - 【日常健康科普指引】：引導並鼓勵使用者維持均衡且低油、低鹽、低糖、高纖維的天然飲食原則。

2. 【食物檢索與營養估值功能（新加入）】：
   - 當使用者的對話中主動提到了特定的食物名稱（例如：「我想吃香蕉」、「剛剛吃了滷肉飯」、「珍珠奶茶多少卡」、「牛排」等，或發送食物／運動照片）。此外，也提供與健康運動相關、同理心滿滿的回答。
`;

// System instruction for Image Analyzer
const IMAGE_ANALYZER_PROMPT = `
you're PaoPao教練, a warm, high-EQ image analyzer. 你是一位專門分析健康飲食和活動照片的 AI 專家。
請根據使用者上傳的照片，判斷並回傳符合規範的 JSON 物件。不要輸出任何 Markdown 或是 json 外的文字。

特別注意：
1. 分析這張照片是食物/飲食還是身體活動/運動項目：
   - 如果是食物：將 type 設為 "diet"，估算其約略卡路里 (卡路里 kcal 值，為整數，填入 estimatedValue)，unit 設為 "大卡"。並粗估三大營養質與膳食纖維狀態。填入 nutritionRough 結構中。
   - 如果是運動或活動：將 type 設為 "exercise"，估算合適的建議時間（分鐘值，填入 estimatedValue），unit 設為 "分鐘"。
2. 計算 pointsEarned：不論使用者上傳什麼照片，只要誠實記錄就給予點數獎勵（通常為 25 點）。
3. 撰寫 coachFeedback：
   - 發揮 PaoPao 教練溫慢、接納且毫無批判的暖心口氣，用引人共鳴的原子習慣科學原理解釋：此照片代表的健康認同感。
   - 根據照片內容，給予一個極具體、低門檻且磨損率超低的「微型健康任務」。
   - 【嚴禁開立醫療處方及特定診斷】：必須於 coachFeedback 尾聲包含以下免責聲明：『⚠️ 貼心提醒：本數據為官方食品營養庫/運動代謝能耗及文獻大眾標準平均估值，實際熱量會因料理及個人心率體脂率而異。教練提供科普建議，不具臨床診斷 or 個人化治療處方之效力。如有特定疾病、特殊控制需求，請務必諮詢執業醫師、實體營養師等專業醫療團隊喔！』
`;

const fallbackFoods: Record<string, { kcal: number; protein: string; carbs: string; fat: string; desc: string }> = {
  香蕉: {
    kcal: 90,
    protein: "1.1g",
    carbs: "23g",
    fat: "0.3g",
    desc: "香蕉富含鉀離子與膳食纖維，能量補充快速，是運動前後的絕佳好夥伴！"
  },
  滷肉飯: {
    kcal: 650,
    protein: "18g",
    carbs: "85g",
    fat: "25g",
    desc: "滷肉飯美味飽足，唯脂肪量與精緻澱粉較高，建議搭配一盤燙青菜與滷蛋平衡營養喔！"
  },
  珍珠奶茶: {
    kcal: 550,
    protein: "5g",
    carbs: "90g",
    fat: "20g",
    desc: "珍奶含有較高精緻糖及油脂，建議偶爾當作生活小確幸，平常以無糖茶或低脂鮮奶替代更佳！"
  },
  牛排: {
    kcal: 400,
    protein: "35g",
    carbs: "0g",
    fat: "28g",
    desc: "牛排富含豐富的優質蛋白質與鐵質，對增肌與造血很有幫助，儘量選擇少油煎或烤的方式。"
  },
  蘋果: {
    kcal: 60,
    protein: "0.3g",
    carbs: "15g",
    fat: "0.2g",
    desc: "一天一蘋果，醫生遠離我！蘋果富含果膠與維生素C，能增強飽足感並幫助腸道健康。"
  },
  大乾麵: {
    kcal: 600,
    protein: "12g",
    carbs: "80g",
    fat: "24g",
    desc: "乾麵常伴隨較高油脂與鈉量的醬汁，可以多請店家少油、多加一份燙青菜以補充纖維質！"
  },
  雞排: {
    kcal: 650,
    protein: "30g",
    carbs: "40g",
    fat: "35g",
    desc: "炸雞排的裹粉與高溫油炸會大幅增加油脂，建議去皮食用，或者偶爾享用就好囉！"
  }
};

const fallbackExercises: Record<string, { met: number; desc: string }> = {
  跑: {
    met: 8.0,
    desc: "慢跑能有效提升心肺耐力與全身新陳代謝，配合國健署指引，維持中度活動強度，微汗即可！"
  },
  羽球: {
    met: 5.5,
    desc: "羽毛球是絕佳的全身性間歇運動，考驗敏捷度與心肺，記得多做熱身，保護膝蓋與手腕！"
  },
  重訓: {
    met: 6.0,
    desc: "阻力訓練與重訓能增加肌肉量、提升基礎代謝率，是原子習慣中持久燃脂與強健骨骼的基石。"
  },
  散步: {
    met: 3.5,
    desc: "步行是最棒且磨損極低的日常習慣。哪怕每天只走 10 分鐘，都能有效啟動心血管活力！"
  },
  騎車: {
    met: 4.0,
    desc: "騎自行車是友善關節的低衝擊有氧運動，也是低阻力融入日常活動通勤的極佳微習慣。"
  },
  瑜伽: {
    met: 2.5,
    desc: "瑜伽能夠拉伸肌肉、提升柔軟度並釋放身心壓力，配合深長呼吸，幫助重新找回身體掌控權。"
  }
};

// 1. Unified High-EQ Chatbot Endpoint with PaoPao branding
app.post("/api/coach/chat", async (req, res) => {
  try {
    const { message, history, profile } = req.body;
    const lowerMessage = (message || "").toLowerCase();

    // Dynamically retrieve profile settings
    let goalStr = "建立完美的原子習慣";
    if (profile?.customGoal) {
      goalStr = `「${profile.customGoal}」`;
    }

    let guidelineText = "";
    if (profile?.selectedGuidelines && profile.selectedGuidelines.length > 0) {
      guidelineText = `，積極守護承諾微習慣方針【${profile.selectedGuidelines.map((item: any) => item.habitName).join("、")}】`;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyPresent = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MOCK_KEY" && apiKey !== "undefined" && apiKey !== "";

    if (isKeyPresent) {
      try {
        const ai = getGeminiClient();
        const prompt = `【使用者個人檔案】
${JSON.stringify(profile)}

【歷史對話紀錄】
${history && Array.isArray(history) ? history.map((m: any) => `${m.sender === "bot" ? "教練(PaoPao)" : "使用者"}: ${m.text}`).join("\n") : "無"}

【最新使用者訊息】
${message}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: COACH_SYSTEM_PROMPT
          }
        });

        if (response && response.text) {
          return res.json({ reply: response.text });
        }
      } catch (realAiError: any) {
        console.error("⚠️ Real Gemini API Call failed, falling back to High-EQ mock engine:", realAiError);
      }
    }

    // --- FALLBACK MOCK ENGINE ---
    // 1. Check for diet matches
    let foodKey = Object.keys(fallbackFoods).find(k => lowerMessage.includes(k));
    if (foodKey) {
      const item = fallbackFoods[foodKey];
      return res.json({
        reply: `【PaoPao教練溫和指引】

嗨！親愛的夥伴，看見你願意主動了解食物、關心攝取，這就是最高等級的習慣認證！🎉

對於您詢問的食物：【${foodKey}】🍉
💡 衛生福利部國健署標準營養成分與大眾飲食指南推薦供您客觀參考：
• 估計約熱量：約 **${item.kcal}** kcal （大卡）
• 估計蛋白質：約 **${item.protein}**
• 估計碳水化合物：約 **${item.carbs}**
• 估計脂肪：約 **${item.fat}**
• 🥗 貼心提醒小叮嚀：${item.desc}
並依照世界權威【哈佛健康飲食盤】指引，鼓勵您多以原型食物為主，餐盤安排把握『多蔬菜、多全穀、優蛋白質』原則！

⚠️ 專業免責聲明：
我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康與營養常識科普引導，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。
⚠️ 貼心提醒：本數據為官方食品庫及文獻之大眾標準平均估值，實際會因烹調、油量與精確份量而有所不同。

🎯 【個人目標對聯方式】：${goalStr}${guidelineText}！
☘️ 【今日低阻力任務】：我們這餐多喝一杯 100ml 溫白開水，陪伴你的代謝系統溫和前進！`
      });
    }

    // 2. Check for exercise matches
    let exerciseKey = Object.keys(fallbackExercises).find(k => lowerMessage.includes(k));
    if (exerciseKey) {
      const item = fallbackExercises[exerciseKey];
      const sampleMins = 30;
      const burnVal = Math.round(item.met * 65 * (sampleMins / 60));
      return res.json({
        reply: `【PaoPao教練運動指導】

哇！看見你帶著滿滿行動力與我分享你的身體活動，教練的心情都亮了起來！☀️

對於您詢問的運動：【${exerciseKey}】🏃‍♀️
🏃‍♂️ 國健署與國際運動學會標準運動能耗與身體活動指南參考：
• 代謝當量 (METs)：約 **${item.met}**
• ⏳ 安排以標準 65kg 成人進行 **${sampleMins} 分鐘** 估算：
  約能消耗：約 **${burnVal}** kcal （大卡）
• ☘️ 官方常規指引：${item.desc}
國健署推薦，成人每週可累計 150 分鐘以上中度身體活動（微汗且能說話）。但別給自己太大壓力，在原子習慣中，哪怕只有在原地抬腿、或散步 20 秒，大腦的神經迴路就已經認證了健康的身份認同！

⚠️ 專業免責聲明：
我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬診斷與運動醫療處方。如有身體特殊不適，請遵循相關醫療專業團隊。
⚠️ 貼心提醒：此運動消耗與代謝能耗為官方平均活動強度參考值，實際耗能會因個人體脂率、心率狀態及肌肉量多寡而有所差異。

🎯 【個人目標對聯方式】：${goalStr}${guidelineText}。
☘️ 【今日低阻力任務】：拉伸肩膀轉動 15 秒鐘，深沉呼吸，這就是最好的自我愛護動作囉！`
      });
    }

    // 3. Fallback check for "營養師" or "菜單" or "處方" specifically
    if (lowerMessage.includes("營養") || lowerMessage.includes("配方") || lowerMessage.includes("診斷") || lowerMessage.includes("糖尿病") || lowerMessage.includes("生病") || lowerMessage.includes("疾病") || lowerMessage.includes("菜單") || lowerMessage.includes("處方") || lowerMessage.includes("營養師")) {
      return res.json({
        reply: `【PaoPao教練溫和提醒】

嗨！夥伴，關於您諮詢的內容，我想要先與您說明教練的角色宗旨：

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構唷。』

我們可以從更穩健大眾的健康習慣出發：
💡 依照世界權威【哈佛健康餐盤】指引，我們可以將每餐分配分為三個重要區塊：蔬菜佔一半（多樣化），優質全穀物（如十穀、糙米）佔 1/4，健康蛋白質（如豆製品、魚、蛋與瘦肉）佔 1/4。這是不需要特定處方，每個人都能輕鬆愛護自己的極佳基準！

🎯 【目標提醒】：${goalStr}。
☘️ 【微習慣建議】：今天晚餐的第一口，請試著先從「一口蛋白質」或「一口蔬菜」開始吃起，以此取代精緻澱粉的先發吸收，幫助身體無壓力感受平穩活力！`
      });
    }

    const responses = [
      `【PaoPao教練提示】\n嗨！ ${profile?.name || "夥伴"}，我是你的 PaoPao健康陪跑教練。很高興收到你的訊息！你現在願意誠實記錄、與我分享，就是最強大的健康自然習慣第一步。
 
『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化臨床飲食處方。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構。』

🎯 【目標提醒】：${goalStr}${guidelineText}。依照哈佛健康餐盤，只要多吃原型食物、多喝溫白開水，每天稍微推進 1%, 就是在累積改變的複利！
☘️ 【可以怎麼做】：我們現在來個低磨損挑戰——深深用鼻子吸氣 4 秒、再用嘴巴吐氣 6 秒，連續做 2 次。這能馬上重置大腦壓力，你覺得如何？努力就是滿分！`,
 
      `【PaoPao教練提示】\n（溫柔拍肩）我非常理解夥伴的心情！生活本來就是由各種不完美、偶爾的美食和大炸雞拼湊而成的。這才是最快樂健康的生理常規狀態！

『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康觀念，但不能為您開立專屬診斷與處方。』
 
🎯 【目標提醒】：${goalStr}${guidelineText}。不要讓大餐或偶爾的熱量飆高變成罪惡感，誠實記錄下來，就代表生活的油門與煞車主導權依然牢牢握在你的手中。
☘️ 【可以怎麼做】：不如現在去倒一杯 250ml 的溫開水喝下去？健康指標顯示，多補充乾淨水分是體內代謝最重要的潤滑劑。你已經做得非常棒了！`
    ];

    const randomResp = responses[Math.floor(Math.random() * responses.length)];
    return res.json({ reply: randomResp });
  } catch (error: any) {
    console.error("Error in /api/coach/chat:", error);
    res.status(500).json({ error: "教練現在有點累，請稍後再試！" });
  }
});

// 2. High-EQ Image Analyzer Endpoint
app.post("/api/coach/analyze-image", async (req, res) => {
  try {
    const { image, profile } = req.body;
    if (!image) {
      return res.status(400).json({ error: "請提供圖片資料" });
    }

    const ai = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "MOCK_KEY") {
      // Mock fallback response
      const isExercise = image.includes("exercise") || Math.random() > 0.5;
      if (isExercise) {
        return res.json({
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
        });
      } else {
        return res.json({
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
        });
      }
    }

    // Call real Gemini model with image data
    const part = base64ToPart(image, "image/jpeg");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        part,
        { text: `使用者個人檔案: ${JSON.stringify(profile)}。請根據圖片分析，回傳 JSON 格式。` }
      ],
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

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Error in /api/coach/analyze-image:", error);
    res.status(500).json({ error: "分析圖片時發生錯誤。" });
  }
});

// 3. Simulated/Dynamic Personalized Micro-Habits Recommender strictly synchronized with profile selectedHabits
app.post("/api/coach/suggest-tasks", async (req, res) => {
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
});

// -------------------------------------------------------------
// VITE DEV SERVER AND PRODUCTION SERVING MIDDLEWARE
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 AI健康陪跑教練伺服器啟動，連接埠: ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
