/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import { GOALS_DATA, Goal, AtomicHabit } from "../data/habitsData";
import {
  User,
  Activity,
  Flame,
  Save,
  Sliders,
  Sparkles,
  Droplet,
  Heart,
  CheckCircle,
  Smile,
  Zap
} from "lucide-react";

interface ProfileFormProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onExportData?: () => void;
  onImportData?: (importedData: any) => void;
}

export default function ProfileForm({
  profile,
  onSave,
  onExportData,
  onImportData
}: ProfileFormProps) {
  const [formData, setFormData] = useState<UserProfile>({
    ...profile,
    age: profile.age || 28,
    activityLevel: profile.activityLevel || "lightly_active",
    dailyExerciseTarget: profile.dailyExerciseTarget || 30,
    dailySleepTarget: profile.dailySleepTarget || 7,
    dailyReminderEnabled: profile.dailyReminderEnabled ?? true,
    dailyReminderTime: profile.dailyReminderTime || "09:00",
    selectedGoals: profile.selectedGoals || ["weight_loss", "general_health"],
    selectedHabits: profile.selectedHabits || [
      { habitId: "wl_protein_first", level: 1 },
      { habitId: "wl_eat_veg", level: 1 },
      { habitId: "wl_walk_after_meal", level: 1 },
      { habitId: "gh_step_7000", level: 1 },
      { habitId: "gh_drink_regular", level: 2 }
    ]
  });

  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'plan' | 'habits'>('summary');
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          onImportData?.(parsed);
        } catch (err) {
          alert("解析備份檔案失敗，格式可能不正確！");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }
  };

  // Keep state synchronized with parent profile props
  useEffect(() => {
    setFormData({
      ...profile,
      age: profile.age || 28,
      activityLevel: profile.activityLevel || "lightly_active",
      dailyExerciseTarget: profile.dailyExerciseTarget || 30,
      dailySleepTarget: profile.dailySleepTarget || 7,
      dailyReminderEnabled: profile.dailyReminderEnabled ?? true,
      dailyReminderTime: profile.dailyReminderTime || "09:00",
      selectedGoals: profile.selectedGoals || ["weight_loss", "general_health"],
      selectedHabits: profile.selectedHabits || [
        { habitId: "wl_protein_first", level: 1 },
        { habitId: "wl_eat_veg", level: 1 },
        { habitId: "wl_walk_after_meal", level: 1 },
        { habitId: "gh_step_7000", level: 1 },
        { habitId: "gh_drink_regular", level: 2 }
      ]
    });
  }, [profile]);

  // Mifflin-St Jeor Formula calculation (BMR & TDEE)
  const getBmrAndTdee = (
    weight?: number,
    height?: number,
    age?: number,
    gender?: string,
    activity?: string
  ) => {
    const w = weight || 65;
    const h = height || 170;
    const a = age || 28;
    const g = gender || "不公開";
    const act = activity || "lightly_active";

    let s = -78; // average offset
    if (g === "男生") {
      s = 5;
    } else if (g === "女生") {
      s = -161;
    }

    const bmr = 10 * w + 6.25 * h - 5 * a + s;

    let palMultiplier = 1.375;
    if (act === "sedentary") palMultiplier = 1.2;
    else if (act === "lightly_active") palMultiplier = 1.375;
    else if (act === "moderately_active") palMultiplier = 1.55;
    else if (act === "very_active") palMultiplier = 1.725;

    const tdee = Math.round(bmr * palMultiplier);

    return {
      bmr: Math.round(bmr),
      tdee: tdee > 1000 ? tdee : 1600,
      palValue: palMultiplier,
    };
  };

  const currentCalc = getBmrAndTdee(
    formData.weight,
    formData.height,
    formData.age,
    formData.gender,
    formData.activityLevel
  );

  const waterTarget = (formData.weight || 65) * 35; // Standard hydration level

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if ((formData.selectedGoals || []).length === 0) {
      alert("請至少選擇一個健康目標喔！");
      return;
    }

    onSave(formData);
    setIsSaved(true);
    setActiveSubTab('summary'); // Redirect to summary of personal configuration on save!
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  const applyCaloriePreset = (val: number) => {
    setFormData(prev => ({ ...prev, dailyCalorieTarget: val }));
  };

  // Helper to toggle selected goals
  const handleToggleGoal = (goalId: string) => {
    const currentGoals = formData.selectedGoals || [];
    let nextGoals: string[];

    if (currentGoals.includes(goalId)) {
      nextGoals = currentGoals.filter(id => id !== goalId);
    } else {
      nextGoals = [...currentGoals, goalId];
    }

    // Automatically synchronize selected habits:
    // If a goal is deselected, we remove its habits from selectedHabits.
    // If a goal is newly selected, we auto-add its first 3 habits as Level 1 defaults so that it initiates beautifully!
    let nextHabits = [...(formData.selectedHabits || [])];
    const removedGoals = currentGoals.filter(id => !nextGoals.includes(id));
    const addedGoals = nextGoals.filter(id => !currentGoals.includes(id));

    // Remove habits that belong to unselected goals
    removedGoals.forEach(gId => {
      const goalObj = GOALS_DATA.find(g => g.id === gId);
      if (goalObj) {
        const habitIdsToRemove = goalObj.habits.map(h => h.id);
        nextHabits = nextHabits.filter(item => !habitIdsToRemove.includes(item.habitId));
      }
    });

    // Add habits belonging to newly selected goals with default Level 1
    addedGoals.forEach(gId => {
      const goalObj = GOALS_DATA.find(g => g.id === gId);
      if (goalObj) {
        // Auto-add up to 2 initial habits to avoid choice paralysis
        goalObj.habits.slice(0, 2).forEach(h => {
          if (!nextHabits.some(item => item.habitId === h.id)) {
            nextHabits.push({ habitId: h.id, level: 1 });
          }
        });
      }
    });

    setFormData(prev => ({
      ...prev,
      selectedGoals: nextGoals,
      selectedHabits: nextHabits
    }));
  };

  // Helper to toggle selected habits
  const handleToggleHabit = (habitId: string) => {
    const currentHabits = formData.selectedHabits || [];
    const exists = currentHabits.some(item => item.habitId === habitId);

    if (exists) {
      setFormData(prev => ({
        ...prev,
        selectedHabits: (prev.selectedHabits || []).filter(item => item.habitId !== habitId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedHabits: [...(prev.selectedHabits || []), { habitId, level: 1 }]
      }));
    }
  };

  // Helper to adjust level of selected habit
  const handleSetHabitLevel = (habitId: string, level: 1 | 2 | 3) => {
    const currentHabits = formData.selectedHabits || [];
    const exists = currentHabits.some(item => item.habitId === habitId);

    if (exists) {
      setFormData(prev => ({
        ...prev,
        selectedHabits: (prev.selectedHabits || []).map(item =>
          item.habitId === habitId ? { ...item, level } : item
        )
      }));
    } else {
      // If not yet selected, select it & set its initial level
      setFormData(prev => ({
        ...prev,
        selectedHabits: [...(prev.selectedHabits || []), { habitId, level }]
      }));
    }
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "diet":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "🥗 飲食" };
      case "exercise":
        return { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "🏃 運動" };
      case "sleep":
        return { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "🛌 睡眠" };
      case "mood":
        return { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "🌸 心理/行為" };
      case "water":
        return { bg: "bg-sky-50 text-sky-700 border-sky-200", label: "🥛 補水" };
      default:
        return { bg: "bg-gray-50 text-gray-700 border-gray-200", label: "🌱 其他" };
    }
  };

  // Quick calculation variables for summary view
  const selectedGoalsList = GOALS_DATA.filter(g => (formData.selectedGoals || []).includes(g.id));
  const selectedHabitsList = (formData.selectedHabits || []).map((sh) => {
    let foundHabit: any = null;
    let goalName = "健康目標";
    for (const g of GOALS_DATA) {
      const matching = g.habits.find(item => item.id === sh.habitId);
      if (matching) {
        foundHabit = matching;
        goalName = g.name;
        break;
      }
    }
    return {
      ...sh,
      habit: foundHabit,
      goalName
    };
  }).filter(item => item.habit !== null);

  return (
    <div id="settings-interior" className="flex flex-col gap-5 w-full">
      {/* Settings Header with Back Button (Removed the right subtabs switcher) */}
      <div className="flex border-b border-brand-border-light pb-2.5 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📋</span>
          <h3 className="font-sans text-xs font-extrabold uppercase tracking-widest text-[#5C564A]">
            {activeSubTab === 'summary' && "個人健康總結與設定"}
            {activeSubTab === 'plan' && "修改健康計畫設定"}
            {activeSubTab === 'habits' && "修改原子微行動隨機化難度"}
          </h3>
        </div>
        
        {activeSubTab !== 'summary' && (
          <button
            type="button"
            onClick={() => setActiveSubTab('summary')}
            className="px-2.5 py-1 text-[10px] font-bold text-brand-muted hover:text-brand-text bg-brand-cream hover:bg-brand-beige border border-brand-border rounded-lg transition-all cursor-pointer flex items-center gap-1"
          >
            ← 返回健康總結
          </button>
        )}
      </div>

      {/* RENDER SUMMARIZED SUMMARY OR EDITORS */}
      {activeSubTab === 'summary' ? (
        <div id="settings-summary-view" className="flex flex-col gap-5 text-left animate-fade-in animate-duration-150">
          {/* Header */}
          <div className="bg-brand-cream border border-brand-border p-4 rounded-2xl flex flex-col gap-1">
            <h4 className="text-xs font-sans font-extrabold text-brand-olive flex items-center gap-1.5">
              💡 專屬您的原子健康指導與行動總結
            </h4>
            <p className="text-[10px] text-brand-muted leading-relaxed">
              親愛的 {formData.name || "夥伴"}，以下為您客製化解構的健康計畫與微行動難度。這裡絕不設立繁雜嚴苛的規則，記錄與實踐一秒就值得為自己喝采：
            </p>
          </div>

          {/* Core Plan Highlights / Focus Points Synthesis */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-500/20 rounded-2xl flex flex-col gap-3 shadow-3xs">
            <h5 className="text-[11px] font-sans font-bold text-emerald-850 flex items-center gap-1 border-b border-emerald-500/10 pb-1.5">
              ⭐ 【您的三大核心健康計畫重點】
            </h5>
            <ul className="text-[10px] text-emerald-900/95 space-y-2 font-sans list-none pl-0">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-700 font-bold flex-shrink-0">① 精準每日熱量：</span>
                <div>
                  設定為 <strong className="font-extrabold text-emerald-800">{formData.dailyCalorieTarget || currentCalc.tdee} kcal</strong>，已根據 TDEE 能耗精密計算，作為您的日常卡路里防線。
                </div>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-700 font-bold flex-shrink-0">② 基礎水分與作息：</span>
                <div>
                  依您的體脂體格精密計算今日補水基礎 <strong className="font-extrabold text-emerald-800">{waterTarget} ml</strong>、中度活動時間 <strong className="font-extrabold text-emerald-800">{formData.dailyExerciseTarget || 30} 分鐘</strong> 與黃金睡眠 <strong className="font-extrabold text-emerald-800">{formData.dailySleepTarget || 7} 小時</strong>。
                </div>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-700 font-bold flex-shrink-0">③ 原子行動方針：</span>
                <div>
                  共綁定 <strong className="font-extrabold text-emerald-800">{selectedGoalsList.length}</strong> 個核心健康方向，並完美對接啟用 <strong className="font-extrabold text-brand-green">{selectedHabitsList.length}</strong> 個客製微行動，難度極低，無痛養成一輩子的習慣。
                </div>
              </li>
            </ul>
          </div>

          {/* 1. Basic Physio Profile */}
          <div className="p-4 bg-white border border-brand-border rounded-2xl flex flex-col gap-3 shadow-3xs">
            <h5 className="text-[11px] font-sans font-bold text-brand-olive flex items-center gap-1 border-b border-brand-cream/60 pb-1.5 flex-wrap">
              👤 【能量代謝與防線總結】
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-cream/40 p-3 rounded-xl border border-brand-cream/80 text-center">
              <div className="flex flex-col gap-0.5 border-r border-brand-border-light/60">
                <span className="text-[9px] text-[#A39B8D] font-bold">基本體魄</span>
                <span className="text-xs font-extrabold text-[#5C564A]">{formData.name || "夥伴"} ({formData.gender || "不公開"})</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:border-r border-brand-border-light/60">
                <span className="text-[9px] text-[#A39B8D] font-bold">身高 / 體重</span>
                <span className="text-xs font-extrabold text-[#5C564A]">{formData.height || 170} cm / {formData.weight || 65} kg</span>
              </div>
              <div className="flex flex-col gap-0.5 border-r border-[#E5E0D5]">
                <span className="text-[9px] text-[#A39B8D] font-bold">每日 TDEE 能耗</span>
                <span className="text-xs font-extrabold text-brand-green font-mono">{currentCalc.tdee} kcal</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-[#A39B8D] font-bold">建議補水基礎</span>
                <span className="text-xs font-extrabold text-blue-600 font-mono">{waterTarget} ml</span>
              </div>
            </div>

            <div className="p-4 bg-brand-beige border border-brand-border/60 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-brand-green mt-0.5">🎯</span>
                <div>
                  <span className="text-[10px] font-bold text-[#5C564A]">當前自訂每日習慣目標：</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <div className="px-2.5 py-1.5 bg-white border border-brand-border/60 rounded-lg text-center shadow-4xs">
                      <span className="block text-[8px] font-bold text-brand-muted uppercase">日常熱量防護</span>
                      <strong className="text-xs font-mono text-brand-green font-bold block mt-0.5">{formData.dailyCalorieTarget || currentCalc.tdee} kcal</strong>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white border border-brand-border/60 rounded-lg text-center shadow-4xs">
                      <span className="block text-[8px] font-bold text-brand-muted uppercase">累積身體活動</span>
                      <strong className="text-xs font-mono text-brand-green font-bold block mt-0.5">{formData.dailyExerciseTarget || 30} 分鐘</strong>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white border border-brand-border/60 rounded-lg text-center shadow-4xs">
                      <span className="block text-[8px] font-bold text-brand-muted uppercase">昨晚睡眠時間</span>
                      <strong className="text-xs font-mono text-brand-green font-bold block mt-0.5">{formData.dailySleepTarget || 7} 小時</strong>
                    </div>
                  </div>
                  <span className="text-[9.5px] text-brand-muted block mt-2 border-t border-[#E5E0D5] pt-1.5">
                    活動加權級別：{
                      formData.activityLevel === "sedentary" ? "久坐常態型 (很少運動)" :
                      formData.activityLevel === "lightly_active" ? "輕度活動型 (常站立/走動)" :
                      formData.activityLevel === "moderately_active" ? "中度操練型 (規律鍛鍊)" : "高度活躍型 (密集體能工作)"
                    }
                  </span>
                  <span className="text-[9.5px] text-brand-muted block mt-1.5 pt-1.5 border-t border-dashed border-[#E5E0D5] flex items-center gap-1">
                    🔔 每日預約提醒更新：{
                      (formData.dailyReminderEnabled ?? true) 
                        ? `已預定 (每天 ${formData.dailyReminderTime || "09:00"}) 💡` 
                        : "目前關閉"
                    }
                  </span>
                </div>
              </div>
            </div>

            {formData.customGoal && (
              <div className="p-3.5 bg-brand-green/5 border border-brand-green/20 rounded-xl flex flex-col gap-1">
                <span className="text-[9px] font-sans font-bold text-brand-darkgreen">🌸 您的自我期勉與態度誓言：</span>
                <p className="text-xs text-brand-text font-bold italic">
                  「 {formData.customGoal} 」
                </p>
              </div>
            )}
          </div>

          {/* 2. Selected Goals */}
          <div className="p-4 bg-white border border-brand-border rounded-2xl flex flex-col gap-2.5 shadow-3xs">
            <h5 className="text-[11px] font-sans font-bold text-brand-olive flex items-center gap-1 border-b border-brand-cream/60 pb-1.5">
              🎯 【已鎖定的健康戰略方向】
            </h5>
            {selectedGoalsList.length === 0 ? (
              <p className="text-xs text-brand-muted text-center py-2">尚未選擇目標，點擊下方按鈕更新設定 🌿</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedGoalsList.map(g => (
                  <div key={g.id} className="p-2.5 bg-[#FAF9F6] border border-brand-border-light rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-extrabold text-brand-olive">🎯 {g.name}</span>
                    <p className="text-[10px] text-[#807D70] leading-tight select-all">{g.corePrinciple}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Selected Habits & Level Indicators */}
          <div className="p-4 bg-white border border-brand-border rounded-2xl flex flex-col gap-2.5 shadow-3xs">
            <h5 className="text-[11px] font-sans font-bold text-brand-olive flex items-center gap-1 border-b border-brand-cream/60 pb-1.5">
              ⚡ 【已啟用的原子微行動方案】
            </h5>
            {selectedHabitsList.length === 0 ? (
              <p className="text-xs text-brand-muted text-center py-2">尚未啟用微任務，點擊下方「修改原子微行動」啟用 ⭐</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                {selectedHabitsList.map((item, index) => {
                  const currentLevel = item.level || 1;
                  const challengeLabel = item.habit?.levels[currentLevel as 1 | 2 | 3] || "";
                  const categoryTheme = getCategoryTheme(item.habit?.category || "diet");
                  return (
                    <div key={`${item.habitId}-${index}`} className="p-2.5 bg-brand-cream/40 border border-brand-border-light rounded-xl flex flex-wrap sm:flex-nowrap items-start justify-between gap-2.5">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10.5px] font-bold text-[#5C564A]">{item.habit?.name}</span>
                          <span className="bg-brand-green text-white text-[8px] font-mono px-1 rounded">Lv{currentLevel}</span>
                          <span className="text-[9px] text-[#A39B8D]">({item.goalName})</span>
                        </div>
                        <p className="text-[10.5px] text-[#4A453A] font-bold mt-1">👉 行動目標：{challengeLabel}</p>
                      </div>
                      <span className={`text-[8.5px] font-sans font-bold px-1.5 py-0.2 bg-white rounded border flex-shrink-0 ${categoryTheme.bg}`}>
                        {categoryTheme.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Action Buttons to go to other tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-brand-border-light">
            <button
              type="button"
              id="summary-btn-goto-plan"
              onClick={() => setActiveSubTab('plan')}
              className="py-3 px-4 bg-brand-cream hover:bg-[#F3EFE6] text-brand-olive font-sans text-xs font-extrabold rounded-xl border border-brand-border flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 shadow-3xs"
            >
              ⚙️ 修改健康計畫
            </button>
            <button
              type="button"
              id="summary-btn-goto-habits"
              onClick={() => setActiveSubTab('habits')}
              className="py-3 px-4 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs"
            >
              ⚡ 修改原子微行動
            </button>
          </div>

          {/* P0: 數據備份與還原備用區 */}
          <div className="mt-4 p-4 bg-brand-cream/40 border border-dashed border-brand-border rounded-[24px] flex flex-col gap-3">
            <div>
              <h4 className="text-xs font-sans font-bold text-brand-olive flex items-center gap-1.5">
                💾 本地數據備份防護線
              </h4>
              <p className="text-[10px] text-brand-muted mt-1 leading-relaxed">
                您的健康足跡、原子微行動與生活積分皆儲存於瀏覽器快取。建議定期匯出備份以保障數據安全喔！
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={onExportData}
                className="py-2 px-3 bg-white hover:bg-brand-cream text-brand-olive font-sans text-[10.5px] font-bold rounded-xl border border-brand-border cursor-pointer transition-all active:scale-98 shadow-4xs"
              >
                📥 匯出資料備份
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-white hover:bg-brand-cream text-brand-olive font-sans text-[10.5px] font-bold rounded-xl border border-brand-border cursor-pointer transition-all active:scale-98 shadow-4xs"
              >
                📤 匯入歷史資料
              </button>
            </div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportFileChange}
            />
          </div>
        </div>
      ) : activeSubTab === 'plan' ? (
        <form onSubmit={handleSaveAll} className="flex flex-col gap-5 text-left">
          {/* Physiological Metrics Input */}
          <div className="p-4 bg-brand-cream border border-brand-border rounded-2xl flex flex-col gap-3.5">
            <h4 className="text-xs font-sans font-bold text-brand-olive flex items-center gap-1.5 border-b border-brand-border-light/60 pb-1.5">
              <User size={13} className="text-brand-green" />
              1. 基本生理數據 (供能量代謝與補水精密加權計算)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted">姓名 / 暱稱</span>
                <input
                  type="text"
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:ring-1 focus:ring-brand-green"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted flex-shrink-0">生理性別</span>
                <select
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text cursor-pointer"
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="不公開">不公開 / 保持中性</option>
                  <option value="男生">男生</option>
                  <option value="女生">女生</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted">年齡</span>
                <input
                  type="number"
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:ring-1 focus:ring-brand-green"
                  value={formData.age || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: Number(e.target.value) }))}
                  placeholder="28"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted">身高 (cm)</span>
                <input
                  type="number"
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:ring-1 focus:ring-brand-green"
                  value={formData.height || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, height: Number(e.target.value) }))}
                  placeholder="170"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted">體重 (kg)</span>
                <input
                  type="number"
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:ring-1 focus:ring-brand-green"
                  value={formData.weight || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: Number(e.target.value) }))}
                  placeholder="65"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-brand-muted">工作活動加權</span>
                <select
                  className="px-3 py-2 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text cursor-pointer"
                  value={formData.activityLevel || "lightly_active"}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value as any }))}
                >
                  <option value="sedentary">久坐常態型 (很少運動)</option>
                  <option value="lightly_active">輕度活動型 (日常站立走動多)</option>
                  <option value="moderately_active">中度操練型 (規律運動健身)</option>
                  <option value="very_active">高度活躍型 (密集高勞力工作)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Goal Selections */}
          <div className="p-4 bg-brand-cream border border-brand-border rounded-2xl flex flex-col gap-3">
            <h4 className="text-xs font-sans font-bold text-brand-olive flex items-center gap-1.5 border-b border-brand-border-light/60 pb-1.5">
              <Heart size={13} className="text-red-500 fill-red-500 animate-pulse" />
              2. 聚焦健康大目標 (可多選，即刻推薦對應小習慣)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-1">
              {GOALS_DATA.map((goal) => {
                const isSelected = (formData.selectedGoals || []).includes(goal.id);
                return (
                  <label
                    key={goal.id}
                    className={`p-3 border rounded-xl text-left cursor-pointer transition-all hover:bg-brand-beige flex items-start gap-2.5 select-none ${
                      isSelected
                        ? "bg-brand-green/5 border-brand-green font-bold shadow-3xs"
                        : "bg-[#FAF9F6] border-brand-border-light"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-brand-border text-brand-green focus:ring-brand-green/30 h-4 w-4 cursor-pointer"
                      checked={isSelected}
                      onChange={() => handleToggleGoal(goal.id)}
                    />
                    <div className="flex-1 -mt-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-sans text-[11px] font-bold text-brand-olive">{goal.name}</span>
                        <span className="text-[9px] font-mono text-brand-muted font-normal uppercase">({goal.englishName})</span>
                      </div>
                      <p className="text-[9.5px] text-brand-ash font-sans leading-tight mt-0.5 card-text">
                        {goal.corePrinciple}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Core Custom Challenge Pledge Quote */}
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-xs font-semibold text-brand-muted flex items-center gap-1">
              <Smile size={13} className="text-brand-green" />
              3. 寫下一句專屬您的自我期勉承諾
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:ring-1 focus:ring-brand-green"
              value={formData.customGoal}
              onChange={(e) => setFormData(prev => ({ ...prev, customGoal: e.target.value }))}
              placeholder="例如：對抗完美主義，每天隨緣喝足溫水，拉伸就是大贏家 🌱"
            />
          </div>

          {/* Metabolics & Calorie targets limit setup */}
          <div className="p-4 bg-brand-beige border border-brand-border rounded-2xl flex flex-col gap-3">
            <h4 className="text-xs font-sans font-bold text-brand-olive">
              4. 基礎代謝率與每日熱量防護線定位 (kcal)
            </h4>
            <div className="p-3 bg-white border border-brand-border rounded-xl flex flex-col gap-2 shadow-4xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-brand-muted border-b border-brand-cream pb-2">
                <span>🔥 基礎代謝率 BMR: <strong className="text-brand-text font-mono">{currentCalc.bmr}</strong> kcal/天</span>
                <span>⚡ 每日能耗 TDEE: <strong className="text-brand-green font-mono">{currentCalc.tdee}</strong> kcal/天</span>
                <span>🥛 建議基本補水: <strong className="text-blue-600 font-mono">{waterTarget}</strong> ml/天</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
                {(() => {
                  const safeFloor = formData.gender === "男生" ? 1500 : 1200;
                  const mildLossTarget = Math.max(safeFloor, currentCalc.tdee - 300);
                  const activeLossTarget = Math.max(safeFloor, currentCalc.tdee - 500);

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => applyCaloriePreset(currentCalc.tdee)}
                        className={`p-2 rounded-xl text-left border flex flex-col gap-0.5 transition-all cursor-pointer ${
                          formData.dailyCalorieTarget === currentCalc.tdee
                            ? "bg-brand-green/10 border-brand-green/60 text-brand-darkgreen font-semibold"
                            : "bg-[#FAF9F6] border-brand-border-light hover:bg-brand-beige"
                        }`}
                      >
                        <span className="text-[9px] font-bold text-brand-olive">🧍 維持體重健康線</span>
                        <span className="text-[11px] font-mono font-bold text-brand-text">{currentCalc.tdee} kcal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyCaloriePreset(mildLossTarget)}
                        className={`p-2 rounded-xl text-left border flex flex-col gap-0.5 transition-all cursor-pointer ${
                          formData.dailyCalorieTarget === mildLossTarget
                            ? "bg-brand-green/20 border-brand-green text-brand-darkgreen font-semibold"
                            : "bg-[#FAF9F6] border-brand-border-light hover:bg-brand-beige"
                        }`}
                      >
                        <span className="text-[9px] font-bold text-brand-green">🏃 輕盈減脂 (無痛推薦)</span>
                        <span className="text-[11px] font-mono font-bold text-brand-green">{mildLossTarget} kcal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyCaloriePreset(activeLossTarget)}
                        className={`p-2 rounded-xl text-left border flex flex-col gap-0.5 transition-all cursor-pointer ${
                          formData.dailyCalorieTarget === activeLossTarget
                            ? "bg-red-500/10 border-red-300 text-red-800 font-semibold"
                            : "bg-[#FAF9F6] border-brand-border-light hover:bg-brand-beige"
                        }`}
                      >
                        <span className="text-[9px] font-bold text-red-700">🔥 積極降脂規劃線</span>
                        <span className="text-[11px] font-mono font-bold text-red-800">{activeLossTarget} kcal</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="mt-3.5 border-t border-brand-cream/80 pt-3 flex flex-col gap-2.5 bg-brand-cream/10 p-2.5 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-[10px] font-medium text-brand-muted">🎯 自訂目標熱量防護線：</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className="w-20 px-2 py-0.5 border border-brand-border rounded-lg text-center text-xs font-mono font-bold text-brand-green bg-white"
                      value={formData.dailyCalorieTarget}
                      onChange={(e) => setFormData(prev => ({ ...prev, dailyCalorieTarget: Number(e.target.value) }))}
                    />
                    <span className="text-[10px] text-brand-muted">kcal / 天</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-dashed border-brand-border-light pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span className="text-[10px] font-medium text-brand-muted">🏃 自訂每日運動目標：</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-20 px-2 py-0.5 border border-brand-border rounded-lg text-center text-xs font-mono font-bold text-brand-green bg-white"
                        value={formData.dailyExerciseTarget}
                        onChange={(e) => setFormData(prev => ({ ...prev, dailyExerciseTarget: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-[10px] text-brand-muted flex items-center gap-1.5">
                        <span>分鐘 / 天</span>
                        <span className="text-[#8C8472] font-mono text-[9px] bg-brand-cream border px-1.5 py-0.5 rounded-md">
                          (每週累積約: <strong className="font-extrabold text-brand-green font-mono">{(formData.dailyExerciseTarget || 0) * 7}</strong> 分鐘)
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* WHO 身體活動科學指南提示 */}
                  <p className="text-[9.5px] leading-relaxed text-[#8C8472] pl-2 border-l border-brand-green/30 italic font-normal">
                    💡 **WHO 指導建議**：成年人每週應累積 **150 ~ 300 分鐘** 中等強度身體活動（每天約 20 ~ 40 分鐘）。不需給自己壓力，飯後悠閒散步、走樓梯或伸展皆可輕鬆計入！
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-t border-dashed border-brand-border-light pt-2.5">
                  <span className="text-[10px] font-medium text-brand-muted">💤 自訂每日睡眠目標：</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className="w-20 px-2 py-0.5 border border-brand-border rounded-lg text-center text-xs font-mono font-bold text-brand-green bg-white"
                      value={formData.dailySleepTarget || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, dailySleepTarget: Number(e.target.value) || 0 }))}
                    />
                    <span className="text-[10px] text-brand-muted">小時 / 天</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-t border-dashed border-brand-border-light pt-2.5">
                  <span className="text-[10px] font-semibold text-brand-darkgreen flex items-center gap-1">🔔 每日定時提醒更新：</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-brand-text font-bold">
                      <input
                        type="checkbox"
                        className="rounded border-brand-border text-brand-green focus:ring-brand-green/30 h-3.5 w-3.5 cursor-pointer"
                        checked={formData.dailyReminderEnabled ?? true}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({ ...prev, dailyReminderEnabled: checked }));
                          if (checked && "Notification" in window) {
                            Notification.requestPermission();
                          }
                        }}
                      />
                      啟用提醒
                    </label>
                    <input
                      type="time"
                      className="px-2 py-0.5 border border-brand-border rounded-lg text-center text-xs font-mono font-bold text-brand-green bg-white cursor-pointer"
                      value={formData.dailyReminderTime || "09:00"}
                      onChange={(e) => setFormData(prev => ({ ...prev, dailyReminderTime: e.target.value }))}
                      disabled={formData.dailyReminderEnabled === false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submittable form actions */}
          <div className="flex items-center justify-between border-t border-brand-border-light pt-4 mt-1 bg-white/30 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('summary')}
              className="px-4 py-2 bg-brand-cream hover:bg-[#F3EFE6] text-brand-muted hover:text-brand-text font-sans text-xs font-semibold rounded-xl border border-brand-border cursor-pointer transition-all"
            >
              取消 / 返回總結
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
            >
              <Save size={14} />
              {isSaved ? "計畫已更新保存 ✔" : "儲存計畫設定"}
            </button>
          </div>
        </form>
      ) : (
        /* RENDER HABITS SELECTION & LEVEL CONFIG TAB */
        <div className="flex flex-col gap-4 text-left">
          <div className="bg-brand-cream border border-brand-border p-3.5 rounded-2xl">
            <h4 className="text-xs font-sans font-bold text-brand-olive flex items-center gap-1.5">
              <Zap size={13} className="text-brand-green animate-bounce" />
              原子微任務難度調研（難度階梯微調）
            </h4>
            <p className="text-[10px] text-brand-muted mt-1 leading-relaxed">
              根據在「健康計畫設定」中所選大目標，此處為您解壓縮所有對應微行動。您可單獨勾選要挑戰的條目，並微調其每日挑戰難度（Lv1、Lv2、Lv3），不求完美，每日執行 15 秒即加分！
            </p>
          </div>

          <div className="flex flex-col gap-3.5 max-h-[500px] overflow-y-auto pr-1">
            {GOALS_DATA.filter(g => (formData.selectedGoals || []).includes(g.id)).length === 0 ? (
              <div className="p-8 text-center text-brand-muted text-xs bg-brand-cream border border-brand-border rounded-2xl flex flex-col gap-1">
                <p>⚠️ 您尚未勾選任何健康大目標喔！</p>
                <p className="text-[10.5px]">請先切換至「📋 健康計畫設定」勾選大目標，此處將智能為您開拓微行動對應指標！💖</p>
              </div>
            ) : (
              GOALS_DATA.filter(g => (formData.selectedGoals || []).includes(g.id)).map((goal) => (
                <div key={goal.id} className="p-3.5 bg-white border border-brand-border rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 border-b border-brand-cream pb-1.5">
                    <span className="text-sm">🎯</span>
                    <span className="font-sans text-xs font-bold text-brand-olive">{goal.name} (習慣解壓)</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {goal.habits.map((h) => {
                      const selectedHabits = formData.selectedHabits || [];
                      const isChecked = selectedHabits.some(item => item.habitId === h.id);
                      const habitConfig = selectedHabits.find(item => item.habitId === h.id);
                      const currentLevel = habitConfig ? habitConfig.level : 1;

                      const theme = getCategoryTheme(h.category);

                      return (
                        <div
                          key={h.id}
                          className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                            isChecked
                              ? "bg-brand-green/5 border-brand-green/40 shadow-4xs"
                              : "bg-[#FAFAFA] border-brand-border-light/60 opacity-60"
                          }`}
                        >
                          {/* Checked line top */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <label className="flex items-start gap-2 cursor-pointer flex-1 select-none">
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded border-brand-border text-brand-green focus:ring-brand-green/30 h-3.5 w-3.5"
                                checked={isChecked}
                                onChange={() => handleToggleHabit(h.id)}
                              />
                              <span className="text-xs font-extrabold text-brand-text leading-snug">
                                {h.name}
                              </span>
                            </label>
                            <span className={`text-[9px] font-sans font-bold px-1.5 py-0.2 bg-white rounded border flex-shrink-0 ${theme.bg}`}>
                              {theme.label}
                            </span>
                          </div>

                          {/* Levels Slider/Segments */}
                          <div className="grid grid-cols-3 gap-1 p-0.5 bg-brand-cream/80 border border-brand-border-light rounded-lg">
                            {[1, 2, 3].map((lv) => {
                              const isActive = currentLevel === lv;
                              const levelsLabels = { 1: "Lv1 超容易", 2: "Lv2 普通", 3: "Lv3 進階" };
                              return (
                                <button
                                  key={lv}
                                  type="button"
                                  onClick={() => handleSetHabitLevel(h.id, lv as 1 | 2 | 3)}
                                  className={`py-1 text-[9.5px] font-sans font-bold rounded-md transition-all cursor-pointer ${
                                    isActive
                                      ? "bg-brand-green text-white shadow-3xs"
                                      : "text-brand-muted hover:bg-brand-beige text-opacity-80"
                                  }`}
                                >
                                  {levelsLabels[lv as 1 | 2 | 3]}
                                </button>
                              );
                            })}
                          </div>

                          {/* Description text */}
                          <div className="bg-brand-cream/40 p-2 rounded-lg border border-brand-border-light/40 flex flex-col gap-0.5 select-all">
                            <p className="text-[10px] text-brand-green font-bold flex items-center gap-1 leading-none">
                              🍀 目前設定的行動指標：
                            </p>
                            <p className="text-[10.5px] text-brand-text font-bold mt-0.5 leading-normal">
                              {h.levels[currentLevel as 1 | 2 | 3]}
                            </p>
                            <p className="text-[9.5px] text-[#807D70] font-sans italic leading-tight mt-1 bg-white/40 px-1.5 py-0.5 rounded">
                              科學原理：{h.suggestion}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-brand-border-light pt-4 mt-1 bg-white/30 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('summary')}
              className="px-4 py-2 bg-brand-cream hover:bg-[#F3EFE6] text-brand-muted hover:text-brand-text font-sans text-xs font-semibold rounded-xl border border-brand-border cursor-pointer transition-all"
            >
              取消 / 返回總結
            </button>
            <button
              type="button"
              onClick={() => handleSaveAll()}
              className="px-6 py-2.5 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
            >
              <Save size={14} />
              {isSaved ? "微習慣設定保存 ✔" : "儲存微行動設定"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
