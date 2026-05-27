/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { UserProfile } from "../types";
import { GOALS_DATA } from "../data/habitsData";
import { Star, Target } from "lucide-react";

interface HealthPlanSummaryProps {
  profile: UserProfile;
}

export default function HealthPlanSummary({ profile }: HealthPlanSummaryProps) {
  // Mifflin-St Jeor Formula calculation (BMR & TDEE) identical to ProfileForm
  const getBmrAndTdee = (
    weight = 65,
    height = 170,
    age = 28,
    gender = "不公開",
    activity = "lightly_active"
  ) => {
    let s = -78; // average offset
    if (gender === "男生") {
      s = 5;
    } else if (gender === "女生") {
      s = -161;
    }

    const bmr = 10 * weight + 6.25 * height - 5 * age + s;

    let palMultiplier = 1.375;
    if (activity === "sedentary") palMultiplier = 1.2;
    else if (activity === "lightly_active") palMultiplier = 1.375;
    else if (activity === "moderately_active") palMultiplier = 1.55;
    else if (activity === "very_active") palMultiplier = 1.725;

    const tdee = Math.round(bmr * palMultiplier);

    return {
      bmr: Math.round(bmr),
      tdee: tdee > 1000 ? tdee : 1600,
      palValue: palMultiplier,
    };
  };

  const currentCalc = getBmrAndTdee(
    profile.weight,
    profile.height,
    profile.age,
    profile.gender,
    profile.activityLevel
  );

  const waterTarget = (profile.weight || 65) * 35; // Standard hydration level

  const selectedGoalsList = GOALS_DATA.filter(g => (profile.selectedGoals || []).includes(g.id));
  const selectedHabitsList = (profile.selectedHabits || []).map((sh) => {
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
    <div className="flex flex-col gap-4 text-left animate-fade-in w-full">
      {/* Three Core Pillars Cards */}
      <div className="p-5 bg-emerald-50/40 border border-emerald-500/20 rounded-3xl flex flex-col gap-3 shadow-3xs">
        <h4 className="text-xs font-sans font-extrabold text-emerald-850 flex items-center gap-1.5 border-b border-emerald-500/10 pb-2">
          <Star size={13} className="text-emerald-700 animate-pulse" /> 【您的三大核心健康計畫重點】
        </h4>
        <ul className="text-[10px] text-emerald-900/95 space-y-2.5 font-sans list-none pl-0">
          <li className="flex items-start gap-2">
            <span className="text-emerald-700 font-extrabold flex-shrink-0 text-xs">①</span>
            <div>
              <strong className="font-bold text-emerald-800">精準每日熱量防線：</strong>
              設定為 <strong className="font-black text-emerald-800 font-mono text-[11px]">{profile.dailyCalorieTarget || currentCalc.tdee} kcal</strong>，完美對接您的 TDEE 每日能量代謝。
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-700 font-extrabold flex-shrink-0 text-xs">②</span>
            <div>
              <strong className="font-bold text-emerald-800">基礎水分與日常作息：</strong>
              今日補水目標 <strong className="font-black text-emerald-800 font-mono text-[11px]">{waterTarget} ml</strong>、中度活動目標 <strong className="font-black text-emerald-800 font-mono text-[11px]">{profile.dailyExerciseTarget || 30} 分鐘</strong> 與黃金睡眠品質 <strong className="font-black text-emerald-800 font-mono text-[11px]">{profile.dailySleepTarget || 7} 小時</strong>。
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-700 font-extrabold flex-shrink-0 text-xs">③</span>
            <div>
              <strong className="font-bold text-emerald-800">原子行動方針：</strong>
              共綁定 <strong className="font-black text-emerald-800 text-[11px]">{selectedGoalsList.length}</strong> 個核心健康目標方向，並啟用 <strong className="font-black text-brand-green text-[11px]">{selectedHabitsList.length}</strong> 個客製精準微行動！
            </div>
          </li>
        </ul>
      </div>

      {/* Selected Strategic Goals */}
      <div className="p-5 bg-white border border-brand-border rounded-[28px] flex flex-col gap-3 shadow-3xs">
        <h4 className="text-xs font-sans font-extrabold text-brand-olive flex items-center gap-1.5 border-b border-brand-cream/60 pb-2">
          <Target size={13} className="text-brand-green" /> 【已鎖定的健康戰略方向】
        </h4>
        {selectedGoalsList.length === 0 ? (
          <p className="text-[10px] text-brand-muted text-center py-2">尚未選擇目標，可至「個人設定」進行更新 🌿</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {selectedGoalsList.map(g => (
              <div key={g.id} className="p-3 bg-brand-cream/30 border border-brand-border/50 rounded-2xl flex flex-col gap-1">
                <span className="text-[10.5px] font-bold text-brand-olive">🎯 {g.name}</span>
                <p className="text-[9.5px] text-[#807D70] leading-tight-more">{g.corePrinciple}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
