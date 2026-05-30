/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { CoachState, MicroTask, WellnessRecord, ChatMessage } from "./types";
import { loadCoachState, saveCoachState, getTasksFromSelectedHabits } from "./lib/storage";
import { evaluateBadges } from "./lib/badgeEngine";
import ProfileForm from "./components/ProfileForm";
import HabitBoard from "./components/HabitBoard";
import WellnessDashboard from "./components/WellnessDashboard";
import CoachChat from "./components/CoachChat";
import HealthPlanSummary from "./components/HealthPlanSummary";
import TipCard from "./components/TipCard";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, MessageSquare, X, Check, Settings, ClipboardList } from "lucide-react";

// Helper to calculate habit streaks and cumulative days
function getStreakInfo(records: WellnessRecord[], microTasks: MicroTask[], isExcused: boolean = false) {
  const activeDatesSet = new Set<string>();

  // 1. Collect dates from records (format: YYYY-MM-DD)
  records.forEach((r) => {
    if (r.timestamp) {
      activeDatesSet.add(r.timestamp.slice(0, 10));
    }
  });

  // 2. Collect dates from completed micro-tasks
  microTasks.forEach((t) => {
    if (t.completed && t.completedAt) {
      activeDatesSet.add(t.completedAt.slice(0, 10));
    }
  });

  // 3. Inject today into active dates set if today is excused
  if (isExcused) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    activeDatesSet.add(`${y}-${m}-${d}`);
  }

  const totalActiveDays = activeDatesSet.size;

  if (totalActiveDays === 0) {
    return { consecutiveStreak: 0, totalActiveDays: 0 };
  }

  // Get active dates sorted chronologically
  const activeDates = Array.from(activeDatesSet).sort();
  
  // Use today's local date as basis
  const now = new Date();
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatLocalDate(now);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  const hasToday = activeDatesSet.has(todayStr);
  const hasYesterday = activeDatesSet.has(yesterdayStr);

  if (!hasToday && !hasYesterday) {
    return { consecutiveStreak: 0, totalActiveDays };
  }

  // Start checking backwards
  let checkDate = hasToday ? now : yesterday;
  let streak = 0;

  while (true) {
    const checkStr = formatLocalDate(checkDate);
    if (activeDatesSet.has(checkStr)) {
      streak++;
      // Go to previous day
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { consecutiveStreak: streak, totalActiveDays };
}

export default function App() {
  // Master state
  const [state, setState] = useState<CoachState>(() => loadCoachState());

  // Top navigation tabs
  const [currentTab, setCurrentTab] = useState<'plan' | 'record' | 'settings'>('plan');

  // Layered dialog chat overlay
  const [showChatModal, setShowChatModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Pending context from WellnessDashboard → CoachChat bridge
  const [pendingChatFile, setPendingChatFile] = useState<File | null>(null);
  const [pendingChatQuery, setPendingChatQuery] = useState<string | null>(null);

  const badges = evaluateBadges(state.records, state.profile.dailyCalorieTarget || 1600, state.microTasks, state.totalPoints);
  const unlockedBadgesCount = badges.filter(b => b.isUnlocked).length;
  const { consecutiveStreak, totalActiveDays } = getStreakInfo(state.records, state.microTasks, state.isExcused);

  // Auto-sync state edits to localStorage
  useEffect(() => {
    saveCoachState(state);
  }, [state]);

  // Daily cross-day auto-reset logic for atomic tasks
  useEffect(() => {
    const getTodayStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayStr();
    const lastReset = localStorage.getItem("pao_pao_last_reset_date");

    if (lastReset !== todayStr) {
      setState((prev) => {
        const resetTasks = prev.microTasks.map((t) => ({
          ...t,
          completed: false,
          completedAt: undefined
        }));
        return {
          ...prev,
          microTasks: resetTasks,
          isExcused: false // 跨日清空特赦狀態
        };
      });
      localStorage.setItem("pao_pao_last_reset_date", todayStr);
    }
  }, []);

  // Handle toggling of micro-tasks (Using delta point calculation to persist historical points)
  const handleToggleTask = (id: string) => {
    setState((prev) => {
      let pointsDiff = 0;
      const updatedTasks = prev.microTasks.map((task) => {
        if (task.id === id) {
          const newCompleted = !task.completed;
          pointsDiff = newCompleted ? task.points : -task.points;
          return { ...task, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : undefined };
        }
        return task;
      });

      return {
        ...prev,
        microTasks: updatedTasks,
        totalPoints: prev.totalPoints + pointsDiff
      };
    });
  };

  // Toggle today's excuse shield status
  const handleToggleExcuse = () => {
    setState((prev) => ({
      ...prev,
      isExcused: !prev.isExcused
    }));
  };

  // Add custom micro-task
  const handleAddTask = (newTask: MicroTask) => {
    setState((prev) => ({
      ...prev,
      microTasks: [newTask, ...prev.microTasks]
    }));
  };

  // Replace whole lists
  const handleRegenerateTasks = (newTasks: MicroTask[]) => {
    setState((prev) => ({
      ...prev,
      microTasks: newTasks
    }));
  };

  // Save profile edits
  const handleSaveProfile = (newProfile: any) => {
    const syncedTasks = getTasksFromSelectedHabits(newProfile);
    setState((prev) => ({
      ...prev,
      profile: newProfile,
      microTasks: syncedTasks
    }));
  };

  // Add newly logged record (diet, exercise, water, sleep, mood)
  const handleAddRecord = (record: WellnessRecord) => {
    setState((prev) => {
      const newRecords = [...prev.records, record];
      const newTotalPoints = prev.totalPoints + record.pointsEarned;

      // Automatically construct corresponding coach chat bubble to make chat feel highly synchronized!
      const newCoachMessage: ChatMessage = {
        id: `m-bot-praise-${Date.now()}`,
        sender: "bot",
        text: `【自動分析回饋】\n我幫你把『${record.title}』登錄在健康牆上囉！✨\n\n${record.coachFeedback}`,
        timestamp: new Date().toISOString()
      };

      return {
        ...prev,
        records: newRecords,
        totalPoints: newTotalPoints,
        messages: [...prev.messages, newCoachMessage]
      };
    });
  };

  // Delete a logged record (diet, exercise, water, sleep, mood)
  const handleDeleteRecord = (recordId: string) => {
    setState((prev) => {
      const recordToDelete = prev.records.find(r => r.id === recordId);
      if (!recordToDelete) return prev;
      
      const newRecords = prev.records.filter(r => r.id !== recordId);
      const pointsToSubtract = recordToDelete.pointsEarned || 0;
      const newTotalPoints = Math.max(0, prev.totalPoints - pointsToSubtract);

      const deleteCoachMessage: ChatMessage = {
        id: `m-bot-delete-${Date.now()}`,
        sender: "bot",
        text: `【自動系統通知】\n我已在健康牆上協助刪除了『${recordToDelete.title}』紀錄，相關數據與累計積分已同步調整。`,
        timestamp: new Date().toISOString()
      };

      return {
        ...prev,
        records: newRecords,
        totalPoints: newTotalPoints,
        messages: [...prev.messages, deleteCoachMessage]
      };
    });
  };

  // Update/Edit a logged record (diet, exercise, water, sleep, mood)
  const handleUpdateRecord = (updatedRecord: WellnessRecord) => {
    setState((prev) => {
      const oldRec = prev.records.find(r => r.id === updatedRecord.id);
      const pointsDiff = (updatedRecord.pointsEarned || 0) - (oldRec?.pointsEarned || 0);
      
      const updatedRecords = prev.records.map((r) => {
        if (r.id === updatedRecord.id) {
          return updatedRecord;
        }
        return r;
      });

      const updateCoachMessage: ChatMessage = {
        id: `m-bot-update-${Date.now()}`,
        sender: "bot",
        text: `【系統通知】\n我已更新了健康牆上的『${updatedRecord.title}』紀錄數據。`,
        timestamp: new Date().toISOString()
      };

      return {
        ...prev,
        records: updatedRecords,
        totalPoints: Math.max(0, prev.totalPoints + pointsDiff),
        messages: [...prev.messages, updateCoachMessage]
      };
    });
  };

  // Navigate to chat modal with optional auto-trigger file or query
  const handleNavigateToChat = (query?: string, file?: File) => {
    setPendingChatQuery(query || null);
    setPendingChatFile(file || null);
    setShowChatModal(true);
  };

  // Add custom messages to feed (typically user action + AI reaction)
  const handleAddCustomMessages = (userMsg: ChatMessage | null, botMsg: ChatMessage) => {
    setState((prev) => ({
      ...prev,
      messages: userMsg
        ? [...prev.messages, userMsg, botMsg]
        : [...prev.messages, botMsg]
    }));
  };

  // Clear chat history to let user re-initialize with new profile and dietitian setup
  const handleClearMessages = () => {
    setState((prev) => ({
      ...prev,
      messages: [
        {
          id: "m-welcome",
          sender: "bot",
          text: "嗨！我是 PaoPao教練，很高興陪伴你。❤️\n\n在這裡，你可以直接輸入食物或運動粗估熱量（供哈佛餐盤大眾指南對照），或點擊『飲食拍照』自動分析。每天都有專屬原子任務，我們一起無痛培養健康認同吧！🌱",
          timestamp: new Date().toISOString()
        }
      ]
    }));
  };

  // Empathy chat message submission
  const handleSendMessage = async (userText: string) => {
    // Append user message immediately to the feed
    const userMsg: ChatMessage = {
      id: `m-usr-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toISOString()
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg]
    }));

    try {
      const chatHistory = [...state.messages, userMsg].slice(-8); // slice last few to keep context prompt fast

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 seconds timeout to prevent hanging

      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: chatHistory,
          profile: state.profile
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errDetail = "";
        try {
          errDetail = await res.text();
        } catch (_) {}
        throw new Error(`對話回傳失敗 (狀態碼: ${res.status}${errDetail ? ", 內容: " + errDetail.slice(0, 100) : ""})`);
      }
      const data = await res.json();

      // Append chatbot reply
      const coachMsg: ChatMessage = {
        id: `m-bot-${Date.now()}`,
        sender: "bot",
        text: data.reply || data.text || "收到囉！在微習慣養成的陪跑路上，我們一起誠實記錄、輕鬆面對生活中的每一步！☕️",
        timestamp: new Date().toISOString()
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, coachMsg]
      }));

    } catch (e: any) {
      console.error(e);
      // Fallback message with debug details
      const fallbackMsg: ChatMessage = {
        id: `m-bot-fallback-${Date.now()}`,
        sender: "bot",
        text: `嗨！在忙嗎？不論過得如何，都感謝你誠實寫下來！你今天想要聽聽什麼微小的健康加分點滴呢？❤️\n\n⚠️ 【前端連線診斷資訊】\n- 連線錯誤：${e.message || JSON.stringify(e)}\n- 請求路徑：/api/coach/chat`,
        timestamp: new Date().toISOString()
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, fallbackMsg]
      }));
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-text font-sans selection:bg-brand-beige pb-12 flex flex-col justify-between">
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/50 border-b border-brand-border px-3 sm:px-6 py-3.5 flex items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center shadow-xs flex-shrink-0">
            <span className="text-sm">🌿</span>
          </div>
          <div className="flex-shrink-0">
            <h1 className="font-sans text-sm sm:text-base font-bold tracking-tight text-brand-olive flex items-center gap-1.5 whitespace-nowrap">
              PaoPao Coach
            </h1>
            <p className="text-[9px] sm:text-[10px] text-brand-ash font-sans tracking-wide whitespace-nowrap">
              原子習慣健康教練
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Squeaky clean, compact active Streak Indicator */}
          <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F5EFE4] border border-[#E6DEC9] rounded-full shadow-4xs transition-all select-none whitespace-nowrap flex-shrink-0">
            <span className="text-sm filter drop-shadow-[#E07A5F_0px_1px_1px] mr-0.5">🔥</span>
            <span className="font-sans text-[10px] sm:text-[10.5px] font-bold flex items-center gap-0.5">
              <span className="text-[#D95F29]">連續 <span className="font-mono font-black text-[11px] sm:text-xs">{consecutiveStreak}</span> 天</span>
              <span className="text-[#D3CBB8] font-normal select-none mx-0.5">|</span>
              <span className="text-[#7A7261]">累積 <span className="font-mono font-black text-[11px] sm:text-xs text-brand-green">{totalActiveDays}</span> 天</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Top Directive Tab Navigation Bar */}
      <div className="bg-brand-cream border-b border-brand-border/60 sticky top-[73px] z-30 backdrop-blur-md py-1.5 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center sm:justify-start">
          {/* Segmented Sliding Capsule Switcher */}
          <div className="bg-[#EAE3D2]/40 border border-brand-border p-0.5 rounded-xl flex items-center relative shadow-3xs w-full sm:w-auto">
            <button
              id="tab-plan"
              onClick={() => setCurrentTab('plan')}
              className={`relative z-10 px-4 py-1.5 text-xs font-sans font-extrabold tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 flex-1 sm:flex-initial whitespace-nowrap cursor-pointer ${
                currentTab === 'plan' ? "text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {currentTab === 'plan' && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0 bg-brand-green rounded-lg -z-10 shadow-xs"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span>🌱 原子健康計劃</span>
            </button>
            
            <button
              id="tab-record"
              onClick={() => setCurrentTab('record')}
              className={`relative z-10 px-4 py-1.5 text-xs font-sans font-extrabold tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 flex-1 sm:flex-initial whitespace-nowrap cursor-pointer ${
                currentTab === 'record' ? "text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {currentTab === 'record' && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0 bg-brand-green rounded-lg -z-10 shadow-xs"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span>🍱 健康紀錄</span>
            </button>
            
            <button
              id="tab-settings"
              onClick={() => setCurrentTab('settings')}
              className={`relative z-10 px-4 py-1.5 text-xs font-sans font-extrabold tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 flex-1 sm:flex-initial whitespace-nowrap cursor-pointer ${
                currentTab === 'settings' ? "text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {currentTab === 'settings' && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0 bg-brand-green rounded-lg -z-10 shadow-xs"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span>⚙️ 個人設定</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 mt-6 flex flex-col gap-6 flex-1 w-full animate-fade-in">
        <AnimatePresence mode="wait">
          {currentTab === 'plan' && (
            <motion.div
              id="plan-view"
              key="plan"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6 w-full"
            >
              {/* TOP REMINDER BANNER FOR PERSONAL GOAL & MODAL TRIGGERS */}
              <div id="top-reminder-hero" className="p-6 md:p-8 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col md:flex-row gap-6 items-center justify-between transition-all hover:shadow-2xs animate-fade-in">
                <div className="flex-1 flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-sans font-bold tracking-widest uppercase text-brand-green bg-brand-beige px-3 py-1 rounded-full border border-brand-sand max-w-fit">
                    🌱 今日原子健康計畫指南
                  </span>
                  <h2 className="font-sans text-sm font-bold border-none text-brand-olive leading-tight">
                    {state.profile.customGoal ? `「${state.profile.customGoal}」` : "「歡迎點擊個人設定，開啟專屬您的無痛小習慣之旅 ☘️」"}
                  </h2>
                  <div className="text-[10.5px] text-brand-ash leading-relaxed font-medium font-sans flex flex-col gap-1.5 mt-0.5 border-t border-brand-border-light/40 pt-2.5">
                    <span className="font-extrabold text-brand-olive text-xs">PaoPao教練：為你拆解今日健康戰略 ➔</span>
                    <p className="pl-2 border-l-2 border-brand-green/30">
                      1. **飲食防線**：對齊大眾哈佛餐盤比例，將今日總攝取控制在 **{state.profile.dailyCalorieTarget || 1600} 大卡** 內。
                    </p>
                    <p className="pl-2 border-l-2 border-brand-green/30">
                      2. **習慣累積**：勾選並完成下方的 **「今日原子任務」**。運動或喝水後隨手打卡以累積行為複利。
                    </p>
                    <p className="pl-2 border-l-2 border-brand-green/30">
                      3. **修護與能耗**：維持 **{state.profile.dailySleepTarget || 7} 小時** 睡眠，並透過起步走走達成 **{state.profile.dailyExerciseTarget || 30} 分鐘** 活動量。
                    </p>
                    <span className="text-[9.5px] text-[#A39B8D] italic font-normal mt-1 flex items-center gap-1">
                      💡 指引：點擊右側「原子健康計劃 📋」看完整圖表戰略，或點擊「PaoPao教練」拍照辨識、對話解惑。每天溫和前行 1%！
                    </span>
                  </div>
                </div>
                
                {/* THE "OTHERS BECOME ICONS" CONTROL DOCK */}
                <div className="w-full md:w-auto flex-shrink-0 flex flex-col gap-3 min-w-[300px] border-t md:border-t-0 md:border-l border-brand-border-light pt-4 md:pt-0 md:pl-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#8A8273]">
                      快選教練工具
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Trigger: Chatbot Dialog */}
                    <button
                      id="btn-coach-chat"
                      onClick={() => {
                        handleClearMessages();
                        setShowChatModal(true);
                      }}
                      className="p-3 bg-brand-cream hover:bg-[#F3EFE6] border border-brand-border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-3xs hover:shadow-2xs"
                      title="PaoPao教練"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EAE3D2] flex items-center justify-center text-brand-green">
                        <MessageSquare size={16} />
                      </div>
                      <span className="text-[10px] font-sans font-extrabold text-[#5C564A]">PaoPao教練</span>
                    </button>

                    {/* Trigger: Open Atomic Health Plan popup modal */}
                    <button
                      id="btn-goto-plan-summary"
                      onClick={() => setShowPlanModal(true)}
                      className="p-3 bg-brand-cream hover:bg-[#F3EFE6] border border-brand-border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-3xs hover:shadow-2xs"
                      title="點擊查看原子健康計劃與戰略目標"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EAE3D2] text-brand-green flex items-center justify-center">
                        <ClipboardList size={16} />
                      </div>
                      <span className="text-[10px] font-sans font-extrabold text-[#5C564A]">原子健康計劃 📋</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* NATIVE INTEGRATED HAZEL-FREE HABIT CHECKLIST */}
              <div id="integrated-habits-board" className="p-6 md:p-8 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center gap-2 pb-3 border-b border-brand-border-light">
                  <span className="text-xl">📋</span>
                  <h3 className="font-sans text-xs font-extrabold uppercase tracking-widest text-[#5C564A]">
                    今日原子任務
                  </h3>
                </div>
                <HabitBoard
                  tasks={state.microTasks}
                  profile={state.profile}
                  isExcused={state.isExcused}
                  onToggleExcuse={handleToggleExcuse}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onRegenerateTasks={handleRegenerateTasks}
                />
              </div>

              {/* Under-dashboard friendly science reminder */}
              <TipCard />
            </motion.div>
          )}

          {currentTab === 'record' && (
            <motion.div
              id="records-view"
              key="record"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6 w-full"
            >
              {/* Wellness entries, diet logs, calorie targets are nested here */}
              <div id="wellness-dashboard-container" className="w-full">
                <WellnessDashboard
                  records={state.records}
                  profile={state.profile}
                  totalPoints={state.totalPoints}
                  microTasks={state.microTasks}
                  onAddRecord={handleAddRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onUpdateRecord={handleUpdateRecord}
                  onNavigateToChat={handleNavigateToChat}
                />
              </div>
            </motion.div>
          )}

          {currentTab === 'settings' && (
            <motion.div
              id="settings-view"
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6 w-full"
            >
              {/* Streamlined settings container */}
              <div id="integrated-settings-card" className="p-6 md:p-8 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-5">
                <ProfileForm
                  profile={state.profile}
                  onSave={(newProfile) => {
                    handleSaveProfile(newProfile);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ========================================= */}
      {/* OVERLAY DIALOG 2: EMPATHETIC BOT CHATBOT */}
      {/* ========================================= */}
      {showChatModal && (
        <div id="coach-chat-overlay" className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-[480px] w-full h-[580px] max-h-[85vh] p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">💬</span>
                <h3 className="font-sans text-xs font-bold text-brand-text">PaoPao教練</h3>
              </div>
              <button
                id="btn-close-chat"
                onClick={() => {
                  setShowChatModal(false);
                  handleClearMessages();
                }}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content area: No nested scrollbar wrapper  */}
            <div className="flex-1 min-h-0">
              <CoachChat
                messages={state.messages}
                profile={state.profile}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearMessages}
                onImageAnalysisResult={(rec) => {
                  handleAddRecord(rec);
                  setShowChatModal(false);
                }}
                onAddCustomMessages={handleAddCustomMessages}
                autoFile={pendingChatFile}
                autoQuery={pendingChatQuery}
                onAutoConsumed={() => {
                  setPendingChatFile(null);
                  setPendingChatQuery(null);
                }}
              />
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-brand-border-light text-center text-[9px] text-[#A39B8D] flex-shrink-0">
              PaoPao教練提供大眾健康指引與溫和陪伴。
            </div>
            
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* OVERLAY DIALOG 3: ATOMIC HEALTH PLAN MODAL */}
      {/* ========================================= */}
      {showPlanModal && (
        <div id="health-plan-overlay" className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-[480px] w-full max-h-[80vh] p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">📋</span>
                <h3 className="font-sans text-xs font-bold text-[#5C564A]">原子健康計劃</h3>
              </div>
              <button
                id="btn-close-plan"
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <HealthPlanSummary profile={state.profile} />
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-brand-border-light text-center text-[9px] text-[#A39B8D] flex-shrink-0">
              微小習慣積沙成塔，今日進步 1% 就是成功！
            </div>
            
          </div>
        </div>
      )}

      {/* 3. Bottom Disclaimer / Safe Zone Footer */}
      <footer className="mt-12 py-5 px-6 flex flex-col sm:flex-row items-center justify-between border-t border-brand-border text-[9.5px] text-brand-ash font-bold tracking-wider bg-white/50 w-full gap-2">
        <span>PaoPao Coach — 行為複利微習慣工具</span>
        <div className="flex items-center gap-3 text-[9px] text-brand-muted">
          <span>非醫療處方與診斷</span>
          <span className="text-brand-border-light select-none">|</span>
          <span>行為科學設計</span>
        </div>
      </footer>

      {/* Persistent floating action button (FAB) for Coach PaoPao */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {!showChatModal && (
            <motion.button
              id="fab-pao-coach"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                handleClearMessages();
                setShowChatModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-3 shadow-xl hover:shadow-2xl flex items-center gap-2 cursor-pointer border border-emerald-500/20 group relative"
              title="隨時找 PaoPao 教練聊聊"
            >
              {/* Notification pulse highlight */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span className="text-sm">💬</span>
              <span className="text-xs font-sans font-bold tracking-wide">PaoPao教練在線</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
