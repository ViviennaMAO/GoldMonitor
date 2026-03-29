var api = require('../../utils/api')
var util = require('../../utils/util')

var FACTOR_SHORT = {
  'F1_DXY': 'DXY',
  'F4_BEI': 'BEI',
  'F5_GPR': 'GPR',
  'F6_GVZ': 'GVZ',
  'F9_GDXMomentum': 'GDXm',
  'F10_TIPSBEISpread': 'T-B',
  'F11_DXYMomentum': 'DXYm',
  'F12_DXYDownGPRUp': 'D×G',
  'F13_GoldGDXDivergence': 'G-M',
  'F14_GVZMomentum': 'GVZm'
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
    // Regime v2 (3-layer)
    regimeName: '--',
    regimeClass: 'badge-neutral',
    regimeMultiplier: '--',
    regimeConfidence: 0,
    // L1
    l1Quadrant: '--',
    l1Growth: '--',
    l1Inflation: '--',
    l1Fed: '--',
    l1Multiplier: '--',
    // L2
    l2HMM: '--',
    l2HMMConfidence: '--',
    l2Liquidity: '--',
    l2MarketRegime: '--',
    l2AdjFactor: '--',
    // L3
    l3DollarType: '--',
    l3OverlayDelta: '--',
    l3RateShock: false,
    l3Changepoint: false,
    // Heatmap
    heatmapRows: [],
    heatmapFactors: [],
    // Correlation
    corrMatrix: [],
    corrFactorNames: [],
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
      api.fetchCorrelation().catch(function () { return null }),
      api.fetchGranger().catch(function () { return null })
    ]).then(function (results) {
      var factorsData = results[0]
      var icData = results[1]
      var regimeData = results[2]
      var corrData = results[3]
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

      // ── Regime v2 (3-layer) ──
      if (regimeData && regimeData.current) {
        var cur = regimeData.current
        var regime = cur.regime || 'Unknown'
        updateObj.regimeName = regime
        updateObj.regimeMultiplier = cur.multiplier != null ? cur.multiplier.toFixed(3) + 'x' : '--'
        updateObj.regimeConfidence = cur.confidence != null ? Math.round(cur.confidence * 100) : 0

        // Classify regime for badge color
        var rLower = regime.toLowerCase()
        if (rLower.indexOf('risk-on') !== -1 || rLower.indexOf('favorable') !== -1 || rLower.indexOf('扩张') !== -1) {
          updateObj.regimeClass = 'badge-buy'
        } else if (rLower.indexOf('risk-off') !== -1 || rLower.indexOf('cautious') !== -1 || rLower.indexOf('熊') !== -1 || rLower.indexOf('滞胀') !== -1 || rLower.indexOf('防御') !== -1) {
          updateObj.regimeClass = 'badge-sell'
        } else {
          updateObj.regimeClass = 'badge-gold'
        }

        // L1 · 宏观四象限
        if (cur.layer1) {
          var l1 = cur.layer1
          updateObj.l1Quadrant = l1.quadrant_zh || l1.quadrant || '--'
          updateObj.l1Growth = l1.growth_direction === 'up' ? '↑ 扩张' : '↓ 收缩'
          updateObj.l1Inflation = l1.inflation_direction === 'up' ? '↑ 上行' : '↓ 下行'
          updateObj.l1Fed = l1.fed_cycle_zh || l1.fed_cycle || '--'
          updateObj.l1Multiplier = l1.multiplier != null ? l1.multiplier.toFixed(2) + 'x' : '--'
        }

        // L2 · 市场结构
        if (cur.layer2) {
          var l2 = cur.layer2
          updateObj.l2HMM = (l2.hmm_label_zh || l2.hmm_label || '--') +
            (l2.hmm_confidence != null ? ' ' + Math.round(l2.hmm_confidence * 100) + '%' : '')
          updateObj.l2HMMConfidence = l2.hmm_confidence != null ? Math.round(l2.hmm_confidence * 100) : 0
          updateObj.l2Liquidity = l2.market_regime_zh || l2.market_regime || '--'
          updateObj.l2MarketRegime = l2.market_regime_zh || '--'
          updateObj.l2AdjFactor = l2.adj_factor != null ? l2.adj_factor.toFixed(3) + 'x' : '--'
        }

        // L3 · 事件叠加
        if (cur.layer3) {
          var l3 = cur.layer3
          updateObj.l3DollarType = l3.dollar_type_zh || l3.dollar_type || '--'
          updateObj.l3OverlayDelta = l3.overlay_delta != null ?
            (l3.overlay_delta >= 0 ? '+' : '') + l3.overlay_delta.toFixed(2) : '--'
          updateObj.l3RateShock = l3.rate_shock_detected || false
          updateObj.l3Changepoint = l3.changepoint_detected || false
        }

        // Heatmap (now with all 13 factors)
        if (regimeData.heatmap) {
          var allFactorKeys = Object.keys(FACTOR_SHORT)
          // Only include keys that exist in heatmap data
          var firstRow = regimeData.heatmap[0]
          var factorKeys = allFactorKeys.filter(function (k) {
            return firstRow && firstRow.factors && firstRow.factors[k] !== undefined
          })
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

      // ── Correlation Matrix ──
      if (corrData && corrData.matrix && corrData.factors) {
        var fNames = corrData.factors.map(function (f) { return FACTOR_SHORT[f] || f })
        updateObj.corrFactorNames = fNames

        // Build NxN grid
        var n = corrData.factors.length
        var grid = []
        for (var r = 0; r < n; r++) {
          grid.push([])
          for (var c = 0; c < n; c++) {
            grid[r].push(0)
          }
        }
        corrData.matrix.forEach(function (cell) {
          var ri = corrData.factors.indexOf(cell.x)
          var ci = corrData.factors.indexOf(cell.y)
          if (ri >= 0 && ci >= 0) {
            grid[ri][ci] = cell.value
          }
        })

        var corrRows = []
        for (var row = 0; row < n; row++) {
          var cells = []
          for (var col = 0; col < n; col++) {
            var v = grid[row][col]
            cells.push({
              value: v,
              display: row === col ? '1.0' : v.toFixed(1),
              bg: getCorrColor(v),
              textColor: Math.abs(v) > 0.5 ? '#FFFFFF' : '#D1D5DB',
              isDiag: row === col
            })
          }
          corrRows.push({
            name: fNames[row],
            cells: cells
          })
        }
        updateObj.corrMatrix = corrRows
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
    'F4': '通胀预期 BEI — 通胀利好黄金',
    'F5': '地缘政治风险 GPR — 经济政策不确定性',
    'F6': '黄金波动率 GVZ — 市场恐慌指标 (观察中)',
    'F9': '矿业股动量 — GDX/金价比20日变化率',
    'F10': '实际利率-通胀利差 — 替代F3, IC最高(0.73)',
    'F11': '美元动量 20D — USD趋势加速度',
    'F12': '弱美元×高风险 — 金价最强顺风组合',
    'F13': '金价-矿业股背离 — 均值回归信号',
    'F14': '波动率动量 — 恐慌情绪变化率'
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

function getCorrColor(val) {
  var abs = Math.abs(val)
  if (val >= 0.7) return 'rgba(16, 185, 129, 0.85)'
  if (val >= 0.5) return 'rgba(16, 185, 129, 0.6)'
  if (val >= 0.3) return 'rgba(16, 185, 129, 0.35)'
  if (val > -0.3) return 'rgba(75, 85, 99, 0.25)'
  if (val > -0.5) return 'rgba(239, 68, 68, 0.35)'
  if (val > -0.7) return 'rgba(239, 68, 68, 0.6)'
  return 'rgba(239, 68, 68, 0.85)'
}
