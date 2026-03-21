var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    totalReturn: '--',
    totalReturnColor: '#9CA3AF',
    sharpe: '--',
    maxDrawdown: '--',
    winRate: '--',
    tradeCount: '--',
    finalEquity: '--',
    equityPoints: [],
    // Active position
    activePosition: null,
    // Recent trades
    trades: [],
    activeTab: 'overview'
  },

  onLoad() {
    this.loadData()
  },

  onPullDownRefresh() {
    var that = this
    this.loadData().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  loadData() {
    var that = this
    wx.showLoading({ title: '加载回测数据...' })

    return Promise.all([
      api.fetchEquityCurve().catch(function () { return null }),
      api.fetchPositions().catch(function () { return null })
    ]).then(function (results) {
      var equityData = results[0]
      var posData = results[1]

      var updateObj = { loading: false }

      // ── Equity Curve (API returns array directly) ──
      if (equityData && Array.isArray(equityData) && equityData.length > 0) {
        var curve = equityData
        var first = curve[0]
        var last = curve[curve.length - 1]

        // Calculate stats from curve data
        var startEquity = first.equity
        var endEquity = last.equity
        var totalReturn = ((endEquity - startEquity) / startEquity) * 100

        // Find max drawdown
        var peak = startEquity
        var maxDD = 0
        curve.forEach(function (pt) {
          if (pt.equity > peak) peak = pt.equity
          var dd = ((pt.equity - peak) / peak) * 100
          if (dd < maxDD) maxDD = dd
        })

        updateObj.totalReturn = util.formatPercent(totalReturn)
        updateObj.totalReturnColor = totalReturn >= 0 ? '#10B981' : '#EF4444'
        updateObj.maxDrawdown = util.formatNumber(maxDD, 2) + '%'
        updateObj.finalEquity = '$' + util.formatNumber(endEquity, 0)

        // Sample equity points for table display
        var step = Math.max(1, Math.floor(curve.length / 20))
        var points = []
        for (var i = 0; i < curve.length; i += step) {
          points.push({
            date: util.formatDate(curve[i].date),
            equity: util.formatNumber(curve[i].equity, 0),
            drawdown: curve[i].drawdown != null ? util.formatNumber(curve[i].drawdown, 2) + '%' : '--',
            drawdownColor: (curve[i].drawdown || 0) < -2 ? '#EF4444' : '#9CA3AF'
          })
        }
        // Always include last point
        if (points[points.length - 1].date !== util.formatDate(last.date)) {
          points.push({
            date: util.formatDate(last.date),
            equity: util.formatNumber(last.equity, 0),
            drawdown: last.drawdown != null ? util.formatNumber(last.drawdown, 2) + '%' : '--',
            drawdownColor: (last.drawdown || 0) < -2 ? '#EF4444' : '#9CA3AF'
          })
        }
        updateObj.equityPoints = points
      }

      // ── Positions (API returns {active, recent_trades}) ──
      if (posData) {
        // Active position
        if (posData.active && posData.active.length > 0) {
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

        // Recent trades
        if (posData.recent_trades && posData.recent_trades.length > 0) {
          var winCount = 0
          updateObj.trades = posData.recent_trades.map(function (t) {
            var pnl = t.pnl || 0
            if (pnl > 0) winCount++
            return {
              date: util.formatDate(t.date),
              direction: t.direction || 'Long',
              dirClass: (t.direction || 'Long') === 'Long' ? 'badge-buy' : 'badge-sell',
              type: t.type || '',
              entryPrice: util.formatPrice(t.entry),
              exitPrice: util.formatPrice(t.exit),
              pnl: '$' + util.formatNumber(pnl, 2),
              pnlPercent: util.formatPercent(t.return_pct),
              pnlColor: pnl >= 0 ? '#10B981' : '#EF4444'
            }
          })

          var total = posData.recent_trades.length
          updateObj.tradeCount = total + ''
          updateObj.winRate = util.formatNumber((winCount / total) * 100, 1) + '%'
        }
      }

      that.setData(updateObj)
      wx.hideLoading()
    }).catch(function (err) {
      console.error('Load backtest failed:', err)
      that.setData({ loading: false })
      wx.hideLoading()
      wx.showToast({ title: '回测数据加载失败', icon: 'none' })
    })
  }
})
