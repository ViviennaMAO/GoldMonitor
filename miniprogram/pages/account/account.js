var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    // Account stats
    balance: '--',
    equity: '--',
    margin: '--',
    freeMargin: '--',
    marginLevel: '--',
    todayPnl: '--',
    todayPnlColor: '#9CA3AF',
    weekPnl: '--',
    weekPnlColor: '#9CA3AF',
    // Regime
    regimeStatus: '--',
    regimeClass: 'badge-neutral',
    riskMultiplier: '--',
    // Open positions count
    openCount: 0,
    // App info
    version: '1.0.0',
    apiBase: ''
  },

  onLoad() {
    var app = getApp()
    this.setData({ apiBase: app.globalData.apiBase })
    this.loadData()
  },

  onPullDownRefresh() {
    var that = this
    this.loadData().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    var that = this
    wx.showLoading({ title: '加载账户数据...' })

    return Promise.all([
      api.request('/signal').catch(function () { return null }),
      api.fetchPositions().catch(function () { return null }),
      api.fetchRegime().catch(function () { return null })
    ]).then(function (results) {
      var signalData = results[0]
      var posData = results[1]
      var regimeData = results[2]

      var updateObj = { loading: false }

      // Account from signal endpoint (contains account info)
      if (signalData && signalData.account) {
        var a = signalData.account
        updateObj.balance = '$' + util.formatNumber(a.balance, 2)
        updateObj.equity = '$' + util.formatNumber(a.equity, 2)
        updateObj.margin = '$' + util.formatNumber(a.margin, 2)
        updateObj.freeMargin = '$' + util.formatNumber(a.freeMargin, 2)
        updateObj.marginLevel = a.marginLevel ? util.formatNumber(a.marginLevel, 0) + '%' : '--'
        updateObj.todayPnl = util.formatPercent(a.todayPnl)
        updateObj.todayPnlColor = (a.todayPnl || 0) >= 0 ? '#10B981' : '#EF4444'
        updateObj.weekPnl = util.formatPercent(a.weekPnl)
        updateObj.weekPnlColor = (a.weekPnl || 0) >= 0 ? '#10B981' : '#EF4444'
      }

      // Open positions count
      if (posData && posData.positions) {
        var openCount = posData.positions.filter(function (p) { return !p.exitDate }).length
        updateObj.openCount = openCount
      }

      // Regime
      if (regimeData) {
        var regime = regimeData.current || regimeData.regime
        if (regime) {
          var status = regime.status || regime
          updateObj.regimeStatus = status === 'healthy' ? '健康' :
                                   status === 'caution' ? '警戒' :
                                   status === 'circuit_break' ? '熔断' : status
          updateObj.regimeClass = status === 'healthy' ? 'badge-buy' :
                                  status === 'caution' ? 'badge-gold' : 'badge-sell'
          updateObj.riskMultiplier = regime.multiplier != null ?
            regime.multiplier + '×' : '1.0×'
        }
      }

      that.setData(updateObj)
      wx.hideLoading()
    }).catch(function (err) {
      console.error('Load account failed:', err)
      that.setData({ loading: false })
      wx.hideLoading()
      wx.showToast({ title: '账户数据加载失败', icon: 'none' })
    })
  },

  onRefreshTap() {
    this.loadData()
  },

  onCopyApi() {
    wx.setClipboardData({
      data: this.data.apiBase,
      success: function () {
        wx.showToast({ title: 'API 地址已复制', icon: 'success' })
      }
    })
  }
})
