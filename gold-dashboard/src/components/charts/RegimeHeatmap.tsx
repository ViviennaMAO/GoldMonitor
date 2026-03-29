'use client'
import { useState } from 'react'
import { useRegime, RegimeLayer1, RegimeLayer2, RegimeLayer3 } from '@/lib/useGoldData'
import clsx from 'clsx'

const FACTOR_SHORT: Record<string, string> = {
  F1_DXY: 'DXY',
  F4_BEI: 'BEI',
  F5_GPR: 'GPR',
  F6_GVZ: 'GVZ',
  F9_GDXMomentum: 'GDXm',
  F10_TIPSBEISpread: 'T-B',
  F11_DXYMomentum: 'DXYm',
  F12_DXYDownGPRUp: 'D×G',
  F13_GoldGDXDivergence: 'G-M',
  F14_GVZMomentum: 'GVZm',
}

const FACTOR_LABEL: Record<string, string> = {
  F1_DXY: '美元',
  F4_BEI: '通胀',
  F5_GPR: '地缘',
  F6_GVZ: '波动',
  F9_GDXMomentum: '矿业动量',
  F10_TIPSBEISpread: '利差',
  F11_DXYMomentum: '美元动量',
  F12_DXYDownGPRUp: '交叉',
  F13_GoldGDXDivergence: '背离',
  F14_GVZMomentum: '波动动量',
}

// ── Three-Layer Regime Panel ────────────────────────────────────────────────

const DIRECTION_COLOR = {
  up: 'text-green-400',
  down: 'text-red-400',
  neutral: 'text-slate-500',
}

const QUADRANT_COLOR: Record<string, string> = {
  Stagflation: 'text-amber-400',
  Overheating: 'text-orange-400',
  Deflation:   'text-blue-400',
  Reflation:   'text-green-400',
  Neutral:     'text-slate-400',
}

const SHOCK_COLOR: Record<string, string> = {
  fragility:   'text-red-400',
  expectation: 'text-amber-400',
  inflation:   'text-orange-400',
}

function LayerTag({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] text-slate-600 uppercase tracking-wider">{label}</span>
      <span className={clsx('text-[10px] font-semibold', color)}>{value}</span>
    </div>
  )
}

function ThreeLayerPanel({
  layer1,
  layer2,
  layer3,
  confidence,
}: {
  layer1?: RegimeLayer1
  layer2?: RegimeLayer2
  layer3?: RegimeLayer3
  confidence?: number
}) {
  if (!layer1) return null

  const confPct = confidence != null ? Math.round(confidence * 100) : null

  return (
    <div className="mt-2 space-y-1.5">
      {/* Confidence bar */}
      {confPct != null && (
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-slate-600 w-12 flex-shrink-0">置信度</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-300 transition-all duration-700"
              style={{ width: `${confPct}%` }}
            />
          </div>
          <span className="text-[8px] text-slate-500 font-mono w-6 text-right">{confPct}%</span>
        </div>
      )}

      {/* Layer 1: Macro */}
      <div className="p-1.5 rounded-lg bg-white/[0.025] border border-white/[0.04]">
        <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">L1 · 宏观四象限</div>
        <div className="flex items-center gap-3">
          <LayerTag
            label="象限"
            value={layer1.quadrant_zh}
            color={QUADRANT_COLOR[layer1.quadrant] ?? 'text-slate-400'}
          />
          <div className="w-px h-7 bg-white/[0.06]" />
          <LayerTag
            label="增长"
            value={layer1.growth_direction === 'up' ? '↑ 扩张' : layer1.growth_direction === 'down' ? '↓ 收缩' : '→ 中性'}
            color={DIRECTION_COLOR[layer1.growth_direction] ?? 'text-slate-400'}
          />
          <div className="w-px h-7 bg-white/[0.06]" />
          <LayerTag
            label="通胀"
            value={layer1.inflation_direction === 'up' ? '↑ 上行' : layer1.inflation_direction === 'down' ? '↓ 下行' : '→ 中性'}
            color={DIRECTION_COLOR[layer1.inflation_direction] ?? 'text-slate-400'}
          />
          <div className="w-px h-7 bg-white/[0.06]" />
          <LayerTag
            label="美联储"
            value={layer1.fed_cycle_zh}
            color={layer1.fed_cycle === 'Tightening' ? 'text-red-400' : layer1.fed_cycle === 'Easing' ? 'text-green-400' : 'text-slate-400'}
          />
        </div>
      </div>

      {/* Layer 2: Market */}
      {layer2 && (
        <div className="p-1.5 rounded-lg bg-white/[0.025] border border-white/[0.04]">
          <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">L2 · 市场结构</div>
          <div className="flex items-center gap-3">
            <LayerTag
              label={`HMM${!layer2.hmm_available ? ' (规则)' : ''}`}
              value={`${layer2.hmm_label_zh} ${Math.round(layer2.hmm_confidence * 100)}%`}
              color={layer2.hmm_label === 'Bull' ? 'text-green-400' : layer2.hmm_label === 'Bear' ? 'text-red-400' : 'text-slate-400'}
            />
            <div className="w-px h-7 bg-white/[0.06]" />
            <LayerTag
              label="流动性"
              value={layer2.market_regime_zh}
              color={
                layer2.market_regime === 'Trending' ? 'text-green-400' :
                layer2.market_regime === 'Systemic Risk' ? 'text-red-400' :
                layer2.market_regime === 'Crisis Spike' ? 'text-amber-400' :
                'text-slate-400'
              }
            />
            <div className="w-px h-7 bg-white/[0.06]" />
            <LayerTag label="调整" value={`${layer2.adj_factor}×`} color="text-slate-300" />
          </div>
        </div>
      )}

      {/* Layer 3: Event */}
      {layer3 && (layer3.rate_shock_detected || layer3.changepoint_detected || layer3.overlay_delta !== 0) && (
        <div className={clsx(
          'p-1.5 rounded-lg border',
          layer3.rate_shock_detected
            ? 'bg-amber-500/[0.06] border-amber-500/20'
            : layer3.changepoint_detected
            ? 'bg-blue-500/[0.06] border-blue-500/20'
            : 'bg-white/[0.025] border-white/[0.04]',
        )}>
          <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">L3 · 事件叠加</div>
          <div className="flex items-center gap-3 flex-wrap">
            {layer3.rate_shock_detected && (
              <LayerTag
                label="利率冲击"
                value={layer3.shock_source_zh ?? '检测中'}
                color={SHOCK_COLOR[layer3.shock_source ?? ''] ?? 'text-amber-400'}
              />
            )}
            {layer3.changepoint_detected && (
              <LayerTag label="变点" value={`${layer3.days_since_changepoint}天前`} color="text-blue-400" />
            )}
            <LayerTag
              label="美元形态"
              value={layer3.dollar_type_zh}
              color={layer3.dollar_type === 'risk_off' ? 'text-amber-400' : layer3.dollar_type === 'growth' ? 'text-blue-400' : layer3.dollar_type === 'weak' ? 'text-green-400' : 'text-slate-400'}
            />
            <LayerTag
              label="叠加量"
              value={`${layer3.overlay_delta >= 0 ? '+' : ''}${layer3.overlay_delta.toFixed(2)}`}
              color={layer3.overlay_delta > 0 ? 'text-green-400' : layer3.overlay_delta < 0 ? 'text-red-400' : 'text-slate-400'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function getColor(value: number): string {
  const abs = Math.min(Math.abs(value), 2.5)
  const intensity = abs / 2.5
  if (value > 0) {
    return `rgba(34,197,94,${0.15 + intensity * 0.65})`
  } else {
    return `rgba(239,68,68,${0.15 + intensity * 0.65})`
  }
}

export function RegimeHeatmap() {
  const { data } = useRegime()
  const [tooltip, setTooltip] = useState<{ month: string; factor: string; value: number } | null>(null)

  const current = data?.current
  const heatmap = data?.heatmap ?? []
  const factorKeys = heatmap.length > 0 ? Object.keys(heatmap[0].factors) : []

  if (!heatmap.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
        加载 Regime 热力图...
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Regime 热力图</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">月末因子 Z-Score · 绿色=利多 红色=利空</p>
        </div>
        {current && (
          <div className={clsx(
            'px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
            current.regime === 'Risk-On' || current.regime === 'Favorable'
              ? 'bg-green-500/15 border-green-500/30 text-green-400'
              : current.regime === 'Risk-Off' || current.regime === 'Cautious'
              ? 'bg-red-500/15 border-red-500/30 text-red-400'
              : 'bg-slate-500/15 border-slate-500/30 text-slate-400',
          )}>
            {current.regime} · {current.multiplier}x
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[-2, -1.2, -0.4, 0.4, 1.2, 2].map(v => (
              <div
                key={v}
                className="w-5 h-4 rounded-sm"
                style={{ backgroundColor: getColor(v) }}
              />
            ))}
          </div>
          <span className="text-[9px] text-slate-600">看空 ← 中性 → 看多</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-[9px] text-slate-600 text-left pb-1 w-16 font-normal">因子</th>
              {heatmap.map(h => (
                <th key={h.month} className="text-[9px] text-slate-600 text-center pb-1 font-mono font-normal">
                  {h.month.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorKeys.map(fid => (
              <tr key={fid}>
                <td className="text-[10px] text-slate-400 pr-2 font-mono py-0.5">
                  <div>{FACTOR_SHORT[fid] ?? fid.replace(/^F\d+_/, '')}</div>
                  <div className="text-[8px] text-slate-700 leading-none">{FACTOR_LABEL[fid] ?? ''}</div>
                </td>
                {heatmap.map(h => {
                  const val = h.factors[fid] ?? 0
                  const isHovered = tooltip?.month === h.month && tooltip?.factor === fid

                  return (
                    <td
                      key={h.month}
                      className="relative cursor-pointer"
                      onMouseEnter={() => setTooltip({ month: h.month, factor: fid, value: val })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div
                        className={clsx(
                          'rounded transition-all duration-200 flex items-center justify-center',
                          isHovered && 'ring-1 ring-white/30 scale-110',
                        )}
                        style={{
                          height: 28,
                          backgroundColor: getColor(val),
                          transform: isHovered ? 'scale(1.1)' : undefined,
                        }}
                      >
                        <span className={clsx(
                          'text-[8px] font-mono',
                          Math.abs(val) > 1.5 ? 'text-white/80' : 'text-slate-400/60',
                        )}>
                          {val.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-mono">
              {tooltip.month} · {FACTOR_SHORT[tooltip.factor] ?? tooltip.factor}
              {FACTOR_LABEL[tooltip.factor] ? ` ${FACTOR_LABEL[tooltip.factor]}` : ''}
            </span>
            <span
              className="font-bold font-mono"
              style={{ color: tooltip.value >= 0 ? '#22C55E' : '#EF4444' }}
            >
              Z = {tooltip.value > 0 ? '+' : ''}{tooltip.value.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">
            {tooltip.value > 1.0
              ? '强利多信号'
              : tooltip.value > 0.3
              ? '温和利多'
              : tooltip.value < -1.0
              ? '强利空信号'
              : tooltip.value < -0.3
              ? '温和利空'
              : '中性，方向不明显'}
          </div>
        </div>
      )}

      {/* Three-layer regime detail (v2) */}
      {current?.layer1 ? (
        <ThreeLayerPanel layer1={current.layer1} layer2={current.layer2} layer3={current.layer3} confidence={current.confidence} />
      ) : (
        <div className="mt-2 flex items-center justify-center gap-4 text-[9px]">
          <span className="text-red-400/60">Risk-Off: {current?.risk_off_score ?? 0}/5</span>
          <span className="text-green-400/60">Risk-On: {current?.risk_on_score ?? 0}/5</span>
        </div>
      )}
    </div>
  )
}
