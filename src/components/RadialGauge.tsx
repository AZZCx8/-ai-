import {motion} from 'motion/react';

interface RadialGaugeProps {
  label: string;
  valueText: string;
  subText: string;
  percent: number | null;
  accent: 'purple' | 'blue' | 'emerald' | 'amber' | 'rose';
}

const ACCENT_MAP = {
  purple: {stroke: '#A855F7', text: 'text-violet-300', glow: 'rgba(168, 85, 247, 0.35)'},
  blue: {stroke: '#38BDF8', text: 'text-sky-300', glow: 'rgba(56, 189, 248, 0.35)'},
  emerald: {stroke: '#10B981', text: 'text-emerald-300', glow: 'rgba(16, 185, 129, 0.35)'},
  amber: {stroke: '#F59E0B', text: 'text-amber-300', glow: 'rgba(245, 158, 11, 0.35)'},
  rose: {stroke: '#F43F5E', text: 'text-rose-300', glow: 'rgba(244, 63, 94, 0.35)'},
};

export function RadialGauge({label, valueText, subText, percent, accent}: RadialGaugeProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const colors = ACCENT_MAP[accent];

  return (
    <div className="glass-card flex flex-col items-center justify-between rounded-3xl p-4 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="7"
          />
          {percent !== null && (
            <motion.circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{strokeDashoffset: circumference}}
              animate={{strokeDashoffset: offset}}
              transition={{duration: 0.6, ease: [0.16, 1, 0.3, 1]}}
              style={{filter: `drop-shadow(0 0 8px ${colors.glow})`}}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          <span className={`font-mono-num text-base font-bold leading-tight ${colors.text}`}>
            {valueText}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        <div className="text-sm font-bold text-slate-100">{label}</div>
        <div className="line-clamp-2 text-[11px] leading-snug text-slate-400">{subText}</div>
      </div>
    </div>
  );
}
