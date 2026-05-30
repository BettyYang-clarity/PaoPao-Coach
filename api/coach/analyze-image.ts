/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Request, Response } from "express";

const IMAGE_ANALYZER_PROMPT = `你是一位「精煉溫柔系」的 PaoPao健康養成教練，擅長分析食物照片。

【分析任務】：
你會拿到一張食物（或運動）照片與使用者個人檔案（含每日熱量目標）。請進行透明、有條理的推理，像在跟使用者說話。

【請回傳 JSON，包含以下三個欄位】

1. "reasoning"（繁體中文，3~5 句）：
   - 「這看起來是...」（辨識食物與烹調方式）
   - 估算份量（幾份/幾克）
   - 說明熱量、蛋白質、碳水、脂肪的估算數字與依據
   - 語氣樸實微溫，不用驚嘆號，不要過度讚美

2. "pendingRecord"（結構化初始估算）：
   {
     "title": 食物名稱（繁體中文，20字以內）,
     "type": "diet" 或 "exercise",
     "estimatedValue": 熱量（大卡，整數）,
     "unit": "大卡",
     "proteinGrams": 蛋白質（克，整數）,
     "carbsGrams": 碳水化合物（克，整數）,
     "fatGrams": 脂肪（克，整數）,
     "nutritionRough": {
       "carbs": "偏高/適中/偏低",
       "protein": "充足/適中/偏低",
       "fat": "偏高/適中/偏低",
       "veg": "充足/不足/極少"
     },
     "pointsEarned": 20
   }

3. "coachSuggestion"（繁體中文，2~3 句，個人化行動建議）：
   - 根據此餐熱量 vs 使用者每日熱量目標，算出佔比並明確說出
   - 給出今天剩餘飲食或運動的具體補償建議（例如：下一餐選什麼、飯後散步幾分鐘）
   - 若熱量合理，則給鼓勵並建議如何繼續維持
   - 例如：「這餐約 680 大卡，佔你每日目標 1800 大卡的 38%，稍微偏多一點。晚餐可以選擇清蒸魚或蔬菜豆腐湯，減少油脂攝取。飯後散步 20 分鐘可以幫助消耗約 80 大卡。」

注意：所有數字欄位請給整數。不要輸出 Markdown，直接回傳純 JSON。`;

function getGeminiClient(): GoogleGenAI {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao;
  const key = rawKey ? rawKey.trim().replace(/^['"]|['"]$/g, '') : '';
  return new GoogleGenAI({
    apiKey: key || "MOCK_KEY",
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
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
  return { inlineData: { data: base64Data, mimeType } };
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["reasoning", "pendingRecord", "coachSuggestion"],
  properties: {
    reasoning: { type: Type.STRING },
    coachSuggestion: { type: Type.STRING },
    pendingRecord: {
      type: Type.OBJECT,
      required: ["title", "type", "estimatedValue", "unit", "proteinGrams", "carbsGrams", "fatGrams", "nutritionRough", "pointsEarned"],
      properties: {
        title: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["diet", "exercise"] },
        estimatedValue: { type: Type.INTEGER },
        unit: { type: Type.STRING },
        proteinGrams: { type: Type.INTEGER },
        carbsGrams: { type: Type.INTEGER },
        fatGrams: { type: Type.INTEGER },
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
};

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
        const contentsText = `使用者個人檔案: ${JSON.stringify(profile)}。請分析這張照片，根據使用者的每日熱量目標（dailyCalorieTarget）給出個人化建議。回傳符合格式的 JSON。`;

        let response;
        const callParams = (modelName: string) => ({
          model: modelName,
          contents: [part, { text: contentsText }],
          config: {
            systemInstruction: IMAGE_ANALYZER_PROMPT,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
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
      reasoning: "這看起來是一份家常便當，有白飯、炒青菜和豬肉片。估算份量約一人份（250g）。以白飯（碳水約 70 克）加上炒豬肉（蛋白質約 22 克、脂肪約 18 克）來估算，整體熱量大約在 530~580 大卡之間，取 550 大卡。",
      coachSuggestion: "這餐約 550 大卡，佔每日目標的 28~30%，屬合理範圍。蔬菜稍少，下一餐可以多點一份燙青菜或豆腐湯補充纖維。飯後散步 15 分鐘（約消耗 60 大卡）有助於血糖平穩。",
      pendingRecord: {
        title: "家常便當",
        type: "diet",
        estimatedValue: 550,
        unit: "大卡",
        proteinGrams: 22,
        carbsGrams: 70,
        fatGrams: 18,
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
