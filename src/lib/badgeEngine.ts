/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WellnessRecord, MicroTask } from "../types";

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlockedDescription: string;
  icon: string; // Emoji
  category: 'diet' | 'exercise' | 'sleep' | 'water' | 'protein' | 'general';
  isUnlocked: boolean;
  progressText: string;
  color: string; // Tailwind colors
}

// Robust consecutive days algorithm helper
function getLongestConsecutiveDays(dates: string[]): number {
  if (dates.length === 0) return 0;
  
  // Sort unique dates chronologically
  const sortedDateTimes = Array.from(new Set(dates))
    .map(d => new Date(`${d}T12:00:00`).getTime()) // Noon to safeguard DST
    .sort((a, b) => a - b);
  
  let longest = 1;
  let current = 1;
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let i = 1; i < sortedDateTimes.length; i++) {
    const diff = sortedDateTimes[i] - sortedDateTimes[i - 1];
    
    // Check if the difference is exactly 1 day (with a 2-hour safety tolerance for DST transitions)
    if (diff >= oneDayMs - 7200000 && diff <= oneDayMs + 7200000) {
      current++;
    } else if (diff > oneDayMs + 7200000) {
      current = 1;
    }
    if (current > longest) {
      longest = current;
    }
  }
  return longest;
}

export function evaluateBadges(
  records: WellnessRecord[],
  dailyCalorieTarget: number,
  microTasks: MicroTask[] = [],
  totalPoints: number = 0
): Badge[] {
  // 1. Get dates arrays for streaks
  const dietDates = Array.from(new Set(
    records
      .filter(r => r.type === "diet")
      .map(r => r.timestamp.slice(0, 10))
  ));
  const longestDietStreak = getLongestConsecutiveDays(dietDates);

  const exeDates = Array.from(new Set(
    records
      .filter(r => r.type === "exercise")
      .map(r => r.timestamp.slice(0, 10))
  ));
  const longestExeStreak = getLongestConsecutiveDays(exeDates);

  // 2. Today stats (localtime friendly)
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => r.timestamp.slice(0, 10) === todayStr);
  
  const todayDietKcal = todayRecords
    .filter(r => r.type === "diet")
    .reduce((sum, r) => sum + (r.estimatedValue || 0), 0);
  const hasDietToday = todayRecords.some(r => r.type === "diet");

  const todayWaterIntake = todayRecords
    .filter(r => r.type === "water")
    .reduce((sum, r) => sum + (r.estimatedValue || 0), 0);

  // 3. Sleep milestones (count sleep records >= 7 hours)
  const eliteSleepCount = records.filter(r => r.type === "sleep" && (r.estimatedValue || 0) >= 7).length;

  // 4. Protein milestones (count diet records with protein >= 25g)
  const highProteinRecordsCount = records.filter(r => r.type === "diet" && (r.proteinGrams || 0) >= 25).length;
  
  // Find highest recorded single-meal protein
  const highestProteinVal = records
    .filter(r => r.type === "diet" && r.proteinGrams !== undefined)
    .reduce((max, r) => Math.max(max, r.proteinGrams || 0), 0);

  // 5. Atomic task stats
  const totalTasks = microTasks.length;
  const completedTasks = microTasks.filter((t) => t.completed).length;
  const hasCompletedAnyTask = completedTasks >= 1;
  const isPerfectTasks = totalTasks > 0 && completedTasks === totalTasks;

  // Define badges
  return [
    {
      id: "b-starter",
      name: "誠實起跑者 🏃‍♂️",
      description: "登錄人生第 1 筆原子健康紀錄，邁出無痛掌握生活的第一步。",
      unlockedDescription: "恭喜！踏出了原子微習慣最厲害的第一步，誠實是你最強大的盟友！",
      icon: "🌱",
      category: "general",
      isUnlocked: records.length >= 1,
      progressText: records.length >= 1 ? "1 / 1" : "0 / 1",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200"
    },
    {
      id: "b-diet-streak",
      name: "七日飲食陪跑員 🍱",
      description: "連續 7 天誠實記錄飲食餐點。不要求完美的飲食，只著重無壓力紀錄！",
      unlockedDescription: "太不可思議了！連續 7 天與教練並肩前行，你的飲食覺察力已經大幅躍升！",
      icon: "🏅",
      category: "diet",
      isUnlocked: longestDietStreak >= 7,
      progressText: `${longestDietStreak} / 7 天`,
      color: "bg-amber-50 text-amber-800 border-amber-200"
    },
    {
      id: "b-exe-streak",
      name: "三日運動悍將 ⚡",
      description: "連續 3 天記錄運動。不管是伸展、散步還是大汗淋漓，動起來就卓越！",
      unlockedDescription: "身體在為你喝采！連續 3 天調用你的細胞活力，你已成功啟動原子動能！",
      icon: "🔥",
      category: "exercise",
      isUnlocked: longestExeStreak >= 3,
      progressText: `${longestExeStreak} / 3 天`,
      color: "bg-orange-50 text-orange-800 border-orange-200"
    },
    {
      id: "b-deficit",
      name: "溫柔熱量赤字 🥗",
      description: "單日控制攝取熱量低於目標。在自主節奏中給予大腦零壓力控卡。",
      unlockedDescription: "今日控卡滿分！你的攝取熱量溫和地在計畫之內，身體感到特別輕盈。",
      icon: "🍀",
      category: "diet",
      isUnlocked: hasDietToday && todayDietKcal <= dailyCalorieTarget,
      progressText: hasDietToday ? `${todayDietKcal} / ${dailyCalorieTarget} 大卡` : "今日尚未記錄飲食",
      color: "bg-blue-55 text-blue-800 border-blue-200"
    },
    {
      id: "b-water",
      name: "新陳代謝灌溉者 🥛",
      description: "今日補充水份達 1500 毫升（ml）以上。順手灌溉全身６兆細胞！",
      unlockedDescription: "水分補好補滿！1500ml 溫水成功入胃，恭喜你啟動了極佳的代謝開關！",
      icon: "💧",
      category: "water",
      isUnlocked: todayWaterIntake >= 1500,
      progressText: `${todayWaterIntake} / 1500 ml`,
      color: "bg-cyan-50 text-cyan-800 border-cyan-200"
    },
    {
      id: "b-sleep",
      name: "高規格睡眠寶寶 😴",
      description: "累計 3 次睡足 7 小時（含）以上的睡眠紀錄，讓大腦啟動排毒清潔機制。",
      unlockedDescription: "滿滿的修復力！累計 3 次足量深度睡眠，這可是你最天然、最顶级的養生補品！",
      icon: "🌙",
      category: "sleep",
      isUnlocked: eliteSleepCount >= 3,
      progressText: `${eliteSleepCount} / 3 次`,
      color: "bg-indigo-50 text-indigo-800 border-indigo-200"
    },
    {
      id: "b-protein",
      name: "優質高蛋白達人 🍳",
      description: "記錄過任何一餐含有 25 克（含）以上優質蛋白質的健美餐食。",
      unlockedDescription: "蛋白質之王！成功攝取 25g+ 精準蛋白質，肌肉正在開心重建與修補！",
      icon: "🥚",
      category: "protein",
      isUnlocked: highestProteinVal >= 25,
      progressText: `${highestProteinVal} / 25 克`,
      color: "bg-rose-50 text-rose-800 border-rose-200"
    },
    {
      id: "b-milestone",
      name: "微紀錄生活大師 👑",
      description: "累計寫下 5 筆（含）以上健康足跡，誠實面對自我是最帥氣的微習慣！",
      unlockedDescription: "你已經擁有 5 次以上的豐碩足跡！原子習慣滾雪球，你正在翻轉人生的航道！",
      icon: "🏆",
      category: "general",
      isUnlocked: records.length >= 5,
      progressText: `${records.length} / 5 筆`,
      color: "bg-purple-50 text-purple-800 border-purple-200"
    },
    {
      id: "b-atomic-first",
      name: "原子點火 ⚡",
      description: "今日完成了至少 1 項原子小任務。微小的開始，就是複利的起點！",
      unlockedDescription: "太棒了！你點燃了第一個微習慣火苗，大腦的阻力已經被你成功擊碎！",
      icon: "⚡",
      category: "general",
      isUnlocked: hasCompletedAnyTask,
      progressText: `${completedTasks} / 1`,
      color: "bg-emerald-50 text-emerald-800 border-emerald-200"
    },
    {
      id: "b-atomic-perfect",
      name: "無痛全壘打 🏆",
      description: "今日清單上的原子任務 100% 全數達成！以最低磨損的方式完成對自我的承諾。",
      unlockedDescription: "無痛全壘打達成！你用最低磨損的堅持完成了所有的原子承諾，習慣大師就是你！",
      icon: "🏆",
      category: "general",
      isUnlocked: isPerfectTasks,
      progressText: totalTasks > 0 ? `${completedTasks} / ${totalTasks}` : "0 / 0",
      color: "bg-amber-50 text-amber-800 border-amber-200"
    },
    {
      id: "b-points-100",
      name: "百倍複利雪球 ❄️",
      description: "累積健康行為複利達 100 分。看吧，微小的習慣正在滾成大雪球！",
      unlockedDescription: "恭喜解鎖百倍複利！100 分的行為積累，證明你已經掌握了無痛習慣的密碼！",
      icon: "❄️",
      category: "general",
      isUnlocked: totalPoints >= 100,
      progressText: `${totalPoints} / 100 分`,
      color: "bg-sky-50 text-sky-800 border-sky-200"
    },
    {
      id: "b-points-500",
      name: "習慣複利奇蹟 👑",
      description: "累積健康行為複利達 500 分。習慣複利的奇蹟，已在你的日常中發光發熱。",
      unlockedDescription: "習慣複利奇蹟！500 分的深層蛻變，你已將健康認同深刻進了靈魂深處！",
      icon: "👑",
      category: "general",
      isUnlocked: totalPoints >= 500,
      progressText: `${totalPoints} / 500 分`,
      color: "bg-purple-100 text-purple-900 border-purple-300"
    }
  ];
}
