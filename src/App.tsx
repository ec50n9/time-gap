/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, UIEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Step = 0 | 15 | 30 | 60;
type Option = 'shorter' | 'longer';
type DayMode = 'auto' | 0 | 1 | 2;
type Preset = { id: string; label: string; hour: number; minute: number };

const STORAGE_KEY = 'time-calc-v1';

const DEFAULT_PRESETS: Preset[] = [
  { id: 'work-start', label: '上班', hour: 9, minute: 0 },
  { id: 'lunch', label: '午休', hour: 12, minute: 0 },
  { id: 'work-end', label: '下班', hour: 18, minute: 0 },
  { id: 'sleep', label: '睡觉', hour: 23, minute: 0 },
];

const pad = (num: number) => num.toString().padStart(2, '0');

const hoursList = Array.from({ length: 24 }, (_, i) => i);
const minutesList = Array.from({ length: 60 }, (_, i) => i);

const ScrollPicker = ({ options, value, onChange, pad: shouldPad }: { options: number[], value: number, onChange: (v: number) => void, pad?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const programmedScrollRef = useRef(false);

  useEffect(() => {
    if (containerRef.current) {
      const index = options.indexOf(value);
      if (index !== -1) {
        const target = index * 44;
        if (Math.abs(containerRef.current.scrollTop - target) > 1) {
          programmedScrollRef.current = true;
          containerRef.current.scrollTop = target;
        }
      }
    }
  }, [value]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (programmedScrollRef.current) {
      programmedScrollRef.current = false;
      return;
    }
    const el = e.currentTarget;
    const index = Math.round(el.scrollTop / 44);
    if (options[index] !== undefined && options[index] !== value) {
      onChange(options[index]);
    }
  };

  return (
    <div
      className="h-[240px] w-20 overflow-y-auto snap-y snap-mandatory py-[98px] hide-scrollbar"
      ref={containerRef}
      onScroll={handleScroll}
      style={{ scrollBehavior: 'auto' }}
    >
      {options.map((opt) => (
        <div
          key={opt}
          className={`h-[44px] flex items-center justify-center snap-center text-[24px] cursor-pointer transition-colors ${value === opt ? 'text-[#111] font-bold' : 'text-[#bbb] font-medium'
            }`}
          onClick={() => {
            if (containerRef.current) {
              programmedScrollRef.current = true;
              containerRef.current.scrollTo({ top: options.indexOf(opt) * 44, behavior: 'smooth' });
            }
            onChange(opt);
          }}
        >
          {shouldPad ? pad(opt) : opt}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [targetTime, setTargetTime] = useState<{ hour: number; minute: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetHour !== undefined) {
          return { hour: parsed.targetHour, minute: parsed.targetMinute };
        }
      }
    } catch (e) { }
    return { hour: 8, minute: 30 };
  });

  const [step, setStep] = useState<Step>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step !== undefined) return parsed.step as Step;
      }
    } catch (e) { }
    return 0;
  });

  const [dayMode, setDayMode] = useState<DayMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dayMode !== undefined) return parsed.dayMode as DayMode;
      }
    } catch (e) { }
    return 'auto';
  });

  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.presets)) return parsed.presets;
      }
    } catch (e) { }
    return DEFAULT_PRESETS;
  });

  const [targetPresetId, setTargetPresetId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetPresetId !== undefined) return parsed.targetPresetId;
      }
    } catch (e) { }
    return null;
  });

  const [selectedOption, setSelectedOption] = useState<Option>('shorter');
  const [now, setNow] = useState(new Date());
  const [toastVisible, setToastVisible] = useState(false);
  const [isStepMenuOpen, setIsStepMenuOpen] = useState(false);
  const [isDayMenuOpen, setIsDayMenuOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [tempTime, setTempTime] = useState<{ hour: number; minute: number }>({ hour: 0, minute: 0 });
  const [tempPresetId, setTempPresetId] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const presetLongPressTimer = useRef<number | null>(null);
  const presetLongPressFired = useRef(false);

  const targetLabel = presets.find(p => p.id === targetPresetId)?.label ?? null;
  const isNewPreset = editingPreset !== null && !presets.some(p => p.id === editingPreset.id);

  // Save to locale storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      targetHour: targetTime.hour,
      targetMinute: targetTime.minute,
      step,
      dayMode,
      presets,
      targetPresetId,
    }));
  }, [targetTime, step, dayMode, presets, targetPresetId]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute target Date
  const target = new Date(now);
  target.setHours(targetTime.hour, targetTime.minute, 0, 0);

  let isAutoTomorrow = false;
  let autoResultText = '';

  // Calculate auto result
  const autoTarget = new Date(target);
  if (autoTarget.getTime() <= now.getTime()) {
    autoTarget.setDate(autoTarget.getDate() + 1);
    isAutoTomorrow = true;
  }
  autoResultText = isAutoTomorrow ? '明天' : '今天';

  if (dayMode === 'auto') {
    if (isAutoTomorrow) {
      target.setDate(target.getDate() + 1);
    }
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() + (dayMode as number));
    target.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const targetDateText = dayMode === 'auto'
    ? autoResultText
    : dayMode === 0 ? '今天' : dayMode === 1 ? '明天' : '后天';

  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  // Step logic
  const isExact = step === 0 || diffMinutes % step === 0;
  const shorterMins = step > 0 ? Math.floor(diffMinutes / step) * step : diffMinutes;
  const longerMins = step > 0 ? Math.ceil(diffMinutes / step) * step : diffMinutes;

  const activeMins = selectedOption === 'shorter' ? shorterMins : longerMins;
  const inactiveMins = selectedOption === 'shorter' ? longerMins : shorterMins;

  // Formatters
  const formatHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad(h)}:${pad(m)}`;
  };

  const formatHMS = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const getEndDateTimeStr = (durationMins: number) => {
    const end = new Date(now.getTime() + durationMins * 60000);
    const isTomorrowEnd = end.getDate() !== now.getDate() || end.getMonth() !== now.getMonth();
    return `${isTomorrowEnd ? '明天' : '今天'} ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  };

  const displayStr = step === 0 ? formatHMS(diffMs) : formatHM(activeMins);

  const showToast = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const handlePointerDown = () => {
    longPressTimer.current = window.setTimeout(() => {
      navigator.clipboard.writeText(displayStr).catch(() => { });
      if (navigator.vibrate) navigator.vibrate(50);
      showToast();
    }, 1000);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div className="fixed inset-0 bg-[#fafafa] flex flex-col font-sans touch-manipulation overflow-hidden">

      {/* Top Right: Current Time */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8 flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/5 z-10 text-[14px] md:text-[15px] font-medium text-[#555]">
        <div className="relative flex items-center justify-center w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-[#222]"></span>
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#111]"></span>
        </div>
        此刻 {pad(now.getHours())}:{pad(now.getMinutes())}
      </div>

      {/* Main Content Flow */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-[10%] max-w-5xl mx-auto w-full pb-[10vh]">

        {/* Line 1: 现在距离 */}
        <div className="text-[20px] md:text-[32px] text-[#999] font-medium tracking-wide mb-1 md:mb-3 ml-2 md:ml-4">
          现在距离
        </div>

        {/* Line 2: 目标时间 (Picker) */}
        <div className="flex items-center -ml-2 select-none">
          <div className="relative">
            <div
              className="relative cursor-pointer group px-2 sm:px-4 py-2 rounded-2xl hover:bg-black/5 active:bg-black/10 transition-colors active:scale-[0.98] duration-200"
              onClick={() => setIsDayMenuOpen(true)}
            >
              <div className="flex items-baseline gap-1 md:gap-2 pointer-events-none">
                <span className="text-[24px] sm:text-[28px] md:text-[42px] font-medium text-[#777] tracking-wider relative -top-1 md:-top-2 whitespace-nowrap">
                  {targetDateText}
                </span>
                {dayMode === 'auto' && (
                  <span className="text-[12px] md:text-[14px] text-[#aaa] font-medium relative -top-3 md:-top-5 tracking-widest bg-black/5 rounded px-1.5 py-0.5">
                    自动
                  </span>
                )}
                {!isDayMenuOpen && <span className="text-[14px] text-[#ccc] relative -top-2 ml-1 hidden sm:inline-block">▾</span>}
              </div>
            </div>

            <AnimatePresence>
              {isDayMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDayMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-2 sm:left-4 mt-2 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl p-2 border border-black/[0.04] min-w-[200px] origin-top-left flex flex-col gap-1 z-50"
                  >
                    {[
                      { value: 'auto', label: `自动判断 (${autoResultText})` },
                      { value: 0, label: '今天' },
                      { value: 1, label: '明天' },
                      { value: 2, label: '后天' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setDayMode(option.value as DayMode);
                          setSelectedOption('shorter');
                          setIsDayMenuOpen(false);
                          if (navigator.vibrate) navigator.vibrate(30);
                        }}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] transition-colors outline-none text-left tracking-wide ${dayMode === option.value ? 'bg-black/5 text-[#111] font-bold' : 'text-[#666] hover:bg-black/5 active:bg-black/10 font-medium'}`}
                      >
                        <span>{option.label}</span>
                        {dayMode === option.value && (
                          <span className="w-2 h-2 rounded-full bg-[#111]"></span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div
            className="relative cursor-pointer group px-2 sm:px-4 py-2 rounded-2xl hover:bg-black/5 active:bg-black/10 transition-colors active:scale-[0.98] duration-200"
            onClick={() => {
              setTempTime(targetTime);
              setTempPresetId(targetPresetId);
              setIsTimePickerOpen(true);
            }}
          >
            <div className="flex items-baseline pointer-events-none">
              <span className="text-[48px] sm:text-[56px] md:text-[88px] font-bold tracking-tight leading-none text-[#1a1a1a]">
                {targetLabel ?? `${pad(targetTime.hour)}:${pad(targetTime.minute)}`}
              </span>
              {targetLabel && (
                <span className="ml-2 md:ml-3 text-[14px] md:text-[18px] font-medium text-[#bbb] tracking-wide self-end mb-2 md:mb-4 whitespace-nowrap">
                  {pad(targetTime.hour)}:{pad(targetTime.minute)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Line 3: 还有 */}
        <div className="text-[20px] md:text-[32px] text-[#999] font-medium tracking-wide mt-2 mb-2 md:mt-4 md:mb-6 ml-2 md:ml-4">
          还有
        </div>

        {/* Line 4: 倒计时 */}
        <div className="-ml-2 sm:-ml-4 select-none w-full overflow-hidden">
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={e => e.preventDefault()}
            className={`inline-block font-bold text-black font-mono tracking-tighter leading-none cursor-pointer active:scale-[0.98] active:opacity-80 transition-all rounded-3xl px-2 sm:px-4 py-2 hover:bg-black/5 whitespace-nowrap ${step === 0
                ? 'text-[54px] sm:text-[72px] md:text-[120px]'
                : 'text-[72px] sm:text-[96px] md:text-[140px]'
              }`}
          >
            {displayStr}
          </div>
        </div>

        {/* Line 5: 温暖的下半句解释 */}
        <div className="mt-8 md:mt-12 ml-2 md:ml-4 min-h-[100px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`desc-${step}-${isExact ? 'exact' : selectedOption}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 ? (
                <div className="text-[16px] md:text-[22px] text-[#bbb] font-medium">
                  时间正在一秒秒流逝呢。
                </div>
              ) : isExact ? (
                <div className="text-[16px] md:text-[22px] text-[#777] font-medium leading-relaxed max-w-xl">
                  十分完美，刚好满足 {step} 分钟的取整要求。<br className="hidden md:block" />
                  这表示倒计时会在 <span className="text-[#111] font-bold border-b-2 border-black/20 pb-0.5 whitespace-nowrap">{getEndDateTimeStr(activeMins)}</span> 准点结束。
                </div>
              ) : (
                <div className="flex flex-col items-start gap-4">
                  <div className="text-[16px] md:text-[22px] text-[#777] font-medium leading-relaxed max-w-xl">
                    为了凑整 {step} 分钟，当前选择了<span className="text-[#111] font-bold mx-1 whitespace-nowrap">{selectedOption === 'shorter' ? '稍微提前' : '稍微推迟'}</span>。<br />
                    倒计时将在 <span className="text-[#111] font-bold border-b-[3px] border-black/10 pb-0.5 whitespace-nowrap">{getEndDateTimeStr(activeMins)}</span> 刚好完成。
                  </div>

                  <button
                    onClick={() => setSelectedOption(selectedOption === 'shorter' ? 'longer' : 'shorter')}
                    className="flex items-center gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-[16px] bg-black/[0.03] hover:bg-black/[0.06] active:bg-black/[0.08] active:scale-[0.98] transition-all outline-none cursor-pointer group mt-1"
                  >
                    <span className="text-[14px] md:text-[15px] text-[#666] font-medium group-hover:text-[#333] transition-colors text-left leading-snug">
                      {inactiveMins === 0
                        ? '或者不想等了，立刻开始 ➔'
                        : `或者想${selectedOption === 'shorter' ? '晚一点' : '早一点'}，改成 ${getEndDateTimeStr(inactiveMins)} 结束 ➔`}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Bottom Right: Step Toggle */}
      {isStepMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsStepMenuOpen(false)} />
      )}
      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 z-50">
        <AnimatePresence>
          {isStepMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-[calc(100%+12px)] right-0 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl p-2 border border-black/[0.04] min-w-[200px] origin-bottom-right flex flex-col gap-1"
            >
              {[
                { value: 0, label: '关闭 (精确到秒)' },
                { value: 15, label: '凑整到 15 分钟' },
                { value: 30, label: '凑整到 30 分钟' },
                { value: 60, label: '凑整到 60 分钟' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setStep(option.value as Step);
                    setSelectedOption('shorter');
                    setIsStepMenuOpen(false);
                    if (navigator.vibrate) navigator.vibrate(30);
                  }}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] transition-colors outline-none text-left tracking-wide ${step === option.value ? 'bg-black/5 text-[#111] font-bold' : 'text-[#666] hover:bg-black/5 active:bg-black/10 font-medium'}`}
                >
                  <span>{option.label}</span>
                  {step === option.value && (
                    <span className="w-2 h-2 rounded-full bg-[#111]"></span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsStepMenuOpen(!isStepMenuOpen)}
          className="group flex items-center justify-center gap-[10px] px-5 py-3 md:px-[22px] md:py-3.5 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] text-[15px] transition-shadow outline-none cursor-pointer border border-black/[0.04]"
        >
          <span className="text-[#888] font-medium transition-colors leading-none pt-[1px] md:pt-[2px]">时间凑整</span>
          <div className="relative flex items-center h-[18px] w-[60px] md:w-[65px] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={step}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={`absolute inset-y-0 left-0 flex items-center font-mono font-bold text-[15px] md:text-[16px] whitespace-nowrap leading-none ${step === 0 ? 'text-[#ccc]' : 'text-[#111]'}`}
              >
                {step === 0 ? '关闭' : `${step} 分钟`}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.button>
      </div>

      {/* Copied Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            transition={{ duration: 0.2 }}
            className="fixed top-12 left-1/2 bg-[#1a1a1a] text-white text-[14px] font-medium tracking-wide px-6 py-3 rounded-full shadow-lg z-50 pointer-events-none"
          >
            已复制到剪贴板
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time Picker Sheet */}
      <AnimatePresence>
        {isTimePickerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsTimePickerOpen(false)}
              className="fixed inset-0 bg-black/20 z-[60] touch-none"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] shadow-2xl z-[70] overflow-hidden select-none"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-center justify-between p-4 px-6 border-b border-black/5">
                <button
                  className="px-2 py-2 text-[#999] hover:text-[#555] font-medium text-[16px] transition-colors"
                  onClick={() => setIsTimePickerOpen(false)}
                >
                  取消
                </button>
                <div className="text-[17px] font-medium text-[#111]">选择时间</div>
                <button
                  className="px-2 py-2 text-[#000] font-bold text-[16px] transition-colors"
                  onClick={() => {
                    setTargetTime(tempTime);
                    setTargetPresetId(tempPresetId);
                    setSelectedOption('shorter');
                    setIsTimePickerOpen(false);
                    if (navigator.vibrate) navigator.vibrate(30);
                  }}
                >
                  确定
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto px-5 py-3 border-b border-black/5 hide-scrollbar">
                {presets.map(preset => (
                  <button
                    key={preset.id}
                    onPointerDown={() => {
                      presetLongPressFired.current = false;
                      presetLongPressTimer.current = window.setTimeout(() => {
                        presetLongPressFired.current = true;
                        setEditingPreset({ ...preset });
                        if (navigator.vibrate) navigator.vibrate(50);
                      }, 500);
                    }}
                    onPointerUp={() => {
                      if (presetLongPressTimer.current) {
                        clearTimeout(presetLongPressTimer.current);
                        presetLongPressTimer.current = null;
                      }
                      if (!presetLongPressFired.current) {
                        setTargetTime({ hour: preset.hour, minute: preset.minute });
                        setTargetPresetId(preset.id);
                        setSelectedOption('shorter');
                        setIsTimePickerOpen(false);
                        if (navigator.vibrate) navigator.vibrate(30);
                      }
                    }}
                    onPointerCancel={() => {
                      if (presetLongPressTimer.current) {
                        clearTimeout(presetLongPressTimer.current);
                        presetLongPressTimer.current = null;
                      }
                    }}
                    onContextMenu={e => e.preventDefault()}
                    className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-medium transition-colors whitespace-nowrap ${
                      tempPresetId === preset.id
                        ? 'bg-[#111] text-white'
                        : 'bg-black/5 text-[#555] hover:bg-black/10 active:bg-black/[0.12]'
                    }`}
                  >
                    {preset.label}
                    <span className={`ml-1.5 font-mono tabular-nums ${tempPresetId === preset.id ? 'opacity-70' : 'opacity-50'}`}>
                      {pad(preset.hour)}:{pad(preset.minute)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setEditingPreset({
                    id: `p-${Date.now()}`,
                    label: '',
                    hour: tempTime.hour,
                    minute: tempTime.minute,
                  })}
                  className="shrink-0 px-4 py-2 rounded-full text-[16px] font-medium bg-black/5 text-[#888] hover:bg-black/10 active:bg-black/[0.12] transition-colors leading-none"
                  aria-label="新增预设"
                >
                  +
                </button>
              </div>

              <div className="flex relative h-[250px] items-center justify-center bg-[#fafafa]">
                {/* Highlight band */}
                <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-[44px] bg-black/5 rounded-2xl pointer-events-none" />

                <div className="flex w-full max-w-sm justify-center gap-[40px] relative z-10 px-8">
                  <ScrollPicker
                    options={hoursList}
                    value={tempTime.hour}
                    onChange={(v) => { setTempTime(prev => ({ ...prev, hour: v })); setTempPresetId(null); }}
                    pad
                  />
                  <div className="flex items-center justify-center font-bold text-3xl pb-1.5 opacity-50 relative -top-[1px] -mx-4 pointer-events-none">:</div>
                  <ScrollPicker
                    options={minutesList}
                    value={tempTime.minute}
                    onChange={(v) => { setTempTime(prev => ({ ...prev, minute: v })); setTempPresetId(null); }}
                    pad
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Preset Edit Modal */}
      <AnimatePresence>
        {editingPreset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setEditingPreset(null)}
              className="fixed inset-0 bg-black/30 z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl z-[90] w-[92vw] max-w-md overflow-hidden select-none"
            >
              <div className="flex items-center justify-between p-4 px-6 border-b border-black/5">
                <button
                  className="px-2 py-2 text-[#999] hover:text-[#555] font-medium text-[16px] transition-colors"
                  onClick={() => setEditingPreset(null)}
                >
                  取消
                </button>
                <div className="text-[17px] font-medium text-[#111]">
                  {isNewPreset ? '添加预设' : '编辑预设'}
                </div>
                <button
                  className="px-2 py-2 text-[#000] font-bold text-[16px] transition-colors disabled:opacity-30"
                  disabled={!editingPreset.label.trim()}
                  onClick={() => {
                    const next = { ...editingPreset, label: editingPreset.label.trim() };
                    if (isNewPreset) {
                      setPresets([...presets, next]);
                      setTempTime({ hour: next.hour, minute: next.minute });
                      setTempPresetId(next.id);
                    } else {
                      setPresets(presets.map(p => p.id === next.id ? next : p));
                      if (targetPresetId === next.id) {
                        setTargetTime({ hour: next.hour, minute: next.minute });
                      }
                      if (tempPresetId === next.id) {
                        setTempTime({ hour: next.hour, minute: next.minute });
                      }
                    }
                    setEditingPreset(null);
                    if (navigator.vibrate) navigator.vibrate(30);
                  }}
                >
                  保存
                </button>
              </div>

              <div className="p-5">
                <input
                  type="text"
                  value={editingPreset.label}
                  onChange={(e) => setEditingPreset({ ...editingPreset, label: e.target.value })}
                  placeholder="名称（如：下班）"
                  maxLength={10}
                  autoFocus
                  className="w-full px-4 py-3 bg-black/5 rounded-2xl text-[16px] font-medium outline-none focus:bg-black/[0.08] transition-colors placeholder:text-[#bbb]"
                />

                <div className="flex relative h-[240px] mt-4 items-center justify-center bg-[#fafafa] rounded-2xl overflow-hidden">
                  <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-[44px] bg-black/5 rounded-2xl pointer-events-none" />
                  <div className="flex justify-center gap-[40px] relative z-10">
                    <ScrollPicker
                      options={hoursList}
                      value={editingPreset.hour}
                      onChange={(v) => setEditingPreset({ ...editingPreset, hour: v })}
                      pad
                    />
                    <div className="flex items-center justify-center font-bold text-3xl pb-1.5 opacity-50 relative -top-[1px] -mx-4 pointer-events-none">:</div>
                    <ScrollPicker
                      options={minutesList}
                      value={editingPreset.minute}
                      onChange={(v) => setEditingPreset({ ...editingPreset, minute: v })}
                      pad
                    />
                  </div>
                </div>

                {!isNewPreset && (
                  <button
                    onClick={() => {
                      const id = editingPreset.id;
                      setPresets(presets.filter(p => p.id !== id));
                      if (targetPresetId === id) setTargetPresetId(null);
                      if (tempPresetId === id) setTempPresetId(null);
                      setEditingPreset(null);
                      if (navigator.vibrate) navigator.vibrate(30);
                    }}
                    className="mt-4 w-full py-3 rounded-2xl bg-red-50 text-red-600 font-medium text-[15px] hover:bg-red-100 active:bg-red-200 transition-colors"
                  >
                    删除此预设
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
