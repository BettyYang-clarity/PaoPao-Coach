/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import type { Request, Response } from "express";

const COACH_SYSTEM_PROMPT = `你是一位「精煉溫柔系」的 PaoPao健康養成教練。你深諳行為心理與原子習慣，用字樸實、微溫、安靜且極度克制，徹底拒絕浮誇讚美與大段雞湯。

你的說話風格與硬性約束：
1. 【適度精練與結構化 (Structured Minimalist Warmth)】：
   - 說話保持溫和簡煉不拖泥帶水，但遇有食物或活動諮詢時，請使用好閱讀的結構化排版（如條列式、小圖示、粗體字）。
   - 不要使用任何浮誇的感嘆號與廉價誇獎。誠實記錄就是習慣的起點，請用中性、溫和、冷靜的語氣隨喜讚賞。
   - 先說事實，再給一句有溫度的定錨，最後直接拋出下一個無摩擦的物理微行動。
2. 【大眾免責指引聲明】：
   - 你不得為使用者開立專屬醫療診斷或個人化臨床治療處方。在你的回答結尾，必須包含以下大眾免責聲明：
     「我是您的 PaoPao健康陪跑教練，提供大眾健康指引，不能提供個人化醫療診斷與臨床處方。如有特定控制需求，請務必諮詢專業醫療機構唷。」
3. 【推廣哈佛餐盤與主動營養科普】：
   - 當使用者諮詢、上傳、或提及任何與食物、餐食、點心、飲料相關的內容時，你必須主動估算並明確標記其「熱量（卡路里，kcal）」與「蛋白質含量（公克，g）」，並以結構化（例如條列式、小圖示、粗體字）的方式排版呈現，避免過於簡短或敷衍的回答。
   - 引導使用者往「原型食物（蔬菜佔半，穀物與蛋白各 1/4）」前進，幫助建立無摩擦的飲食健康良性連結。
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
    desc: "牛排富含豐富 of 優質蛋白質與鐵質，對肌肉修復及體力維持有絕佳效果，記得搭配豐富蔬菜喔！"
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

export default async function handler(req: Request, res: Response) {
  try {
    const { message, history, profile } = req.body || {};
    const lowerMessage = message?.toLowerCase() || "";
    const goalStr = profile?.customGoal || "維持健康生活方式";
    const guidelineText = profile?.selectedHabits && profile.selectedHabits.length > 0
      ? `，並為您精選了 ${profile.selectedHabits.length} 個微原子習慣`
      : "";

    const keyPresent = isApiKeyPresent();

    let systemWarning = "";
    if (!keyPresent) {
      const allKeys = Object.keys(process.env).filter(k => !k.startsWith("AWS_") && !k.startsWith("VERCEL_") && !k.startsWith("npm_"));
      const rawVal = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao;
      const valInfo = rawVal 
        ? `存在但未通過判定 (長度: ${rawVal.length}, 前三字: "${rawVal.slice(0, 3)}", 類型: ${typeof rawVal})` 
        : "完全為 undefined 或空字串";
      systemWarning = `⚠️ 【系統診斷：尚未設定或讀取到您的 GEMINI_API_KEY 金鑰。\n\n🔧 診斷資訊：\n- GEMINI_API_KEY 狀態：${valInfo}\n- 容器可用環境變數清單：${allKeys.join(", ")}\n\n💡 請至您的 Vercel 專案 Dashboard ➔ Settings ➔ Environment Variables 新增名為 \`GEMINI_API_KEY\` 的環境變數後，並在 Deployments 重新點擊 Redeploy 以啟用真實的 AI 智慧教練。】\n\n`;
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
          // 優先嘗試使用極速 gemini-3.1-flash-lite 確保文字聊天毫秒級零延遲
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT
            }
          });
        } catch (modelError: any) {
          console.warn("⚠️ gemini-3.1-flash-lite failed, trying gemini-3.5-flash fallback:", modelError);
          // 次要嘗試使用 gemini-3.5-flash
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
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
        const errorMsg = `❌ 【AI 教練連線失敗】\n很抱歉，教練與 AI 核心失去連線。這通常是由於金鑰設定問題或額度限制引起的。\n\n💡 偵錯與診斷資訊：\n- 錯誤內容：${realAiError.message || JSON.stringify(realAiError)}\n- 金鑰狀態：已設定 (長度: ${(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_Pao)?.trim().length} 字元)\n\n請檢查您的 Vercel 專案 Settings -> Environment Variables 中的 GEMINI_API_KEY。設定完畢後，請重新部署以套用。`;
        return res.json({ reply: errorMsg });
      }
    }

    // --- FALLBACK MOCK ENGINE ---
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
☘️ 【微習慣建議】：在剛運動完的這 30 分鐘，請順手給自己盛上一杯 300ml 的微溫水，一口口慢吞吞地喝完它。這是最棒、最簡單、也最不需要意志力就能幫助肌肉修補 and 加速乳酸代謝的習慣連結。

今天真的做得太棒了，持續累積你的微小改變吧！`
      });
    }

    const responses = [
      systemWarning + `【PaoPao教練提示】\n嗨！ ${profile?.name || "夥伴"}，我是你的 PaoPao健康陪跑教練。很高興收到你的訊息！你現在願意誠實記錄、與我分享，就是最強大的健康自然習慣第一步。
 
『我是您的 PaoPao健康陪跑教練，我可以為您提供大眾健康指引，但不能為您開立專屬醫療診斷與個人化飲食指引。如有特定疾病、特殊控制或治療需求，請務必諮詢執業醫師、實體營養師等專業醫療機構。』

🎯 【目標提醒】：${goalStr}${guidelineText}。依照哈佛健康餐盤，只要多吃原型食物、多喝溫白開水，每天稍微推進 1%, 就是在累積改變的複利！
☘️ 【可以怎麼做】：我們現在來個 low-friction 挑戰——深深用鼻子吸氣 4秒、再用嘴巴吐氣 6 秒，連續做 2 次。這能馬上重置大腦壓力，你覺得如何？努力就是滿分！`,
 
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
