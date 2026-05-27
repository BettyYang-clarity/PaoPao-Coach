/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MicroTask, UserProfile } from "../types";
import { GOALS_DATA, Goal, AtomicHabit } from "../data/habitsData";
import { getActionableGuide } from "../data/actionableGuides";
import {
  Coffee,
  RotateCw,
  CheckCircle2,
  Circle,
  Plus,
  Heart,
  HelpCircle,
  Sparkles,
  Smile,
  Droplet,
  Dumbbell,
  Moon,
  Utensils,
  Award
} from "lucide-react";

interface HabitBoardProps {
  tasks: MicroTask[];
  profile: UserProfile;
  onToggleTask: (id: string) => void;
  onAddTask: (task: MicroTask) => void;
  onRegenerateTasks: (newTasks: MicroTask[]) => void;
}

export default function HabitBoard({
  tasks,
  profile,
  onToggleTask,
  onAddTask,
  onRegenerateTasks
}: HabitBoardProps) {
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<MicroTask["category"]>("diet");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Icon mapping helper matching the precise category
  const getCategoryIcon = (category: MicroTask["category"]) => {
    switch (category) {
      case "diet":
        return <Utensils className="text-emerald-600" size={13} />;
      case "exercise":
        return <Dumbbell className="text-amber-600" size={13} />;
      case "sleep":
        return <Moon className="text-indigo-600" size={13} />;
      case "mood":
        return <Smile className="text-rose-600" size={13} />;
      case "water":
        return <Droplet className="text-sky-600" size={13} />;
      default:
        return <Sparkles className="text-brand-green" size={13} />;
    }
  };

  const getCategoryBg = (category: MicroTask["category"]) => {
    switch (category) {
      case "diet":
        return "bg-emerald-50 border-emerald-150 text-emerald-700";
      case "exercise":
        return "bg-amber-50 border-amber-150 text-amber-700";
      case "sleep":
        return "bg-indigo-50 border-indigo-150 text-indigo-700";
      case "mood":
        return "bg-rose-50 border-rose-150 text-rose-700";
      case "water":
        return "bg-sky-50 border-sky-150 text-sky-700";
      default:
        return "bg-brand-cream border-brand-border text-brand-green";
    }
  };

  // Helper to parse busy titles into a clean literal todo action
  const parseTaskTitle = (title: string) => {
    let text = title.split(" ➔ ")[0]; // remove trailing guide line if exists
    let goalName = "習慣";
    let habitName = "";
    let levelStr = "Lv1";
    let cleanText = text;

    if (text.startsWith("【") && text.includes("】")) {
      const idxClose = text.indexOf("】");
      const bracketContent = text.substring(1, idxClose);
      cleanText = text.substring(idxClose + 1).trim();

      const parts = bracketContent.split("｜");
      if (parts.length >= 2) {
        goalName = parts[0].trim();
        const secondPart = parts[1].trim();
        const levelMatch = secondPart.match(/Lv\d+/);
        if (levelMatch) {
          levelStr = levelMatch[0];
          habitName = secondPart.replace(/\s+Lv\d+(\s+超容易|\s+普通|\s+進階)?$/, "").trim();
        } else {
          habitName = secondPart;
        }
      } else {
        habitName = parts[0].trim();
      }
    }

    // Strip leading emojis and symbols (including broken surrogate pairs) to keep visual noise minimal
    cleanText = cleanText.replace(/^[^\u4e00-\u9fa5a-zA-Z0-9\s（(「『]+/g, "").trim();

    return { goalName, habitName: habitName || "原子微習慣", levelStr, cleanText };
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "diet":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-250", label: "🥗 飲食" };
      case "exercise":
        return { bg: "bg-amber-50 text-amber-700 border-amber-250", label: "🏃 運動" };
      case "sleep":
        return { bg: "bg-indigo-50 text-indigo-700 border-indigo-250", label: "🛌 睡眠" };
      case "mood":
        return { bg: "bg-rose-50 text-rose-700 border-rose-250", label: "🌸 心理" };
      case "water":
        return { bg: "bg-sky-50 text-sky-700 border-sky-250", label: "🥛 補水" };
      default:
        return { bg: "bg-gray-50 text-gray-700 border-gray-250", label: "🌱 其他" };
    }
  };

  // Static draw offline/mock generator following the level design logic
  const drawLocalRandomTasks = (): MicroTask[] => {
    const selectedHabits = profile.selectedHabits || [];

    const generated: MicroTask[] = [];
    let idx = 0;

    // Populate utilizing specifically customized user habits with their chosen levels
    if (selectedHabits.length > 0) {
      selectedHabits.forEach((sh) => {
        let foundHabit: AtomicHabit | null = null;
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
          const lvLabels = { 1: "Lv1 超容易", 2: "Lv2 普通", 3: "Lv3 進階" };
          const challengeText = foundHabit.levels[sh.level];
          generated.push({
            id: `t-pref-${foundHabit.id}-${Date.now()}-${idx++}`,
            title: `【${goalName} ｜ ${foundHabit.name} ${lvLabels[sh.level]}】 ${challengeText}`,
            category: foundHabit.category,
            completed: false,
            points: sh.level === 1 ? 15 : sh.level === 2 ? 25 : 35, // More points for higher difficulty
            suggestion: foundHabit.suggestion
          });
        }
      });
    }

    // Fallback completely to general_health default tasks only if they literally haven't selected anything
    if (generated.length === 0) {
      const general = GOALS_DATA.find(g => g.id === "general_health");
      if (general) {
        general.habits.slice(0, 3).forEach((h) => {
          generated.push({
            id: `t-fallback-${h.id}-${Date.now()}-${idx++}`,
            title: `【維持健康 ｜ ${h.name} Lv1 超容易】 ${h.levels[1]}`,
            category: h.category,
            completed: false,
            points: 15,
            suggestion: h.suggestion
          });
        });
      }
    }

    return generated;
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      // We will perform POST request to keep backend updated.
      // Since server.ts expects standard profile parameters, we post the profile
      const response = await fetch("/api/coach/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.tasks && data.tasks.length > 0) {
          // Map backend titles with customized Levels if they correspond to selected goals
          onRegenerateTasks(data.tasks);
          setIsGenerating(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Suggest atomic tasks fetch warning, falling back locally:", e);
    }

    // High quality client-side generator fallback to ensure no latency breaks the layout
    setTimeout(() => {
      const localTasks = drawLocalRandomTasks();
      onRegenerateTasks(localTasks);
      setIsGenerating(false);
    }, 800);
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    const newTask: MicroTask = {
      id: `t-custom-${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      completed: false,
      points: 12,
      suggestion: "這是自訂的原子行動挑戰！"
    };

    onAddTask(newTask);
    setCustomTitle("");
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getEncouragementMessage = () => {
    if (totalTasks === 0) return "今日還沒有安排任務喔，點擊「重置待辦清單」開始吧！☘️";
    if (completionPercentage === 0) {
      return "今天也是全新的原子習慣起點！不急不急，準備跨出小小的第一步，你就是自己的滿分教練 ☘️";
    }
    if (completionPercentage < 40) {
      return `哇！你已經點亮了第 ${completedTasks} 個微原子習慣！每天累積 1% 的複利，正在你的體內發芽茁壯喔，超棒的！👏`;
    }
    if (completionPercentage < 100) {
      return `太厲害了！你已經達成了今日的 ${completedTasks}/${totalTasks} 項任務！大腦的阻力已經徹底被你克服了，溫和前行，為自己鼓掌！✨`;
    }
    return `🎉 恭喜你！今日原子任務全數達成 (${completedTasks}/${totalTasks})！你用最低磨損的堅持完成了對自己的承諾，你是最棒的原子習慣大師！❤️`;
  };

  return (
    <div id="habit-panel" className="flex flex-col gap-5 text-left font-sans">
      {/* Title & Actions bar (Slicker and spacious) */}
      <div className="flex items-center justify-between border-b border-brand-border-light pb-2 mt-1">
        <div className="flex items-center gap-2">
          <Coffee className="text-brand-green" size={15} />
          <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">每日自主小清單</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="text-xs font-sans text-brand-green hover:text-brand-darkgreen font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="新增或收合自訂任務"
          >
            {showCustomForm ? "➖ 收起自訂" : "➕ 新增自訂"}
          </button>
          <span className="text-brand-border-light select-none">|</span>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="text-xs font-sans text-brand-green hover:text-brand-darkgreen font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            title="換一組符合目前計畫的任務"
          >
            <RotateCw size={11} className={isGenerating ? "animate-spin" : ""} />
            重置待辦清單
          </button>
        </div>
      </div>

      {/* 頂部任務完成進度及動態同理心鼓勵詞橫幅 */}
      {totalTasks > 0 && (
        <div className="bg-[#FAF7F2] border border-brand-border/60 rounded-2xl p-4 flex flex-col gap-2.5 shadow-4xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#5C564A] flex items-center gap-1.5">
              <Award size={13} className="text-brand-green animate-pulse" />
              今日原子任務進度：{completedTasks} / {totalTasks} ({completionPercentage}%)
            </span>
          </div>
          {/* 高質感進度條 */}
          <div className="w-full bg-[#EAE3D2]/55 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-green rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-[10.5px] leading-relaxed text-[#5C564A] font-medium font-sans mt-0.5">
            {getEncouragementMessage()}
          </p>
        </div>
      )}

      {/* Custom Add Feature (Slimer & simple) - Collapsible controlled by showCustomForm */}
      {showCustomForm && (
        <form onSubmit={handleAddCustomTask} className="bg-brand-cream/15 p-3.5 border border-brand-border/60 rounded-2xl flex flex-col gap-2 shadow-4xs animate-fade-in">
          <span className="text-[10px] font-bold text-brand-muted flex items-center gap-1">
            <Heart size={11} className="text-brand-green" />
            自訂一項今日無痛小待辦：
          </span>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="flex-1 min-w-0 px-3 py-1.5 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 focus:bg-white"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="例如：睡前拉筋 15 秒 🌿"
            />
            <div className="flex gap-2 sm:flex-shrink-0">
              <select
                className="flex-1 sm:flex-initial px-2 py-1.5 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-muted cursor-pointer"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as MicroTask["category"])}
              >
                <option value="diet">飲食 🥗</option>
                <option value="water">補水 💧</option>
                <option value="exercise">運動 🏃</option>
                <option value="sleep">睡眠 😴</option>
                <option value="mood">心靈 🌸</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-brand-beige hover:bg-brand-sand text-brand-green border border-brand-border rounded-xl cursor-pointer shadow-3xs transition-all flex-shrink-0 active:scale-95 flex items-center justify-center gap-1 font-bold font-sans text-xs"
                title="添加自主約定"
              >
                <Plus size={14} /> 新增
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Task List (Clean minimalist layout) */}
      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-brand-ash font-sans text-xs bg-brand-cream rounded-2xl border border-dashed border-brand-border px-4 font-bold">
            🌿 待辦任務空空如也。請點擊「重置待辦清單」載入挑戰。
          </div>
        ) : (
          <div className="max-h-[310px] overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin">
            {tasks.map((task) => {
              const isCompleted = task.completed;
              const { goalName, habitName, levelStr, cleanText } = parseTaskTitle(task.title);
              const isExpanded = expandedTaskId === task.id;
              const categoryTheme = getCategoryTheme(task.category);

              return (
                <div
                  key={task.id}
                  className={`p-3.5 border rounded-2xl flex flex-col gap-2.5 transition-all ${
                    isCompleted
                      ? "bg-[#FAF9F6]/60 border-brand-border-light/60 text-brand-ash/60"
                      : "bg-white border-brand-border hover:border-brand-green/30 shadow-4xs"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Completion Check Box */}
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className="text-brand-ash hover:text-brand-green flex-shrink-0 cursor-pointer transition-all focus:outline-hidden mt-0.5"
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-brand-green fill-brand-green/5" />
                      ) : (
                        <Circle size={18} className="hover:scale-105" />
                      )}
                    </button>

                    {/* Right content column */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {/* Top Header of the Task Item */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Title with exact metadata */}
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`text-[10px] font-bold ${isCompleted ? 'text-brand-ash/50' : 'text-[#5C564A]'}`}>
                            {habitName}
                          </span>
                          <span className={`text-[8px] font-mono px-1 rounded flex-shrink-0 ${isCompleted ? 'bg-brand-ash/20 text-brand-ash/60' : 'bg-brand-green text-white'}`}>
                            {levelStr}
                          </span>
                          <span className="text-[9px] text-[#A39B8D] truncate">({goalName})</span>
                        </div>

                        {/* Right action block */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[8.5px] font-sans font-bold px-1.5 py-0.5 bg-white border rounded leading-none ${isCompleted ? 'opacity-50' : ''} ${categoryTheme.bg}`}>
                            {categoryTheme.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className={`text-xs cursor-pointer p-1 rounded-lg border border-brand-border-light/40 shadow-4xs transition-all hover:bg-brand-cream active:scale-95 flex items-center justify-center ${
                              isExpanded ? "bg-brand-cream/80" : ""
                            }`}
                            title="物理微行動步驟與學理分析"
                          >
                            💡
                          </button>
                        </div>
                      </div>

                      {/* 👉 行動目標: Positioned fully underneath the header to maximize space usage */}
                      <p className={`font-sans text-[11.5px] leading-relaxed mt-0.5 ${isCompleted ? 'text-brand-ash/60 line-through font-normal' : 'text-brand-text font-bold'}`}>
                        👉 行動目標：{cleanText}
                      </p>
                    </div>
                  </div>

                  {/* Expandable guide */}
                  {isExpanded && (
                    <div className="p-3 bg-brand-cream/65 border border-brand-border-light/60 rounded-xl text-[10.5px] leading-relaxed text-brand-text animate-fade-in flex flex-col gap-1.5 font-sans">
                      <div>
                        <span className="font-bold text-brand-green">🎯 物理微行動步驟：</span>
                        <p className="inline text-brand-text font-medium">{getActionableGuide(task.id, task.category)}</p>
                      </div>
                      {task.suggestion && (
                        <div className="border-t border-brand-border-light/40 pt-1.5 mt-0.5 text-[10px] text-[#80796B]">
                          <span className="font-bold">🧪 習慣學理：</span>
                          <p className="inline">{task.suggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
