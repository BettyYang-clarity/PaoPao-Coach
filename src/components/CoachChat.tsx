/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, UserProfile, WellnessRecord } from "../types";
import { Send, Image, Loader2, Sparkles, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { compressImage } from "../lib/imageCompress";

interface PendingAnalysis {
  type: 'diet' | 'exercise';
  title: string;
  estimatedValue: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  unit: string;
  base64: string;
  pointsEarned: number;
  coachSuggestion: string;
  nutritionRough?: {
    carbs?: string;
    protein?: string;
    fat?: string;
    veg?: string;
  };
}

interface CoachChatProps {
  messages: ChatMessage[];
  profile: UserProfile;
  onSendMessage: (text: string) => Promise<void>;
  onImageAnalysisResult: (record: WellnessRecord) => void;
  onClearChat?: () => void;
  onAddCustomMessages?: (userMsg: ChatMessage | null, botMsg: ChatMessage) => void;
  // Auto-trigger from WellnessDashboard
  autoFile?: File | null;
  autoQuery?: string | null;
  onAutoConsumed?: () => void;
}

// Frontend fallback parser to dynamically extract nutrition metrics from coach replies
function extractNutritionFromText(text: string, titleDefault: string) {
  const lowerText = text.toLowerCase();
  
  // 1. Detect if it relates to diet or exercise
  const isDiet = lowerText.includes("大卡") || lowerText.includes("kcal") || lowerText.includes("卡路里") || lowerText.includes("吃") || lowerText.includes("喝") || lowerText.includes("餐") || lowerText.includes("蛋");
  const isExercise = lowerText.includes("分鐘") || lowerText.includes("met") || lowerText.includes("運動") || lowerText.includes("活動");
  
  if (!isDiet && !isExercise) return null;
  
  const type = isDiet ? "diet" : "exercise";
  
  // 2. Extract calories or duration
  let estimatedValue = 0;
  const kcalMatch = text.match(/(\d+)\s*(?:大卡|kcal|卡路里|卡)/i);
  if (kcalMatch) {
    estimatedValue = parseInt(kcalMatch[1]);
  } else {
    const minsMatch = text.match(/(\d+)\s*(?:分鐘|分)/);
    if (minsMatch) {
      estimatedValue = parseInt(minsMatch[1]);
    }
  }
  
  if (estimatedValue === 0) return null;
  
  // 3. Extract protein
  let proteinGrams = 0;
  const proteinMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:公克|克|g)/i);
  if (proteinMatch) {
    proteinGrams = Math.round(parseFloat(proteinMatch[1]));
  }
  
  // 4. Rough calculation for carbs and fat
  let carbsGrams = 0;
  let fatGrams = 0;
  if (type === "diet") {
    carbsGrams = Math.round((estimatedValue * 0.5) / 4);
    fatGrams = Math.round((estimatedValue * 0.3) / 9);
    if (proteinGrams > 0) {
      const remainingKcal = estimatedValue - (proteinGrams * 4);
      if (remainingKcal > 0) {
        carbsGrams = Math.round((remainingKcal * 0.6) / 4);
        fatGrams = Math.round((remainingKcal * 0.4) / 9);
      }
    }
  }
  
  // 5. Extract specific title
  let title = titleDefault || (isDiet ? "今日美味餐飲" : "今日身體活動");
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
    proteinGrams,
    carbsGrams,
    fatGrams,
    pointsEarned: 25,
    nutritionRough: {
      carbs: carbsGrams > 0 ? `${carbsGrams}g` : "適量",
      protein: proteinGrams > 0 ? `${proteinGrams}g` : "充足",
      fat: fatGrams > 0 ? `${fatGrams}g` : "充足",
      veg: "適量"
    }
  };
}

export default function CoachChat({
  messages,
  profile,
  onSendMessage,
  onImageAnalysisResult,
  onClearChat,
  onAddCustomMessages,
  autoFile,
  autoQuery,
  onAutoConsumed
}: CoachChatProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, pendingAnalysis, showSaveModal]);

  // Auto-trigger: file from WellnessDashboard drag-upload or query from inline consult
  useEffect(() => {
    if (autoFile) {
      processImageFile(autoFile);
      onAutoConsumed?.();
    } else if (autoQuery) {
      // Inject the query as a user message and fire send
      onSendMessage(autoQuery).catch(console.error);
      onAutoConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFile, autoQuery]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSubmit = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const apiResult: any = await onSendMessage(textToSubmit);
      if (apiResult) {
        let pending = apiResult.pendingRecord;
        
        // Defensive Frontend extraction in case backend returns plain text or lacks pendingRecord
        if (!pending && apiResult.reply) {
          pending = extractNutritionFromText(apiResult.reply, textToSubmit);
        }

        if (pending) {
          setPendingAnalysis({
            type: pending.type || "diet",
            title: pending.title || textToSubmit,
            estimatedValue: pending.estimatedValue || 0,
            proteinGrams: pending.proteinGrams || 0,
            carbsGrams: pending.carbsGrams || 0,
            fatGrams: pending.fatGrams || 0,
            unit: pending.unit || "大卡",
            base64: "", // No image base64 for text-based input
            pointsEarned: pending.pointsEarned || 25,
            coachSuggestion: apiResult.reply || pending.coachSuggestion || "",
            nutritionRough: pending.nutritionRough
          });
          setShowSaveModal(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      setUploadError("教練稍微收訊不好，請再傳一次唷！");
    } finally {
      setIsSending(false);
    }
  };

  const fileToBase64Mime = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve({ base64: base64String, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("請上傳圖片格式檔案唷！");
      return;
    }

    setIsSending(true);
    setUploadError(null);

    let base64 = "";
    let mimeType = "";

    try {
      const compressed = await compressImage(file);
      base64 = compressed.base64;
      mimeType = compressed.mimeType;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout for heavy image analysis

      const res = await fetch("/api/coach/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, profile }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("伺服器影像辨識失敗");

      const apiResult = await res.json();

      // 使用者訊息（附帶圖片）
      const userMsg: ChatMessage = {
        id: `m-usr-img-${Date.now()}`,
        sender: "user",
        text: "📸 上傳了一張照片，請幫我分析！",
        imageUrl: base64,
        timestamp: new Date().toISOString()
      };

      // AI 推理分析訊息（自然語言透明輸出）
      const analysisText = [
        `🔍 **辨識分析**\n${apiResult.reasoning || "正在推理中..."}`,
        apiResult.dietAdvice ? `\n\n💡 **飲食建議**\n${apiResult.dietAdvice}` : "",
        "\n\n如果數字不對，可以繼續告訴我（例如：「份量是兩人份」、「這是小份的」），我會重新估算。確認後，點下方「儲存紀錄」即可登錄。"
      ].join("");

      const analysisMsg: ChatMessage = {
        id: `m-bot-analysis-${Date.now()}`,
        sender: "bot",
        text: analysisText,
        timestamp: new Date().toISOString()
      };

      if (onAddCustomMessages) {
        onAddCustomMessages(userMsg, analysisMsg);
      }

      const pending = apiResult.pendingRecord || apiResult || {};
      setPendingAnalysis({
        type: pending.type || "diet",
        title: pending.title || "未知食物",
        estimatedValue: pending.estimatedValue || 0,
        proteinGrams: pending.proteinGrams || 0,
        carbsGrams: pending.carbsGrams || 0,
        fatGrams: pending.fatGrams || 0,
        unit: pending.unit || "大卡",
        base64,
        pointsEarned: pending.pointsEarned || 25,
        coachSuggestion: apiResult.coachSuggestion || apiResult.coachFeedback || "",
        nutritionRough: pending.nutritionRough
      });
      setShowSaveModal(false);

    } catch (err: any) {
      console.error(err);
      setUploadError("照片辨識暫時無法使用，可手動在聊天輸入食物名稱讓我估算喔！");

      const errorMsg: ChatMessage = {
        id: `m-bot-img-err-${Date.now()}`,
        sender: "bot",
        text: "照片分析稍微忙碌中。可以直接告訴我你吃了什麼（例如：「一碗滷肉飯加一顆滷蛋」），我幫你估算熱量。",
        timestamp: new Date().toISOString()
      };
      if (onAddCustomMessages) {
        onAddCustomMessages(null, errorMsg);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveRecord = () => {
    if (!pendingAnalysis) return;
    const isPrefixed = /^[🍱🏃‍♀️💎🍀]/.test(pendingAnalysis.title);
    const displayTitle = isPrefixed ? pendingAnalysis.title : `🍱 ${pendingAnalysis.title}`;

    onImageAnalysisResult({
      id: `r-ai-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: pendingAnalysis.type,
      title: displayTitle,
      imageUrl: pendingAnalysis.base64,
      estimatedValue: pendingAnalysis.estimatedValue,
      unit: pendingAnalysis.unit,
      proteinGrams: pendingAnalysis.type === "diet" ? pendingAnalysis.proteinGrams : undefined,
      pointsEarned: pendingAnalysis.pointsEarned,
      coachFeedback: pendingAnalysis.coachSuggestion || "",
      nutritionRough: pendingAnalysis.nutritionRough
    });

    const parts = [
      `✅ 已儲存「${displayTitle}」`,
      `熱量 ${pendingAnalysis.estimatedValue} 大卡`,
      `蛋白質 ${pendingAnalysis.proteinGrams}g`,
      `碳水 ${pendingAnalysis.carbsGrams}g`,
      `脂肪 ${pendingAnalysis.fatGrams}g`
    ];
    const savedMsg: ChatMessage = {
      id: `m-bot-saved-${Date.now()}`,
      sender: "bot",
      text: parts.join('・') + (pendingAnalysis.coachSuggestion ? `\n\n${pendingAnalysis.coachSuggestion}` : ""),
      timestamp: new Date().toISOString()
    };
    if (onAddCustomMessages) {
      onAddCustomMessages(null, savedMsg);
    }

    setPendingAnalysis(null);
    setShowSaveModal(false);
  };

  // Nutrition tag color helper
  const getNutritionColor = (val?: string) => {
    if (!val) return "bg-slate-100 text-slate-500";
    if (val.includes("偏高") || val.includes("不足") || val.includes("極少")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (val.includes("偏低")) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div
      id="chat-panel"
      className={`flex flex-col h-full min-h-0 w-full transition-all duration-300 relative ${
        isDragging ? "ring-2 ring-emerald-500 bg-emerald-50/10 rounded-2xl" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs shrink-0">🍀</span>
          <span className="text-[10px] font-medium text-slate-500 truncate">PaoPao教練</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onClearChat && (
            <button
              type="button"
              onClick={onClearChat}
              className="text-amber-600 hover:text-amber-800 px-2 py-1 bg-amber-50 hover:bg-amber-100/60 border border-amber-100 rounded-lg text-[10px] font-sans font-semibold transition-all cursor-pointer flex items-center gap-0.5"
              title="重置對談歷史"
            >
              🧹 重置對談
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-emerald-700 hover:text-emerald-900 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/60 rounded-lg text-[10px] font-sans font-semibold transition-all cursor-pointer flex items-center gap-1"
          >
            <Image size={10} className="text-emerald-600" />
            飲食拍照
          </button>
        </div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 mb-4 select-text">
        {messages.map((msg) => {
          const isBot = msg.sender === "bot";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 max-w-[85%] ${
                isBot ? "self-start" : "self-end flex-row-reverse"
              }`}
            >
              <div className="flex-shrink-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-3xs border ${
                  isBot ? "bg-emerald-50 text-emerald-600 border-emerald-100/20" : "bg-teal-50 text-teal-600 border-teal-100/20"
                }`}>
                  {isBot ? "🥗" : "🏃‍♀️"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div
                  className={`p-3.5 rounded-2xl font-sans text-xs leading-relaxed whitespace-pre-wrap ${
                    isBot
                      ? "bg-slate-50 border border-slate-100/80 text-slate-700 rounded-tl-xs"
                      : "bg-emerald-600 text-white rounded-tr-xs"
                  }`}
                >
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Uploaded food"
                      className="max-w-[160px] max-h-[160px] rounded-xl object-cover mb-2 border border-black/5"
                    />
                  )}
                  {msg.text}
                </div>
                <span className={`text-[9px] text-slate-400 font-mono ${isBot ? "" : "text-right"}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-start gap-2.5 max-w-[80%] self-start animate-pulse">
            <span className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100/30 flex items-center justify-center text-xs">🥗</span>
            <div className="p-3 bg-slate-50 border border-slate-100/50 rounded-2xl rounded-tl-xs flex items-center gap-1.5 text-xs text-slate-400 font-sans">
              <Loader2 size={12} className="animate-spin text-emerald-500" />
              正在辨識照片並推理分析中…
            </div>
          </div>
        )}

        {pendingAnalysis && !showSaveModal && (
          <div className="p-3 bg-emerald-50 border border-brand-green/20 rounded-2xl flex items-center justify-between gap-3 animate-fade-in mb-1">
            <div className="flex items-center gap-2 text-emerald-800 text-[10px] font-bold font-sans">
              <span>☘️</span>
              <span>已估算完成！是否將「{pendingAnalysis.title}」({pendingAnalysis.estimatedValue} kcal) 儲存至今日足跡？</span>
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3.5 py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-[10px] font-bold rounded-xl shadow-4xs cursor-pointer active:scale-95 transition-all flex-shrink-0"
            >
              儲存結果
            </button>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-emerald-700 text-[10px] font-sans font-bold flex items-center justify-center gap-1 mb-2">
          <Sparkles size={12} className="animate-bounce" />
          鬆開手！PaoPao教練會自動分析食物內容唷～
        </div>
      )}

      {/* Error banner */}
      {uploadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-xl flex items-center gap-1.5 mb-2 font-sans leading-normal">
          <AlertCircle size={12} className="flex-shrink-0" />
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-auto font-bold text-amber-900 cursor-pointer">關閉</button>
        </div>
      )}

      {/* Pending Analysis Confirmation Card */}
      {pendingAnalysis && showSaveModal && (
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm mb-3 overflow-hidden animate-fade-in flex flex-col max-h-[260px] md:max-h-[300px]">
          {/* Card Header */}
          <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5 border-b border-emerald-100 flex-shrink-0">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 font-sans">
              <CheckCircle2 size={13} className="text-emerald-600" />
              確認並儲存紀錄
            </span>
            <button
              type="button"
              onClick={() => setShowSaveModal(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
              title="收合"
            >
              <X size={11} />
            </button>
          </div>

          <div className="px-3.5 py-2.5 flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-0 text-left">
            {/* Food name */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-semibold">食物名稱</label>
              <input
                type="text"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-300"
                value={pendingAnalysis.title}
                onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, title: e.target.value })}
              />
            </div>

            {/* Macro nutrients - 2x2 grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Calories - full width highlight */}
              <div className="col-span-2 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                <span className="text-[10px] text-emerald-700 font-bold">🔥 熱量</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    className="w-16 text-right px-1.5 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 text-xs font-bold font-sans outline-none focus:ring-1 focus:ring-emerald-400"
                    value={pendingAnalysis.estimatedValue}
                    onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, estimatedValue: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-emerald-600 font-medium">大卡</span>
                </div>
              </div>

              {/* Protein */}
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-2">
                <span className="text-[10px] text-blue-700 font-semibold">💪 蛋白質</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-12 text-right px-1 py-0.5 bg-white border border-blue-200 rounded-md text-blue-800 text-xs font-bold font-sans outline-none focus:ring-1 focus:ring-blue-300"
                    value={pendingAnalysis.proteinGrams}
                    onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, proteinGrams: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-blue-500">g</span>
                </div>
              </div>

              {/* Carbs */}
              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-2">
                <span className="text-[10px] text-amber-700 font-semibold">🌾 碳水</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-12 text-right px-1 py-0.5 bg-white border border-amber-200 rounded-md text-amber-800 text-xs font-bold font-sans outline-none focus:ring-1 focus:ring-amber-300"
                    value={pendingAnalysis.carbsGrams}
                    onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, carbsGrams: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-amber-500">g</span>
                </div>
              </div>

              {/* Fat */}
              <div className="col-span-2 flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-2.5 py-2">
                <span className="text-[10px] text-rose-700 font-semibold">🫙 脂肪</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-12 text-right px-1 py-0.5 bg-white border border-rose-200 rounded-md text-rose-800 text-xs font-bold font-sans outline-none focus:ring-1 focus:ring-rose-300"
                    value={pendingAnalysis.fatGrams}
                    onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, fatGrams: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-rose-500">g</span>
                </div>
              </div>
            </div>

            {/* Nutrition quality tags */}
            {pendingAnalysis.nutritionRough && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(pendingAnalysis.nutritionRough).map(([key, val]) => {
                  const labels: Record<string, string> = { carbs: "碳水", protein: "蛋白質", fat: "油脂", veg: "蔬菜" };
                  return (
                    <span key={key} className={`px-2 py-0.5 rounded-full text-[10px] border font-medium ${getNutritionColor(val as string)}`}>
                      {labels[key] || key}：{val as string}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Coach suggestion */}
            {pendingAnalysis.coachSuggestion && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <p className="text-[10px] text-slate-500 font-semibold mb-1">💡 今日建議</p>
                <p className="text-[10px] text-slate-600 leading-relaxed">{pendingAnalysis.coachSuggestion}</p>
              </div>
            )}

            {/* Hint */}
            <p className="text-[10px] text-slate-400 leading-relaxed">
              數字有誤？在上方直接修改，或繼續在聊天中補充（例如「是兩人份」）再確認。
            </p>

          </div>

          {/* Save Action - Fixed at bottom */}
          <div className="p-2 border-t border-emerald-100 bg-slate-50 flex-shrink-0">
            <button
              type="button"
              onClick={handleSaveRecord}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              確認儲存這筆紀錄
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSendText} className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-sans text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-100/50 focus:bg-white"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={pendingAnalysis ? "告訴我份量或調整資訊，例如「這是兩人份」..." : "輸入食物、運動或諮詢健康問題..."}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-[0.96] flex items-center justify-center shadow-xs flex-shrink-0"
        >
          <Send size={14} className="flex-shrink-0" />
        </button>
      </form>
    </div>
  );
}
