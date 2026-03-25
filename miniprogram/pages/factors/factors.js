var api = require('../../utils/api')
var util = require('../../utils/util')

var FACTOR_SHORT = {
  'F1_DXY': 'DXY',
  'F2_FedFunds': 'Fed',
  'F2b_RateMomentum': 'FedΔ',
  'F2c_RateExpect': 'DGS2',
  'F3_TIPS10Y': 'TIPS',
  'F4_BEI': 'BEI',
  'F5_GPR': 'GPR',
  'F6_GVZ': 'GVZ',
  'F7_WGC': 'WGC',
  'F8_ETFFlow': 'ETF',
  'F9_GDXRatio': 'GDX'
}

Page({
  data: {
    loading: true,
    activeTab: 'factors',
    // Factors
    factors: [],
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
      api.fetchRegime().catch(function () { return null })
    ]).then(function (results) {
      var factorsData = results[0]
      var icData = results[1]
      var regimeData = results[2]

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
        // Check if any factor has GPR unit (pipeline fallback active)
        var hasPipeline = factorsData.factors.some(function (f) { return f.rawUnit === 'GPR' })
        if (hasPipeline && sources.indexOf('Pipeline') === -1) sources.push('Pipeline')
        updateObj.dataSource = sources.join('+') || 'API'

        updateObj.factors = factorsData.factors.map(function (f) {
          var zs = f.zScore != null ? f.zScore : 0
          var val = f.rawValue != null ? f.rawValue : f.value
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
            description: getFactorDescription(f.id)
          }
        })
      }

      // ── IC Tracking ──
      if (icData && icData.rolling_ic) {
        var icArr = icData.rolling_ic
        var sum = 0
        icArr.forEach(function (d) { sum += d.ic })
        var mean = icArr.length > 0 ? sum / icArr.length : 0
        var latest = icArr.length > 0 ? icArr[icArr.length - 1].ic : 0

        // Calculate ICIR (mean / std)
        var variance = 0
        icArr.forEach(function (d) { variance += Math.pow(d.ic - mean, 2) })
        var std = icArr.length > 1 ? Math.sqrt(variance / (icArr.length - 1)) : 1
        var icir = mean / std

        updateObj.icMean = util.formatNumber(mean, 4)
        updateObj.icir = util.formatNumber(icir, 2)
        updateObj.icLatest = util.formatNumber(latest, 4)
        updateObj.icLatestColor = latest > 0.3 ? '#10B981' : latest > 0 ? '#34D399' :
                                  latest < -0.3 ? '#EF4444' : '#F87171'

        // Sample IC data for display (every 3rd point)
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
        // Always include last
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
          updateObj.regimeClass = regime === 'Risk-On' ? 'badge-buy' :
                                  regime === 'Risk-Off' ? 'badge-sell' : 'badge-gold'
          updateObj.regimeMultiplier = current.multiplier != null ? current.multiplier + 'x' : '--'
        }

        if (regimeData.heatmap) {
          var factorKeys = ['F1_DXY', 'F2_FedFunds', 'F2b_RateMomentum', 'F2c_RateExpect', 'F3_TIPS10Y', 'F4_BEI', 'F5_GPR', 'F6_GVZ', 'F7_WGC', 'F8_ETFFlow', 'F9_GDXRatio']
          updateObj.heatmapFactors = factorKeys.map(function (k) { return FACTOR_SHORT[k] || k })

          updateObj.heatmapRows = regimeData.heatmap.map(function (row) {
            var month = row.month.substring(5) // "2026-03" → "03"
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
    'F2': '联邦基金利率 — 加息利空黄金',
    'F2b': '利率动量 — 60日变化方向',
    'F2c': '利率预期 — 2年期国债收益率',
    'F3': 'TIPS 10Y 实际利率 — 金价核心驱动',
    'F4': '通胀预期 BEI — 通胀利好黄金',
    'F5': '地缘政治风险 GPR — 经济政策不确定性',
    'F6': '黄金波动率 GVZ — 市场恐慌指标',
    'F7': '央行购金需求 — 实物需求支撑',
    'F8': 'ETF 资金流 — 投资者情绪',
    'F9': '矿业股/金价比 — 板块相对强弱'
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
