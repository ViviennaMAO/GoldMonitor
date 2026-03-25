var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    goldPrice: null,
    priceChange: null,
    priceChangePercent: null,
    priceChangeColor: '#9CA3AF',
    priceSource: '--',
    signal: null,
    signalLabel: '--',
    signalBadgeClass: 'badge-neutral',
    signalConfidence: 0,
    predictedReturn: '--',
    signalDate: '--',
    // SHAP waterfall
    shapBars: [],
    shapBaseValue: '--',
    shapPrediction: '--',
    shapBullSum: '--',
    shapBearSum: '--',
    // Factors
    factors: [],
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

  loadAllData() {
    var that = this
    wx.showLoading({ title: '加载中...' })

    return Promise.all([
      api.fetchGoldPrice().catch(function () { return null }),
      api.fetchSignal().catch(function () { return null }),
      api.fetchShap().catch(function () { return null }),
      api.fetchFactors().catch(function () { return null })
    ]).then(function (results) {
      var priceData = results[0]
      var signalData = results[1]
      var shapData = results[2]
      var factorsData = results[3]

      var updateObj = { loading: false, lastUpdate: util.formatDateTime(new Date().toISOString()) }

      // Gold price
      if (priceData) {
        updateObj.goldPrice = util.formatPrice(priceData.price)
        updateObj.priceChange = priceData.change
        updateObj.priceChangePercent = util.formatPercent(priceData.changePercent || priceData.changePct)
        updateObj.priceChangeColor = util.getChangeColor(priceData.change)
        updateObj.priceSource = priceData.source === 'stooq' ? 'Stooq' :
                                priceData.source === 'yahoo' ? 'Yahoo' :
                                priceData.source === 'yahoo-chart' ? 'Yahoo' :
                                priceData.source === 'pipeline' ? 'Pipeline' : 'MOCK'
      }

      // Signal
      if (signalData) {
        updateObj.signal = signalData.signal
        updateObj.signalLabel = util.getSignalLabel(signalData.signal)
        updateObj.signalBadgeClass = util.getSignalBadgeClass(signalData.signal)
        updateObj.signalConfidence = signalData.confidence || 0
        updateObj.predictedReturn = util.formatPercent(signalData.predictedReturn)
        updateObj.signalDate = signalData.date || '--'
      }

      // SHAP waterfall (web-style)
      if (shapData && shapData.bars) {
        var bars = shapData.bars.slice()
        // Sort by absolute value descending
        bars.sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value) })

        var maxAbsVal = Math.abs(bars[0].value)
        var bullSum = 0
        var bearSum = 0

        var shapBars = bars.map(function (bar) {
          var isPositive = bar.value >= 0
          if (isPositive) bullSum += bar.value
          else bearSum += bar.value

          return {
            factor: bar.factor,
            label: bar.label || bar.factor,
            rawFeature: bar.raw_feature != null ? bar.raw_feature.toFixed(2) : '--',
            value: bar.value,
            displayValue: (bar.value >= 0 ? '+' : '') + (bar.value * 100 / (shapData.prediction - shapData.base_value) * 100).toFixed(0),
            displayPct: (bar.value >= 0 ? '+' : '') + (bar.value / Math.abs(shapData.prediction - shapData.base_value) * 100).toFixed(1) + '%',
            isPositive: isPositive,
            barWidth: maxAbsVal > 0 ? Math.round(Math.abs(bar.value) / maxAbsVal * 100) : 0,
            color: isPositive ? '#10B981' : '#EF4444'
          }
        })

        updateObj.shapBars = shapBars
        updateObj.shapBaseValue = util.formatPercent(shapData.base_value)
        updateObj.shapPrediction = util.formatPercent(shapData.prediction)
        updateObj.shapBullSum = '+' + (bullSum / Math.abs(shapData.prediction - shapData.base_value) * 100).toFixed(1) + '%'
        updateObj.shapBearSum = (bearSum / Math.abs(shapData.prediction - shapData.base_value) * 100).toFixed(1) + '%'
      }

      // Factor mini cards
      if (factorsData && factorsData.factors) {
        updateObj.factors = factorsData.factors.map(function (f) {
          var val = f.rawValue != null ? f.rawValue : f.value
          return {
            id: f.id,
            name: f.name,
            value: util.formatNumber(val),
            unit: f.rawUnit || '',
            zScore: f.zScore != null ? util.formatNumber(f.zScore) : '--',
            zScoreColor: f.zScore > 0.5 ? '#10B981' : f.zScore < -0.5 ? '#EF4444' : '#9CA3AF',
            signal: f.signal || 'Neutral'
          }
        })
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
