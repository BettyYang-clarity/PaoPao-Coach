/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { WellnessRecord, UserProfile, MicroTask } from "../types";
import { evaluateBadges } from "../lib/badgeEngine";
import { compressImage } from "../lib/imageCompress";
import { 
  Plus, 
  Coffee, 
  Calendar, 
  Eye, 
  Droplet, 
  Dumbbell, 
  Moon, 
  Smile, 
  Flame, 
  PlusCircle, 
  Check, 
  HelpCircle, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil
} from "lucide-react";

interface WellnessDashboardProps {
  records: WellnessRecord[];
  profile: UserProfile;
  totalPoints: number;
  microTasks: MicroTask[];
  onAddRecord: (record: WellnessRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  onUpdateRecord?: (record: WellnessRecord) => void;
  onNavigateToChat?: (query?: string, file?: File) => void;
}

export default function WellnessDashboard({
  records,
  profile,
  totalPoints,
  microTasks = [],
  onAddRecord,
  onDeleteRecord,
  onUpdateRecord,
  onNavigateToChat
}: WellnessDashboardProps) {
  // Modal toggles to split visual complexity
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isBadgesExpanded, setIsBadgesExpanded] = useState(false);

  const badges = evaluateBadges(records, profile.dailyCalorieTarget || 1600, microTasks, totalPoints);
  const unlockedBadgesCount = badges.filter(b => b.isUnlocked).length;
  const totalBadgesCount = badges.length;

  // Advisory stationary tips board
  const PAOPAO_ADVICES = [
    { text: "久坐會使代謝暴跌。現在起立聳肩並大伸展 15 秒，重新喚醒肌肉與脂肪燃燒酶吧。 ☕", tag: "微伸展", icon: "🛌" },
    { text: "微習慣如雪球。不求一夕登天，每天溫和前行 1% 就是最大成就。 🌿", tag: "習慣認同", icon: "🌱" },
    { text: "實踐一下蔬菜佔盤面一半的綠色餐盤比例，這能高效平穩餐後血糖、消除飯後昏睡。 🥦", tag: "哈佛餐盤", icon: "🥗" },
    { text: "每日喝足 1500~2000ml 開水是健康運行的關鍵。將水杯放在手邊，沒事順手啜飲兩口。 🥛", tag: "補水指標", icon: "🥛" },
    { text: "睡前 30 分鐘將手機改移到離床三步外的書桌上。隔絕藍光干擾，能大幅增加深睡比例。 💤", tag: "高效舒眠", icon: "😴" },
    { text: "今天壓力沉重嗎？站到鏡前對自己溫柔一笑。卸下多餘的焦慮，不完美正是最放鬆的常態。 🌸", tag: "心靈舒壓", icon: "❤️" },
    { text: "太酸太累不想動？沒關係，平躺把雙腿貼牆抬高 1 分鐘，大腦就會認證這是一次特級放鬆。 🧘", tag: "低磨損活動", icon: "🧘" },
    { text: "精緻含糖飲料會使血糖狂飆。嘗試用無糖綠茶或氣泡水溫和替代，減輕大腦糖癮的負擔。 🥤", tag: "減脂良伴", icon: "🥤" }
  ];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * PAOPAO_ADVICES.length));

  // Active logging tab inside the manual modal
  const [activeTab, setActiveTab] = useState<'diet' | 'water' | 'exercise' | 'sleep' | 'mood'>('diet');
  
  // Image Upload Core States - now only used for navigate-to-chat
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Diet Log
  const [dietTitle, setDietTitle] = useState("");
  const [dietKcal, setDietKcal] = useState<number | "">("");
  const [dietProtein, setDietProtein] = useState<number | "">("");

  // States for Exercise Log
  const [exerciseTitle, setExerciseTitle] = useState("");
  const [exerciseMin, setExerciseMin] = useState<number | "">("");
  const [exerciseBurnedKcal, setExerciseBurnedKcal] = useState<number | "">("");

  // States for Sleep Log
  const [sleepHours, setSleepHours] = useState<number>(7);

  // States for Mood Log
  const [moodScore, setMoodScore] = useState<number>(4);
  const [moodNotes, setMoodNotes] = useState("");

  // States for Hydration Custom Log
  const [customWaterMl, setCustomWaterMl] = useState<number | "">("");

  // History Multi-Tab Hub States
  const [historyTab, setHistoryTab] = useState<'timeline' | 'calendar' | 'trends' | 'medals'>('timeline');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'diet' | 'exercise' | 'sleep' | 'mood' | 'water' | 'weight'>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [weightInput, setWeightInput] = useState<number | "">("");
  const [bodyFatInput, setBodyFatInput] = useState<number | "">("");
  const [weightNotes, setWeightNotes] = useState("");
  const [trendDuration, setTrendDuration] = useState<30 | 60 | 90 | 180 | 365>(30);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // States for Footprint Editing mode
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState<number | "">("");
  const [editProtein, setEditProtein] = useState<number | "">("");
  const [editBurnedKcal, setEditBurnedKcal] = useState<number | "">("");
  const [editBodyFat, setEditBodyFat] = useState<number | "">("");
  const [editMealType, setEditMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' | "">("");

  const getDefaultMealType = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 17) return 'lunch';
    if (hour >= 17 && hour < 22) return 'dinner';
    if (hour >= 22 || hour < 5) return 'snack';
    return 'other';
  };

  const [dietMealType, setDietMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'>(getDefaultMealType());

  const [isLoading, setIsLoading] = useState(false);

  // Inline PaoPao Coach consultation state
  const [inlineQuery, setInlineQuery] = useState("");

  // Back-logging date states & helpers (Timezone-safe)
  const getLocalTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [logDate, setLogDate] = useState<string>(getLocalTodayString());
  const [weightLogDate, setWeightLogDate] = useState<string>(getLocalTodayString());

  const getRecordTimestamp = () => {
    const todayStr = getLocalTodayString();
    if (logDate === todayStr) {
      return new Date().toISOString();
    }
    const now = new Date();
    const [year, month, day] = logDate.split('-').map(Number);
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
  };

  const getWeightTimestamp = () => {
    const todayStr = getLocalTodayString();
    if (weightLogDate === todayStr) {
      return new Date().toISOString();
    }
    const now = new Date();
    const [year, month, day] = weightLogDate.split('-').map(Number);
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
  };

  // Reset inline query whenever tab changes
  useEffect(() => {
    setInlineQuery("");
  }, [activeTab]);

  // Navigate to chat with the selected file
  const handleImageForChat = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    onNavigateToChat?.(undefined, file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageForChat(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageForChat(e.dataTransfer.files[0]);
    }
  };

  // Navigate to chat with inline query
  const handleInlineConsult = () => {
    if (!inlineQuery.trim()) return;
    onNavigateToChat?.(inlineQuery.trim());
    setInlineQuery("");
  };


  // Quick hydration count helper
  const handleQuickWater = () => {
    const freshRecord: WellnessRecord = {
      id: `r-water-${Date.now()}`,
      timestamp: getRecordTimestamp(),
      type: "water",
      title: "補充溫開水 🥛",
      estimatedValue: 250,
      unit: "毫升",
      pointsEarned: 5,
      coachFeedback: "咕嚕咕嚕！太棒了，身體正在大聲對你說謝謝！補水是啟動新陳代謝、讓思緒敏銳最無痛的小習慣。為你加 5 點建構習慣分！繼續保持！"
    };
    onAddRecord(freshRecord);
  };

  const handleCustomWaterSubmit = () => {
    const mlValue = Number(customWaterMl);
    if (!mlValue || mlValue <= 0) return;
    const freshRecord: WellnessRecord = {
      id: `r-water-${Date.now()}`,
      timestamp: getRecordTimestamp(),
      type: "water",
      title: `手動補開水 ${mlValue} 毫升 🥛`,
      estimatedValue: mlValue,
      unit: "毫升",
      pointsEarned: 5,
      coachFeedback: `咕嚕補充水份 ${mlValue}ml！這樣誠實規律地滋潤身體，是絕妙的原子生活實踐。做的極好！`
    };
    onAddRecord(freshRecord);
    setCustomWaterMl("");
  };

  const handleWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wVal = Number(weightInput);
    if (!wVal || wVal <= 0) return;
    const fVal = bodyFatInput !== "" ? Number(bodyFatInput) : undefined;
    
    const freshRecord: WellnessRecord = {
      id: `r-weight-${Date.now()}`,
      timestamp: getWeightTimestamp(),
      type: "weight",
      title: `誠實體格記錄：體重 ${wVal} kg ${fVal ? `• 體脂率 ${fVal}%` : ""}`,
      estimatedValue: wVal,
      bodyFatPercent: fVal,
      unit: "公斤",
      notes: weightNotes.trim() || undefined,
      pointsEarned: 10,
      coachFeedback: `嗨夥伴！非常感謝你對自我體格數據的溫和凝視（體重 ${wVal} 公斤${fVal ? `，體脂率 ${fVal}%` : ""}）。記住，能量數字不代表你的個人成就與道德價值，敢於誠實覺察就是習慣的最佳印記！`
    };
    onAddRecord(freshRecord);
    setWeightInput("");
    setBodyFatInput("");
    setWeightNotes("");
  };

  // Helper mapping mood score to text and emoji
  const getMoodEmoji = (score: number) => {
    switch (score) {
      case 1: return { emoji: "😭/🥺", label: "有些疲憊/挫折" };
      case 2: return { emoji: "😐/🫠", label: "平淡放空中" };
      case 3: return { emoji: "🙂/🌤️", label: "溫和穩定" };
      case 4: return { emoji: "😄/☘️", label: "神清氣爽" };
      case 5: return { emoji: "🥳/🌟", label: "元氣滿滿！" };
      default: return { emoji: "🙂", label: "穩定" };
    }
  };

  // Render Calendar helper
  const getCalendarDays = () => {
    const year = calendarYear;
    const month = calendarMonth; // 0-indexed
    
    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Offset for starting day (0 = Sunday, 1 = Monday ...)
    const startOffset = firstDay.getDay();
    
    const days = [];
    // Empty placeholders for preceding month offsets
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const getTrendData = () => {
    const baseWeight = profile.weight || 65;
    const now = new Date();
    let raw = records.filter(r => r.type === 'weight');
    
    // Filter by trendDuration in days
    const cutoffTime = now.getTime() - trendDuration * 24 * 60 * 60 * 1000;
    raw = raw.filter(r => new Date(r.timestamp).getTime() >= cutoffTime);
    
    // Sort ascendingly by timestamp
    raw = raw.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (raw.length > 0) {
      return raw.map(r => ({
        date: new Date(r.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' }),
        weight: r.estimatedValue || baseWeight,
        fat: r.bodyFatPercent || 22,
        timestamp: new Date(r.timestamp).getTime()
      }));
    }
    return [];
  };

  // Mifflin-St Jeor Formula calculation
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
    };
  };

  const dashboardCalc = getBmrAndTdee(
    profile.weight || 65,
    profile.height || 170,
    profile.age || 28,
    profile.gender || "不公開",
    profile.activityLevel || "lightly_active"
  );

  const getWeeklyDeficitDays = () => {
    const deficitDaysList = [];
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(Date.now() - i * oneDayMs);
      const dateStr = targetDate.toDateString();
      
      let dayKcal = 0;
      let dayBurned = 0;
      let hasRecordOnDay = false;
      
      records.forEach((r) => {
        const rDate = new Date(r.timestamp);
        if (rDate.toDateString() === dateStr) {
          hasRecordOnDay = true;
          if (r.type === "diet") {
            dayKcal += r.estimatedValue || 0;
          }
          if (r.type === "exercise") {
            if (r.caloriesBurned) {
              dayBurned += r.caloriesBurned;
            } else if (r.estimatedValue) {
              dayBurned += Math.round(r.estimatedValue * 6.5);
            }
          }
        }
      });
      
      // Deficit = TDEE + ExerciseBurned - DietIntake
      const dayDeficit = (dashboardCalc.tdee + dayBurned) - dayKcal;
      
      if (hasRecordOnDay && dayDeficit > 0) {
        deficitDaysList.push(dateStr);
      }
    }
    
    return deficitDaysList.length;
  };
  
  const weeklyDeficitDays = getWeeklyDeficitDays();

  // Aggregated calculations for TODAY
  const getTodayStats = () => {
    const todayStr = new Date().toDateString();
    let kcal = 0;
    let water = 0;
    let exercise = 0;
    let sleep = 0;
    let protein = 0;
    let burnedKcal = 0;

    records.forEach((r) => {
      const recordDate = new Date(r.timestamp);
      if (recordDate.toDateString() === todayStr) {
        if (r.type === "diet") {
          kcal += r.estimatedValue || 0;
          if (r.proteinGrams) {
            protein += r.proteinGrams;
          }
        }
        if (r.type === "water") water += r.estimatedValue || 0;
        if (r.type === "exercise") {
          exercise += r.estimatedValue || 0;
          if (r.caloriesBurned) {
            burnedKcal += r.caloriesBurned;
          } else if (r.estimatedValue) {
            burnedKcal += Math.round(r.estimatedValue * 6.5);
          }
        }
        if (r.type === "sleep") sleep += r.estimatedValue || 0;
      }
    });

    return { kcal, water, exercise, sleep, protein, burnedKcal };
  };

  const todayStats = getTodayStats();
  const todayDeficit = (dashboardCalc.tdee + todayStats.burnedKcal) - todayStats.kcal;

  const getLatestWeight = () => {
    const weightRecords = records.filter((r) => r.type === "weight");
    if (weightRecords.length > 0) {
      const sorted = [...weightRecords].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return sorted[0].estimatedValue || profile.weight || 65;
    }
    return profile.weight || 65;
  };
  const latestWeight = getLatestWeight();

  // Handle standard logs onSubmit
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let freshRecord: WellnessRecord;

    if (activeTab === "diet") {
      const title = dietTitle.trim() || "誠實飲食小記錄";
      const kcal = Number(dietKcal) || 350;
      const proteinVal = dietProtein !== "" ? Number(dietProtein) : undefined;

      let customFeedback = `誠實記錄了『${title}』${proteinVal !== undefined ? `（含 ${proteinVal} 克蛋白質）` : ""}，是今日的健康存款！`;
      if (dietMealType === 'breakfast') {
        customFeedback = `🌅 活力早餐已登記！『${title}』${proteinVal !== undefined ? `（含 ${proteinVal} 克蛋白質）` : ""}。一份優質早餐能穩定你白天的胰島素，開啟一整天的自律複利，幹得好！`;
      } else if (dietMealType === 'lunch') {
        customFeedback = `☀️ 飽足午餐已登記！『${title}』${proteinVal !== undefined ? `（含 ${proteinVal} 克蛋白質）` : ""}。下午是精神最緊繃的時刻，攝取足夠營養能平穩能量波形，繼續前行！`;
      } else if (dietMealType === 'dinner') {
        customFeedback = `🌙 溫馨晚餐已登記！『${title}』${proteinVal !== undefined ? `（含 ${proteinVal} 克蛋白質）` : ""}。晚間飲食宜溫和適量，這能為你的胃腸與睡眠提供完美的修復環境唷！`;
      } else if (dietMealType === 'snack') {
        customFeedback = `🌌 宵夜小記。你誠實地記錄了『${title}』。沒關係的，偶爾的口腹放鬆也是情緒的特赦盾牌！建議可以搭配一杯熱水或深呼吸，安心休息，明天我們溫和重啟自律生活。`;
      } else if (dietMealType === 'other') {
        customFeedback = `🍎 點心/其他補給小記！『${title}』。主動覺察並誠實寫下每一次額外攝取，就是養成原子生活最核心的基石！`;
      }
      
      freshRecord = {
        id: `r-diet-${Date.now()}`,
        timestamp: getRecordTimestamp(),
        type: "diet",
        title,
        estimatedValue: kcal,
        unit: "大卡",
        pointsEarned: 20,
        mealType: dietMealType,
        proteinGrams: proteinVal,
        nutritionRough: {
          carbs: "充足 (碳水提供能量)",
          protein: proteinVal !== undefined ? `${proteinVal}克` : "適中 (肌肉修復活力)",
          fat: "適量",
          veg: "較少 (記得下一頓多吃幾口青菜唷)"
        },
        coachFeedback: customFeedback
      };

      setDietTitle("");
      setDietKcal("");
      setDietProtein("");
    } else if (activeTab === "exercise") {
      const title = exerciseTitle.trim() || "舒活舒展律動";
      const minutes = Number(exerciseMin) || 15;
      const burnedVal = exerciseBurnedKcal !== "" ? Number(exerciseBurnedKcal) : undefined;

      freshRecord = {
        id: `r-exe-${Date.now()}`,
        timestamp: getRecordTimestamp(),
        type: "exercise",
        title,
        estimatedValue: minutes,
        unit: "分鐘",
        pointsEarned: 20,
        caloriesBurned: burnedVal,
        coachFeedback: `動了 ${minutes} 分鐘（${title}）${burnedVal !== undefined ? `，消耗約 ${burnedVal} 大卡` : ""}，繼續保持！`
      };

      setExerciseTitle("");
      setExerciseMin("");
      setExerciseBurnedKcal("");
    } else if (activeTab === "sleep") {
      freshRecord = {
        id: `r-sleep-${Date.now()}`,
        timestamp: getRecordTimestamp(),
        type: "sleep",
        title: `沉浸舒眠 ${sleepHours} 小時 🛌`,
        estimatedValue: sleepHours,
        unit: "小時",
        pointsEarned: 15,
        coachFeedback: `你昨晚睡了 ${sleepHours} 小時，充足休息是活力的底層基石。`
      };
    } else {
      // Mood track
      const { label, emoji } = getMoodEmoji(moodScore);
      freshRecord = {
        id: `r-mood-${Date.now()}`,
        timestamp: getRecordTimestamp(),
        type: "mood",
        title: `心情印記：${emoji} ${label}`,
        pointsEarned: 15,
        moodScore,
        unit: "評級",
        notes: moodNotes.trim() || "今日心靈隨記",
        coachFeedback: `感謝你分享今日心情（${label}），覺察情緒本身就是最好的自我照顧。`
      };
      setMoodNotes("");
    }

    onAddRecord(freshRecord);
    setIsLoading(false);
    setShowLogModal(false);
  };

  // Quick preset logger
  const logQuickAction = (type: 'diet' | 'exercise', title: string, val: number, coachMessage: string) => {
    const freshRecord: WellnessRecord = {
      id: `r-quick-${Date.now()}`,
      timestamp: getRecordTimestamp(),
      type,
      title,
      estimatedValue: val,
      unit: type === "diet" ? "大卡" : "分鐘",
      pointsEarned: 15,
      coachFeedback: coachMessage
    };
    onAddRecord(freshRecord);
    setShowLogModal(false); // Sweet feedback closure
  };

  return (
    <div id="wellness-panel" className="flex flex-col gap-5 font-sans">
      
      {/* Dynamic Unified Wellness Console */}
      <div className="bg-white border border-brand-border rounded-[32px] p-5 md:p-6 shadow-3xs flex flex-col gap-6">
        
        {/* Unified Top header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-brand-border-light gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🍀</span>
            <div>
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-brand-text">
                今日健康記錄
              </h3>
              <p className="text-[10px] text-[#80796B] font-medium leading-none block mt-0.5">
                點擊各數據，快速新增你的當日生活記錄
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 text-[10px] font-bold font-sans text-brand-green hover:bg-brand-cream border border-brand-green/20 rounded-xl shadow-4xs cursor-pointer transition-all flex items-center gap-1.5"
            >
              📜 健康足跡 ({records.length})
            </button>
          </div>
        </div>

        {/* Dynamic Category Progress Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Calorie Card */}
          <button
            type="button"
            onClick={() => setActiveTab('diet')}
            className={`p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-98 ${
              activeTab === 'diet'
                ? "bg-brand-cream/80 border-brand-green shadow-4xs ring-1 ring-brand-green/20"
                : "bg-white border-brand-border hover:bg-brand-cream/15"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-sans font-bold text-brand-muted">🥗 飲食熱量</span>
              <Flame size={12} className={activeTab === 'diet' ? "text-brand-green" : "text-brand-ash"} />
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className="text-sm font-mono font-bold text-brand-text">{todayStats.kcal}</span>
                <span className="text-[9px] text-[#80796B]">/ {profile.dailyCalorieTarget || 1600} kcal</span>
              </div>
              <div className="w-full bg-brand-cream h-1 rounded-full overflow-hidden mt-2 border border-brand-border-light/40">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (todayStats.kcal / (profile.dailyCalorieTarget || 1600)) * 100)}%` }}
                />
              </div>
            </div>
          </button>
 
          {/* Protein Card */}
          <button
            type="button"
            onClick={() => setActiveTab('diet')}
            className={`p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-98 ${
              activeTab === 'diet'
                ? "bg-brand-cream/80 border-brand-green shadow-4xs ring-1 ring-brand-green/20"
                : "bg-white border-brand-border hover:bg-brand-cream/15"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-sans font-bold text-brand-muted">🥩 優質蛋白</span>
              <Award size={12} className={activeTab === 'diet' ? "text-brand-green" : "text-brand-ash"} />
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className="text-sm font-mono font-bold text-brand-text">{todayStats.protein} g</span>
                <span className="text-[9px] text-[#80796B]">/ {profile.weight ? Math.round(profile.weight * 1.2) : 65} g</span>
              </div>
              <div className="w-full bg-brand-cream h-1 rounded-full overflow-hidden mt-2 border border-brand-border-light/40">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (todayStats.protein / (profile.weight ? Math.round(profile.weight * 1.2) : 65)) * 100)}%` }}
                />
              </div>
            </div>
          </button>
 
          {/* Water Card */}
          <button
            type="button"
            onClick={() => setActiveTab('water')}
            className={`p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-98 ${
              activeTab === 'water'
                ? "bg-brand-cream/80 border-brand-green shadow-4xs ring-1 ring-brand-green/20"
                : "bg-white border-brand-border hover:bg-brand-cream/15"
            }`}
          >
            <div className="flex items-center justify-between w-full gap-1">
              <span className="text-[10px] font-sans font-bold text-brand-muted">💧 補充水分</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Droplet size={12} className={activeTab === 'water' ? "text-brand-green" : "text-brand-ash"} />
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickWater();
                  }}
                  className="w-4.5 h-4.5 rounded-full bg-brand-green hover:bg-brand-darkgreen text-white text-[10px] flex items-center justify-center font-bold shadow-4xs cursor-pointer active:scale-90"
                  title="快速補開水 250ml"
                >
                  +
                </span>
               </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className="text-sm font-mono font-bold text-brand-text">{todayStats.water}</span>
                <span className="text-[9px] text-[#80796B]">/ {Math.round((profile.weight || 65) * 35)} ml</span>
              </div>
              <div className="w-full bg-brand-cream h-1 rounded-full overflow-hidden mt-2 border border-brand-border-light/40">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (todayStats.water / Math.round((profile.weight || 65) * 35)) * 100)}%` }}
                />
              </div>
            </div>
          </button>

          {/* Exercise Card */}
          <button
            type="button"
            onClick={() => setActiveTab('exercise')}
            className={`p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-98 ${
              activeTab === 'exercise'
                ? "bg-brand-cream/80 border-brand-green shadow-4xs ring-1 ring-brand-green/20"
                : "bg-white border-brand-border hover:bg-brand-cream/15"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-sans font-bold text-brand-muted">🏃 累積身體活動</span>
              <Dumbbell size={12} className={activeTab === 'exercise' ? "text-brand-green" : "text-brand-ash"} />
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className="text-sm font-mono font-bold text-brand-text">{todayStats.exercise}</span>
                <span className="text-[9px] text-[#80796B]">/ {profile.dailyExerciseTarget || 30} min</span>
              </div>
              <div className="w-full bg-brand-cream h-1 rounded-full overflow-hidden mt-2 border border-brand-border-light/40">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (todayStats.exercise / (profile.dailyExerciseTarget || 30)) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[9px] font-bold text-[#059669] flex items-center gap-0.5">
                <span>🔥 今日消耗：</span>
                <span className="font-mono text-[10px]">{todayStats.burnedKcal}</span>
                <span>kcal</span>
              </div>
            </div>
          </button>

          {/* Sleep Card */}
          <button
            type="button"
            onClick={() => setActiveTab('sleep')}
            className={`p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-98 ${
              activeTab === 'sleep'
                ? "bg-brand-cream/80 border-brand-green shadow-4xs ring-1 ring-brand-green/20"
                : "bg-white border-brand-border hover:bg-brand-cream/15"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-sans font-bold text-brand-muted">🛌 昨晚睡眠</span>
              <Moon size={12} className={activeTab === 'sleep' ? "text-brand-green" : "text-brand-ash"} />
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className="text-sm font-mono font-bold text-brand-text">{todayStats.sleep}</span>
                <span className="text-[9px] text-[#80796B]">/ {profile.dailySleepTarget || 7} hr</span>
              </div>
              <div className="w-full bg-brand-cream h-1 rounded-full overflow-hidden mt-2 border border-brand-border-light/40">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (todayStats.sleep / (profile.dailySleepTarget || 7)) * 100)}%` }}
                />
              </div>
            </div>
          </button>

          {/* Health Footprint Card (6th Grid Item) */}
          <button
            type="button"
            onClick={() => {
              setHistoryTab('trends');
              setShowHistoryModal(true);
            }}
            className="p-3.5 border rounded-2xl flex flex-col justify-between text-left transition-all relative cursor-pointer active:scale-[0.98] bg-white border-brand-border hover:bg-brand-cream/30 hover:border-brand-green/30 shadow-4xs group"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-sans font-bold text-brand-muted">🔥 今日能量赤字</span>
              <Flame size={12} className="text-brand-ash group-hover:text-[#059669] transition-colors" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-0.5 line-clamp-1">
                <span className={`text-sm font-mono font-bold ${todayDeficit > 0 ? 'text-[#059669]' : 'text-brand-text'}`}>
                  {todayDeficit}
                </span>
                <span className="text-[9px] text-[#80796B]"> kcal</span>
              </div>
              <div className="text-[9px] text-brand-muted mt-2 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>本週自律：{weeklyDeficitDays} 天赤字</span>
              </div>
            </div>
          </button>
        </div>

        {/* Dynamic Inner Panel for Content Actions (Saves tremendous space) */}
        <div id="dynamic-log-panel" className="bg-brand-cream/25 border border-brand-sand rounded-2xl p-4.5 flex flex-col gap-4 shadow-4xs">
          
          {/* 紀錄日期選擇器 (統一控制此面板內的補登記) */}
          <div className="flex items-center justify-between border-b border-brand-sand/30 pb-2.5 mb-1 gap-2">
            <span className="text-[10px] font-sans font-bold text-brand-muted flex items-center gap-1.5">
              📅 紀錄日期 (可在此補登記歷程)：
            </span>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value || getLocalTodayString())}
              max={getLocalTodayString()}
              className="px-2 py-0.5 bg-white border border-brand-border rounded-lg font-sans text-[10.5px] text-[#5C564A] focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
            />
          </div>

          {/* A. DIET ACTIVE TAB */}
          {activeTab === 'diet' && (
            <div className="flex flex-col gap-4.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C564A]">🥗 記錄飲食</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                {/* Drag drop AI analyser image */}
                <div className="md:col-span-6 flex flex-col gap-2">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all min-h-[110px] ${
                      isDragging 
                        ? "border-brand-green bg-brand-cream" 
                        : "border-brand-sand hover:border-brand-green bg-white"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-auto"
                      title="選取飲食相片上傳"
                    />
                    
                    <div className="flex flex-col items-center gap-1 text-brand-muted">
                      <div className="p-1.5 bg-brand-cream rounded-lg border border-brand-border-light/50 shadow-4xs">
                        <ImageIcon size={14} className="text-brand-green" />
                      </div>
                      <span className="text-xs font-bold text-brand-text">相機拍拍美食 或 拖放相片至此</span>
                    </div>
                </div>
              </div>

                {/* Direct Manual Entry */}
                <form onSubmit={handleLogSubmit} className="md:col-span-6 flex flex-col justify-between gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">1. 食物/美食名稱：</span>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                      value={dietTitle}
                      onChange={(e) => setDietTitle(e.target.value)}
                      placeholder="例如：熱壓起司火腿三明治 🥪"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">2. 餐別：</span>
                      <select
                        className="w-full px-2 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                        value={dietMealType}
                        onChange={(e) => setDietMealType(e.target.value as any)}
                      >
                        <option value="breakfast">🌅 早餐</option>
                        <option value="lunch">☀️ 午餐</option>
                        <option value="dinner">🌙 晚餐</option>
                        <option value="snack">🌌 宵夜</option>
                        <option value="other">🍎 其他</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">3. 大卡(選填)：</span>
                      <input
                        type="number"
                        className="w-full px-2 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                        value={dietKcal}
                        onChange={(e) => setDietKcal(e.target.value ? Number(e.target.value) : "")}
                        placeholder="例：350"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">4. 蛋白g(選填)：</span>
                      <input
                        type="number"
                        className="w-full px-2 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                        value={dietProtein}
                        onChange={(e) => setDietProtein(e.target.value ? Number(e.target.value) : "")}
                        placeholder="例：22"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    ✓ 手動補登此餐美食
                  </button>
                </form>
              </div>

              {/* Inline PaoPao Coach consultation box */}
              <div className="border-t border-brand-border-light/50 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const query = inlineQuery.trim() || "珍珠奶茶熱量是多少？";
                      onNavigateToChat?.(query);
                      setInlineQuery("");
                    }}
                    className="text-[10.5px] font-extrabold text-brand-green flex items-center gap-1 hover:text-brand-darkgreen cursor-pointer active:scale-98 transition-all bg-transparent border-none p-0"
                    title="點擊直接進入 PaoPao 教練進行健康與飲食詢問"
                  >
                    💬 詢問 PaoPao 飲食與健康疑問 ➔
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                    placeholder="例如：地瓜熱量高嗎？或 運動後怎麼補充蛋白質？"
                    value={inlineQuery}
                    onChange={(e) => setInlineQuery(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') { 
                        e.preventDefault(); 
                        handleInlineConsult(); 
                      } 
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleInlineConsult}
                    disabled={!inlineQuery.trim()}
                    className="px-3.5 py-1.5 bg-brand-green hover:bg-brand-darkgreen disabled:bg-brand-ash/20 disabled:text-brand-ash/50 text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1 flex-shrink-0"
                  >
                    諮詢
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* B. WATER ACTIVE TAB */}
          {activeTab === 'water' && (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C564A]">💧 補充水分記錄</span>
                <span className="text-[9px] text-[#80796B]">目標需求：{~~((profile.weight || 65) * 35)} ml</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                <div className="md:col-span-4 bg-white p-3 border border-brand-border rounded-xl flex items-center gap-3.5 shadow-4xs">
                  <span className="text-2xl filter drop-shadow-sm">🥛</span>
                  <div>
                    <span className="text-[10px] font-bold text-brand-muted block font-sans">今日補水累積</span>
                    <p className="text-sm font-sans font-extrabold text-brand-text">
                      累積進水量 <span className="font-mono text-base text-brand-green font-black">{todayStats.water}</span> ml
                    </p>
                  </div>
                </div>

                <div className="md:col-span-8 flex flex-col gap-3 w-full">
                  <div className="flex flex-col gap-1.5 w-full">
                    <span className="text-[9.5px] font-bold text-brand-muted font-sans block">點選隨手補登一杯水：</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={handleQuickWater}
                        className="py-1.5 bg-white hover:bg-brand-cream text-[#5C564A] font-sans font-extrabold text-[10px] rounded-lg border border-brand-border transition-all active:scale-95 cursor-pointer shadow-4xs"
                      >
                        🥛 +250ml
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const freshRecord: WellnessRecord = {
                            id: `r-water-${Date.now()}`,
                            timestamp: getRecordTimestamp(),
                            type: "water",
                            title: "飯前喝開水 350ml 💧",
                            estimatedValue: 350,
                            unit: "毫升",
                            pointsEarned: 15,
                            coachFeedback: "餐前 350ml 飽腹感水分，有效杜絕大腦偽食物訊號，同時啟動胃部蠕動與代謝加速！繼續保持！"
                          };
                          onAddRecord(freshRecord);
                        }}
                        className="py-1.5 bg-white hover:bg-brand-cream text-[#5C564A] font-sans font-extrabold text-[10px] rounded-lg border border-brand-border transition-all active:scale-95 cursor-pointer shadow-4xs"
                      >
                        💧 飯前 +350ml
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const freshRecord: WellnessRecord = {
                            id: `r-water-${Date.now()}`,
                            timestamp: getRecordTimestamp(),
                            type: "water",
                            title: "灌入一大公升保温杯 500ml 💧",
                            estimatedValue: 500,
                            unit: "毫升",
                            pointsEarned: 10,
                            coachFeedback: "豪爽飲水 500ml！此時體內微循環暢通，體溫調控溫和，表現極其優異。"
                          };
                          onAddRecord(freshRecord);
                        }}
                        className="py-1.5 bg-white hover:bg-brand-cream text-[#5C564A] font-sans font-extrabold text-[10px] rounded-lg border border-brand-border transition-all active:scale-95 cursor-pointer shadow-4xs"
                      >
                        保溫杯 +500ml
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">或自訂手動輸入補水量 (毫升)：</span>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="flex-1 px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                        value={customWaterMl}
                        onChange={(e) => setCustomWaterMl(e.target.value ? Number(e.target.value) : "")}
                        placeholder="請輸入毫升數，如 300"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCustomWaterSubmit();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCustomWaterSubmit}
                        disabled={!customWaterMl || Number(customWaterMl) <= 0}
                        className="px-4 py-1.5 bg-brand-green hover:bg-brand-darkgreen disabled:bg-brand-ash/20 disabled:text-brand-ash/50 text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer flex-shrink-0"
                      >
                        補登水分
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. EXERCISE ACTIVE TAB */}
          {activeTab === 'exercise' && (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C564A]">🏃 身體活動記錄</span>
                <span className="text-[9px] text-[#80796B]">今天已累計了：{todayStats.exercise} 分鐘</span>
              </div>

              <form onSubmit={handleLogSubmit} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">動作/項目：</span>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                      value={exerciseTitle}
                      onChange={(e) => setExerciseTitle(e.target.value)}
                      placeholder="運動拉筋拉伸拉背"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">時間(分鐘)：</span>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                      value={exerciseMin}
                      onChange={(e) => setExerciseMin(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：15"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-[#80796B] uppercase font-sans">燃燒熱量(選填)：</span>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                      value={exerciseBurnedKcal}
                      onChange={(e) => setExerciseBurnedKcal(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例：150 kcal"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  ✓ 手動打卡身體動一動
                </button>
              </form>

              {/* Inline PaoPao Coach consultation box */}
              <div className="border-t border-brand-border-light/50 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const query = inlineQuery.trim() || "慢跑30分鐘會消耗多少熱量？";
                      onNavigateToChat?.(query);
                      setInlineQuery("");
                    }}
                    className="text-[10.5px] font-extrabold text-brand-green flex items-center gap-1 hover:text-brand-darkgreen cursor-pointer active:scale-98 transition-all bg-transparent border-none p-0"
                    title="點擊直接進入 PaoPao 運動能耗與卡路里計算"
                  >
                    💬 詢問 PaoPao 運動能耗與卡路里計算 ➔
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30 shadow-4xs"
                    placeholder="例如：慢跑30分鐘會消耗多少熱量？或 散步一萬步能消耗多少卡路里？"
                    value={inlineQuery}
                    onChange={(e) => setInlineQuery(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') { 
                        e.preventDefault(); 
                        handleInlineConsult(); 
                      } 
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleInlineConsult}
                    disabled={!inlineQuery.trim()}
                    className="px-3.5 py-1.5 bg-brand-green hover:bg-brand-darkgreen disabled:bg-brand-ash/20 disabled:text-brand-ash/50 text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1 flex-shrink-0"
                  >
                    諮詢
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* D. SLEEP ACTIVE TAB */}
          {activeTab === 'sleep' && (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C564A]">🛌 睡眠記錄</span>
                <span className="text-[9px] text-[#80796B]">推薦標準：{profile.dailySleepTarget || 7} 小時</span>
              </div>

              <div className="bg-white p-3.5 border border-brand-border rounded-xl flex flex-col gap-2 shadow-4xs">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="font-bold text-brand-text">昨晚沉沉睡了大約：</span>
                  <span className="text-brand-green font-extrabold text-xs">{sleepHours} 小時</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="0.5"
                  className="w-full accent-brand-green cursor-pointer mt-1"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                />
                <div className="flex justify-between text-[8px] text-[#A39B8D] font-sans px-1">
                  <span>稍微短促 (4小時)</span>
                  <span>黃金修復 (8小時)</span>
                  <span>長久深眠 (12小時)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const freshRecord: WellnessRecord = {
                      id: `r-sleep-${Date.now()}`,
                      timestamp: getRecordTimestamp(),
                      type: "sleep",
                      title: `沉浸舒眠 ${sleepHours} 小時 🛌`,
                      estimatedValue: sleepHours,
                      unit: "小時",
                      pointsEarned: 15,
                      coachFeedback: `太棒了，你昨晚睡了 ${sleepHours} 小時！充足的放鬆是讓心智在白天快速複利的基石。為你敲定這項認證！`
                    };
                    onAddRecord(freshRecord);
                  }}
                  className="mt-1 w-full py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  ✓ 認證睡眠，記錄好眠
                </button>
              </div>
            </div>
          )}

          {/* E. MOOD ACTIVE TAB */}
          {activeTab === 'mood' && (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C564A]">🌸 心靈覺察印記控制台</span>
                <span className="text-[9px] text-[#80796B]">停下來關注情緒感受是很尊貴的習慣喔</span>
              </div>

              <div className="bg-white p-3.5 border border-brand-border rounded-xl flex flex-col gap-3 shadow-4xs">
                {/* 5 smiley buttons */}
                <div className="flex justify-between items-center gap-1.5 p-1 bg-brand-cream/60 border border-brand-border-light rounded-xl">
                  {([1, 2, 3, 4, 5] as const).map((sc) => {
                    const item = getMoodEmoji(sc);
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setMoodScore(sc)}
                        className={`flex-1 py-1 text-center rounded-lg cursor-pointer transition-all active:scale-95 flex flex-col items-center justify-center ${
                          moodScore === sc
                            ? "bg-white border border-brand-green text-brand-green shadow-4xs scale-102"
                            : "border border-transparent hover:bg-white/40 text-[#5C564A]"
                        }`}
                      >
                        <span className="text-sm font-sans">{item.emoji.split('/')[0]}</span>
                        <span className="text-[8px] font-bold line-clamp-1 scale-90 mt-0.5">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 bg-brand-cream/35 border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
                    value={moodNotes}
                    onChange={(e) => setMoodNotes(e.target.value)}
                    placeholder="打兩行此時的心思與感謝，跟自己溫和說說話..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const { label, emoji } = getMoodEmoji(moodScore);
                      const freshRecord: WellnessRecord = {
                        id: `r-mood-${Date.now()}`,
                        timestamp: getRecordTimestamp(),
                        type: "mood",
                        title: `心情印記：${emoji} ${label}`,
                        pointsEarned: 15,
                        moodScore,
                        unit: "評級",
                        notes: moodNotes.trim() || "今日心靈隨記",
                        coachFeedback: `親愛的夥伴，生活中的喜怒哀樂全都是生命的真誠波形。你願意正視當下的感受，並為自己留下一個深呼吸的空間，這在心靈原子成長中代表著極高水準的修練。生活牆已完美為你蓋印。`
                      };
                      onAddRecord(freshRecord);
                      setMoodNotes("");
                    }}
                    className="py-1.5 px-4 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer flex-shrink-0"
                  >
                    ✓ 寫下情緒
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 2.4 Stationary High-EQ Micro Habits Inspiration Board */}
      <div className="p-4 bg-brand-cream border border-brand-sand rounded-[24px] shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans animate-fade-in">
        <div className="flex items-start sm:items-center gap-3">
          <span className="text-2xl p-1 bg-white border border-[#EAE3D2] rounded-xl shadow-4xs flex-shrink-0 animate-bounce duration-1000">
            {PAOPAO_ADVICES[tipIndex].icon}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-sans font-black tracking-widest uppercase text-brand-green bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full select-none">
                PaoPao 習慣加油站
              </span>
              <span className="text-[9px] font-sans font-extrabold text-[#7A7261] bg-[#FAF7F2] border border-[#EAE3D2] px-1.5 py-0.5 rounded-md select-none">
                ✦ {PAOPAO_ADVICES[tipIndex].tag}
              </span>
            </div>
            <p className="text-xs font-bold font-sans text-[#4A453A] leading-relaxed mt-1.5 pr-2.5">
              {PAOPAO_ADVICES[tipIndex].text}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTipIndex((prev) => (prev + 1) % PAOPAO_ADVICES.length)}
          className="px-3 py-1.5 bg-white border border-[#EAE3D2] hover:bg-[#FDFCF7] text-brand-olive font-extrabold text-[10px] sm:text-xs rounded-xl shadow-4xs hover:shadow-3xs transition-all active:scale-[0.96] cursor-pointer self-stretch sm:self-auto text-center shrink-0"
        >
          💡 換一則方針
        </button>
      </div>

      {/* 2.5 Collapsible Badge Showcase Area right after Diet Log Box */}
      {!isBadgesExpanded ? (
        <div 
          onClick={() => setIsBadgesExpanded(true)}
          className="p-4 bg-white border border-brand-border rounded-[24px] shadow-3xs cursor-pointer hover:bg-brand-cream/35 transition-all flex items-center justify-between group animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">🏅</span>
            <div>
              <h3 className="font-sans text-xs font-bold text-brand-text flex items-center gap-1.5">
                PaoPao 原子勳章牆
                <span className="text-[9px] text-[#A39B8D] font-normal font-sans hover:underline">(點擊展開)</span>
              </h3>
              <p className="text-[10px] text-brand-ash font-sans mt-0.5">
                誠實面對自我，解鎖健康生活習慣的專屬印記牆 ☘️
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-sans font-extrabold text-brand-green px-2.5 py-1 bg-brand-cream border border-brand-sand rounded-xl shadow-3xs">
              已解鎖 {unlockedBadgesCount} / {totalBadgesCount}
            </span>
            <ChevronDown size={14} className="text-brand-ash group-hover:text-brand-text group-hover:translate-y-0.5 transition-all" />
          </div>
        </div>
      ) : (
        <div className="p-6 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-4 animate-fade-in">
          <div 
            onClick={() => setIsBadgesExpanded(false)}
            className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-brand-border-light gap-2 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🏅</span>
              <div>
                <h3 className="font-sans text-xs font-extrabold uppercase tracking-widest text-[#5C564A] flex items-center gap-1.5">
                  PaoPao 原子勳章牆
                  <span className="text-[9px] text-[#A39B8D] font-normal font-sans hover:underline">(點擊收起)</span>
                </h3>
                <p className="text-[10px] text-brand-ash font-sans mt-0.5">
                  日常原子紀錄就是鋼印！永久收集專屬的健康誠實徽章。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <div className="flex items-center gap-2 px-3 py-1 bg-brand-cream border border-brand-border rounded-full shadow-3xs">
                <span className="text-xs">🏆</span>
                <span className="text-[10px] font-sans font-bold text-brand-green">
                  已解鎖 {unlockedBadgesCount} / {totalBadgesCount} 個
                </span>
              </div>
              <ChevronUp size={14} className="text-brand-ash group-hover:text-brand-text group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {/* Badge Bento-like Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {badges.map((badge) => {
              return (
                <div
                  key={badge.id}
                  className={`p-3.5 border rounded-2xl flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                    badge.isUnlocked
                      ? `${badge.color} border-brand-green/30 shadow-2xs hover:shadow-xs scale-100 hover:-translate-y-0.5`
                      : "bg-gray-100/50 border-gray-200/60 opacity-85 text-gray-500 hover:opacity-100"
                  }`}
                >
                  {/* Visual Accent for Unlocked badge */}
                  {badge.isUnlocked && (
                    <div className="absolute top-0 right-0 w-8 h-8 bg-brand-green/10 rounded-bl-full flex items-center justify-center pointer-events-none">
                      <Check size={8} className="text-brand-green font-bold translate-x-1 -translate-y-1" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {badge.icon}
                      </span>
                      <span className="text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 bg-white/80 rounded-md border border-black/5 text-gray-600">
                        {badge.progressText}
                      </span>
                    </div>

                    <h4 className={`text-xs font-bold font-sans mt-3 tracking-tight ${badge.isUnlocked ? "text-brand-text" : "text-gray-500"}`}>
                      {badge.name}
                    </h4>
                    <p className="text-[9.5px] leading-relaxed font-sans text-brand-muted mt-1.5 opacity-85">
                      {badge.isUnlocked ? badge.unlockedDescription : badge.description}
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-black/5 pt-2">
                    <span className={`text-[8px] font-sans font-bold uppercase tracking-wider ${badge.isUnlocked ? "text-brand-green" : "text-gray-400"}`}>
                      {badge.isUnlocked ? "✦ 已解鎖 ✦" : "未達成"}
                    </span>
                    {!badge.isUnlocked && (
                      <span className="text-[8.5px] text-gray-400 font-sans italic">待養成</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ========================================= */}
      {/* DIALOG MODEL 1: HIGH FIDELITY MANUAL LOGGING FORM */}
      {/* ========================================= */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Inside title */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-border-light">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="font-sans text-sm font-bold text-brand-text">習慣記錄 & 快速無痛加分</h3>
              </div>
              <button
                onClick={() => {
                  setShowLogModal(false);
                }}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segment Tab buttons inside the pop-up */}
            <div className="flex bg-brand-cream border border-brand-border p-1 rounded-xl">
              {(["diet", "exercise", "sleep", "mood"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-center text-[10px] tracking-wide font-sans font-bold rounded-lg cursor-pointer transition-all ${
                    activeTab === tab
                      ? "bg-brand-green text-white shadow-2xs"
                      : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  {tab === "diet" && "飲食 🥗"}
                  {tab === "exercise" && "運動 🏃"}
                  {tab === "sleep" && "舒眠 😴"}
                  {tab === "mood" && "心靈 🌸"}
                </button>
              ))}
            </div>

            {/* Dialog Form */}
            <form onSubmit={handleLogSubmit} className="flex flex-col gap-4">
              {/* 紀錄日期選擇器 */}
              <div className="flex items-center justify-between bg-brand-cream/65 border border-brand-border p-3 rounded-2xl gap-2">
                <span className="text-[10px] font-sans font-bold text-brand-muted flex items-center gap-1.5">
                  📅 紀錄日期 (可在此補登記歷程)：
                </span>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value || getLocalTodayString())}
                  max={getLocalTodayString()}
                  className="px-2 py-1 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
                />
              </div>
              {activeTab === "diet" && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">餐別</label>
                    <select
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white cursor-pointer"
                      value={dietMealType}
                      onChange={(e) => setDietMealType(e.target.value as any)}
                    >
                      <option value="breakfast">🌅 早餐</option>
                      <option value="lunch">☀️ 午餐</option>
                      <option value="dinner">🌙 晚餐</option>
                      <option value="snack">🌌 宵夜</option>
                      <option value="other">🍎 其他</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 font-sans">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">食物或飲品名稱</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={dietTitle}
                      onChange={(e) => setDietTitle(e.target.value)}
                      placeholder="例如：熱壓起司火腿三明治"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">估計熱量 (大卡)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={dietKcal}
                      onChange={(e) => setDietKcal(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：350 (不知道可不填)"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">蛋白質 (克，選填)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={dietProtein}
                      onChange={(e) => setDietProtein(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：25 (選填監測)"
                    />
                  </div>
                </div>
              )}

              {activeTab === "exercise" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">活動項目</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={exerciseTitle}
                      onChange={(e) => setExerciseTitle(e.target.value)}
                      placeholder="例如：跟跑 10 分鐘"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">持續時間 (分鐘)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={exerciseMin}
                      onChange={(e) => setExerciseMin(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：15"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">消耗熱量 (大卡，選填)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={exerciseBurnedKcal}
                      onChange={(e) => setExerciseBurnedKcal(e.target.value ? Number(e.target.value) : "")}
                      placeholder="例如：120 (選填)"
                    />
                  </div>
                </div>
              )}

              {activeTab === "sleep" && (
                <div className="flex flex-col gap-2 p-4 bg-brand-cream border border-brand-border-light rounded-2xl">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted flex justify-between">
                    <span>昨天睡眠長度</span>
                    <span className="text-brand-green font-bold text-xs">{sleepHours} 小時</span>
                  </span>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="0.5"
                    className="w-full accent-brand-green cursor-pointer mt-1"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-[#A39B8D] font-sans px-1">
                    <span>有些少 (4h)</span>
                    <span>完美充沛 (8h)</span>
                    <span>深度慵懶 (12h)</span>
                  </div>
                </div>
              )}

              {activeTab === "mood" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted flex justify-between">
                      <span>你此時的心情如何？</span>
                      <span className="text-brand-green font-bold text-xs">{getMoodEmoji(moodScore).emoji} {getMoodEmoji(moodScore).label}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      className="w-full accent-brand-green cursor-pointer mt-1"
                      value={moodScore}
                      onChange={(e) => setMoodScore(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-wider text-brand-muted">碎碎念倾訴 (可不填)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-brand-cream border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-2 focus:ring-brand-green/30 focus:bg-white"
                      value={moodNotes}
                      onChange={(e) => setMoodNotes(e.target.value)}
                      placeholder="例如：開完會心情有點喘不過氣，好在慢慢調適過來囉"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-brand-green hover:bg-brand-darkgreen text-white font-sans text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Plus size={14} />
                {isLoading ? "教練溫柔書寫中..." : "誠實記錄，解鎖徽章 ☘️"}
              </button>
            </form>

            {/* Atomic Quick actions block inside the popup for clean layout */}
            <div className="border-t border-brand-border-light pt-4 mt-1">
              <h4 className="font-sans text-[9px] tracking-widest uppercase font-bold text-brand-ash mb-3 flex items-center gap-1">
                <Check size={11} className="text-brand-green" />
                習慣補給一鍵完成 (推薦：無摩擦原子行動)
              </h4>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'diet', 
                    '多加一份蔬菜 🥦', 
                    30, 
                    '完美！你在餐食中主動多加了一份綠色蔬菜。微量膳食纖維正在大聲地為你喝采。加 15 點！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  多吃了蔬菜 🥦
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'exercise', 
                    '溫柔肩頸拉筋 1 分鐘 🧘', 
                    1, 
                    '這不是偷懶，是你對自己身體最誠實的感謝和放鬆體貼。身體在開心地舒展！已為您在健康生活牆蓋上誠實認證！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  肩頸舒緩拉筋 🧘
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'exercise', 
                    '快走動一動 10 分鐘 🏃', 
                    10, 
                    '完美！多巴胺正在腦海裡起跳呢。這就是微習慣的極致力量！已將本筆習慣登載在生活牆囉。'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  快走 10 分鐘 🏃
                </button>
                <button
                  type="button"
                  onClick={() => logQuickAction(
                    'diet', 
                    '選擇無糖飲料 / 溫開水 🍵', 
                    0, 
                    '完美！血管正在大口深呼吸。這是最溫柔、最無痛的主動權，完美！生活牆上的解鎖足跡又進一步了！'
                  )}
                  className="px-3 py-2 bg-brand-cream hover:bg-brand-beige text-brand-muted border border-brand-border rounded-xl text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  改選無糖茶 🍵
                </button>
              </div>
            </div>

          </div>
        </div>
      )}


      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-[#2d2d2d]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[85vh] p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Title */}
            <div className="flex items-center justify-between pb-1 flex-shrink-0">
               <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h3 className="font-sans text-sm font-bold text-brand-text">健康足跡與生活回顧</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 hover:bg-brand-cream border border-transparent hover:border-brand-border rounded-xl transition-all cursor-pointer text-brand-ash hover:text-brand-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Hub Tabs Selector */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-brand-cream border border-brand-border-light rounded-2xl flex-shrink-0">
              <button
                type="button"
                onClick={() => setHistoryTab('timeline')}
                className={`py-2 text-[10.5px] font-sans font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                  historyTab === 'timeline'
                    ? "bg-brand-green text-white shadow-3xs"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-sand/10"
                }`}
              >
                👣 足跡足印
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('calendar')}
                className={`py-2 text-[10.5px] font-sans font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                  historyTab === 'calendar'
                    ? "bg-brand-green text-white shadow-3xs"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-sand/10"
                }`}
              >
                📅 歷程日曆
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('trends')}
                className={`py-2 text-[10.5px] font-sans font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                  historyTab === 'trends'
                    ? "bg-brand-green text-white shadow-3xs"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-sand/10"
                }`}
              >
                ⚖️ 體重體脂
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('medals')}
                className={`py-2 text-[10.5px] font-sans font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                  historyTab === 'medals'
                    ? "bg-brand-green text-white shadow-3xs"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-sand/10"
                }`}
              >
                🏆 勳章行為
              </button>
            </div>

            {/* TAB CONTENTS CONTAINER */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 py-1">
              
              {/* TAB 1: TIMELINE */}
              {historyTab === 'timeline' && (
                <div className="flex flex-col gap-3">
                  {/* Category Filter Buttons Bar */}
                  <div className="flex flex-wrap gap-1 p-1 bg-white border border-brand-border-light rounded-xl shadow-4xs sticky top-0 z-10">
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('all')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'all'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🌐 全部 ({records.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('diet')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'diet'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🥗 飲食 ({records.filter(r => r.type === 'diet').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('exercise')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'exercise'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🏃 運動 ({records.filter(r => r.type === 'exercise').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('sleep')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'sleep'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🛌 睡眠 ({records.filter(r => r.type === 'sleep').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('water')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'water'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🥛 水分 ({records.filter(r => r.type === 'water').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('mood')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'mood'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      🌸 心情 ({records.filter(r => r.type === 'mood').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter('weight')}
                      className={`px-2 py-1 text-[9.5px] font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        timelineFilter === 'weight'
                          ? "bg-brand-green text-white shadow-4xs"
                          : "text-brand-muted hover:text-brand-text hover:bg-brand-cream"
                      }`}
                    >
                      ⚖️ 體重 ({records.filter(r => r.type === 'weight').length})
                    </button>
                  </div>

                  {(() => {
                    const filteredRecords = timelineFilter === 'all'
                      ? records
                      : records.filter(r => r.type === timelineFilter);

                    if (filteredRecords.length === 0) {
                      return (
                        <div className="text-center py-12 text-brand-ash font-sans text-xs leading-relaxed">
                          此分類目前尚未有記錄。不急著追求成就，隨時可以到控制台溫和補登一筆喔。🛀
                        </div>
                      );
                    }

                    return [...filteredRecords].reverse().map((rec) => {
                      const isEditing = editingRecordId === rec.id;

                      if (isEditing) {
                        return (
                          <div key={rec.id} className="p-3.5 bg-white border-2 border-brand-green/30 rounded-2xl flex flex-col gap-3 animate-fade-in shadow-3xs">
                            <div className="flex justify-between items-center pb-2 border-b border-brand-border-light">
                              <span className="text-xs font-bold text-brand-green flex items-center gap-1 font-sans">
                                ✏️ 編輯健康數據
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editTitle.trim()) return;
                                    const updated: WellnessRecord = {
                                      ...rec,
                                      title: editTitle.trim(),
                                      estimatedValue: editValue !== "" ? Number(editValue) : undefined,
                                      proteinGrams: editProtein !== "" ? Number(editProtein) : undefined,
                                      caloriesBurned: editBurnedKcal !== "" ? Number(editBurnedKcal) : undefined,
                                      bodyFatPercent: editBodyFat !== "" ? Number(editBodyFat) : undefined,
                                      mealType: editMealType || undefined
                                    };
                                    onUpdateRecord?.(updated);
                                    setEditingRecordId(null);
                                  }}
                                  className="px-2.5 py-1 bg-brand-green text-white hover:bg-brand-darkgreen rounded-lg text-[9.5px] font-bold cursor-pointer transition-all active:scale-95 border border-transparent"
                                >
                                  保存
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRecordId(null)}
                                  className="px-2.5 py-1 bg-white border border-brand-border text-brand-muted hover:text-brand-text rounded-lg text-[9.5px] font-bold cursor-pointer transition-all"
                                >
                                  取消
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                <span className="text-[9px] text-[#80796B] font-bold">項目名稱：</span>
                                <input
                                  type="text"
                                  className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                />
                              </div>

                              {rec.estimatedValue !== undefined && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-[#80796B] font-bold">累積數值 ({rec.unit})：</span>
                                  <input
                                    type="number"
                                    className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value !== "" ? Number(e.target.value) : "")}
                                  />
                                </div>
                              )}

                              {rec.type === 'diet' && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-[#80796B] font-bold">餐別：</span>
                                  <select
                                    className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                    value={editMealType}
                                    onChange={(e) => setEditMealType(e.target.value as any)}
                                  >
                                    <option value="breakfast">🌅 早餐</option>
                                    <option value="lunch">☀️ 午餐</option>
                                    <option value="dinner">🌙 晚餐</option>
                                    <option value="snack">🌌 宵夜</option>
                                    <option value="other">🍎 其他</option>
                                  </select>
                                </div>
                              )}

                              {rec.type === 'diet' && rec.proteinGrams !== undefined && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-[#80796B] font-bold">蛋白質克數 (克)：</span>
                                  <input
                                    type="number"
                                    className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                    value={editProtein}
                                    onChange={(e) => setEditProtein(e.target.value !== "" ? Number(e.target.value) : "")}
                                  />
                                </div>
                              )}

                              {rec.type === 'exercise' && rec.caloriesBurned !== undefined && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-[#80796B] font-bold">消耗熱量 (大卡)：</span>
                                  <input
                                    type="number"
                                    className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                    value={editBurnedKcal}
                                    onChange={(e) => setEditBurnedKcal(e.target.value !== "" ? Number(e.target.value) : "")}
                                  />
                                </div>
                              )}

                              {rec.type === 'weight' && rec.bodyFatPercent !== undefined && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-[#80796B] font-bold">體脂率 (%)：</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="px-2.5 py-1.5 bg-brand-cream/40 border border-brand-border rounded-lg text-xs font-sans text-brand-text w-full focus:outline-hidden focus:border-brand-green/50"
                                    value={editBodyFat}
                                    onChange={(e) => setEditBodyFat(e.target.value !== "" ? Number(e.target.value) : "")}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={rec.id} className="p-3 bg-brand-cream border border-brand-border-light rounded-2xl flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-white shadow-4xs border border-brand-border-light text-sm">
                                {rec.type === 'diet' && "🥗"}
                                {rec.type === 'exercise' && "🏃"}
                                {rec.type === 'sleep' && "🛌"}
                                {rec.type === 'mood' && "🌸"}
                                {rec.type === 'water' && "🥛"}
                                {rec.type === 'weight' && "⚖️"}
                              </span>
                              <div>
                                <h4 className="font-sans text-xs font-bold text-brand-text leading-tight">{rec.title}</h4>
                                <span className="text-[9px] text-[#A39B8D] font-mono leading-none block mt-0.5">
                                  {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {deletingRecordId === rec.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold text-[#E07A5F] px-1.5 py-0.5 bg-red-50 border border-red-100 rounded-md select-none animate-pulse">
                                    確定刪除？
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteRecord?.(rec.id);
                                      setDeletingRecordId(null);
                                    }}
                                    className="p-1 px-1.5 bg-[#E07A5F] text-white rounded-md hover:bg-red-600 transition-all cursor-pointer font-sans text-[8.5px] font-extrabold"
                                  >
                                    是
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingRecordId(null)}
                                    className="p-1 px-1.5 bg-white border border-brand-border text-brand-muted hover:text-brand-text rounded-md transition-all cursor-pointer font-sans text-[8px]"
                                  >
                                    否
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[8.5px] font-sans font-bold text-brand-green px-2 py-0.5 bg-white border border-brand-green/10 rounded-md shadow-4xs select-none">
                                    ✓ 已記錄
                                  </span>
                                  {onUpdateRecord && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRecordId(rec.id);
                                        setEditTitle(rec.title);
                                        setEditValue(rec.estimatedValue !== undefined ? rec.estimatedValue : "");
                                        setEditProtein(rec.proteinGrams !== undefined ? rec.proteinGrams : "");
                                        setEditBurnedKcal(rec.caloriesBurned !== undefined ? rec.caloriesBurned : "");
                                        setEditBodyFat(rec.bodyFatPercent !== undefined ? rec.bodyFatPercent : "");
                                        setEditMealType(rec.mealType || "");
                                      }}
                                      className="px-2 py-0.5 text-[10px] text-brand-text hover:text-white hover:bg-brand-green/95 border border-brand-border hover:border-brand-green rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                      title="編輯這筆紀錄"
                                    >
                                      <Pencil size={9.5} />
                                      <span>編輯</span>
                                    </button>
                                  )}
                                  {onDeleteRecord && (
                                    <button
                                      type="button"
                                      onClick={() => setDeletingRecordId(rec.id)}
                                      className="px-2 py-0.5 text-[10px] text-red-600 hover:text-white hover:bg-red-500 border border-brand-border-light hover:border-red-500 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                      title="刪除這筆紀錄"
                                    >
                                      <Trash2 size={9.5} />
                                      <span>刪除</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {rec.estimatedValue !== undefined && (
                            <div className="flex flex-wrap gap-1 text-[8.5px]">
                              {rec.type === 'diet' && rec.mealType && (
                                <span className="px-1.5 py-0.5 bg-yellow-50 border border-yellow-200/50 rounded font-sans text-yellow-800 font-bold">
                                  {rec.mealType === 'breakfast' && '🌅 早餐'}
                                  {rec.mealType === 'lunch' && '☀️ 午餐'}
                                  {rec.mealType === 'dinner' && '🌙 晚餐'}
                                  {rec.mealType === 'snack' && '🌌 宵夜'}
                                  {rec.mealType === 'other' && '🍎 點心/其他'}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 bg-white border border-brand-border rounded font-sans text-brand-muted">
                                數值：{rec.estimatedValue} {rec.unit}
                              </span>
                              {rec.bodyFatPercent !== undefined && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded font-sans text-indigo-700 font-bold">
                                  體脂：{rec.bodyFatPercent} %
                                </span>
                              )}
                              {rec.proteinGrams !== undefined && rec.proteinGrams > 0 && (
                                <span className="px-1.5 py-0.5 bg-brand-green/10 border border-brand-green/20 rounded font-sans text-brand-green font-bold">
                                  蛋白質：{rec.proteinGrams} 克
                                </span>
                              )}
                              {rec.caloriesBurned !== undefined && rec.caloriesBurned > 0 && (
                                <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 rounded font-sans text-orange-700 font-bold">
                                  消耗熱量：{rec.caloriesBurned} 大卡
                                </span>
                              )}
                            </div>
                          )}

                          {/* AI Coach line */}
                          <div className="px-3 py-2 bg-white border border-brand-border rounded-xl">
                            <p className="text-[10px] text-brand-muted font-sans leading-relaxed">
                              🙋‍♂️ <span className="font-bold text-brand-green">PaoPao 教練：</span>
                              {rec.coachFeedback}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* TAB 2: CALENDAR REVIEW */}
              {historyTab === 'calendar' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[11px] text-[#5C564A] font-extrabold bg-brand-cream border border-brand-border px-3 py-1.5 rounded-xl shadow-4xs">
                    <span className="font-sans flex items-center gap-1">📅 歷程網格日曆</span>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear(prev => prev - 1);
                          } else {
                            setCalendarMonth(prev => prev - 1);
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-lg border border-brand-border hover:border-brand-green/30 text-[9px] text-brand-green active:scale-95 transition-all font-bold cursor-pointer"
                      >
                        ◀
                      </button>
                      <span className="font-sans text-[10px] text-brand-text min-w-[75px] text-center bg-white border border-brand-border px-2 py-0.5 rounded-md">
                        {calendarYear} 年 {calendarMonth + 1} 月
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear(prev => prev + 1);
                          } else {
                            setCalendarMonth(prev => prev + 1);
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-lg border border-brand-border hover:border-brand-green/30 text-[9px] text-brand-green active:scale-95 transition-all font-bold cursor-pointer"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Container */}
                  <div className="bg-brand-cream/40 border border-brand-border rounded-2xl p-3">
                    <div className="grid grid-cols-7 gap-1 text-center font-sans font-extrabold text-[10px] text-brand-muted mb-2 border-b border-brand-border-light pb-1">
                      <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center font-sans">
                      {getCalendarDays().map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} />;
                        
                        // Check records on this day
                        const dayRecords = records.filter(r => 
                          new Date(r.timestamp).toDateString() === day.toDateString()
                        );
                        const isSelected = new Date(selectedCalendarDate).toDateString() === day.toDateString();

                        return (
                          <button
                            key={`day-${idx}`}
                            type="button"
                            onClick={() => setSelectedCalendarDate(day.toDateString())}
                            className={`aspect-square p-1 rounded-xl border flex flex-col justify-between items-center relative transition-all cursor-pointer ${
                              isSelected
                                ? "bg-brand-green text-white border-brand-green shadow-xs scale-102"
                                : "bg-white border-brand-border hover:bg-brand-cream/80"
                            }`}
                          >
                            <span className="text-[10px] font-extrabold">{day.getDate()}</span>
                            
                            {/* Simple Mini Indicators inside cell */}
                            <div className="flex gap-0.5 justify-center mt-auto flex-wrap gap-y-px h-1.5">
                              {dayRecords.some(r => r.type === 'diet') && <span className="w-1 h-1 rounded-full bg-brand-green block" />}
                              {dayRecords.some(r => r.type === 'exercise') && <span className="w-1 h-1 rounded-full bg-orange-400 block" />}
                              {dayRecords.some(r => r.type === 'water') && <span className="w-1 h-1 rounded-full bg-sky-400 block" />}
                              {dayRecords.some(r => r.type === 'sleep') && <span className="w-1 h-1 rounded-full bg-purple-400 block" />}
                              {dayRecords.some(r => r.type === 'mood') && <span className="w-1 h-1 rounded-full bg-brand-light block text-transparent" />}
                              {dayRecords.some(r => r.type === 'weight') && <span className="w-1 h-1 rounded-full bg-indigo-500 block" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filtered logs for selected day */}
                  <div className="mt-1 border-t border-brand-border-light pt-2.5">
                    <span className="text-[10px] font-extrabold text-brand-text block mb-2 px-1">
                      🍀 {new Date(selectedCalendarDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })} 的誠實記錄：
                    </span>

                    {records.filter(r => new Date(r.timestamp).toDateString() === new Date(selectedCalendarDate).toDateString()).length === 0 ? (
                      <div className="text-center py-6 bg-brand-cream border border-dashed border-brand-border rounded-xl text-brand-ash text-[10px] font-medium leading-relaxed">
                        這一天無憂無慮，沒有任何記錄負擔。無論是享受放鬆還是無壓躺平，都是珍貴的生命日常。🛀
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {records.filter(r => new Date(r.timestamp).toDateString() === new Date(selectedCalendarDate).toDateString()).map((rec) => (
                          <div key={rec.id} className="p-3 bg-white border border-brand-border rounded-2xl flex flex-col gap-2 shadow-4xs">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-extrabold flex items-center gap-1.5 text-brand-text">
                                <span>
                                  {rec.type === 'diet' && "🥗"}
                                  {rec.type === 'exercise' && "🏃"}
                                  {rec.type === 'sleep' && "🛌"}
                                  {rec.type === 'mood' && "🌸"}
                                  {rec.type === 'water' && "🥛"}
                                  {rec.type === 'weight' && "⚖️"}
                                </span>
                                {rec.title}
                              </span>
                              <span className="text-[8.5px] text-[#A39B8D] font-mono">
                                {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[9.5px] text-brand-muted leading-relaxed font-sans bg-brand-cream/40 p-2 rounded-xl border border-brand-border-light">
                              💁‍♂️ <span className="font-bold text-brand-green">PaoPao：</span>
                              {rec.coachFeedback}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: WEIGHT & FAT TRENDS */}
              {historyTab === 'trends' && (
                <div className="flex flex-col gap-3">
                  
                  {/* 今日自律能量赤字與減重曲線預報 */}
                  {(() => {
                    const activeDeficit = todayDeficit > 0 ? todayDeficit : 500;
                    const deltaW1 = (activeDeficit * 7) / 7700;
                    const deltaW4 = (activeDeficit * 28) / 7700;
                    const deltaW12 = (activeDeficit * 84) / 7700;

                    return (
                      <div className="border border-brand-border rounded-2xl p-4 bg-white shadow-4xs flex flex-col gap-3.5">
                        <div className="flex items-center gap-2 border-b border-brand-border-light pb-2">
                          <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E2D9] rounded-lg">
                            <TrendingDown size={14} className="text-[#059669]" />
                          </div>
                          <div>
                            <span className="text-[11px] font-extrabold text-brand-text block">🎯 自律減重軌跡與曲線預報</span>
                            <span className="text-[8.5px] text-brand-muted block mt-0.5">基於 7700 kcal = 1kg 脂肪物理常數精準模擬</span>
                          </div>
                        </div>

                        {/* Today's Energy Balance Grid */}
                        <div className="grid grid-cols-4 gap-2 text-center bg-brand-cream/60 p-2.5 rounded-xl border border-brand-border-light/60">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-bold text-brand-muted flex items-center justify-center gap-0.5">🔥 TDEE</span>
                            <span className="text-xs font-mono font-bold text-brand-text">
                              {dashboardCalc.tdee}{" "}
                              <span className="text-[7.5px] font-sans font-normal text-brand-muted">kcal</span>
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 border-l border-brand-sand/30">
                            <span className="text-[8.5px] font-bold text-[#059669] flex items-center justify-center gap-0.5">🏃 運動消耗</span>
                            <span className="text-xs font-mono font-bold text-[#059669]">
                              +{todayStats.burnedKcal}{" "}
                              <span className="text-[7.5px] font-sans font-normal text-brand-muted">kcal</span>
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 border-l border-brand-sand/30">
                            <span className="text-[8.5px] font-bold text-[#B91C1C] flex items-center justify-center gap-0.5">🥗 飲食攝取</span>
                            <span className="text-xs font-mono font-bold text-[#B91C1C]">
                              -{todayStats.kcal}{" "}
                              <span className="text-[7.5px] font-sans font-normal text-brand-muted">kcal</span>
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 border-l border-brand-sand/30">
                            <span className="text-[8.5px] font-bold text-brand-text flex items-center justify-center gap-0.5">💡 淨赤字</span>
                            <span
                              className={`text-xs font-mono font-bold ${
                                todayDeficit > 0 ? "text-[#059669]" : "text-brand-muted"
                              }`}
                            >
                              {todayDeficit > 0 ? `+${todayDeficit}` : todayDeficit}{" "}
                              <span className="text-[7.5px] font-sans font-normal text-brand-muted">kcal</span>
                            </span>
                          </div>
                        </div>

                        {/* Forecast Weight Trajectory Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white border border-brand-border/60 rounded-xl p-2 flex flex-col gap-1 text-center shadow-5xs hover:border-[#10B981]/30 transition-all">
                            <span className="text-[8px] font-extrabold text-brand-muted">📆 1 週後自律</span>
                            <span className="text-[9px] font-bold text-[#059669] font-mono">-{deltaW1.toFixed(2)} kg</span>
                            <span className="text-[10px] font-mono font-bold text-brand-text">
                              {(latestWeight - deltaW1).toFixed(2)} kg
                            </span>
                          </div>
                          <div className="bg-white border border-brand-border/60 rounded-xl p-2 flex flex-col gap-1 text-center shadow-5xs hover:border-[#10B981]/30 transition-all">
                            <span className="text-[8px] font-extrabold text-brand-muted">📆 4 週後自律</span>
                            <span className="text-[9px] font-bold text-[#059669] font-mono">-{deltaW4.toFixed(2)} kg</span>
                            <span className="text-[10px] font-mono font-bold text-brand-text">
                              {(latestWeight - deltaW4).toFixed(2)} kg
                            </span>
                          </div>
                          <div className="bg-white border border-brand-border/60 rounded-xl p-2 flex flex-col gap-1 text-center shadow-5xs hover:border-[#10B981]/30 transition-all">
                            <span className="text-[8px] font-extrabold text-brand-muted">📆 12 週後自律</span>
                            <span className="text-[9px] font-bold text-[#059669] font-mono">-{deltaW12.toFixed(2)} kg</span>
                            <span className="text-[10px] font-mono font-bold text-brand-text">
                              {(latestWeight - deltaW12).toFixed(2)} kg
                            </span>
                          </div>
                        </div>

                        {/* Adaptive Context Warning/Insight */}
                        <div className="bg-[#FAF9F6] border border-[#E5E2D9] rounded-xl p-2.5 text-[9px] leading-relaxed text-[#5C564A]">
                          {todayDeficit > 0 ? (
                            <span className="flex items-start gap-1">
                              <span className="text-xs">✨</span>
                              <span>
                                <strong>幹得好！</strong>按今日自律步調（赤字{" "}
                                <span className="font-mono font-bold text-[#059669]">{todayDeficit} kcal</span>
                                /天）持續下去，12週後您將穩健減輕{" "}
                                <span className="font-mono font-bold text-[#059669]">{deltaW12.toFixed(1)} kg</span>{" "}
                                脂肪複利！
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-start gap-1">
                              <span className="text-xs">💡</span>
                              <span>
                                目前今日尚未形成熱量赤字（或暫為負值）。
                                <strong>上圖已為您採用健康目標（赤字 500 kcal/天）進行自律模擬預估。</strong>
                                加把勁！動起來或少吃一口，啟動燃脂引擎吧！
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Enter weight manually */}
                  <form onSubmit={handleWeightSubmit} className="bg-brand-cream border border-brand-border p-3.5 rounded-2xl flex flex-col gap-2 shadow-4xs">
                    <span className="text-[10px] font-extrabold text-[#5C564A] block">⚖️ 補充登錄今日體格數據</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-brand-muted uppercase font-sans">體重 (公斤)：</span>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value ? Number(e.target.value) : "")}
                          placeholder="例如：65.4"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-brand-muted uppercase font-sans">體脂率 (%) (選填)：</span>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
                          value={bodyFatInput}
                          onChange={(e) => setBodyFatInput(e.target.value ? Number(e.target.value) : "")}
                          placeholder="例如：21.5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-brand-muted uppercase font-sans">量測日期：</span>
                        <input
                          type="date"
                          className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-green/30"
                          value={weightLogDate}
                          onChange={(e) => setWeightLogDate(e.target.value || getLocalTodayString())}
                          max={getLocalTodayString()}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[9px] font-bold text-brand-muted uppercase font-sans">隨筆備註 (選填)：</span>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 bg-white border border-brand-border rounded-xl font-sans text-xs text-brand-text focus:outline-hidden"
                        value={weightNotes}
                        onChange={(e) => setWeightNotes(e.target.value)}
                        placeholder="例如：早上起床空腹測量"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!weightInput}
                      className="w-full py-1.5 bg-brand-green hover:bg-brand-darkgreen disabled:bg-brand-ash/20 disabled:text-brand-ash/50 text-white font-sans text-[10.5px] font-bold rounded-xl shadow-4xs transition-all active:scale-[0.98] cursor-pointer mt-1"
                    >
                      ✓ 誠實登錄此筆體格數據
                    </button>
                  </form>

                  {/* Dynamic SVG Trend Line Graphical Chart */}
                  <div className="border border-brand-border rounded-2xl p-4 bg-white shadow-4xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-brand-border-light pb-2">
                      <div>
                        <span className="text-[10.5px] font-bold text-brand-text block">📈 體重與體脂率歷程趨勢圖</span>
                        <span className="text-[8.5px] text-[#A39B8D] mt-0.5 block font-sans">
                          🟢 實線：體重 (kg) &nbsp;&nbsp;|&nbsp;&nbsp; 🔵 虛線：體脂率 (%)
                        </span>
                      </div>
                      
                      {/* Interval selector buttons layout */}
                      <div className="flex items-center gap-1 bg-brand-cream p-0.5 rounded-lg border border-brand-border-light self-start sm:self-auto">
                        {([
                          { label: "30天", days: 30 },
                          { label: "60天", days: 60 },
                          { label: "90天", days: 90 },
                          { label: "半年", days: 180 },
                          { label: "一年", days: 365 },
                        ] as const).map(opt => (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => setTrendDuration(opt.days)}
                            className={`px-2 py-0.5 text-[8.5px] font-sans font-extrabold rounded-md transition-all cursor-pointer ${
                              trendDuration === opt.days
                                ? "bg-brand-green text-white shadow-4xs"
                                : "text-brand-muted hover:text-brand-text hover:bg-brand-sand/15"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SVG Render */}
                    {(() => {
                      const trendData = getTrendData();
                      if (trendData.length === 0) {
                        return (
                          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-brand-cream/40 rounded-xl border border-dashed border-brand-border-light">
                            <span className="text-xl mb-1.5 filter drop-shadow-xs">⚖️</span>
                            <span className="text-[10px] font-bold text-brand-muted font-sans gap-1 flex items-center">
                              目前尚無此期間的體重與體脂紀錄
                            </span>
                            <span className="text-[9px] text-[#A39B8D] mt-1 font-sans">
                              可在下方「手動記錄體重與體脂」表單輸入當前數值，即可在此開始生成趨勢圖表唷！
                            </span>
                          </div>
                        );
                      }

                      const weights = trendData.map(d => d.weight);
                      const fats = trendData.map(d => d.fat);
                      
                      const minWeight = Math.min(...weights) - 1 > 0 ? Math.min(...weights) - 1 : 40;
                      const maxWeight = Math.max(...weights) + 1;
                      const minFat = Math.min(...fats) - 1 > 0 ? Math.min(...fats) - 1 : 5;
                      const maxFat = Math.max(...fats) + 1;
                      
                      const weightRange = maxWeight - minWeight || 1;
                      const fatRange = maxFat - minFat || 1;
                      
                      const graphWidth = 480;
                      const graphHeight = 110;
                      
                      const plottedPoints = trendData.map((d, idx) => {
                        const x = 40 + idx * ((graphWidth - 60) / (trendData.length - 1 || 1));
                        const yWeight = graphHeight - 15 - ((d.weight - minWeight) / weightRange) * (graphHeight - 30);
                        const yFat = graphHeight - 15 - ((d.fat - minFat) / fatRange) * (graphHeight - 30);
                        return { ...d, x, yWeight, yFat };
                      });

                      const weightPathD = plottedPoints.map((p, i) => 
                        i === 0 ? `M ${p.x} ${p.yWeight}` : `L ${p.x} ${p.yWeight}`
                      ).join(' ');

                      const fatPathD = plottedPoints.map((p, i) => 
                        i === 0 ? `M ${p.x} ${p.yFat}` : `L ${p.x} ${p.yFat}`
                      ).join(' ');

                      return (
                        <div className="relative pt-1">
                          <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-full overflow-visible font-mono">
                            {/* Horizontal grid guide lines */}
                            <line x1="30" y1="15" x2={graphWidth - 10} y2="15" stroke="#f4f1ea" strokeWidth="1" />
                            <line x1="30" y1="50" x2={graphWidth - 10} y2="50" stroke="#f4f1ea" strokeWidth="1" />
                            <line x1="30" y1="80" x2={graphWidth - 10} y2="80" stroke="#f4f1ea" strokeWidth="1" />
                            <line x1="30" y1={graphHeight - 15} x2={graphWidth - 10} y2={graphHeight - 15} stroke="#dcd6cb" strokeWidth="1" />

                            {/* left Y axis text (weight) */}
                            <text x="5" y="20" fill="#10b981" className="text-[7.5px] font-bold">{maxWeight.toFixed(1)}kg</text>
                            <text x="5" y="85" fill="#10b981" className="text-[7.5px] font-bold">{minWeight.toFixed(1)}kg</text>

                            {/* right Y axis text (fat) */}
                            <text x={graphWidth - 5} y="20" textAnchor="end" fill="#6366f1" className="text-[7.5px] font-bold">{maxFat.toFixed(1)}%</text>
                            <text x={graphWidth - 5} y="85" textAnchor="end" fill="#6366f1" className="text-[7.5px] font-bold">{minFat.toFixed(1)}%</text>

                            {/* Weight Polyline */}
                            {weightPathD && (
                              <path
                                d={weightPathD}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* Fat Polyline */}
                            {fatPathD && (
                              <path
                                d={fatPathD}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="2"
                                strokeDasharray="3,3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* Dots & labels */}
                            {plottedPoints.map((pt, index) => (
                              <g key={`pt-${index}`} className="group/dot cursor-pointer">
                                {/* Weight Dot */}
                                <circle
                                  cx={pt.x}
                                  cy={pt.yWeight}
                                  r="4"
                                  className="fill-white stroke-brand-green stroke-[2.5px] hover:r-5 transition-all"
                                />
                                <text
                                  x={pt.x}
                                  y={pt.yWeight - 8}
                                  textAnchor="middle"
                                  className="text-[7.5px] font-bold fill-brand-green bg-white filter drop-shadow-px"
                                >
                                  {pt.weight.toFixed(1)}
                                </text>

                                {/* Fat Dot */}
                                <circle
                                  cx={pt.x}
                                  cy={pt.yFat}
                                  r="3"
                                  className="fill-white stroke-indigo-500 stroke-[2px] hover:r-4 transition-all"
                                />
                                <text
                                  x={pt.x}
                                  y={pt.yFat + 11}
                                  textAnchor="middle"
                                  className="text-[7px] font-extrabold fill-indigo-600 bg-white filter drop-shadow-px"
                                >
                                  {pt.fat.toFixed(1)}%
                                </text>

                                {/* Date Label */}
                                <text
                                  x={pt.x}
                                  y={graphHeight - 2}
                                  textAnchor="middle"
                                  className="text-[7px] fill-brand-ash"
                                >
                                  {pt.date}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 4: BADGES REVIEW */}
              {historyTab === 'medals' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold text-[#5C564A]">🏆 收集的健康原子勳章</span>
                    <span className="text-[9px] font-bold text-brand-green">
                      已累積獲得 {unlockedBadgesCount} 個勳章
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {badges.map((badge) => {
                      return (
                        <div
                          key={`badge-hub-${badge.id}`}
                          className={`p-3.5 border rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                            badge.isUnlocked
                              ? `${badge.color} border-brand-green/30 shadow-4xs scale-100 hover:-translate-y-0.5`
                              : "bg-gray-100/50 border-gray-200/60 opacity-85 text-gray-500"
                          }`}
                        >
                          {badge.isUnlocked && (
                            <div className="absolute top-0 right-0 w-6 h-6 bg-brand-green/10 rounded-bl-full flex items-center justify-center pointer-events-none">
                              <Check size={8} className="text-brand-green font-bold translate-x-0.5 -translate-y-0.5" />
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-2xl filter drop-shadow-sm">
                                {badge.icon}
                              </span>
                              <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.5 bg-white/80 rounded border border-black/5 text-gray-600">
                                {badge.progressText}
                              </span>
                            </div>

                            <h4 className={`text-xs font-bold font-sans mt-2 tracking-tight ${badge.isUnlocked ? "text-brand-text" : "text-gray-500"}`}>
                              {badge.name}
                            </h4>
                            <p className="text-[9.5px] leading-relaxed font-sans text-brand-muted mt-1 opacity-85">
                              {badge.isUnlocked ? badge.unlockedDescription : badge.description}
                            </p>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-black/5 pt-1.5 text-[8px] font-sans font-bold uppercase tracking-wider">
                            <span className={badge.isUnlocked ? "text-brand-green" : "text-gray-400"}>
                              {badge.isUnlocked ? "✦ 已解鎖 ✦" : "未達成"}
                            </span>
                            {!badge.isUnlocked && (
                              <span className="text-gray-400 font-sans italic">待解鎖</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Compact footer inside popup */}
            <div className="pt-2 border-t border-brand-border-light text-center text-[9px] text-brand-ash flex-shrink-0">
              不批評、不自責、拒絕熱量羞恥。溫和踏實，在習慣複利中看見原子巨變。
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
