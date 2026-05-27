/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  name: string;
  height?: number;
  weight?: number;
  gender: string;
  age?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  dailyCalorieTarget: number;
  dailyExerciseTarget: number; // minutes
  dailySleepTarget: number; // hours
  customGoal: string;
  avatarId: string;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string; // e.g. "09:00"
  selectedGuidelines?: string[]; // Keep for compatibility
  selectedGoals?: string[]; // Selected Goal IDs from the 7 options
  selectedHabits?: Array<{ habitId: string; level: 1 | 2 | 3 }>; // Selected Atomic Habits with user Chosen Levels (1-3)
}

export interface WellnessRecord {
  id: string;
  timestamp: string; // ISO string
  type: 'diet' | 'exercise' | 'sleep' | 'mood' | 'water' | 'weight';
  title: string;
  imageUrl?: string;
  estimatedValue?: number; // e.g., kcal, minutes, hours, or ml
  unit: string; // e.g., "大卡", "分鐘", "小時", "毫升", "公斤"
  moodScore?: number; // 1-5
  notes?: string;
  coachFeedback: string;
  pointsEarned: number;
  proteinGrams?: number; // Optional protein tracking in grams
  caloriesBurned?: number; // Optional calories burned in kcal (specifically for exercise type)
  bodyFatPercent?: number; // Optional body fat portion trackers
  nutritionRough?: {
    carbs?: string; // e.g. "適中", "極少"
    protein?: string;
    fat?: string;
    veg?: string;
  };
}

export interface MicroTask {
  id: string;
  title: string;
  category: 'diet' | 'exercise' | 'sleep' | 'mood' | 'water';
  completed: boolean;
  points: number;
  completedAt?: string;
  suggestion: string; // High-empathy encouraging line
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  imageUrl?: string;
}

export interface CoachState {
  profile: UserProfile;
  records: WellnessRecord[];
  microTasks: MicroTask[];
  messages: ChatMessage[];
  totalPoints: number;
  isExcused?: boolean;
}

export const WATER_MICRO_TASK_POOL: string[] = [
  "如果常忘記喝開水，可以把滿水的水杯放在鍵盤右手邊 5 公分處，這樣可以順手喝夠水喔",
  "如果早上醒來時，可以直接喝一杯 300ml 的溫開水，這樣可以溫和喚醒腸胃喔",
  "如果下午感到口渴，可以用一大杯白開水代替手搖含糖飲料，這樣可以避免攝取過多糖分喔",
  "如果覺得開水單調，可以加入一片新鮮檸檬或無糖茶包，這樣可以增加水分攝取量喔",
  "如果準備吹頭髮睡覺，可以先在床頭櫃放一個裝好水的杯子，這樣可以方便明早飲用喔"
];

export const DIET_MICRO_TASK_POOL: string[] = [
  "如果肚子餓了，可以用原味溫熱堅果代替精緻零食，這樣可以更健康喔",
  "如果準備吃下一餐，可以多選一種看得到食物原型的配餐，這樣可以吸收更多天然營養喔",
  "如果遇到高油脂的炸物，可以用筷子剝去外層的炸衣粉皮，這樣可以減少多餘熱量攝取喔",
  "如果主餐便當菜送來，可以先吃綠色蔬菜並慢嚼 10 下，這樣可以平穩餐後血糖喔",
  "如果想吃便當白飯，可以故意在餐盒角落留下一小口，這樣可以更輕鬆控制碳水喔",
  "如果去裝下午或晚上便當，可以主動請老闆少淋一些肉燥肉汁，這樣可以減輕身體負擔喔",
  "如果今晚九點到了，可以貼一張便簽宣佈廚房打烊，這樣可以避免睡前吃消夜喔"
];

export const EXERCISE_MICRO_TASK_POOL: string[] = [
  "如果坐在座位太久，可以站起來將雙手垂直朝天拉伸 15 秒，這樣可以釋放肩頸壓力喔",
  "如果搭乘捷運或公車，可以爬 10 級樓梯代替乘搭電扶梯，這樣可以鍛鍊下肢肌肉喔",
  "如果去洗手間或倒水，可以順便原地做 15 次墊腳尖，這樣可以促進血液微循環喔",
  "如果今天出門散步，可以往巷子外快步走 2 分鐘，這樣可以更有活力喔",
  "如果洗澡或躺平前，可以坐在床沿伸直雙腳摸摸腳趾 15 秒，這樣可以拉開緊繃肌群喔"
];

export const SLEEP_MICRO_TASK_POOL: string[] = [
  "如果想要睡得更沈，可以在上床前把手機充電線改移到離床三步外的書桌上，這樣可以阻絕藍光干擾喔",
  "如果熄燈躺平時，可以閉眼在腹部上緩慢地深大吐氣 5 次，這樣可以安定神經更好入眠喔",
  "如果今晚事情做不完，可以比平時提早 15 分鐘熄燈躺下，這樣可以預備深度大腦修復喔",
  "如果想養成規律作息，可以設定在 11:30 準時熄燈不再滑手機，這樣可以讓大腦養成健康時鐘喔",
  "如果希望晚上容易入眠，可以在下午 4 點以後不喝含有咖啡因的飲品，這樣可以避免神經系統過度興奮喔"
];

export const MOOD_MICRO_TASK_POOL: string[] = [
  "如果感覺壓力有點大，可以把手放在胸口上深呼吸 3 次，這樣可以讓心情迅速平靜讀秒喔",
  "如果快要結束一天，可以在便簽寫下一件就算微小但也讓人幸運的好事，這樣可以累積快樂能量喔",
  "如果正在刷牙照鏡子，可以給鏡中的自己一個溫暖的微笑，這樣可以放鬆緊繃的面部神經喔",
  "如果感到思緒繁雜，可以花 3 分鐘閉眼聽完一首自己最放鬆的療癒音樂，這樣可以阻斷焦慮打擾喔",
  "如果忙碌了一整天，可以用溫熱手掌捏一捏緊繃的肩頸 20 秒，這樣可以溫柔感念身體的付出喔"
];
