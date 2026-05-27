/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Request, Response } from "express";

const IMAGE_ANALYZER_PROMPT = `
you're PaoPao教練, a minimalist, warm, high-EQ image analyzer. 你是一位專門分析健康飲食和活動照片的 AI 專家。
請根據上傳照片回傳符合規範的 JSON 物件。不要輸出 Markdown 標記，直接回傳純 JSON。
請務必包含 'title'（繁體中文食物或活動名稱）與 'coachFeedback'（AI 教練溫和回饋）。

【特別注意：'coachFeedback' 的硬性約束】：
1. 說話極度簡練，字數瘦身 50% 以上！字數嚴格限制在 2 ~ 3 句之內（總字數 80 字內），直擊要害，謝絕廢話與鋪張雞湯。
2. 語氣樸實、微溫、安靜，不用驚嘆號。先溫和肯定其記錄的事實，再以哈佛餐盤做簡單客觀對比，最後給出一個最簡單的物理微行動。
3. 必須在回饋末端包含大眾免責指引聲明：
   「我是您的 PaoPao健康陪跑教練，提供大眾健康指引，不能提供個人化醫療診斷與臨床處方。如有特定控制需求，請務必諮詢專業醫療機構唷。」
`;

function getGeminiClient(): GoogleGenAI {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao;
  const key = rawKey ? rawKey.trim().replace(/^['"]|['"]$/g, '') : '';
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

export default async function handler(req: Request, res: Response) {
  try {
    const { image, profile } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "請提供圖片資料" });
    }

    const keyPresent = isApiKeyPresent();

    const getMockResponse = () => {
      const isExercise = image.includes("exercise") || Math.random() > 0.5;
      if (isExercise) {
        return {
          title: "自主有氧舒展運動 🏃‍♀️",
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
          title: "美味小點心紀錄 ☕",
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
              required: ["type", "estimatedValue", "unit", "nutritionRough", "pointsEarned", "coachFeedback", "title"],
              properties: {
                title: { type: Type.STRING },
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
          // 優先嘗試使用 gemini-3.5-flash 確保高水準飲食多模態圖像辨識品質
          response = await ai.models.generateContent(callParams("gemini-3.5-flash"));
        } catch (modelError: any) {
          console.warn("⚠️ gemini-3.5-flash image analysis failed, trying gemini-3.1-flash-lite fallback:", modelError);
          // 次要嘗試使用極速 gemini-3.1-flash-lite 做安全降級
          response = await ai.models.generateContent(callParams("gemini-3.1-flash-lite"));
        }

        if (response && response.text) {
          const result = JSON.parse(response.text.trim() || "{}");
          return res.json(result);
        }
      } catch (realAiError: any) {
        console.error("⚠️ Real Gemini Image Analyzer failed:", realAiError);
        return res.status(500).json({ 
          error: "AI 圖片分析失敗，已暫停 Mock 模擬", 
          details: realAiError.message || JSON.stringify(realAiError),
          diagnostics: `金鑰狀態: 已設定 (長度: ${(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao)?.trim().length} 字元)`
        });
      }
    }

    return res.json(getMockResponse());
  } catch (error: any) {
    console.error("Error in Vercel image analyzer handler:", error);
    res.status(500).json({ error: "分析圖片時發生錯誤。", details: error.message });
  }
}
