var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    // Equity curve summary
    totalReturn: '--',
    totalReturnColor: '#9CA3AF',
    sharpe: '--',
    maxDrawdown: '--',
    winRate: '--',
    tradeCount: '--',
    finalEquity: '--',
    // Recent equity points (for simple text display)
    equityPoints: [],
    // Positions
    positions: [],
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

      // Equity curve
      if (equityData) {
        if (equityData.stats) {
          var s = equityData.stats
          updateObj.totalReturn = util.formatPercent(s.totalReturn)
          updateObj.totalReturnColor = s.totalReturn >= 0 ? '#10B981' : '#EF4444'
          updateObj.sharpe = util.formatNumber(s.sharpe, 4)
          updateObj.maxDrawdown = util.formatPercent(s.maxDrawdown)
          updateObj.winRate = util.formatPercent(s.winRate)
          updateObj.tradeCount = s.trades || '--'
          updateObj.finalEquity = s.finalEquity ? '$' + util.formatNumber(s.finalEquity, 0) : '--'
        }

        if (equityData.curve && equityData.curve.length > 0) {
          // Show last 20 data points as a list
          var curve = equityData.curve
          var step = Math.max(1, Math.floor(curve.length / 20))
          var points = []
          for (var i = 0; i < curve.length; i += step) {
            points.push({
              date: util.formatDate(curve[i].date),
              equity: util.formatNumber(curve[i].equity, 0),
              drawdown: curve[i].drawdown != null ? util.formatPercent(curve[i].drawdown) : '--',
              drawdownColor: (curve[i].drawdown || 0) < -2 ? '#EF4444' : '#9CA3AF'
            })
          }
          // Always include last point
          var last = curve[curve.length - 1]
          if (points[points.length - 1].date !== util.formatDate(last.date)) {
            points.push({
              date: util.formatDate(last.date),
              equity: util.formatNumber(last.equity, 0),
              drawdown: last.drawdown != null ? util.formatPercent(last.drawdown) : '--',
              drawdownColor: (last.drawdown || 0) < -2 ? '#EF4444' : '#9CA3AF'
            })
          }
          updateObj.equityPoints = points
        }
      }

      // Positions
      if (posData && posData.positions) {
        updateObj.positions = posData.positions.map(function (p) {
          var pnl = p.pnl || 0
          return {
            id: p.id || p.entryDate,
            direction: p.direction || 'Long',
            dirClass: (p.direction || 'Long') === 'Long' ? 'badge-buy' : 'badge-sell',
            entryDate: util.formatDate(p.entryDate),
            exitDate: p.exitDate ? util.formatDate(p.exitDate) : '持仓中',
            entryPrice: util.formatPrice(p.entryPrice),
            exitPrice: p.exitPrice ? util.formatPrice(p.exitPrice) : '--',
            pnl: util.formatPercent(pnl),
            pnlColor: pnl >= 0 ? '#10B981' : '#EF4444',
            lots: p.lots || p.size || 1,
            status: p.exitDate ? 'closed' : 'open'
          }
        }).slice(0, 30) // Show last 30 trades
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
