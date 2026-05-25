/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { WellnessRecord, UserProfile } from "../types";
import { 
  Plus, 
  Coffee, 
  Calendar, 
  Eye, 
  Droplet, 
  Dumbbell, 
  Moon, 
  Smile, 
  Flame, 
  PlusCircle, 
  Check, 
  HelpCircle, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  X,
  FileText,
  TrendingUp,
  Award
} from "lucide-react";

interface WellnessDashboardProps {
  records: WellnessRecord[];
  profile: UserProfile;
  totalPoints: number;
  onAddRecord: (record: WellnessRecord) => void;
}

export default function WellnessDashboard({
  records,
  profile,
  totalPoints,
  onAddRecord
}: WellnessDashboardProps) {
  // Modal toggles to split visual complexity
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Active logging tab inside the manual modal
  const [activeTab, setActiveTab] = useState<'diet' | 'exercise' | 'sleep' | 'mood'>('diet');
  
  // Image Upload Core States
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Diet Log
  const [dietTitle, setDietTitle] = useState("");
  const [dietKcal, setDietKcal] = useState<number | "">("");

  // States for Exercise Log
  const [exerciseTitle, setExerciseTitle] = useState("");
  const [exerciseMin, setExerciseMin] = useState<number | "">("");

  // States for Sleep Log
  const [sleepHours, setSleepHours] = useState<number>(7);

  // States for Mood Log
  const [moodScore, setMoodScore] = useState<number>(4);
  const [moodNotes, setMoodNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // Base64 helper converter
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

  // AI analysis caller
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImgError("請上傳正確的圖片格式（png/jpg）檔案唷！");
      return;
    }

    setImgLoading(true);
    setImgError(null);

    try {
      const { base64, mimeType } = await fileToBase64Mime(file);

      const res = await fetch("/api/coach/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType,
          textDescription: "使用者上傳了一張食物照片，請給予溫和的原子習慣加分建議。",
          profile
        })
      });

      if (!res.ok) {
        throw new Error("影像辨識失敗");
      }

      const record: WellnessRecord = await res.json();
      onAddRecord(record);

    } catch (err: any) {
      console.error(err);
      setImgError("辨識服務稍微忙碌，已自動為你記下健康誠實加分點數囉！💖");
      
      const fallbackRecord: WellnessRecord = {
        id: `r-fallback-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "diet",
        title: "誠實記錄的美味相片 🧁",
        estimatedValue: 320,
        unit: "大卡",
        pointsEarned: 20,
        coachFeedback: "看看這張美麗的照片！看見你如此誠實地拍下飲食並用心紀錄，習慣的天線瞬間被幸福感加爆。誠實代表你的大腦已經主動覺察。直接為你加 20 分！"
      };
      onAddRecord(fallbackRecord);
    } finally {
      setImgLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

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

  // Quick hydration count helper
  const handleQuickWater = () => {
    const freshRecord: WellnessRecord = {
      id: `r-water-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "water",
      title: "補充溫開水 🥛",
      estimatedValue: 250,
      unit: "毫升",
      pointsEarned: 5,
      coachFeedback: "咕嚕咕嚕！太棒了，身體正在大聲對你說謝謝！補水是啟動新陳代謝、讓思緒敏銳最無痛的小習慣。為你加 5 點建構習慣分！繼續保持！"
    };
    onAddRecord(freshRecord);
  };

  // Helper mapping mood score to text and emoji
  const getMoodEmoji = (score: number) => {
    switch (score) {
      case 1: return { emoji: "😭/🥺", label: "有些疲憊/挫折" };
      case 2: return { emoji: "😐/🫠", label: "平淡放空中" };
      case 3: return { emoji: "🙂/🌤️", label: "溫和穩定" };
      case 4: return { emoji: "😄/☘️", label: "神清氣爽" };
      case 5: return { emoji: "🥳/🌟", label: "元氣滿滿！" };
      default: return { emoji: "🙂", label: "穩定" };
    }
  };

  // Aggregated calculations for TODAY
  const getTodayStats = () => {
    const todayStr = new Date().toDateString();
    let kcal = 0;
    let water = 0;
    let exercise = 0;
    let sleep = 0;

    records.forEach((r) => {
      const recordDate = new Date(r.timestamp);
      if (recordDate.toDateString() === todayStr) {
        if (r.type === "diet") kcal += r.estimatedValue || 0;
        if (r.type === "water") water += r.estimatedValue || 0;
        if (r.type === "exercise") exercise += r.estimatedValue || 0;
        if (r.type === "sleep") sleep += r.estimatedValue || 0;
      }
    });

    return { kcal, water, exercise, sleep };
  };

  const todayStats = getTodayStats();

  // Handle standard logs onSubmit
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let freshRecord: WellnessRecord;

    if (activeTab === "diet") {
      const title = dietTitle.trim() || "誠實飲食小記錄";
      const kcal = Number(dietKcal) || 350;
      
      freshRecord = {
        id: `r-diet-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "diet",
        title,
        estimatedValue: kcal,
        unit: "大卡",
        pointsEarned: 20,
        nutritionRough: {
          carbs: "充足 (碳水提供能量)",
          protein: "適中 (肌肉修復活力)",
          fat: "適量",
          veg: "較少 (記得下一頓多吃幾口青菜唷)"
        },
        coachFeedback: `哇，誠實記錄了『${title}』大餐！這是一次超棒的前進喔。不完美也是美好的滋味，我們為你加滿 20 分的健康誠實點！建議今晚多做 30 秒拉筋或舒服深呼吸，讓身體好好消化！`
      };

      setDietTitle("");
      setDietKcal("");
    } else if (activeTab === "exercise") {
      const title = exerciseTitle.trim() || "舒活舒展律動";
      const minutes = Number(exerciseMin) || 15;

      freshRecord = {
        id: `r-exe-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "exercise",
        title,
        estimatedValue: minutes,
        unit: "分鐘",
        pointsEarned: 20,
        coachFeedback: `太強了！你今天動了 ${minutes} 分鐘（${title}），這可是真真切切的健康存款。不管動作有多簡單、就算只是拉筋扭腰，你的身體細胞都在開心地對你唱歌唷。今日收下 20 點加分！`
      };

      setExerciseTitle("");
      setExerciseMin("");
    } else if (activeTab === "sleep") {
      freshRecord = {
        id: `r-sleep-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "sleep",
        title: `沉浸舒眠 ${sleepHours} 小時 🛌`,
        estimatedValue: sleepHours,
        unit: "小時",
        pointsEarned: 15,
        coachFeedback: `你昨晚睡了 ${sleepHours} 小時！充足的休息是一切活力複利的底層基石。即使睡眠時間不完美，光是懂得放下手機上床躺好，就是愛護自己最好的原子行動！幫你加 15 點！`
      };
    } else {
      // Mood track
      const { label, emoji } = getMoodEmoji(moodScore);
      freshRecord = {
        id: `r-mood-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "mood",
        title: `心情印記：${emoji} ${label}`,
        pointsEarned: 15,
        moodScore,
        unit: "評級",
        notes: moodNotes.trim() || "今日心靈隨記",
        coachFeedback: `嗨夥伴，非常感謝你與我分享你今日真實的心情狀態（${label}）。不論今天是晴是雨、哪怕是有點疲憊的霧霾天，這全都是生命最誠實、最美麗的波段。你願意停下來覺察情緒，在心靈原子習慣中是超高端的表現！直接為你加 15 分心靈安慰點！`
      };
      setMoodNotes("");
    }

    onAddRecord(freshRecord);
    setIsLoading(false);
    setShowLogModal(false); // Auto-close manual log after adding for sleek look
  };

  // Quick preset logger
  const logQuickAction = (type: 'diet' | 'exercise', title: string, val: number, coachMessage: string) => {
    const freshRecord: WellnessRecord = {
      id: `r-quick-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      title,
      estimatedValue: val,
      unit: type === "diet" ? "大卡" : "分鐘",
      pointsEarned: 15,
      coachFeedback: coachMessage
    };
    onAddRecord(freshRecord);
    setShowLogModal(false); // Sweet feedback closure
  };

  return (
    <div id="wellness-panel" className="flex flex-col gap-6 font-sans">
      
      {/* 1. Today's Positive Accumulative Hub (No shame, only addition) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Calorie Accumulator badge */}
        <div className="p-5 bg-white border border-brand-border rounded-[24px] flex flex-col justify-between shadow-3xs hover:shadow-2xs transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-sans font-bold text-brand-muted">已記錄熱量</span>
              <Flame size={14} className="text-brand-green/80" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-xl font-bold text-brand-text">{todayStats.kcal}</span>
              <span className="text-[10px] text-brand-ash font-sans">/ {profile.dailyCalorieTarget} kcal</span>
            </div>
          </div>
          <div className="w-full bg-brand-cream h-1.5 rounded-full overflow-hidden mt-3 border border-brand-border-light">
            <div
              className="bg-brand-green h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (todayStats.kcal / profile.dailyCalorieTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Dynamic Water Tracker */}
        <div className="p-5 bg-white border border-brand-border rounded-[24px] flex flex-col justify-between shadow-3xs hover:shadow-2xs transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-sans font-bold text-brand-muted">溫和補水</span>
              <Droplet size={14} className="text-brand-green/80" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-xl font-bold text-brand-text">{todayStats.water}</span>
              <span className="text-[10px] text-brand-ash font-sans">/ 2000 ml</span>
            </div>
          </div>
          <button
            onClick={handleQuickWater}
            className="mt-3 w-full py-1.5 text-[9px] tracking-wider uppercase bg-brand-green hover:bg-brand-darkgreen text-white font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.97] shadow-3xs"
          >
            快速 +250ml 溫水
          </button>
        </div>

        {/* Exercise Accumulator */}
        <div className="p-5 bg-white border border-brand-border rounded-[24px] flex flex-col justify-between shadow-3xs hover:shadow-2xs transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-sans font-bold text-brand-muted">累積身體活動</span>
              <Dumbbell size={14} className="text-brand-green/80" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-xl font-bold text-brand-text">{todayStats.exercise}</span>
              <span className="text-[10px] text-brand-ash font-sans">分鐘</span>
            </div>
          </div>
          <span className="text-[9px] text-brand-muted font-sans mt-3 leading-tight block">
            不費力的伸展也是大成功
          </span>
        </div>

        {/* Sleep Accumulator */}
        <div className="p-5 bg-white border border-brand-border rounded-[24px] flex flex-col justify-between shadow-3xs hover:shadow-2xs transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-sans font-bold text-brand-muted">昨晚睡眠</span>
              <Moon size={14} className="text-brand-green/80" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-xl font-bold text-brand-text">{todayStats.sleep}</span>
              <span className="text-[10px] text-brand-ash font-sans">小時</span>
            </div>
          </div>
          <span className="text-[9px] text-brand-ash font-sans mt-3 leading-tight block">
            好睡眠是一切修復的基石
          </span>
        </div>
      </div>

      {/* 2. MAIN MERGED SECTION: DIET LOG with AI IMAGE + COACH SHORTCUTS (SAVES SPACE) */}
      <div className="p-6 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-4">
        
        {/* Unit Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-brand-border-light">
          <div className="flex items-center gap-2">
            <span className="text-sm">🍱</span>
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-widest text-[#5C564A]">
              飲食紀錄
            </h3>
          </div>
          <span className="text-[9.5px] text-brand-ash font-sans font-semibold">AI 影像智能分析 & 習慣控制台</span>
        </div>

        {/* Content split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* Left Column: drag-and-drop file uploader (spans 7 cols on desktop) */}
          <div className="md:col-span-7 flex flex-col justify-between gap-3">
            <p className="text-[10px] text-brand-muted font-sans leading-relaxed">
              拍下或拖曳今日的美食照片，Lumi AI 將溫和為您鑑定大卡、營養與給予健康加分建議！
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 min-h-[120px] md:min-h-[140px] border-2 border-dashed rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all ${
                isDragging 
                  ? "border-brand-green bg-brand-cream" 
                  : "border-brand-sand hover:border-brand-green bg-brand-cream/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${
                  imgLoading ? "pointer-events-none" : "pointer-events-auto"
                }`}
                title="選取自訂相片上傳"
              />
              
              {imgLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-brand-green animate-spin" />
                  <span className="text-[10px] font-sans text-brand-green font-bold">Lumi AI 影像解讀中...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-brand-muted">
                  <div className="p-2 bg-white border border-brand-border rounded-lg shadow-3xs mb-0.5">
                    <ImageIcon size={16} className="text-brand-green" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">點擊手動選取 或 拖入美食照</span>
                  <span className="text-[9px] text-brand-ash">AI 將陪伴鑑定並自動記大卡 ☘️</span>
                </div>
              )}
            </div>

            {imgError && (
              <div className="p-2 bg-red-50 border border-red-200/40 rounded-xl flex items-start gap-1.5 text-red-600">
                <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                <p className="text-[9px] leading-relaxed font-sans">{imgError}</p>
              </div>
            )}
          </div>

          {/* Right Column: Mini action entries (spans 5 cols on desktop) */}
          <div className="md:col-span-5 flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-brand-border-light pt-4 md:pt-0 md:pl-5">
            <span className="text-[9.5px] font-sans font-bold uppercase tracking-wider text-[#8A8273] block">
              ✍️ 隨喜自主紀錄
            </span>

            <div className="flex flex-col gap-2.5">
              {/* Manual shortcut */}
              <button
                onClick={() => setShowLogModal(true)}
                className="w-full flex items-center gap-3 p-3 bg-brand-cream/60 hover:bg-brand-beige border border-brand-border rounded-xl cursor-pointer transition-all hover:translate-x-0.5 active:scale-[0.98] text-left shadow-3xs"
              >
                <div className="text-sm p-1 bg-white border border-brand-border-light rounded-lg shadow-3xs">📝</div>
                <div>
                  <span className="block text-xs font-bold text-brand-text">手動補登習慣</span>
                  <span className="text-[9px] text-[#A39B8D] font-sans">隨心記錄卡路里、運動或睡眠</span>
                </div>
              </button>

              {/* History shortcuts */}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="w-full flex items-center gap-3 p-3 bg-brand-cream/60 hover:bg-brand-beige border border-brand-border rounded-xl cursor-pointer transition-all hover:translate-x-0.5 active:scale-[0.98] text-left shadow-3xs"
              >
                <div className="text-sm p-1 bg-white border border-brand-border-light rounded-lg shadow-3xs">📜</div>
                <div>
                  <span className="block text-xs font-bold text-brand-text">誠實健康生活牆</span>
                  <span className="text-[9px] text-[#A39B8D] font-sans">展開您的原子歷史足跡與 AI 反饋</span>
                </div>
              </button>
            </div>

            <div className="p-2.5 bg-brand-beige rounded-xl border border-brand-sand text-[9px] text-[#70695C] leading-relaxed font-sans mt-1">
              ✨ 「微小的自我覺察就是改變的開始。」不計較多寡、不苛求完美，累積點數代表您今天愛護身體的具體印記！
            </div>
          </div>

        </div>

      </div>


      {/* ========================================= */}
      {/* DIALOG MODEL 1: HIGH FIDELITY MANUAL LOGGING FORM */}
      {/* ========================================= */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Inside title */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="font-sans text-sm font-bold text-brand-text">習慣記錄 & 快速無痛加分</h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segment Tab buttons inside the pop-up */}
            <div className="flex bg-brand-cream border border-brand-border p-1 rounded-xl">
              {(["diet", "exercise", "sleep", "mood"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-center text-[10px] tracking-wide font-sans font-bold rounded-lg cursor-pointer transition-all ${
                    activeTab === tab
                      ? "bg-brand-green text-white shadow-2xs"
                      : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  {tab === "diet" && "飲食 🥗"}
                  {tab === "exercise" && "運動 🏃"}
                  {tab === "sleep" && "舒眠 😴"}
                  {tab === "mood" && "心靈 🌸"}
                </button>
              ))}
            </div>

            {/* Dialog Form */}
            <form onSubmit={handleLogSubmit} className="flex flex-col gap-4">
              {activeTab === "diet" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">食物或飲品名稱</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={dietTitle}
                      onChange={(e) => setDietTitle(e.target.value)}
                      placeholder="例如：熱壓起司火腿三明治"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">估計熱量 (大卡)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={dietKcal}
                      onChange={(e) => setDietKcal(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：350 (不知道可不填)"
                    />
                  </div>
                </div>
              )}

              {activeTab === "exercise" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">活動項目</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={exerciseTitle}
                      onChange={(e) => setExerciseTitle(e.target.value)}
                      placeholder="例如：跟跑 10 分鐘"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">持續時間 (分鐘)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={exerciseMin}
                      onChange={(e) => setExerciseMin(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：15"
                      required
                    />
                  </div>
                </div>
              )}

              {activeTab === "sleep" && (
                <div className="flex flex-col gap-2 p-4 bg-brand-cream border border-brand-border-light rounded-2xl">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted flex justify-between">
                    <span>昨天睡眠長度</span>
                    <span className="text-brand-green font-bold text-xs">{sleepHours} 小時</span>
                  </span>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="0.5"
                    className="w-full accent-brand-green cursor-pointer mt-1"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-[#A39B8D] font-sans px-1">
                    <span>有些少 (4h)</span>
                    <span>完美充沛 (8h)</span>
                    <span>深度慵懶 (12h)</span>
                  </div>
                </div>
              )}

              {activeTab === "mood" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted flex justify-between">
                      <span>你此時的心情如何？</span>
                      <span className="text-brand-green font-bold text-xs">{getMoodEmoji(moodScore).emoji} {getMoodEmoji(moodScore).label}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      className="w-full accent-brand-green cursor-pointer mt-1"
                      value={moodScore}
                      onChange={(e) => setMoodScore(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">碎碎念倾訴 (可不填)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={moodNotes}
                      onChange={(e) => setMoodNotes(e.target.value)}
                      placeholder="例如：開完會心情有點喘不過氣，好在慢慢調適過來囉"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Plus size={14} />
                {isLoading ? "教練溫柔書寫中..." : "誠實記錄，獲取能量 ☘️"}
              </button>
            </form>

            {/* Atomic Quick actions block inside the popup for clean layout */}
            <div className="border-t border-brand-border-light pt-4 mt-1">
              <h4 className="font-sans text-[9px] tracking-widest uppercase font-bold text-brand-ash mb-3 flex items-center gap-1">
                <Check size={11} className="text-brand-green" />
                習慣補給一鍵完成 (推薦：無摩擦原子行動)
              </h4>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'diet', 
                    '多加一份蔬菜 🥦', 
                    30, 
                    '完美！你在餐食中主動多加了一份綠色蔬菜。微量膳食纖維正在大聲地為你喝采。加 15 點！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  多吃了蔬菜 🥦
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'exercise', 
                    '溫柔肩頸拉筋 1 分鐘 🧘', 
                    1, 
                    '這不是偷懶，是你對自己身體最誠實的感謝和放鬆體貼。身體在開心地舒展！加 15 點！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  肩頸舒緩拉筋 🧘
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'exercise', 
                    '快走動一動 10 分鐘 🏃', 
                    10, 
                    '完美！多巴胺正在腦海裡起跳呢。這就是微習慣的極致力量！收下 15 點！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  快走 10 分鐘 🏃
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'diet', 
                    '選擇無糖飲料 / 溫開水 🍵', 
                    0, 
                    '完美！血管正在大口深呼吸。這是最溫柔、最無痛的主動權，完美！加 15 點！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  改選無糖茶 🍵
                </button>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* ========================================= */}
      {/* DIALOG MODEL 2: HONESTY LIFESTYLE WALL */}
      {/* ========================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[85vh] p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Title */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">📜</span>
                <h3 className="font-sans text-sm font-bold text-brand-text">誠實健康生活牆 (累積的健康足跡)</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrolling list */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 py-1">
              {records.length === 0 ? (
                <div className="text-center py-12 text-brand-ash font-sans text-xs leading-relaxed">
                  生活牆空空的，代表你今天正在踏出隨意享受的一步喔！不急著追求成就，隨時可以補登一筆。
                </div>
              ) : (
                [...records].reverse().map((rec) => (
                  <div key={rec.id} className="p-4 rounded-2xl bg-brand-cream border border-brand-border-light flex flex-col gap-2.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-white shadow-3xs border border-brand-border-light">
                          {rec.type === 'diet' && "🥗"}
                          {rec.type === 'exercise' && "🏃"}
                          {rec.type === 'sleep' && "🛌"}
                          {rec.type === 'mood' && "🌸"}
                          {rec.type === 'water' && "🥛"}
                        </span>
                        <div>
                          <h4 className="font-sans text-xs font-bold text-brand-text line-clamp-1">{rec.title}</h4>
                          <span className="text-[9px] text-[#A39B8D] font-mono leading-none block mt-0.5">
                            {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-brand-green px-2 py-0.5 bg-white border border-brand-border-light rounded-md">
                        +{rec.pointsEarned} pts
                      </span>
                    </div>

                    {rec.estimatedValue !== undefined && (
                      <div className="flex gap-2">
                        <div className="text-[9px] px-2 py-0.5 bg-white border border-brand-border-light rounded-md text-brand-muted font-medium shadow-3xs">
                          數據：{rec.estimatedValue} {rec.unit}
                        </div>
                        {rec.nutritionRough && (
                          <div className="text-[9px] font-medium text-[#A39B8D] flex items-center gap-1 bg-white px-2 py-0.5 border border-brand-border-light rounded-md shadow-3xs">
                            <span>碳水: {rec.nutritionRough.carbs}</span>
                            <span>•</span>
                            <span>蛋白: {rec.nutritionRough.protein}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Empathetic AI Feedback */}
                    <div className="px-3.5 py-2.5 bg-white border border-brand-border rounded-xl">
                      <p className="text-[10px] text-brand-muted font-sans leading-relaxed">
                        🙋‍♂️ <span className="font-bold text-brand-green">Lumi 教練：</span>
                        {rec.coachFeedback}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Compact footer inside popup */}
            <div className="pt-3 border-t border-brand-border-light text-center text-[9px] text-brand-ash flex-shrink-0">
              不批評、不審判、只有滿滿的無痛累積。
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
