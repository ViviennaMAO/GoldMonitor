'use client'
import clsx from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  color?: 'green' | 'amber' | 'red' | 'blue' | 'gold'
  height?: number
  showLabel?: boolean
  className?: string
}

const colorClasses = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gold: 'bg-yellow-400',
}

export function ProgressBar({ value, max = 100, color = 'blue', height = 4, showLabel, className }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={clsx('w-full flex items-center gap-2', className)}>
      <div
        className="flex-1 rounded-full bg-slate-800 overflow-hidden"
        style={{ height }}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-500', colorClasses[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 font-mono w-10 text-right">{value.toFixed(1)}%</span>
      )}
    </div>
  )
}
