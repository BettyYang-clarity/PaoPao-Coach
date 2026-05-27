/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoachState, MicroTask, UserProfile } from "../types";
import { GOALS_DATA } from "../data/habitsData";

const LOCAL_STORAGE_KEY = "ai_health_coach_state";

export function getTasksFromSelectedHabits(profile: UserProfile): MicroTask[] {
  const selectedHabits = profile.selectedHabits || [];
  const generated: MicroTask[] = [];
  let idx = 0;

  selectedHabits.forEach((sh) => {
    let foundHabit: any = null;
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
      const lvLabels: Record<number, string> = { 1: "Lv1 超容易", 2: "Lv2 普通", 3: "Lv3 進階" };
      const challengeText = foundHabit.levels[sh.level] || foundHabit.levels[1];
      generated.push({
        id: `t-pref-${foundHabit.id}-${sh.level}-${idx++}`,
        title: `【${goalName} ｜ ${foundHabit.name} ${lvLabels[sh.level] || "Lv1"}】 ${challengeText}`,
        category: foundHabit.category,
        completed: false,
        points: sh.level === 1 ? 15 : sh.level === 2 ? 25 : 35,
        suggestion: foundHabit.suggestion
      });
    }
  });

  return generated;
}

export const INITIAL_STATE: CoachState = {
  profile: {
    name: "誠實陪跑生",
    height: 170,
    weight: 65,
    gender: "不公開",
    age: 28,
    activityLevel: "lightly_active",
    dailyCalorieTarget: 1600,
    dailyExerciseTarget: 30,
    dailySleepTarget: 7,
    dailyReminderEnabled: true,
    dailyReminderTime: "09:00",
    customGoal: "培養每日誠實記錄生活、溫和補水與多吃蔬菜的微習慣 🌿",
    avatarId: "avatar-1",
    selectedGuidelines: ["diet_whole", "water_more", "rest_sleep"],
    selectedGoals: ["weight_loss", "general_health"],
    selectedHabits: [
      { habitId: "wl_protein_first", level: 1 },
      { habitId: "wl_eat_veg", level: 1 },
      { habitId: "wl_walk_after_meal", level: 1 },
      { habitId: "gh_step_7000", level: 1 },
      { habitId: "gh_drink_regular", level: 2 }
    ]
  },
  records: [],
  microTasks: [], // Will be filled below dynamically
  messages: [
    {
      id: "m-welcome",
      sender: "bot",
      text: "嗨！我是您的 PaoPao教練。很高興今天能夠陪伴你！❤️\n\n在這裡：\n👉 輸入「食物名稱」(如：地瓜/香蕉)，我會為您估算標準卡路里與三大營養配盤成分參考（不提供任何個人化臨床飲食治療方案，但為您送上哈佛餐盤公開指引比對）。\n👉 輸入「運動」(如：慢跑/重訓)，我會為您幫忙依代謝當量估算約略消耗大卡與運動推薦！\n👉 點擊「飲食拍照」就能自動分析與無痛習慣打卡。\n\n每天都有專屬原子小任務，一起輕鬆無痛培養一輩子的健康認同吧！🌱",
      timestamp: new Date().toISOString()
    }
  ],
  totalPoints: 0
};

// Dynamically fill INITIAL_STATE microTasks so that they match profile settings perfectly
INITIAL_STATE.microTasks = getTasksFromSelectedHabits(INITIAL_STATE.profile);

export function loadCoachState(): CoachState {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // Ensure arrays and structures are loaded correctly
      if (parsed.profile && parsed.records && parsed.microTasks && parsed.messages) {
        // Migration cleanup if old cache had pet or default initial mock diet logs
        if (parsed.pet) delete parsed.pet;
        const initialIndex = parsed.records.findIndex((r: any) => r.id === "r-initial");
        if (initialIndex !== -1) {
          parsed.records.splice(initialIndex, 1);
          parsed.totalPoints = Math.max(0, (parsed.totalPoints || 20) - 20);
        }

        // Ensure default properties from INITIAL_STATE are merged in case they are missing in old cache
        parsed.profile = {
          ...INITIAL_STATE.profile,
          ...parsed.profile
        };

        // If the microTasks had old static initialization tasks, overwrite them strictly with their profile selected habits
        const hasOldTasks = parsed.microTasks.some((t: any) => 
          t.id.startsWith("dt-init-") || 
          t.id.startsWith("t-auto-") || 
          t.id.startsWith("t-fallback-")
        );
        if (hasOldTasks || parsed.microTasks.length === 0) {
          parsed.microTasks = getTasksFromSelectedHabits(parsed.profile);
        }

        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load local coach state:", e);
  }
  return { ...INITIAL_STATE };
}

export function saveCoachState(state: CoachState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save local coach state:", e);
  }
}
