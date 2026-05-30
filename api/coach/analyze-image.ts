/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Request, Response } from "express";

const IMAGE_ANALYZER_PROMPT = `你是一位「精煉溫柔系」的 PaoPao健康養成教練，擅長分析食物照片。

【分析任務】：
你會拿到一張食物（或運動）照片。請你進行透明、有條理的推理分析，像在跟使用者說話一樣。

【回應格式要求】
請回傳一個 JSON，包含以下欄位：

1. "reasoning"：這是你對照片的自然語言推理分析（繁體中文），格式如下：
   - 先描述「我看到的是...」（辨識食物）
   - 再估算份量：「看起來大概是...份、...克」
   - 給出熱量與蛋白質的估算範圍（附上估算依據）
   - 針對這道食物的飲食特性（偏油？偏鹹？蛋白質充足？蔬菜不足？），給出 1 個具體的替代或補充建議
   - 語氣樸實微溫，2~4 句，不要過度讚美，不用驚嘆號

2. "pendingRecord"：結構化的初始估算，供使用者調整：
   {
     "title": "食物名稱（繁體中文）",
     "type": "diet" 或 "exercise",
     "estimatedValue": 熱量數字（大卡）,
     "unit": "大卡",
     "proteinGrams": 蛋白質克數（整數）,
     "nutritionRough": {
       "carbs": "偏高/適中/偏低",
       "protein": "偏高/適中/偏低",
       "fat": "偏高/適中/偏低",
       "veg": "充足/不足/極少"
     },
     "pointsEarned": 20
   }

3. "dietAdvice"：針對這道食物的飲食建議（1~2 句），例如：「這道菜偏油，建議下一餐搭配燙青菜，或選擇蒸煮的烹調方式。」

注意：estimatedValue 請給單一數字（取估算範圍的中間值）。不要輸出 Markdown，直接回傳純 JSON。`;

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
    const { image, mimeType: reqMimeType, profile } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "請提供圖片資料" });
    }

    const mimeType = reqMimeType || "image/jpeg";
    const keyPresent = isApiKeyPresent();

    if (keyPresent) {
      try {
        const ai = getGeminiClient();
        const part = base64ToPart(image, mimeType);
        const contentsText = `使用者個人檔案: ${JSON.stringify(profile)}。請分析這張照片並回傳符合格式的 JSON。`;

        let response;
        const callParams = (modelName: string) => ({
          model: modelName,
          contents: [part, { text: contentsText }],
          config: {
            systemInstruction: IMAGE_ANALYZER_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["reasoning", "pendingRecord", "dietAdvice"],
              properties: {
                reasoning: { type: Type.STRING },
                dietAdvice: { type: Type.STRING },
                pendingRecord: {
                  type: Type.OBJECT,
                  required: ["title", "type", "estimatedValue", "unit", "proteinGrams", "nutritionRough", "pointsEarned"],
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["diet", "exercise"] },
                    estimatedValue: { type: Type.INTEGER },
                    unit: { type: Type.STRING },
                    proteinGrams: { type: Type.INTEGER },
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
                    pointsEarned: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        });

        try {
          response = await ai.models.generateContent(callParams("gemini-3.5-flash"));
        } catch (modelError: any) {
          console.warn("⚠️ gemini-3.5-flash failed, trying gemini-3.1-flash-lite:", modelError);
          response = await ai.models.generateContent(callParams("gemini-3.1-flash-lite"));
        }

        if (response && response.text) {
          const result = JSON.parse(response.text.trim() || "{}");
          return res.json(result);
        }
      } catch (realAiError: any) {
        console.error("⚠️ Real Gemini Image Analyzer failed:", realAiError);
        return res.status(500).json({
          error: "AI 圖片分析失敗",
          details: realAiError.message || JSON.stringify(realAiError),
        });
      }
    }

    // Mock fallback
    return res.json({
      reasoning: "這看起來是一份家常便當，有白飯、炒青菜和肉類。估算份量大概是一人份（約 250g），以白飯 + 炒肉的組合來看，熱量大約在 500~600 大卡之間，取中間值約 550 大卡。蛋白質部分視肉量而定，估算約 20 克。",
      dietAdvice: "這餐蔬菜比例偏少，建議下一餐可以多加一份燙青菜，或在點餐時主動要求多配一份蔬菜。",
      pendingRecord: {
        title: "家常便當（示範）",
        type: "diet",
        estimatedValue: 550,
        unit: "大卡",
        proteinGrams: 20,
        nutritionRough: {
          carbs: "偏高",
          protein: "適中",
          fat: "適中",
          veg: "不足"
        },
        pointsEarned: 20
      }
    });
  } catch (error: any) {
    console.error("Error in image analyzer handler:", error);
    res.status(500).json({ error: "分析圖片時發生錯誤。", details: error.message });
  }
}
