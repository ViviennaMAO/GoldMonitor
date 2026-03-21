var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    // Account stats
    initialEquity: '--',
    finalEquity: '--',
    totalReturn: '--',
    totalReturnColor: '#9CA3AF',
    totalTrades: '--',
    winRate: '--',
    winners: '--',
    losers: '--',
    maxDrawdown: '--',
    sharpe: '--',
    avgWin: '--',
    avgLoss: '--',
    // Regime
    regimeStatus: '--',
    regimeClass: 'badge-neutral',
    riskMultiplier: '--',
    // Active position
    activePosition: null,
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
      api.request('/account').catch(function () { return null }),
      api.request('/signal').catch(function () { return null }),
      api.fetchPositions().catch(function () { return null }),
      api.fetchRegime().catch(function () { return null })
    ]).then(function (results) {
      var accountData = results[0]
      var signalData = results[1]
      var posData = results[2]
      var regimeData = results[3]

      var updateObj = { loading: false }

      // ── Account stats from /api/account ──
      if (accountData) {
        updateObj.initialEquity = '$' + util.formatNumber(accountData.initial_equity, 0)
        updateObj.finalEquity = '$' + util.formatNumber(accountData.final_equity, 0)
        updateObj.totalReturn = util.formatPercent(accountData.total_return)
        updateObj.totalReturnColor = (accountData.total_return || 0) >= 0 ? '#10B981' : '#EF4444'
        updateObj.totalTrades = accountData.total_trades || 0
        updateObj.winRate = util.formatNumber(accountData.win_rate, 1) + '%'
        updateObj.winners = accountData.winners || 0
        updateObj.losers = accountData.losers || 0
        updateObj.maxDrawdown = util.formatNumber(accountData.max_drawdown, 2) + '%'
        updateObj.sharpe = util.formatNumber(accountData.sharpe_ratio, 4)
        updateObj.avgWin = '$' + util.formatNumber(accountData.avg_win, 2)
        updateObj.avgLoss = '$' + util.formatNumber(accountData.avg_loss, 2)
      }

      // ── Regime from /api/signal ──
      if (signalData) {
        var regime = signalData.regime || 'Unknown'
        updateObj.regimeStatus = regime === 'Risk-On' ? '风险偏好' :
                                  regime === 'Risk-Off' ? '风险规避' :
                                  regime === 'Transition' ? '过渡期' : regime
        updateObj.regimeClass = regime === 'Risk-On' ? 'badge-buy' :
                                regime === 'Risk-Off' ? 'badge-sell' : 'badge-gold'
        updateObj.riskMultiplier = signalData.regime_multiplier != null ?
          signalData.regime_multiplier + 'x' : '--'
      }

      // ── Active position from /api/positions ──
      if (posData && posData.active && posData.active.length > 0) {
        var ap = posData.active[0]
        updateObj.activePosition = {
          symbol: ap.symbol || 'XAUUSD',
          direction: ap.direction || 'Long',
          dirClass: (ap.direction || 'Long') === 'Long' ? 'badge-buy' : 'badge-sell',
          size: util.formatNumber(ap.size, 2),
          entryPrice: util.formatPrice(ap.entry_price),
          currentPrice: util.formatPrice(ap.current_price),
          stopLoss: util.formatPrice(ap.stop_loss),
          pnl: '$' + util.formatNumber(ap.unrealized_pnl, 2),
          pnlPercent: util.formatPercent(ap.return_pct),
          pnlColor: (ap.unrealized_pnl || 0) >= 0 ? '#10B981' : '#EF4444'
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
