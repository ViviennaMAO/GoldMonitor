'use client'
import { useEffect, useState } from 'react'
import { Circle, Cpu, Database, Wifi, Bell, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { AlertItem } from '@/types'
import { useGoldPrice, useFactors, useModelHealth } from '@/lib/useGoldData'
import clsx from 'clsx'

const alertConfig = {
  critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning:  { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info:     { icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  daily:    { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-700/30' },
}

export function StatusBar() {
  const [time, setTime] = useState('')
  const [showAlerts, setShowAlerts] = useState(false)
  const { data: priceData } = useGoldPrice()
  const { dataSource } = useFactors()
  const { data: health } = useModelHealth()

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Build alerts from model health
  const alerts: AlertItem[] = []
  if (health) {
    if (health.status === 'degraded') {
      alerts.push({ id: 'health-degraded', level: 'critical', message: `模型质量降级 — IC 转负`, time: '模型监控' })
    } else if (health.status === 'warning') {
      alerts.push({ id: 'health-warning', level: 'warning', message: `模型 IC 下降趋势`, time: '模型监控' })
    }
    health.warnings?.forEach((w, i) => {
      alerts.push({ id: `warn-${i}`, level: 'warning', message: w, time: '模型监控' })
    })
    // Add positive info
    if (health.status === 'healthy' && (!health.warnings || health.warnings.length === 0)) {
      alerts.push({ id: 'health-ok', level: 'info', message: `模型健康 · OOS IC=${health.oos_ic?.toFixed(3)} · 60d IC=${health.recent_60d_ic?.toFixed(3)}`, time: '模型监控' })
    }
    alerts.push({
      id: 'factors',
      level: 'daily',
      message: `${health.n_factors} 因子 · ${health.oos_samples ?? 0} OOS样本 · 训练截止 ${health.train_end ?? 'N/A'}`,
      time: '模型配置',
    })
  }

  // Add data source info
  const priceSource = priceData?.source ?? 'mock'
  if (priceSource !== 'mock') {
    alerts.push({ id: 'price-live', level: 'info', message: `金价数据源: ${priceSource} · $${priceData?.price?.toFixed(0)}`, time: '数据源' })
  } else {
    alerts.push({ id: 'price-mock', level: 'warning', message: '金价使用模拟数据', time: '数据源' })
  }

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount  = alerts.filter(a => a.level === 'warning').length

  const healthColor = health?.status === 'healthy' ? 'text-green-400/80'
    : health?.status === 'warning' ? 'text-amber-400/80'
    : health?.status === 'degraded' ? 'text-red-400/80'
    : 'text-slate-500'

  const healthLabel = health?.status === 'healthy' ? '模型健康'
    : health?.status === 'warning' ? '模型预警'
    : health?.status === 'degraded' ? '模型降级'
    : '检测中...'

  return (
    <footer className="relative flex-shrink-0 h-9 flex items-center justify-between px-2 md:px-4 border-t border-white/[0.06] bg-[#050B18] text-[10px]">
      {/* Left: system status */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className={clsx('flex items-center gap-1.5', healthColor)}>
          <Circle className="w-2 h-2 fill-current animate-pulse" />
          <span>{healthLabel}</span>
        </div>
        <div className="items-center gap-1 text-slate-600 hidden md:flex">
          <Cpu className="w-3 h-3" />
          <span>XGBoost · {health?.n_factors ?? '?'}因子</span>
        </div>
        <div className="items-center gap-1 text-slate-600 hidden lg:flex">
          <Database className="w-3 h-3" style={{ color: dataSource?.fred ? '#22C55E80' : undefined }} />
          <span>
            {dataSource?.fred ? 'FRED+Yahoo' : 'Pipeline'}
            {' · '}
            {dataSource?.timestamp
              ? new Date(dataSource.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '--:--'}
          </span>
        </div>
        {health && (
          <div className="items-center gap-1 text-slate-600 hidden xl:flex">
            <Wifi className="w-3 h-3" />
            <span>IC={health.recent_60d_ic?.toFixed(2) ?? '--'}</span>
          </div>
        )}
      </div>

      {/* Center: alert counts */}
      <button
        className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setShowAlerts(s => !s)}
      >
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <XCircle className="w-3 h-3" />
            <span>{criticalCount} 紧急</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{warningCount} 警告</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-slate-600">
          <Bell className="w-3 h-3" />
          <span className="hidden sm:inline">{alerts.length} 条消息</span>
        </div>
      </button>

      {/* Right: time + version */}
      <div className="flex items-center gap-2 md:gap-3 text-slate-600">
        <span className="font-mono">{time}</span>
        <span className="text-slate-800 hidden md:inline">·</span>
        <span className="hidden md:inline">Gold Monitor v1.1</span>
      </div>

      {/* Alerts dropdown */}
      {showAlerts && (
        <div className="absolute bottom-10 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[480px] rounded-2xl border border-white/10 bg-[#0A1628]/98 backdrop-blur-xl shadow-2xl p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">系统告警 · 模型监控</span>
            <button onClick={() => setShowAlerts(false)} className="text-slate-600 hover:text-slate-300 cursor-pointer text-xs">关闭</button>
          </div>
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {alerts.map(alert => {
              const cfg = alertConfig[alert.level]
              const Icon = cfg.icon
              return (
                <div
                  key={alert.id}
                  className={clsx('flex items-start gap-2 p-2 rounded-xl', cfg.bg)}
                >
                  <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0 mt-0.5', cfg.color)} />
                  <span className={clsx('flex-1 text-xs leading-tight', cfg.color === 'text-slate-400' ? 'text-slate-500' : 'text-slate-300')}>
                    {alert.message}
                  </span>
                  <span className="text-[9px] text-slate-700 font-mono flex-shrink-0">{alert.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </footer>
  )
}
