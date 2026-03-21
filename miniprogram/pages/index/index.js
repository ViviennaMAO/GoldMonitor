var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    goldPrice: null,
    priceChange: null,
    priceChangePercent: null,
    priceSource: '--',
    signal: null,
    signalLabel: '--',
    signalBadgeClass: 'badge-neutral',
    signalConfidence: 0,
    predictedReturn: '--',
    shapBars: [],
    factors: [],
    lastUpdate: '--'
  },

  onLoad() {
    this.loadAllData()
  },

  onPullDownRefresh() {
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
        updateObj.priceChangePercent = util.formatPercent(priceData.changePercent)
        updateObj.priceChangeColor = util.getChangeColor(priceData.change)
        updateObj.priceSource = priceData.source === 'stooq' ? 'Stooq' :
                                priceData.source === 'yahoo' ? 'Yahoo' : 'MOCK'
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

      // SHAP bars (top 6)
      if (shapData && shapData.bars) {
        var bars = shapData.bars.slice()
        bars.sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value) })
        updateObj.shapBars = bars.slice(0, 6).map(function (bar) {
          var absVal = Math.abs(bar.value)
          var maxVal = Math.abs(bars[0].value)
          return {
            name: bar.name || bar.factor,
            value: bar.value,
            displayValue: (bar.value >= 0 ? '+' : '') + bar.value.toFixed(4),
            isPositive: bar.value >= 0,
            barWidth: maxVal > 0 ? Math.round((absVal / maxVal) * 100) : 0,
            color: bar.value >= 0 ? '#10B981' : '#EF4444'
          }
        })
      }

      // Factor summary (mini cards)
      if (factorsData && factorsData.factors) {
        updateObj.factors = factorsData.factors.map(function (f) {
          return {
            id: f.id,
            name: f.name,
            value: util.formatNumber(f.value),
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
