'use client'
import { useEffect, useState } from 'react'
import { Circle, Cpu, Database, Wifi, Bell, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { alerts } from '@/data/mockData'
import { AlertItem } from '@/types'
import { useGoldPrice, useFactors } from '@/lib/useGoldData'
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

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount  = alerts.filter(a => a.level === 'warning').length

  return (
    <footer className="relative flex-shrink-0 h-9 flex items-center justify-between px-4 border-t border-white/[0.06] bg-[#050B18] text-[10px]">
      {/* Left: system status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-green-400/80">
          <Circle className="w-2 h-2 fill-current animate-pulse" />
          <span>系统正常</span>
        </div>
        <div className="flex items-center gap-1 text-slate-600">
          <Cpu className="w-3 h-3" />
          <span>XGBoost 推理引擎 · 在线</span>
        </div>
        <div className="flex items-center gap-1 text-slate-600">
          <Database className="w-3 h-3" style={{ color: dataSource?.fred ? '#22C55E80' : undefined }} />
          <span>
            {dataSource?.fred ? 'FRED+Yahoo' : 'Mock 数据'}
            {' · '}
            {dataSource?.timestamp
              ? new Date(dataSource.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '21:00'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-600">
          <Wifi className="w-3 h-3" />
          <span>VSTAR WebSocket · 连接中</span>
        </div>
      </div>

      {/* Center: alert counts */}
      <button
        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
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
          <span>{alerts.length} 条消息</span>
        </div>
      </button>

      {/* Right: time + version */}
      <div className="flex items-center gap-3 text-slate-600">
        <span className="font-mono">{time}</span>
        <span className="text-slate-800">·</span>
        <span>Gold Monitor v1.0 · PRD v1.0</span>
      </div>

      {/* Alerts dropdown */}
      {showAlerts && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[480px] rounded-2xl border border-white/10 bg-[#0A1628]/98 backdrop-blur-xl shadow-2xl p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">告警消息</span>
            <button onClick={() => setShowAlerts(false)} className="text-slate-600 hover:text-slate-300 cursor-pointer text-xs">关闭</button>
          </div>
          <div className="space-y-1.5">
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
