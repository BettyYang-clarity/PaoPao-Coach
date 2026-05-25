/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { CoachState, MicroTask, WellnessRecord, ChatMessage } from "./types";
import { loadCoachState, saveCoachState, getTasksFromSelectedHabits } from "./lib/storage";
import ProfileForm from "./components/ProfileForm";
import HabitBoard from "./components/HabitBoard";
import WellnessDashboard from "./components/WellnessDashboard";
import CoachChat from "./components/CoachChat";
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

export default function App() {
  // Master state
  const [state, setState] = useState<CoachState>(() => loadCoachState());

  // Interactive notifications states
  const [bellEnabled, setBellEnabled] = useState(true);
  const [coachNotification, setCoachNotification] = useState<string | null>(null);
  const [notifPage, setNotifPage] = useState(0);

  // Top navigation tabs
  const [currentTab, setCurrentTab] = useState<'plan' | 'record' | 'settings'>('plan');

  // Layered dialog chat overlay
  const [showChatModal, setShowChatModal] = useState(false);

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
        text: data.text || "我收到了你的溫馨能量囉！再接再厲！",
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
      "🔔 【無痛微拉筋】：現在雙手臂向上伸直，十指用力交握、維持 15 秒，你又儲存了健康點數！🧘",
      "🔔 【大腦減壓碎碎念】：不完美真的沒關係。就算是吃炸雞，它也幫今天疲憊的你補充滿滿的多巴胺！我們完全不扣分，今天記錄了就是大成功！✨",
      "🔔 【舒甜微小好意】：今晚睡前一小時，把手機放到手碰不著的地方，幫明天清亮的大腦存點定力基礎。😴"
    ];
    setCoachNotification(alerts[Math.floor(Math.random() * alerts.length)]);
  };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-text font-sans selection:bg-brand-beige pb-12 flex flex-col justify-between">
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/50 border-b border-brand-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center shadow-xs">
            <span className="text-sm">🌿</span>
          </div>
          <div>
            <h1 className="font-sans text-base font-bold tracking-tight text-brand-olive flex items-center gap-1.5">
              Lumi Coach
            </h1>
            <p className="text-[10px] text-brand-ash font-sans tracking-wide">
              原子健康微習慣 & 自主記錄健康夥伴
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active Points Hub Indicator */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-beige rounded-full border border-brand-sand shadow-2xs">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#8A8273]">累積能量</span>
            <span className="font-bold text-brand-green font-mono text-sm">{state.totalPoints} pts</span>
          </div>

          {/* Core Alert Toggle/Action Bell button */}
          <button
            onClick={() => {
              setBellEnabled(!bellEnabled);
              if (!bellEnabled) forceRemindMe();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              bellEnabled 
                ? "bg-brand-beige border-brand-sand text-brand-green shadow-xs hover:bg-white" 
                : "bg-white/50 border-brand-border text-brand-ash hover:text-brand-muted"
            }`}
            title={bellEnabled ? "教練叮嚀已開啟 (每 45 秒發送)" : "開啟定時叮嚀"}
          >
            {bellEnabled ? <Bell size={15} className="animate-swing" /> : <BellOff size={15} />}
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
              <span>🌱 原子習慣</span>
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
                    Lumi 教練：微小的習慣最牢固。不求一天登天，今天只要有前進 1%，您就是最大成功！
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
                      title="Lumi 溫柔對話"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EAE3D2] flex items-center justify-center text-brand-green">
                        <MessageSquare size={16} />
                      </div>
                      <span className="text-[10px] font-sans font-extrabold text-[#5C564A]">溫柔對話</span>
                    </button>

                    {/* Trigger: Go to Records Tab */}
                    <button
                      id="btn-goto-records"
                      onClick={() => setCurrentTab('record')}
                      className="p-3 bg-brand-cream hover:bg-[#F3EFE6] border border-brand-border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-3xs hover:shadow-2xs"
                      title="生活健康紀錄"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EAE3D2] flex items-center justify-center text-brand-green">
                        <ClipboardList size={16} />
                      </div>
                      <span className="text-[10px] font-sans font-extrabold text-[#5C564A]">健康紀錄 🍱</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* NATIVE INTEGRATED HAZEL-FREE HABIT CHECKLIST */}
              <div id="integrated-habits-board" className="p-6 md:p-8 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center gap-2 pb-3 border-b border-brand-border-light">
                  <span className="text-xl">📋</span>
                  <h3 className="font-sans text-xs font-extrabold uppercase tracking-widest text-[#5C564A]">
                    今日原子計畫微任務任務焦點
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
              <div id="science-card" className="p-5 bg-white border border-brand-border rounded-[32px] shadow-3xs flex items-center gap-3">
                <span className="text-xl">💡</span>
                <p className="text-[11px] text-[#70695C] font-sans leading-relaxed">
                  <span className="font-bold text-brand-text text-xs block mb-0.5">自然而然的原子成長：</span>
                  本陪跑教練堅持「日常隨喜，無痛紀錄」，拒絕任何焦慮與審判。每天隨心記錄、補注溫水或拉伸 15 秒，就是習慣的大大贏家！
                </p>
              </div>
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
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[85vh] p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="font-sans text-sm font-bold text-brand-text">與 Lumi Coach 溫柔漫談</h3>
              </div>
              <button
                id="btn-close-chat"
                onClick={() => setShowChatModal(false)}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content area scrollable */}
            <div className="flex-1 overflow-y-auto pr-1">
              <CoachChat
                messages={state.messages}
                profile={state.profile}
                onSendMessage={handleSendMessage}
                onImageAnalysisResult={(rec) => {
                  handleAddRecord(rec);
                  setShowChatModal(false); // seamless back to dashboard
                }}
              />
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-brand-border-light text-center text-[9px] text-[#A39B8D] flex-shrink-0">
              Lumi 教練為你提供無判決、極致包容、純溫暖的健康對話支持。
            </div>
            
          </div>
        </div>
      )}

      {/* 3. Bottom Disclaimer / Safe Zone Footer */}
      <footer className="mt-12 py-6 px-8 flex flex-col sm:flex-row items-center justify-between border-t border-brand-border text-[9px] text-brand-ash font-medium tracking-widest uppercase bg-white/50 w-full gap-3">
        <span>Lumi Coach — 原子修復與健康生活微習慣工具</span>
        <div className="flex flex-wrap justify-center gap-4 text-center sm:text-right">
          <span>非醫療處方 (No Prescription)</span>
          <span>不作疾病診斷 (No Diagnosis)</span>
          <span>行為複利科學設計 (Behavioral Science Based)</span>
        </div>
      </footer>
    </div>
  );
}
