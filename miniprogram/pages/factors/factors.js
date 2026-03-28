var api = require('../../utils/api')
var util = require('../../utils/util')

var FACTOR_SHORT = {
  'F1_DXY': 'DXY',
  'F3_TIPS10Y': 'TIPS',
  'F4_BEI': 'BEI',
  'F5_GPR': 'GPR',
  'F6_GVZ': 'GVZ',
  'F8_ETFFlow': 'ETF',
  'F9_GDXRatio': 'GDX',
  'F10_TIPSBEISpread': 'T-B',
  'F11_DXYMomentum': 'DXYm',
  'F12_DXYDownGPRUp': 'D×G',
  'F13_GoldGDXDivergence': 'G-M',
  'F14_GVZMomentum': 'GVZm',
  'F15_ETFFlowAccel': 'ETFa'
}

Page({
  data: {
    loading: true,
    activeTab: 'factors',
    // Factors
    factors: [],
    baseFactors: [],
    logicalFactors: [],
    dataSource: '',
    // IC Tracking
    icData: [],
    icMean: '--',
    icir: '--',
    icLatest: '--',
    icLatestColor: '#9CA3AF',
    // Regime Heatmap
    regimeCurrent: '--',
    regimeClass: 'badge-neutral',
    regimeMultiplier: '--',
    heatmapRows: [],
    heatmapFactors: [],
    // Stress Test
    stressPeriods: [],
    stressSummary: null,
    // Granger
    grangerFactors: [],
    grangerSummary: null,
    // Last update
    lastUpdate: '--'
  },

  onLoad() {
    this.loadAllData()
  },

  onPullDownRefresh() {
    var that = this
    this.loadAllData().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  loadAllData() {
    var that = this
    wx.showLoading({ title: '加载数据...' })

    return Promise.all([
      api.fetchFactors().catch(function () { return null }),
      api.fetchICHistory().catch(function () { return null }),
      api.fetchRegime().catch(function () { return null }),
      api.fetchStressTest().catch(function () { return null }),
      api.fetchGranger().catch(function () { return null })
    ]).then(function (results) {
      var factorsData = results[0]
      var icData = results[1]
      var regimeData = results[2]
      var stressData = results[3]
      var grangerData = results[4]

      var updateObj = { loading: false, lastUpdate: util.formatDateTime(new Date().toISOString()) }

      // ── Factors ──
      if (factorsData && factorsData.factors) {
        var sources = []
        if (factorsData.dataSource) {
          if (factorsData.dataSource.fred) sources.push('FRED')
          if (factorsData.dataSource.yahoo) sources.push('Yahoo')
          if (factorsData.dataSource.stooq) sources.push('Stooq')
          if (factorsData.dataSource.pipeline) sources.push('Pipeline')
        }
        var hasPipeline = factorsData.factors.some(function (f) { return f.rawUnit === 'GPR' })
        if (hasPipeline && sources.indexOf('Pipeline') === -1) sources.push('Pipeline')
        updateObj.dataSource = sources.join('+') || 'API'

        var allFactors = factorsData.factors.map(function (f) {
          var zs = f.zScore != null ? f.zScore : 0
          var val = f.rawValue != null ? f.rawValue : f.value
          var fNum = parseInt((f.id || '').replace('F', ''))
          return {
            id: f.id,
            name: f.name,
            displayName: f.displayName || f.name,
            value: util.formatNumber(val, 2),
            unit: f.rawUnit || '',
            zScore: util.formatNumber(zs),
            zScoreColor: zs > 1 ? '#10B981' : zs > 0.5 ? '#34D399' :
                         zs < -1 ? '#EF4444' : zs < -0.5 ? '#F87171' : '#9CA3AF',
            zScoreWidth: Math.min(Math.abs(zs) / 3 * 100, 100),
            zScoreDir: zs >= 0 ? 'positive' : 'negative',
            signal: f.signal || 'Neutral',
            signalClass: (f.signal || '').indexOf('支撑') !== -1 || (f.signal || '').indexOf('利好') !== -1 || (f.signal || '').indexOf('升温') !== -1 ? 'badge-buy' :
                         (f.signal || '').indexOf('利空') !== -1 || (f.signal || '').indexOf('压制') !== -1 ? 'badge-sell' : 'badge-neutral',
            percentile: f.percentile52w != null ? Math.round(f.percentile52w) : null,
            description: getFactorDescription(f.id),
            isLogical: fNum >= 10
          }
        })

        updateObj.factors = allFactors
        updateObj.baseFactors = allFactors.filter(function (f) { return !f.isLogical })
        updateObj.logicalFactors = allFactors.filter(function (f) { return f.isLogical })
      }

      // ── IC Tracking ──
      if (icData && icData.rolling_ic) {
        var icArr = icData.rolling_ic
        var sum = 0
        icArr.forEach(function (d) { sum += d.ic })
        var mean = icArr.length > 0 ? sum / icArr.length : 0
        var latest = icArr.length > 0 ? icArr[icArr.length - 1].ic : 0

        var variance = 0
        icArr.forEach(function (d) { variance += Math.pow(d.ic - mean, 2) })
        var std = icArr.length > 1 ? Math.sqrt(variance / (icArr.length - 1)) : 1
        var icir = mean / std

        updateObj.icMean = util.formatNumber(mean, 4)
        updateObj.icir = util.formatNumber(icir, 2)
        updateObj.icLatest = util.formatNumber(latest, 4)
        updateObj.icLatestColor = latest > 0.3 ? '#10B981' : latest > 0 ? '#34D399' :
                                  latest < -0.3 ? '#EF4444' : '#F87171'

        var step = Math.max(1, Math.floor(icArr.length / 25))
        var sampled = []
        for (var i = 0; i < icArr.length; i += step) {
          var d = icArr[i]
          sampled.push({
            date: util.formatDate(d.date),
            ic: util.formatNumber(d.ic, 4),
            icRaw: d.ic,
            barHeight: Math.round(Math.abs(d.ic) / 1 * 100),
            color: d.ic >= 0 ? '#10B981' : '#EF4444'
          })
        }
        var lastIC = icArr[icArr.length - 1]
        if (sampled[sampled.length - 1].date !== util.formatDate(lastIC.date)) {
          sampled.push({
            date: util.formatDate(lastIC.date),
            ic: util.formatNumber(lastIC.ic, 4),
            icRaw: lastIC.ic,
            barHeight: Math.round(Math.abs(lastIC.ic) / 1 * 100),
            color: lastIC.ic >= 0 ? '#10B981' : '#EF4444'
          })
        }
        updateObj.icData = sampled
      }

      // ── Regime Heatmap ──
      if (regimeData) {
        var current = regimeData.current
        if (current) {
          var regime = current.regime || 'Unknown'
          updateObj.regimeCurrent = regime
          updateObj.regimeClass = (regime === 'Risk-On' || regime === 'Favorable') ? 'badge-buy' :
                                  (regime === 'Risk-Off' || regime === 'Cautious') ? 'badge-sell' : 'badge-gold'
          updateObj.regimeMultiplier = current.multiplier != null ? current.multiplier + 'x' : '--'
        }

        if (regimeData.heatmap) {
          var factorKeys = ['F1_DXY', 'F3_TIPS10Y', 'F4_BEI', 'F5_GPR', 'F6_GVZ', 'F8_ETFFlow', 'F9_GDXRatio']
          updateObj.heatmapFactors = factorKeys.map(function (k) { return FACTOR_SHORT[k] || k })

          updateObj.heatmapRows = regimeData.heatmap.map(function (row) {
            var month = row.month.substring(5)
            var cells = factorKeys.map(function (k) {
              var val = row.factors[k] || 0
              return {
                value: val,
                display: val.toFixed(1),
                bg: getHeatColor(val),
                textColor: Math.abs(val) > 1.5 ? '#FFFFFF' : '#D1D5DB'
              }
            })
            return { month: month, cells: cells }
          })
        }
      }

      // ── Stress Test ──
      if (stressData && stressData.periods) {
        var periods = []
        var keys = Object.keys(stressData.periods)
        keys.forEach(function (key) {
          var p = stressData.periods[key]
          if (p.status === 'insufficient_data') return
          periods.push({
            id: key,
            name: p.name,
            nameEn: p.name_en,
            start: p.start,
            end: p.end,
            description: p.description,
            samples: p.samples,
            ic: p.ic != null ? util.formatNumber(p.ic, 4) : 'N/A',
            icColor: p.ic > 0.3 ? '#10B981' : p.ic > 0 ? '#34D399' :
                     p.ic < -0.3 ? '#EF4444' : p.ic < 0 ? '#F87171' : '#9CA3AF',
            goldReturn: p.gold_return != null ? util.formatPercent(p.gold_return) : 'N/A',
            goldReturnColor: (p.gold_return || 0) >= 0 ? '#10B981' : '#EF4444',
            maxDrawdown: p.gold_max_drawdown != null ? util.formatNumber(p.gold_max_drawdown, 2) + '%' : 'N/A',
            hitRate: p.direction_hit_rate != null ? util.formatNumber(p.direction_hit_rate, 1) + '%' : 'N/A',
            breakCount: p.logic_break_count || 0,
            severity: p.max_severity || 'none',
            severityClass: p.max_severity === 'high' ? 'badge-sell' :
                           p.max_severity === 'medium' ? 'badge-gold' : 'badge-neutral',
            logicBreaks: (p.logic_breaks || []).map(function (lb) {
              return {
                detail: lb.detail,
                severityClass: lb.severity === 'high' ? 'text-red' :
                               lb.severity === 'medium' ? 'text-gold' : 'text-gray'
              }
            })
          })
        })
        updateObj.stressPeriods = periods

        if (stressData.summary) {
          updateObj.stressSummary = {
            totalBreaks: stressData.summary.total_logic_breaks || 0,
            highSeverity: stressData.summary.high_severity_periods || 0,
            avgIC: stressData.summary.avg_crisis_ic != null ?
              util.formatNumber(stressData.summary.avg_crisis_ic, 4) : 'N/A',
            assessment: stressData.summary.overall_assessment || 'N/A'
          }
        }
      }

      // ── Granger ──
      if (grangerData && grangerData.factors) {
        var gFactors = []
        var fKeys = Object.keys(grangerData.factors)
        fKeys.forEach(function (key) {
          var f = grangerData.factors[key]
          gFactors.push({
            id: key,
            name: f.display_name,
            passes: f.granger_causes_gold,
            passClass: f.granger_causes_gold ? 'badge-buy' : 'badge-sell',
            passLabel: f.granger_causes_gold ? 'PASS' : 'FAIL',
            optimalLag: f.optimal_lag_days != null ? f.optimal_lag_days + 'd' : 'N/A',
            ic: util.formatNumber(f.contemporaneous_ic, 3),
            oosIC: f.oos_ic != null ? util.formatNumber(f.oos_ic, 3) : 'N/A',
            oosICColor: f.oos_ic > 0.1 ? '#10B981' : f.oos_ic < -0.1 ? '#EF4444' : '#9CA3AF',
            verdict: f.verdict || '',
            verdictShort: (f.verdict || '').split('—')[0].trim()
          })
        })
        updateObj.grangerFactors = gFactors

        if (grangerData.summary) {
          updateObj.grangerSummary = {
            passRate: util.formatNumber(grangerData.summary.pass_rate, 0) + '%',
            pass: grangerData.summary.granger_pass,
            fail: grangerData.summary.granger_fail,
            total: grangerData.summary.total_factors,
            recommendation: grangerData.summary.recommendation || 'N/A'
          }
        }
      }

      that.setData(updateObj)
      wx.hideLoading()
    }).catch(function (err) {
      console.error('Load failed:', err)
      that.setData({ loading: false })
      wx.hideLoading()
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    })
  }
})

function getFactorDescription(id) {
  var descriptions = {
    'F1': '美元指数 — 与金价负相关',
    'F3': 'TIPS 10Y 实际利率 — 金价核心驱动',
    'F4': '通胀预期 BEI — 通胀利好黄金',
    'F5': '地缘政治风险 GPR — 经济政策不确定性',
    'F6': '黄金波动率 GVZ — 市场恐慌指标',
    'F8': 'ETF 资金流 — 投资者情绪',
    'F9': '矿业股/金价比 — 板块相对强弱',
    'F10': '实际利率-通胀利差 — 货币政策紧缩信号',
    'F11': '美元动量 20D — USD趋势加速度',
    'F12': '弱美元×高风险 — 金价最强顺风组合',
    'F13': '金价-矿业股背离 — 均值回归信号',
    'F14': '波动率动量 — 恐慌情绪变化率',
    'F15': 'ETF资金加速度 — 资金流趋势突变'
  }
  return descriptions[id] || ''
}

function getHeatColor(val) {
  if (val >= 2) return 'rgba(16, 185, 129, 0.8)'
  if (val >= 1) return 'rgba(16, 185, 129, 0.5)'
  if (val >= 0.5) return 'rgba(16, 185, 129, 0.25)'
  if (val > -0.5) return 'rgba(75, 85, 99, 0.3)'
  if (val > -1) return 'rgba(239, 68, 68, 0.25)'
  if (val > -2) return 'rgba(239, 68, 68, 0.5)'
  return 'rgba(239, 68, 68, 0.8)'
}
