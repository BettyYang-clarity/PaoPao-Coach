/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import { GOALS_DATA } from "../../src/data/habitsData";
import { getActionableGuide } from "../../src/data/actionableGuides";

export default async function handler(req: Request, res: Response) {
  try {
    const { profile } = req.body || {};
    const selectedHabits = profile?.selectedHabits || [];

    const tasks: any[] = [];
    let idx = 0;

    selectedHabits.forEach((sh: any) => {
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
        const challengeText = foundHabit.levels[sh.level as 1 | 2 | 3] || foundHabit.levels[1];
        const actionableText = getActionableGuide(foundHabit.id, foundHabit.category);
        tasks.push({
          id: `t-pref-${foundHabit.id}-${sh.level}-${idx++}`,
          title: `【${goalName} ｜ ${foundHabit.name} ${lvLabels[sh.level as 1 | 2 | 3] || "Lv1"}】 ${challengeText} ➔ 👉 實際執行：${actionableText}`,
          category: foundHabit.category,
          completed: false,
          points: sh.level === 1 ? 15 : sh.level === 2 ? 25 : 35,
          suggestion: foundHabit.suggestion,
          anchorHabit: sh.anchorHabit
         });
      }
    });

    // Fallback completely to general_health default tasks only if they literally haven't selected anything
    if (tasks.length === 0) {
      const general = GOALS_DATA.find(g => g.id === "general_health");
      if (general) {
        general.habits.slice(0, 3).forEach((h) => {
          tasks.push({
            id: `t-fallback-${h.id}-1-${idx++}`,
            title: `【維持健康 ｜ ${h.name} Lv1 超容易】 ${h.levels[1]} ➔ 👉 實際執行：${getActionableGuide(h.id, h.category)}`,
            category: h.category,
            completed: false,
            points: 15,
            suggestion: h.suggestion
          });
        });
      }
    }

    res.json({ tasks });
  } catch (error: any) {
    console.error("Error in Vercel suggest-tasks handler:", error);
    res.status(500).json({ error: "無法推薦微習慣任務", details: error.message });
  }
}
