var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    totalReturn: '--',
    totalReturnColor: '#9CA3AF',
    maxDrawdown: '--',
    winRate: '--',
    tradeCount: '--',
    finalEquity: '--',
    // Active position
    activePosition: null,
    // Recent trades
    trades: [],
    activeTab: 'overview',
    // Canvas ready
    canvasReady: false
  },

  // Store raw curve data for canvas drawing
  _curveData: null,

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
    var tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'equity' && this._curveData) {
      var that = this
      setTimeout(function () {
        that.drawEquityChart()
      }, 100)
    }
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

      // ── Equity Curve ──
      if (equityData && Array.isArray(equityData) && equityData.length > 0) {
        var curve = equityData
        that._curveData = curve

        var first = curve[0]
        var last = curve[curve.length - 1]
        var startEquity = first.equity
        var endEquity = last.equity
        var totalReturn = ((endEquity - startEquity) / startEquity) * 100

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
        updateObj.canvasReady = true
      }

      // ── Positions ──
      if (posData) {
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

        if (posData.recent_trades && posData.recent_trades.length > 0) {
          var winCount = 0
          updateObj.trades = posData.recent_trades.map(function (t) {
            var pnl = t.pnl || 0
            if (pnl > 0) winCount++
            return {
              date: util.formatDate(t.date),
              direction: t.direction || 'Long',
              dirClass: (t.direction || 'Long') === 'Long' ? 'badge-buy' : 'badge-sell',
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
  },

  drawEquityChart() {
    var curve = this._curveData
    if (!curve || curve.length === 0) return

    var that = this
    var query = wx.createSelectorQuery()
    query.select('#equityCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0]) return
        var canvas = res[0].node
        var width = res[0].width
        var height = res[0].height
        var ctx = canvas.getContext('2d')
        var dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        that._drawChart(ctx, width, height, curve)
      })
  },

  _drawChart(ctx, W, H, curve) {
    var PAD_L = 60, PAD_R = 16, PAD_T = 20, PAD_B = 40
    var chartW = W - PAD_L - PAD_R
    var chartH = H - PAD_T - PAD_B

    // ── Clear ──
    ctx.clearRect(0, 0, W, H)

    // ── Sample data (max ~200 points) ──
    var step = Math.max(1, Math.floor(curve.length / 200))
    var data = []
    for (var i = 0; i < curve.length; i += step) {
      data.push(curve[i])
    }
    if (data[data.length - 1] !== curve[curve.length - 1]) {
      data.push(curve[curve.length - 1])
    }

    // ── Find min/max ──
    var minEq = Infinity, maxEq = -Infinity
    var minDD = 0
    data.forEach(function (d) {
      if (d.equity < minEq) minEq = d.equity
      if (d.equity > maxEq) maxEq = d.equity
      if ((d.drawdown || 0) < minDD) minDD = d.drawdown
    })
    var eqRange = maxEq - minEq || 1
    // Add 5% padding
    minEq -= eqRange * 0.05
    maxEq += eqRange * 0.05
    eqRange = maxEq - minEq

    // ── Grid lines & Y labels ──
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)'
    ctx.lineWidth = 0.5
    ctx.fillStyle = '#6B7280'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    var gridLines = 5
    for (var g = 0; g <= gridLines; g++) {
      var yVal = minEq + (eqRange * g / gridLines)
      var yPos = PAD_T + chartH - (chartH * g / gridLines)
      ctx.beginPath()
      ctx.moveTo(PAD_L, yPos)
      ctx.lineTo(PAD_L + chartW, yPos)
      ctx.stroke()
      // Label
      var label = (yVal / 1000).toFixed(0) + 'k'
      ctx.fillText(label, PAD_L - 6, yPos + 4)
    }

    // ── X axis labels ──
    ctx.textAlign = 'center'
    ctx.fillStyle = '#6B7280'
    var xLabels = 5
    for (var xl = 0; xl <= xLabels; xl++) {
      var idx = Math.floor((data.length - 1) * xl / xLabels)
      var xPos = PAD_L + (chartW * xl / xLabels)
      var dateStr = data[idx].date.substring(2, 7) // "23-01"
      ctx.fillText(dateStr, xPos, H - PAD_B + 16)
    }

    // ── Drawdown area (bottom) ──
    if (minDD < 0) {
      var ddH = chartH * 0.2 // drawdown takes bottom 20%
      ctx.beginPath()
      for (var d = 0; d < data.length; d++) {
        var dx = PAD_L + (d / (data.length - 1)) * chartW
        var dd = data[d].drawdown || 0
        var dy = PAD_T + chartH - (Math.abs(dd) / Math.abs(minDD)) * ddH
        if (d === 0) ctx.moveTo(dx, PAD_T + chartH)
        ctx.lineTo(dx, dy)
      }
      ctx.lineTo(PAD_L + chartW, PAD_T + chartH)
      ctx.closePath()
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)'
      ctx.fill()
    }

    // ── Equity gradient fill ──
    var gradient = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH)
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)')
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)')

    ctx.beginPath()
    for (var f = 0; f < data.length; f++) {
      var fx = PAD_L + (f / (data.length - 1)) * chartW
      var fy = PAD_T + chartH - ((data[f].equity - minEq) / eqRange) * chartH
      if (f === 0) ctx.moveTo(fx, fy)
      else ctx.lineTo(fx, fy)
    }
    // Close path for fill
    ctx.lineTo(PAD_L + chartW, PAD_T + chartH)
    ctx.lineTo(PAD_L, PAD_T + chartH)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // ── Equity line ──
    ctx.beginPath()
    for (var p = 0; p < data.length; p++) {
      var px = PAD_L + (p / (data.length - 1)) * chartW
      var py = PAD_T + chartH - ((data[p].equity - minEq) / eqRange) * chartH
      if (p === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = '#10B981'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // ── Start/End markers ──
    var startY = PAD_T + chartH - ((data[0].equity - minEq) / eqRange) * chartH
    var endY = PAD_T + chartH - ((data[data.length - 1].equity - minEq) / eqRange) * chartH

    // Start dot
    ctx.beginPath()
    ctx.arc(PAD_L, startY, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#9CA3AF'
    ctx.fill()

    // End dot
    ctx.beginPath()
    ctx.arc(PAD_L + chartW, endY, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#10B981'
    ctx.fill()

    // End value label
    ctx.fillStyle = '#10B981'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'right'
    var endLabel = '$' + (data[data.length - 1].equity / 1000).toFixed(1) + 'k'
    ctx.fillText(endLabel, PAD_L + chartW - 4, endY - 8)
  }
})
