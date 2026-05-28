/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, UserProfile, WellnessRecord } from "../types";
import { Send, Image, Loader2, Sparkles, AlertCircle, Pencil, X } from "lucide-react";
import { compressImage } from "../lib/imageCompress";

interface CoachChatProps {
  messages: ChatMessage[];
  profile: UserProfile;
  onSendMessage: (text: string) => Promise<void>;
  onImageAnalysisResult: (record: WellnessRecord) => void;
  onClearChat?: () => void;
  onAddCustomMessages?: (userMsg: ChatMessage, botMsg: ChatMessage) => void;
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
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    type: 'diet' | 'exercise';
    title: string;
    estimatedValue: number;
    proteinGrams?: number;
    caloriesBurned?: number;
    unit: string;
    base64: string;
    pointsEarned: number;
    coachFeedback: string;
    nutritionRough?: any;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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

  // Convert File to Base64
  const fileToBase64Mime = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve({
          base64: base64String,
          mimeType: file.type
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Process selected food or movement image
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
      // Utilizing high efficiency compressor with automatic client-side canvas resizing 
      // which is extremely robust against iOS Safari RAM allocation rules and payload limits.
      const compressed = await compressImage(file);
      base64 = compressed.base64;
      mimeType = compressed.mimeType;

      // Call our server-side image analysis model
      const res = await fetch("/api/coach/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType,
          textDescription: `使用者上傳了一張食物照片，請給予溫和的原子習慣加分建議。`,
          profile
        })
      });

      if (!res.ok) {
        throw new Error("伺服器影像辨識失敗");
      }

      const apiResult = await res.json();
      
      const userMsg: ChatMessage = {
        id: `m-usr-img-${Date.now()}`,
        sender: "user",
        text: "📸 [上傳了美食/活動照片進行分析]",
        imageUrl: base64,
        timestamp: new Date().toISOString()
      };

      const botMsg: ChatMessage = {
        id: `m-bot-img-feedback-${Date.now()}`,
        sender: "bot",
        text: `🍀 【PaoPao AI 拍照解析中】\n\n辨識項目：${apiResult.title || '健康餐點'}\n預估熱量：${apiResult.estimatedValue} ${apiResult.unit}\n${apiResult.proteinGrams ? `估算蛋白質：${apiResult.proteinGrams} 克\n` : ''}\n教練溫和評估：\n${apiResult.coachFeedback}\n\n下方已為您開啟紀錄調整區。如有需要，您可以手動細化 (refine) 熱量或數值後確認登錄。也可以直接與我討論此餐點唷！`,
        timestamp: new Date().toISOString()
      };

      if (onAddCustomMessages) {
        onAddCustomMessages(userMsg, botMsg);
      }

      setPendingAnalysis({
        type: apiResult.type || "diet",
        title: apiResult.title || "美味飲食記錄 🍱",
        estimatedValue: apiResult.estimatedValue || 0,
        proteinGrams: apiResult.proteinGrams || 0,
        caloriesBurned: apiResult.caloriesBurned || 0,
        unit: apiResult.unit || "大卡",
        base64,
        pointsEarned: apiResult.pointsEarned || 20,
        coachFeedback: apiResult.coachFeedback || "",
        nutritionRough: apiResult.nutritionRough
      });

    } catch (err: any) {
      console.error(err);
      setUploadError("照片辨識教練今天累了，幫您做自動大卡記錄和手動加分囉！");
      
      const userMsg: ChatMessage = {
        id: `m-usr-img-err-${Date.now()}`,
        sender: "user",
        text: "📸 [上傳了照片進行分析]",
        imageUrl: base64,
        timestamp: new Date().toISOString()
      };

      const botMsg: ChatMessage = {
        id: `m-bot-img-fallback-${Date.now()}`,
        sender: "bot",
        text: `雖然拍照功能稍微忙碌中，但看見你誠實拍下這片健康起點，PaoPao 教練依然超開心！\n我在下方為您載入了預設欄位，您現在可以手動填寫確認數據進行補登與微調唷。❤️`,
        timestamp: new Date().toISOString()
      };

      if (onAddCustomMessages) {
        onAddCustomMessages(userMsg, botMsg);
      }

      setPendingAnalysis({
        type: "diet",
        title: "誠實記錄的美味點心 🧁",
        estimatedValue: 320,
        proteinGrams: 0,
        unit: "大卡",
        base64,
        pointsEarned: 20,
        coachFeedback: "雖然我的相機今天稍微模糊了一下，但看見你誠實拍下照片並記錄，我的原子習慣天線瞬間加滿！誠實是好習慣的第一滴雨水。直接幫你加記錄點 20 點！"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Drag and Drop implementation
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
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
      {/* Header with controls - extremely clean and compact */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs shrink-0">🍀</span>
          <span className="text-[10px] font-medium text-slate-500 truncate" title="PaoPao教練">
            PaoPao教練
          </span>
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

      {/* Message Feed Display */}
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
              {/* Profile/Bot Icon */}
              <div className="flex-shrink-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-3xs border ${
                  isBot ? "bg-emerald-50 text-emerald-600 border-emerald-100/20" : "bg-teal-50 text-teal-600 border-teal-100/20"
                }`}>
                  {isBot ? "🥗" : "🏃‍♀️"}
                </span>
              </div>

              {/* Message Bubble */}
              <div className="flex flex-col gap-1">
                <div
                  className={`p-3.5 rounded-2xl font-sans text-xs leading-relaxed whitespace-pre-wrap ${
                    isBot
                      ? "bg-slate-50 border border-slate-100/80 text-slate-700 rounded-tl-xs"
                      : "bg-emerald-600 text-white rounded-tr-xs"
                  }`}
                >
                  {/* Image attachment preview if present */}
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

        {/* Typing indicator */}
        {isSending && (
          <div className="flex items-start gap-2.5 max-w-[80%] self-start animate-pulse">
            <span className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100/30 flex items-center justify-center text-xs">
              🥗
            </span>
            <div className="p-3 bg-slate-50 border border-slate-100/50 rounded-2xl rounded-tl-xs flex items-center gap-1.5 text-xs text-slate-400 font-sans">
              <Loader2 size={12} className="animate-spin text-emerald-500" />
              正在為您查閱大眾營養學與運動指引庫...
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Image drag-and-drop backdrop warning overlay */}
      {isDragging && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-emerald-700 text-[10px] font-sans font-bold flex items-center justify-center gap-1 mb-2">
          <Sparkles size={12} className="animate-bounce" />
          鬆開手！PaoPao教練會自動拍照解讀成分並給你溫和加分建議喔～
        </div>
      )}

      {/* Error Indicator and Help banner */}
      {uploadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-xl flex items-center gap-1.5 mb-2 font-sans leading-normal">
          <AlertCircle size={12} className="flex-shrink-0" />
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-auto font-bold text-amber-900 cursor-pointer">
            關閉
          </button>
        </div>
      )}

      {/* Pending Image Analysis Manual Refinement Card */}
      {pendingAnalysis && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-500/20 rounded-2xl flex flex-col gap-2 mb-3.5 animate-fade-in shadow-3xs">
          <div className="flex justify-between items-center pb-2 border-b border-emerald-500/10">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 font-sans">
              <span>✍️</span> 調整並確認儲存紀錄 (Refine)
            </span>
            <button
              type="button"
              onClick={() => setPendingAnalysis(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg bg-white/70 hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-100"
              title="取消記錄"
            >
              <X size={11} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] text-emerald-900 font-bold">項目名稱：</label>
              <input
                type="text"
                className="px-2.5 py-1.5 bg-white border border-slate-200/80 rounded-lg text-slate-700 text-xs font-sans outline-hidden"
                value={pendingAnalysis.title}
                onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, title: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-emerald-900 font-bold">
                {pendingAnalysis.type === 'diet' ? '估計熱量 (大卡)：' : `累計數值 (${pendingAnalysis.unit})：`}
              </label>
              <input
                type="number"
                className="px-2.5 py-1.5 bg-white border border-slate-200/80 rounded-lg text-slate-700 text-xs font-sans outline-hidden"
                value={pendingAnalysis.estimatedValue}
                onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, estimatedValue: Number(e.target.value) })}
              />
            </div>

            {pendingAnalysis.type === 'diet' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-emerald-900 font-bold">估計蛋白質 (克)：</label>
                <input
                  type="number"
                  className="px-2.5 py-1.5 bg-white border border-slate-200/80 rounded-lg text-slate-700 text-xs font-sans outline-hidden"
                  value={pendingAnalysis.proteinGrams || 0}
                  onChange={(e) => setPendingAnalysis({ ...pendingAnalysis, proteinGrams: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const titleEmoji = pendingAnalysis.type === "diet" ? "🍱" : "🏃‍♀️";
              const isPrefixed = pendingAnalysis.title.startsWith("🍱") || pendingAnalysis.title.startsWith("🏃‍♀️") || pendingAnalysis.title.startsWith("💎") || pendingAnalysis.title.startsWith("🍀");
              const displayTitle = isPrefixed ? pendingAnalysis.title : `${titleEmoji} ${pendingAnalysis.title}`;

              onImageAnalysisResult({
                id: `r-ai-manual-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: pendingAnalysis.type,
                title: displayTitle,
                imageUrl: pendingAnalysis.base64,
                estimatedValue: pendingAnalysis.estimatedValue,
                unit: pendingAnalysis.unit,
                proteinGrams: pendingAnalysis.type === "diet" ? pendingAnalysis.proteinGrams : undefined,
                pointsEarned: pendingAnalysis.pointsEarned,
                coachFeedback: pendingAnalysis.coachFeedback,
                nutritionRough: pendingAnalysis.nutritionRough
              });
              setPendingAnalysis(null);
            }}
            className="mt-1 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer flex items-center justify-center gap-1 border border-transparent"
          >
            <span>💾</span> 確定儲存紀錄並手動登錄！
          </button>
        </div>
      )}

      {/* Input panel Form */}
      <form onSubmit={handleSendText} className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-sans text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-100/50 focus:bg-white"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isSending ? "等我幾秒分析照片喔..." : "輸入食物名稱(例：地瓜/香蕉)、運動項目(例：快走)或諮詢大眾健康方針..."}
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
