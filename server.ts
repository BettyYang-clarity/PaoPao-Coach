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
你是一位充滿專業感、有溫度、高度同理心、且深諳「行為心理學」與「原子習慣」原理的 AI 健康陪跑專業教練。

你的核心任務是：
1. 【100% 同理與誠實支持】：看見使用者的現狀與情緒，無論他們是否達標、是否吃了高熱量食物，皆給予完全接納、不含任何審判的深切同理。
2. 【專業教練特質 (Coach Persona)】：保持積極、激勵人、方向明確、且具有建設性的專業教練姿態。你不僅提供溫暖支持，還要給予專業指引與健康意識啟發。
3. 【主動提醒個人目標】：請積極讀取傳入的使用者資訊（特別是 profile 裡面的 customGoal「個人健康主題計劃目標」、dailyCalorieTarget、dailyWaterTarget、weightGoal、selectedGuidelines「客製化微習慣方針項目」等），在每次對話回饋中，適時且溫馨地「扣回並溫和提醒」他們當前設定的個人健康主要目標與自主選擇的幾項行動承諾，幫助他們不忘初心，建立健康認同。
4. 【具體行動指南（可以怎麼做）】：在肯定與目標連結後，根據使用者的情況，給出 1 個好起步且摩擦力極低的微型行動指引（micro-step），協助使用者無負擔地累積微習慣。
`;

// System instruction for Image Analyzer
const IMAGE_ANALYZER_PROMPT = `
你是一位專門進行健康管理與原子習慣分析的 AI 陪跑專家。
請仔細分析使用者上傳的飲食（食物、飲料）或運動（跳繩、散步、重訓、運動器材等）照片。
特別注意：
1. 請以極高同理心、有溫度、完全隨喜、絕不審判的教練姿態肯定使用者的誠實記錄。
2. 計算其點數：一律給予 25 點（這是不完美也給滿分的激勵制度）。
3. 估算數值：
   - 飲食照片：估算大致熱量（大卡），並在 nutritionRough 中回傳碳水(carbs)、蛋白質(protein)、脂肪(fat)、蔬菜(veg) 的簡短描述（例如 "適量"、"偏少，可加入優質蛋/大豆"、"蔬菜多嚼20秒超棒"）。
   - 運動照片：估算大致時間（分鐘），不提供熱量值。
4. 提供一個呼應其照片、完全貼合「原子微習慣」理論的下一個極低磨損物理微行動建議（例如：喝杯 300ml 溫水、在客廳走動 10 秒）。
`;

// 1. High-EQ Coach Chat Endpoint
app.post("/api/coach/chat", async (req, res) => {
  try {
    const { message, history, profile } = req.body;

    const ai = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    // Graceful fallback for local/missing key scenario
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "MOCK_KEY") {
      const goalStr = profile?.customGoal ? `配合你的主題計劃「${profile.customGoal}」` : "踏上個人健康微習慣道路";
      const selectedGoals = profile?.selectedGoals || ["weight_loss", "general_health"];
      const activeGoals = GOALS_DATA.filter(g => selectedGoals.includes(g.id));
      
      const guidelineText = activeGoals.length > 0
        ? `\n🌻 【這階段您承諾的客製實踐大目標】：\n${activeGoals.map(g => `  • 🎯 ${g.name} (核心：${g.corePrinciple})`).join("\n")}`
        : "";

      const responses = [
        `【陪跑教練提示】\n嗨！ ${profile?.name || "夥伴"}，我是你的專屬健康陪跑教練。很高興收到你的訊息！你現在願意誠實記錄、與我分享，就是最強大的健康習慣第一步。
 
🎯 【目標提醒】：${goalStr}${guidelineText}。只要每天稍微推進 1%，就是在累積改變的複利！
☘️ 【可以怎麼做】：我們現在來個低磨損挑戰——深深用鼻子吸氣 4 秒、再用嘴巴吐氣 6 秒，連續做 2 次。這能馬上重置大腦壓力，你覺得如何？努力就是滿分！`,
 
        `【陪跑教練提示】\n哈哈，我非常理解夥伴的心情！生活本來就是由各種不完美、美食和大餐拼湊而成的。這才是真實而活潑的生理狀態！
 
🎯 【目標提醒】：${goalStr}${guidelineText}。不要讓大餐或偶爾的怠惰變成罪惡感，記錄下來就代表主導權在你手中。
☘️ 【可以怎麼做】：不如今天多喝一杯 300ml 的微溫開水？讓水分進去幫助體內的新陳代謝做個舒服的溫和循環。你已經做得超棒了！`,
 
        `【陪跑教練提示】\n（溫柔拍肩）聽到你這麼說，我深切懂得那種精疲力竭的感覺。累了、想靠沙發、想偷懶、甚至想喝糖分，都是大腦與身體在發出「需要修復」的真實訊號，完全不需要責備自己！
 
🎯 【目標提醒】：配合你的健康計劃，偶爾的休息是走更長遠路程的必經補給站。
☘️ 【可以怎麼做】：今天放過自己！不要逼自己多做任何微習慣。閉上雙眼，播放一首你最喜歡的溫馨歌曲聽完，這就是給靈魂最好的重置。`
      ];

      const randomResp = responses[Math.floor(Math.random() * responses.length)];
      return res.json({ reply: randomResp });
    }

    // Call Gemini for real AI chat
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `使用者個人檔案: ${JSON.stringify(profile)}\n歷史對話: ${JSON.stringify(history)}\n\n最新訊息: ${message}` }] }
      ],
      config: {
        systemInstruction: COACH_SYSTEM_PROMPT
      }
    });

    res.json({ reply: response.text });
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

startServer();
