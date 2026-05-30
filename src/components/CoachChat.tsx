/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, UserProfile, WellnessRecord } from "../types";
import { Send, Image, Loader2, Sparkles, AlertCircle, X, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { compressImage } from "../lib/imageCompress";

interface PendingAnalysis {
  type: 'diet' | 'exercise';
  title: string;
  estimatedValue: number;
  proteinGrams: number;
  unit: string;
  base64: string;
  pointsEarned: number;
  dietAdvice: string;
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
}

export default function CoachChat({
  messages,
  profile,
  onSendMessage,
  onImageAnalysisResult,
  onClearChat,
  onAddCustomMessages
}: CoachChatProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, pendingAnalysis]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSubmit = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      await onSendMessage(textToSubmit);
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
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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

      const pending = apiResult.pendingRecord || {};
      setPendingAnalysis({
        type: pending.type || "diet",
        title: pending.title || "未知食物",
        estimatedValue: pending.estimatedValue || 0,
        proteinGrams: pending.proteinGrams || 0,
        unit: pending.unit || "大卡",
        base64,
        pointsEarned: pending.pointsEarned || 20,
        dietAdvice: apiResult.dietAdvice || "",
        nutritionRough: pending.nutritionRough
      });

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
      coachFeedback: pendingAnalysis.dietAdvice || "",
      nutritionRough: pendingAnalysis.nutritionRough
    });

    const savedMsg: ChatMessage = {
      id: `m-bot-saved-${Date.now()}`,
      sender: "bot",
      text: `✅ 已儲存「${displayTitle}」，${pendingAnalysis.estimatedValue} 大卡、蛋白質 ${pendingAnalysis.proteinGrams}g。繼續加油！`,
      timestamp: new Date().toISOString()
    };
    if (onAddCustomMessages) {
      onAddCustomMessages(null, savedMsg);
    }

    setPendingAnalysis(null);
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
      {pendingAnalysis && (
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm mb-3 overflow-hidden animate-fade-in">
          {/* Card Header */}
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-emerald-100">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 font-sans">
              <CheckCircle2 size={13} className="text-emerald-600" />
              確認並儲存紀錄
            </span>
            <button
              type="button"
              onClick={() => setPendingAnalysis(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
              title="取消"
            >
              <X size={11} />
            </button>
          </div>

          <div className="px-3.5 py-3 flex flex-col gap-2.5">
            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold">食物名稱</label>
                <input
                  type="text"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-300"
                  value={pendingAnalysis.title}
                  onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold">熱量（大卡）</label>
                <input
                  type="number"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-300"
                  value={pendingAnalysis.estimatedValue}
                  onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, estimatedValue: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold">蛋白質（克）</label>
                <input
                  type="number"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-sans outline-none focus:ring-1 focus:ring-emerald-300"
                  value={pendingAnalysis.proteinGrams}
                  onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, proteinGrams: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Nutrition tags (collapsible) */}
            {pendingAnalysis.nutritionRough && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowNutrition(!showNutrition)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showNutrition ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  營養概況
                </button>
                {showNutrition && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(pendingAnalysis.nutritionRough).map(([key, val]) => {
                      const labels: Record<string, string> = { carbs: "碳水", protein: "蛋白質", fat: "油脂", veg: "蔬菜" };
                      return (
                        <span key={key} className={`px-2 py-0.5 rounded-full text-[10px] border font-medium ${getNutritionColor(val)}`}>
                          {labels[key] || key}：{val}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Hint */}
            <p className="text-[10px] text-slate-400 leading-relaxed">
              數字有誤？直接在上方修改，或繼續在聊天中說明（例如「份量是兩份」）再回來確認。
            </p>

            {/* Save button */}
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
