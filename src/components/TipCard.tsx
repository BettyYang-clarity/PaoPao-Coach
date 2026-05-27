/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw } from "lucide-react";

interface Tip {
  id: number;
  category: string;
  theme: { bg: string; text: string; border: string; icon: string };
  title: string;
  content: string;
}

const TIPS: Tip[] = [
  {
    id: 1,
    category: "原子習慣",
    theme: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", icon: "🌱" },
    title: "兩分鐘法則",
    content: "當你想建立一個新習慣時，這個習慣在開始時應該花不到兩分鐘。不要強求「運動 30 分鐘」，只要「穿上運動鞋走出門」或「在客廳散步 1 分鐘」，你就已經打破了摩擦阻力，順利啟動健康身分識別！"
  },
  {
    id: 2,
    category: "正向鼓勵",
    theme: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", icon: "✨" },
    title: "拒絕完美主義",
    content: "健康的生活是由無數個 60 分與偶爾的 100 分拼湊而成的。即使今天吃了一頓高碳水大餐，只要你按下「誠實記錄」，這件事在習慣心理學上的價值就是 100 分！隨喜讚揚自己的誠實與覺察。"
  },
  {
    id: 3,
    category: "飲食指導",
    theme: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", icon: "🥗" },
    title: "哈佛健康餐盤",
    content: "不需要刻意節食！試著把餐盤的「一半」填滿蔬菜和水果，「四分之一」是優質蛋白質（如蛋、豆腐、海鮮與瘦肉），其餘四分之一是糙米等全穀類。這是不需要特定處方，每個人都能輕鬆愛護身體的完美平衡原則。"
  },
  {
    id: 4,
    category: "身體活動",
    theme: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", icon: "🏃" },
    title: "微型運動能耗",
    content: "國健署推薦成人每週累積 150 分鐘以上中度活動（微汗、能說話不能唱歌）。但如果時間不夠，原步踏步 15 秒、抬腿 10 下或拉伸肩膀也是極佳累積。越是微小到不可能失敗的事情，越容易變成你生活的一部分！"
  },
  {
    id: 5,
    category: "補水觀念",
    theme: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-100", icon: "🥛" },
    title: "無痛補水灌溉",
    content: "人體大約 70% 是水分。在辦公桌或顯眼處放一杯水，每次解鎖手機、起立去洗手間或跟教練說完話時，就順口喝「一小口」溫水。不需要每次都猛灌一大杯，少量的頻繁補充，能讓全身６兆細胞喝得最安心！"
  },
  {
    id: 6,
    category: "睡眠調節",
    theme: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", icon: "🛌" },
    title: "睡前原子儀式",
    content: "睡眠是體內自控力與代謝修復的起點。試著在睡前 10 分鐘放下手機、關小電燈，做 3 次深深的「鼻子吸氣 4 秒、嘴巴慢吐 6 秒」呼吸，能立刻重啟大腦的副交感神經，幫助肌肉放鬆，預備一夜好眠。"
  },
  {
    id: 7,
    category: "正向鼓勵",
    theme: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", icon: "🎈" },
    title: "今天也是大贏家",
    content: "原子習慣的複利威力巨大，每天只要在健康層面進步 1%，一年後你將累積強大 37 倍的複利能量！放輕鬆，今天哪怕是多喝半杯水、走 3 步，你就在這段健康陪跑路上持續前進著，教練與你同在！"
  }
];

export default function TipCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  // Auto rotate every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleNextTip();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleNextTip = () => {
    setIsRotating(true);
    setCurrentIndex((prev) => (prev + 1) % TIPS.length);
    setTimeout(() => setIsRotating(false), 600);
  };

  const currentTip = TIPS[currentIndex];

  return (
    <div
      id="science-card"
      className="p-5 bg-white border border-brand-border rounded-[32px] shadow-3xs flex flex-col gap-3.5 relative overflow-hidden group min-h-[145px]"
    >
      {/* Background decoration */}
      <div className="absolute -right-5 -bottom-5 w-24 h-24 bg-brand-cream/20 rounded-full blur-xl pointer-events-none transition-all duration-500 group-hover:scale-125" />

      {/* Top action header: Badge on left, RefreshCw to switch on right */}
      <div className="flex items-center justify-between gap-2 border-b border-brand-border-light pb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm flex-shrink-0">{currentTip.theme.icon}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[9.5px] font-sans font-bold px-2 py-0.5 rounded-full border ${currentTip.theme.bg} ${currentTip.theme.text} ${currentTip.theme.border}`}
            >
              {currentTip.category}
            </span>
            <span className="text-[12px] font-bold text-brand-text truncate">
              {currentTip.title}
            </span>
          </div>
        </div>

        {/* Change Card button */}
        <button
          type="button"
          onClick={handleNextTip}
          className="text-brand-ash hover:text-brand-green p-1.5 rounded-full hover:bg-brand-cream border border-transparent hover:border-brand-border-light transition-all active:scale-90 flex items-center gap-1 cursor-pointer"
          title="換一則健康陪跑小秘訣"
        >
          <span className="text-[8.5px] font-bold text-[#A39B8D] uppercase tracking-wider hidden sm:inline select-none">
            換一則
          </span>
          <motion.div
            animate={{ rotate: isRotating ? 360 : 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
          >
            <RefreshCw size={11} />
          </motion.div>
        </button>
      </div>

      {/* Body content with smooth slide/fade animations */}
      <div className="flex-1 min-w-0 pr-1 flex items-start gap-2.5">
        <span className="text-lg text-emerald-500 flex-shrink-0 mt-0.5">💡</span>
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTip.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[11.5px] text-[#70695C] font-sans leading-relaxed text-justify"
            >
              {currentTip.content}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
