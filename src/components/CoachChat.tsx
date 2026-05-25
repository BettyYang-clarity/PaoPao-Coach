/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, UserProfile, WellnessRecord } from "../types";
import { Send, Image, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface CoachChatProps {
  messages: ChatMessage[];
  profile: UserProfile;
  onSendMessage: (text: string) => Promise<void>;
  onImageAnalysisResult: (record: WellnessRecord) => void;
}

export default function CoachChat({
  messages,
  profile,
  onSendMessage,
  onImageAnalysisResult
}: CoachChatProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

    try {
      const { base64, mimeType } = await fileToBase64Mime(file);

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

      const record: WellnessRecord = await res.json();
      
      // Update the parent: logs food, adds points, advances pet sprout
      onImageAnalysisResult(record);

    } catch (err: any) {
      console.error(err);
      setUploadError("照片辨識教練今天累了，幫你做自動大卡記錄和手動加分囉！");
      
      // Graceful local fallback record in case of transient API error
      const fallbackRecord: WellnessRecord = {
        id: `r-fallback-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "diet",
        title: "誠實記錄的美味點心 🧁",
        estimatedValue: 320,
        unit: "大卡",
        pointsEarned: 20,
        coachFeedback: "雖然我的相機今天稍微模糊了一下，但看見你誠實拍下照片並記錄，我的原子習慣天線瞬間加滿！誠實是好習慣的第一滴雨水。直接幫你加記錄點 20 點！"
      };
      onImageAnalysisResult(fallbackRecord);
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
      className={`p-6 bg-white border rounded-3xl shadow-sm flex flex-col h-[580px] transition-all duration-300 ${
        isDragging ? "ring-2 ring-indigo-500 bg-indigo-50/10 border-indigo-400" : "border-slate-100"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="w-9 h-9 bg-linear-to-tr from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xs">
              🙋‍♂️
            </span>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h3 className="font-sans text-xs font-bold text-slate-800 flex items-center gap-1">
              AI 陪跑教練
              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-mono rounded-md">
                100% 同理心人格設定
              </span>
            </h3>
            <span className="text-[9px] text-slate-400 font-sans tracking-wide">
              不指責、不恐嚇、只有加分與陪伴 🌱
            </span>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-indigo-600 px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100/50 rounded-xl text-[10px] font-sans font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
        >
          <Image size={11} />
          拍照辨職
        </button>
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
                  isBot ? "bg-indigo-50 text-indigo-600 border-indigo-100/20" : "bg-teal-50 text-teal-600 border-teal-100/20"
                }`}>
                  {isBot ? "🙋‍♂️" : "🏃‍♀️"}
                </span>
              </div>

              {/* Message Bubble */}
              <div className="flex flex-col gap-1">
                <div
                  className={`p-3.5 rounded-2xl font-sans text-xs leading-relaxed whitespace-pre-wrap ${
                    isBot
                      ? "bg-slate-50 border border-slate-100/80 text-slate-700 rounded-tl-xs"
                      : "bg-indigo-600 text-white rounded-tr-xs"
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
              🙋‍♂️
            </span>
            <div className="p-3 bg-slate-50 border border-slate-100/50 rounded-2xl rounded-tl-xs flex items-center gap-1.5 text-xs text-slate-400 font-sans">
              <Loader2 size={12} className="animate-spin text-indigo-500" />
              正在聆聽夥伴、幫你注入微習慣加持中...
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Image drag-and-drop backdrop warning overlay */}
      {isDragging && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center text-indigo-700 text-[10px] font-sans font-bold flex items-center justify-center gap-1 mb-2">
          <Sparkles size={12} className="animate-bounce" />
          鬆開手！教練會自動拍照記錄與計算並給你超溫和加分碎碎念～
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

      {/* Input panel Form */}
      <form onSubmit={handleSendText} className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-sans text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-100/50 focus:bg-white"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isSending ? "等我幾秒分析照片喔..." : "跟教練講講心事、紀錄飲食，或拍下點心照片上傳！"}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-[0.96] flex items-center justify-center shadow-xs"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
