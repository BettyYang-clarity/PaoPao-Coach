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
   - 當使用者的對話中主動提到了特定的食物名稱（例如：「我想吃香蕉」、「剛剛吃了滷肉飯」、「珍珠奶茶多少卡」、「牛排」等，或發送任何食材時），你必須將自己當作智慧陪跑教練：
     * 主動為其提供該食物的標準約略熱量 (卡路里 kcal 值)、以及可能的三大營養素（碳水化合物、蛋白質、脂肪）與膳食纖維等公眾參考成分估值。
     * 必須在回答時加註一條標準說明文字：
       『⚠️ 貼心提醒：本數據為官方食品營養資料庫及學術文獻之大眾標準平均估值，實際熱量會因料理方式、油鹽用量與精確份量而有所不同，適合作為一般習慣控制的客觀參考喔。』

3. 【運動能耗與活動指引功能（新加入）】：
   - 當使用者提到了特定運動項目、或詢問運動能耗與推薦（例如：「跑了 30 分鐘」、「打羽球」、「重訓有什麼推薦的」等），你必須：
     * 根據衛生福利部國民健康署或國際運動醫學學會 (ACSM) 對身體活動代謝當量 (METs) 的官方指引，幫使用者估算約略的消耗卡路里（可以 60 - 70 公斤的成人的平均強度為基本對照標準），並給出消耗大卡的參考。
     * 向使用者推廣官方倡導的樂活運動指引（如：國健署提倡每日累積「微汗、能說話不能唱歌」的中度活動、每週 150 分鐘、並提倡多做日常阻力訓練）。
     * 提供呼應原子習慣的微型身體活動建議，即使只動 1 分鐘也是極了不起的累積！
     * 在涉及運動估算時，同樣主動加註：
       『⚠️ 貼心提醒：此運動消耗與代謝能耗為官方平均活動強度參考值，實際耗能會因個人體脂率、心率狀態及肌肉量多寡而有所差異。』

4. 【主動提醒個人目標】：
   請積極讀取傳入的使用者資訊（特別是 profile 裡面的 customGoal「個人健康主題計劃目標」、dailyCalorieTarget、dailyWaterTarget、weightGoal、selectedGuidelines「客製化微習慣方針項目」等），在每次對話回饋中，適時且溫馨地「扣回並溫和提醒」他們當前設定的個人健康主要目標與自主選擇的幾項行動承諾，幫助他們不忘初心，建立健康認同。

5. 【具體行動指南（可以怎麼做）】：
   在肯定與目標連結後，根據使用者的情況，給出 1 個好起步且摩擦力極低的微型行動指引（micro-step），協助使用者無負擔地累積微習慣。
`;

// System instruction for Image Analyzer
const IMAGE_ANALYZER_PROMPT = `
你是一位專門進行健康管理與原子習慣分析的 AI 陪跑專家。
請仔細分析使用者上傳的飲食（食物、飲料）或運動（跳繩、散步、重訓、運動器材等）照片。
特別注意：
1. 請以極高同理心、有溫度、完全隨喜、絕不審判的教練姿態肯定使用者的誠實記錄。
2. 計算其點數：一律給予 25 點（這是不完美也給滿分的激勵制度）。
3. 估算數值：
   - 飲食照片：估算大致熱量（大卡），並在 nutritionRough 中回傳碳水(carbs)、蛋白質(protein)、脂肪(fat)、蔬菜(veg) 的簡短描述（例如 "適量"、"偏少，可加入優質蛋/大豆"、"蔬菜多嚼20秒超棒"）。並且估算當中的蛋白質含量（克，整數，若非食物或估算不出請回傳 0），記錄在 proteinGrams 欄位中。
   - 運動照片：估算大致時間（分鐘），不提供熱量值，且 proteinGrams 回傳 0。
4. 提供一個呼應其照片、完全貼合「原子微習慣」理論的下一個極低磨損物理微行動建議（例如：喝杯 300ml 溫水、在客廳走動 10 秒）。
`;

const fallbackFoods: Record<string, { kcal: number, protein: string, carbs: string, fat: string, desc: string }> = {
  "香蕉": { kcal: 90, protein: "1.1g", carbs: "23g", fat: "0.3g", desc: "豐富鉀離子與天然膳食纖維，是最無磨損的即時能量站，隨拆隨吃極致便利！" },
  "滷肉飯": { kcal: 650, protein: "15g", carbs: "78g", fat: "32g", desc: "飽滿的米飯加滷肉多汁，美味飽足但油脂稍多，建議搭配一盤燙青菜均衡一下喔。" },
  "珍奶": { kcal: 550, protein: "5g", carbs: "85g", fat: "20g", desc: "好心情與多巴胺的快樂神水，糖分與飽和脂肪較高，建議微糖並拉長喝的間隔時間唷。" },
  "珍珠奶茶": { kcal: 550, protein: "5g", carbs: "85g", fat: "20g", desc: "好心情與多巴胺的快樂神水，糖分與飽和脂肪較高，建議微糖並拉長喝的間隔時間唷。" },
  "雞排": { kcal: 600, protein: "35g", carbs: "40g", fat: "35g", desc: "酥脆外皮與多汁蛋白質，油炸外皮熱量極高，如果想吃得更無負擔，可以剝除部分外皮享用喔！" },
  "炸雞": { kcal: 450, protein: "25g", carbs: "20g", fat: "30g", desc: "香脆美味，飽和脂肪略多。偶爾犒賞自己很棒，下一餐多夾一碗綠色蔬菜以補充纖維，就能取得良好平衡喔。" },
  "蛋": { kcal: 75, protein: "7g", carbs: "0.6g", fat: "5g", desc: "近乎完美國際標準蛋白質，高生物價，是打造代謝與修復的原子建構基石，取得极其容易且摩擦阻力最低！" },
  "牛奶": { kcal: 150, protein: "8g", carbs: "12g", fat: "8g", desc: "蘊含天然酪蛋白與高人體吸收鈣質，國健署每日飲食指南建議每天早晚各喝一杯暖牛奶可滋養身心。" }
};

const fallbackExercises: Record<string, { met: number, name: string, desc: string }> = {
  "慢慢跑": { met: 8, name: "慢跑/跑步", desc: "高強度心肺活動。國健署鼓勵每週累積中高強度活動。慢跑可強化心關節耐受力，但初學者由1分鐘極慢跑起步最佳！" },
  "跑步": { met: 8, name: "慢跑/跑步", desc: "高強度心肺活動。國健署鼓勵每週累積中高強度活動。慢跑可強化心關節耐受力，但初學者由1分鐘極慢跑起步最佳！" },
  "慢跑": { met: 8, name: "慢跑/跑步", desc: "高強度心肺活動。國健署鼓勵每週累積中高強度活動。慢跑可強化心關節耐受力，但初學者由1分鐘極慢跑起步最佳！" },
  "散步": { met: 3, name: "輕快散步/走動", desc: "中度至輕度活動，最沒有心理負擔、摩擦力極低的微運動。國健署建議飯後散步 10 秒即能有效抑制飯後昏沉！" },
  "健走": { met: 4, name: "快速度健步走", desc: "中度身體活動。國健署大力倡導每日健走 30 分鐘，精神奕奕，能極佳調節靜態生活模式。" },
  "游泳": { met: 7, name: "游泳/水中運動", desc: "全身肌肉阻力運動。對於關節 and 膝蓋有很好的保護，也是修復身體呼吸節奏的優美運動指引項目。" },
  "重訓": { met: 5, name: "重量阻力訓練", desc: "國健署強烈推廣每週兩次阻力型運動，能預防骨肌肉流失，增長基礎代謝率、提升體態自控力。" },
  "跳繩": { met: 9.5, name: "跳繩活動", desc: "高轉換率有氧運動。只要今日在家裡地板上跳個 20 下，就是對微習慣的強力認證，活力十足！" },
  "瑜珈": { met: 2.5, name: "放鬆瑜珈/拉筋", desc: "低衝擊、著重呼吸調節。能成功啟動副交感神經，幫助肌肉舒展，是睡眠前完美的微行為引子。" },
  "羽球": { met: 5.5, name: "擊落羽毛球", desc: "中強度的多人趣味有氧活動。國健署提倡每日趣味球類運動，享受心流與多巴胺雙重提振！" }
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

    const ai = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;

    // Direct fallback mode if Gemini key is missing / mock
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "MOCK_KEY") {
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
• ⏳ 假設以標準 65kg 成人進行 **${sampleMins} 分鐘** 估算：
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

startServer();
