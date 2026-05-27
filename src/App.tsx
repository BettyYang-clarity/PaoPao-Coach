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
import { Sparkles, Bell, BellOff, MessageSquare, X, Check, Settings, ClipboardList } from "lucide-react";

// Helper to split long notifications into compact sequential pages of max ~45 characters or by sentence bounds
function getNotificationPages(text: string | null): string[] {
  if (!text) return [];
  const clean = text.trim();
  const sentences = clean.split(/(?<=[。！？；,，、])/g).filter(s => s.trim().length > 0);
  
  const pages: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    if ((buffer + sentence).length > 45) {
      if (buffer) pages.push(buffer);
      buffer = sentence;
    } else {
      buffer += sentence;
    }
  }
  if (buffer) pages.push(buffer);
  
  if (pages.length === 0 && clean) {
    pages.push(clean);
  }
  return pages;
}

// Helper to calculate habit streaks and cumulative days
function getStreakInfo(records: WellnessRecord[], microTasks: MicroTask[]) {
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

  // Interactive notifications states
  const [bellEnabled, setBellEnabled] = useState(true);
  const [coachNotification, setCoachNotification] = useState<string | null>(null);
  const [lastReminderDate, setLastReminderDate] = useState<string>("");
  const [notifPage, setNotifPage] = useState(0);

  // Top navigation tabs
  const [currentTab, setCurrentTab] = useState<'plan' | 'record' | 'settings'>('plan');

  // Layered dialog chat overlay
  const [showChatModal, setShowChatModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const badges = evaluateBadges(state.records, state.profile.dailyCalorieTarget || 1600);
  const unlockedBadgesCount = badges.filter(b => b.isUnlocked).length;
  const { consecutiveStreak, totalActiveDays } = getStreakInfo(state.records, state.microTasks);

  // Reset page when notification changes
  useEffect(() => {
    setNotifPage(0);
  }, [coachNotification]);

  // Auto-sync state edits to localStorage
  useEffect(() => {
    saveCoachState(state);
  }, [state]);

  // Periodic simulated health reminders (Notification simulation)
  useEffect(() => {
    if (!bellEnabled) return;

    const selectedGoals = state.profile.selectedGoals || [];
    let reminders: string[] = [
      "🔔 【教練溫暖提醒】：坐了很久了嗎？現在起來把肩膀往後轉動 5 下、深深吐氣，感謝今天一直帶領你的身體喔。 ☕",
      "🔔 【小習慣大能量】：微習慣就像雪球。不求一夕登天，每日前進 1% 就是最佳成就！ 🌿"
    ];

    selectedGoals.forEach((goalId) => {
      switch (goalId) {
        case "weight_loss":
          reminders.push(`🔔 【減肥計劃提拉】：今天保持正向心態，把大卡指標守護在 ${state.profile.dailyCalorieTarget} kcal。記得晚飯 8 分飽，給內臟夜間自噬休息的空檔喔！ ⚖️`);
          reminders.push("🔔 【哈佛餐盤原則】：午餐或晚餐實踐一下蔬菜佔盤面一半（2等份）的綠色搭配比例，這能非常高效地穩住脂肪堆積！ 🥦");
          break;
        case "better_sleep":
          reminders.push("🔔 【深眠環境保護】：今晚睡前 30 分鐘，把手機放遠一點，改看一看書。移開藍光干擾，今夜慢波深睡會極限延長！ 💤");
          break;
        case "mental_wellness":
          reminders.push("🔔 【心理復原大師】：今天壓力大？對鏡中自己說聲「辛苦了，你很棒」。不追求完美，今天誠實記錄生活，就是特級大成功！ 🌸");
          break;
        case "general_health":
          reminders.push("🔔 【健康規律補水】：早上起暖胃溫開水大洗禮，下午時時啜飲。每日喝足體重 x35ml 毫升水，是代謝順暢運行的秘密！ 🥛");
          break;
      }
    });

    if (reminders.length <= 2) {
      reminders = [
        "🔔 【教練溫暖提醒】：坐了很久了嗎？現在起來把肩膀往後轉動 5 下、深深吐氣，感謝今天一直帶領你的身體喔。 ☕",
        "🔔 【水分加分號角】：下午三點了！去倒一杯溫暖的白開水慢慢喝，滋潤你疲憊的大腦跟皮膚吧。 🥛",
        "🔔 【原子超微伸展】：太累不想動？沒關係，躺下把雙腿抬高貼牆 1 分鐘，這就是最佳的修復大成功。 🛌"
      ];
    }

    // Trigger an initial tip after a small delay
    const initialTimer = setTimeout(() => {
      setCoachNotification(reminders[Math.floor(Math.random() * reminders.length)]);
    }, 12000);

    // Dynamic timer
    const interval = setInterval(() => {
      const selected = reminders[Math.floor(Math.random() * reminders.length)];
      setCoachNotification(selected);
    }, 45000); // remind every 45s so the preview user sees it working!

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [bellEnabled, state.profile.selectedGoals, state.profile.dailyCalorieTarget]);

  // Precise scheduled daily health check reminder
  useEffect(() => {
    if (state.profile.dailyReminderEnabled === false) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const currentDateString = now.toDateString(); // e.g. "Wed May 27 2026"
      const targetTime = state.profile.dailyReminderTime || "09:00";

      if (currentHHMM === targetTime && lastReminderDate !== currentDateString) {
        setLastReminderDate(currentDateString);
        
        const notifyText = `🔔 【原子定時打卡提醒】：您的個人精準原子習慣提醒時間 (${targetTime}) 到了！隨手登錄一杯起點水、拍個照，或花 15 秒告訴 PaoPao 輕巧小習慣今天如何，一起累積複利大健康吧！🌱`;
        setCoachNotification(notifyText);

        // Standard HTML5 Web Notification Integration
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("PaoPao 原子健康教練", {
              body: `提醒主人：微小習慣積沙成塔，您預定的健康習慣打卡時間點 (${targetTime}) 到了唷！🌿`,
              icon: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=128&q=80"
            });
          } catch (e) {
            console.error("Native notification instantiation bypassed in active window:", e);
          }
        }
      }
    }, 15000); // Poll and cross-match matching targets precisely every 15 seconds

    return () => clearInterval(checkInterval);
  }, [state.profile.dailyReminderEnabled, state.profile.dailyReminderTime, lastReminderDate]);

  // Handle toggling of micro-tasks
  const handleToggleTask = (id: string) => {
    setState((prev) => {
      const updatedTasks = prev.microTasks.map((task) => {
        if (task.id === id) {
          const newCompleted = !task.completed;
          return { ...task, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : undefined };
        }
        return task;
      });

      // Calculate total points
      const tPoints = updatedTasks.reduce((acc, t) => acc + (t.completed ? t.points : 0), 0) + 
                       prev.records.reduce((acc, r) => acc + r.pointsEarned, 0);

      return {
        ...prev,
        microTasks: updatedTasks,
        totalPoints: tPoints
      };
    });
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

  // Clear chat history to let user re-initialize with new profile and dietitian setup
  const handleClearMessages = () => {
    setState((prev) => ({
      ...prev,
      messages: [
        {
          id: "m-welcome",
          sender: "bot",
          text: "嗨！我是您的 PaoPao教練。很高興今天能夠陪伴你！❤️\n\n在這裡：\n👉 輸入「食物名稱」(如：地瓜/香蕉)，我會為您估算標準卡路里與三大營養配盤成分參考（不提供任何個人化臨床飲食治療方案，但為您送上哈佛餐盤公開指引比對）。\n👉 輸入「運動」(如：慢跑/重訓)，我會為您幫忙依代謝當量估算約略消耗大卡與運動推薦！\n👉 點擊「飲食拍照」就能自動分析與無痛習慣打卡。\n\n每天都有專屬原子小任務，一起輕鬆無痛培養一輩子的健康認同吧！🌱",
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

      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: chatHistory,
          profile: state.profile
        })
      });

      if (!res.ok) throw new Error("對話回傳失敗");
      const data = await res.json();

      // Append chatbot reply
      const coachMsg: ChatMessage = {
        id: `m-bot-${Date.now()}`,
        sender: "bot",
        text: data.reply || data.text || "我已妥善記錄您的習慣足跡，助力解鎖健康勳章唷！",
        timestamp: new Date().toISOString()
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, coachMsg]
      }));

    } catch (e) {
      console.error(e);
      // Fallback message
      const fallbackMsg: ChatMessage = {
        id: `m-bot-fallback-${Date.now()}`,
        sender: "bot",
        text: "嗨！在忙嗎？不論過得如何，都感謝你誠實寫下來！你今天想要聽聽什麼微小的健康加分點滴呢？❤️",
        timestamp: new Date().toISOString()
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, fallbackMsg]
      }));
    }
  };

  const forceRemindMe = () => {
    const alerts = [
      "🔔 【水分元氣口哨】：倒杯溫水慢慢地喝完，讓乾涸的體魄享受大自然的灌溉吧！加油！🥛",
      "🔔 【無痛微拉筋】：現在雙手臂向上伸直，十指用力交握、維持 15 秒，你又朝解鎖徽章邁進了一大步！🧘",
      "🔔 【大腦減壓碎碎念】：不完美真的沒關係。就算是吃炸雞，它也幫今天疲憊的你補充滿滿的多巴胺！我們完全不扣分，今天記錄了就是大成功！✨",
      "🔔 【舒甜微小好意】：今晚睡前一小時，把手機放到手碰不著的地方，幫明天清亮的大腦存點定力基礎。😴"
    ];
    setCoachNotification(alerts[Math.floor(Math.random() * alerts.length)]);
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

          {/* Core Alert Toggle/Action Bell button */}
          <button
            onClick={() => {
              setBellEnabled(!bellEnabled);
              if (!bellEnabled) forceRemindMe();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex-shrink-0 ${
              bellEnabled 
                ? "bg-brand-beige border-brand-sand text-brand-green shadow-xs hover:bg-white" 
                : "bg-white/50 border-brand-border text-brand-ash hover:text-brand-muted"
            }`}
            title={bellEnabled ? "教練叮嚀已開啟 (每 45 秒發送)" : "開啟定時叮嚀"}
          >
            {bellEnabled ? <Bell size={14} className="animate-swing" /> : <BellOff size={14} />}
          </button>
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
                <div className="flex-1 flex flex-col gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-sans font-bold tracking-widest uppercase text-brand-green bg-brand-beige px-3 py-1 rounded-full border border-brand-sand max-w-fit">
                    🌱 今日原子健康計畫指南
                  </span>
                  <h2 className="font-sans text-sm font-bold border-none text-brand-olive leading-tight">
                    {state.profile.customGoal ? `「${state.profile.customGoal}」` : "「歡迎點擊個人設定，開啟專屬您的無痛小習慣之旅 ☘️」"}
                  </h2>
                  <p className="text-[10px] text-brand-ash leading-relaxed">
                    PaoPao 教練：微小的習慣最牢固。不求一天登天，今天只要有前進 1%，您就是最大成功！
                  </p>
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
                      onClick={() => setShowChatModal(true)}
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
                      className="p-3 bg-brand-cream hover:bg-[#F3EFE6] border border-brand-border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-3xs hover:shadow-2xs animate-pulse"
                      title="點擊查看原子健康計劃與戰略目標"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-brand-green flex items-center justify-center border border-emerald-350">
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
                  onAddRecord={handleAddRecord}
                  onDeleteRecord={handleDeleteRecord}
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
                  handleClearMessages(); // seamless auto refresh back to welcome state
                }}
              />
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-brand-border-light text-center text-[9px] text-[#A39B8D] flex-shrink-0">
              PaoPao教練為你提供無判決、極致包容、純溫暖的健康指引支持。
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
              微小習慣積沙成塔，今日進步 1% 就是最大成功！
            </div>
            
          </div>
        </div>
      )}

      {/* Dynamic Floating Coach Notification Toast */}
      <AnimatePresence>
        {coachNotification && (
          <motion.div
            id="floating-coach-toast"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 z-40 max-w-xs sm:max-w-md bg-white border-2 border-emerald-500/30 rounded-[28px] p-5 shadow-2xl flex flex-col gap-3 font-sans text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🧠</span>
                <span className="text-[10px] font-sans font-black tracking-widest uppercase text-brand-green bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full">
                  PaoPao 原氣加油站
                </span>
              </div>
              <button
                id="btn-close-toast"
                onClick={() => setCoachNotification(null)}
                className="p-1 hover:bg-brand-cream border border-transparent hover:border-[#EAE3D2] rounded-lg transition-all cursor-pointer text-brand-ash hover:text-brand-muted shrink-0"
              >
                <X size={12} />
              </button>
            </div>
            
            <p className="text-xs font-bold font-sans text-[#4A453A] leading-relaxed">
              {coachNotification}
            </p>

            <div className="flex items-center justify-between border-t border-[#FAF7F2] pt-2 text-[9px] text-[#A39B8D]">
              <span>每天進步 1% 就是大成功</span>
              <button
                type="button"
                onClick={() => {
                  setCoachNotification(null);
                  setShowChatModal(true);
                }}
                className="px-3 py-1 bg-brand-green hover:bg-brand-darkgreen text-white font-bold rounded-lg text-[9px] cursor-pointer shadow-4xs transition-all hover:scale-102 flex items-center gap-1 active:scale-98"
              >
                立即打卡 ✍️
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Bottom Disclaimer / Safe Zone Footer */}
      <footer className="mt-12 py-5 px-6 flex flex-col sm:flex-row items-center justify-between border-t border-brand-border text-[9.5px] text-brand-ash font-bold tracking-wider bg-white/50 w-full gap-2">
        <span>PaoPao Coach — 行為複利微習慣工具</span>
        <div className="flex items-center gap-3 text-[9px] text-brand-muted">
          <span>非醫療處方與診斷</span>
          <span className="text-brand-border-light select-none">|</span>
          <span>行為科學設計</span>
        </div>
      </footer>
    </div>
  );
}
