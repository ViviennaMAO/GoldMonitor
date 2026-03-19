'use client'
import clsx from 'clsx'

interface BadgeProps {
  variant: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray'
  size?: 'sm' | 'md'
  children: React.ReactNode
  dot?: boolean
}

const variantClasses = {
  green:  'bg-green-500/15 text-green-400 border border-green-500/20',
  red:    'bg-red-500/15 text-red-400 border border-red-500/20',
  amber:  'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  blue:   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  gray:   'bg-slate-700/50 text-slate-400 border border-slate-700',
}

const dotColors = {
  green: 'bg-green-400', red: 'bg-red-400', amber: 'bg-amber-400',
  blue: 'bg-blue-400', purple: 'bg-purple-400', gray: 'bg-slate-400',
}

export function Badge({ variant, size = 'sm', children, dot }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      variantClasses[variant],
    )}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  )
}
