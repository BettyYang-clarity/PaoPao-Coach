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
    let categoryLabel = "";
    let cleanText = text;

    if (text.startsWith("【") && text.includes("】")) {
      const idxClose = text.indexOf("】");
      const bracketContent = text.substring(1, idxClose);
      cleanText = text.substring(idxClose + 1).trim();

      const parts = bracketContent.split("｜");
      if (parts.length >= 2) {
        // Strip out levels and difficulty suffixes for clean visualization
        categoryLabel = parts[1].trim().replace(/\s+Lv\d+(\s+超容易|\s+普通|\s+進階)?$/, "");
      } else {
        categoryLabel = parts[0].trim();
      }
    }

    // Strip leading emojis to keep visual noise minimal
    cleanText = cleanText.replace(/^[\u2000-\u32FF\ud83c-\ud83d\ude00-\ude4f\ude80-\udeff\ud83e\udd00-\uddff]\s*/g, "").trim();

    return { categoryLabel, cleanText };
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

  return (
    <div id="habit-panel" className="flex flex-col gap-5 text-left font-sans">
      {/* Title & Actions bar (Slicker and spacious) */}
      <div className="flex items-center justify-between border-b border-brand-border-light pb-2 mt-1">
        <div className="flex items-center gap-2">
          <Coffee className="text-brand-green" size={15} />
          <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">每日自主小清單</span>
        </div>
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

      {/* Task List (Clean minimalist layout) */}
      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-brand-ash font-sans text-xs bg-brand-cream rounded-2xl border border-dashed border-brand-border px-4">
            🌿 待辦任務空空如也。請點擊「重置待辦清單」載入挑戰。
          </div>
        ) : (
          tasks.map((task) => {
            const isCompleted = task.completed;
            const { categoryLabel, cleanText } = parseTaskTitle(task.title);
            const isExpanded = expandedTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`relative p-3 border rounded-2xl flex flex-col gap-2.5 transition-all ${
                  isCompleted
                    ? "bg-[#FAF9F6]/60 border-brand-border-light/60 text-brand-ash/60"
                    : "bg-white border-brand-border hover:border-brand-green/30 shadow-4xs"
                }`}
              >
                {/* Horizontal summary view */}
                <div className="flex items-start gap-3">
                  {/* Completion Check Box */}
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className="mt-0.5 text-brand-ash hover:text-brand-green flex-shrink-0 cursor-pointer transition-all focus:outline-hidden"
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-brand-green fill-brand-green/5" />
                    ) : (
                      <Circle size={16} className="hover:scale-105" />
                    )}
                  </button>

                  {/* Clean literal todo title */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={`font-sans text-xs font-bold text-brand-text leading-snug ${isCompleted ? 'text-brand-ash/60 line-through font-normal' : ''}`}>
                      {categoryLabel && <span className="text-brand-green mr-1.5 font-bold">[{categoryLabel}]</span>}
                      {cleanText}
                    </p>
                  </div>

                  {/* Side Badges & Toggle */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] font-mono font-bold text-brand-green px-1.5 py-0.5 bg-brand-cream border border-brand-border-light rounded-md">
                      +{task.points} pts
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className={`text-brand-ash hover:text-brand-muted cursor-pointer p-0.5 rounded transition-all ${
                        isExpanded ? "bg-brand-cream text-brand-green" : ""
                      }`}
                      title="查看實際執行步驟與習慣學理說明"
                    >
                      <HelpCircle size={14} />
                    </button>
                  </div>
                </div>

                {/* Optional neutral actionable steps & explanation (Collapsed by default, zero clutter) */}
                {isExpanded && (
                  <div className="ml-7 p-3 bg-brand-cream/60 border border-brand-border-light/60 rounded-xl text-[10.5px] leading-relaxed text-brand-text animate-fade-in flex flex-col gap-1.5 font-sans">
                    <div>
                      <span className="font-bold text-brand-green">🎯 物理微行動步驟：</span>
                      <p className="inline text-brand-text font-medium">{getActionableGuide(task.id, task.category)}</p>
                    </div>
                    {task.suggestion && (
                      <div className="border-t border-brand-border-light/40 pt-1.5 mt-0.5 text-[10px] text-brand-muted">
                        <span className="font-bold">💡 習慣科學原理：</span>
                        <p className="inline">{task.suggestion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Custom Add Feature (Slimer & simple) */}
      <form onSubmit={handleAddCustomTask} className="border-t border-brand-border-light pt-3 mt-1 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-brand-muted flex items-center gap-1">
          <Heart size={11} className="text-brand-green" />
          自訂一項今日無痛小待辦：
        </span>

        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-1.5 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 focus:bg-white"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="例如：睡前喝水 200ml / 散步 5 分鐘"
          />
          <select
            className="px-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-[10.5px] text-brand-muted cursor-pointer"
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
            className="p-1.5 bg-brand-beige hover:bg-brand-sand text-brand-green border border-brand-border rounded-xl cursor-pointer shadow-3xs transition-all flex-shrink-0 active:scale-95 flex items-center justify-center"
            title="添加自主約定"
          >
            <Plus size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
