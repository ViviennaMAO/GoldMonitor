var api = require('../../utils/api')
var util = require('../../utils/util')

Page({
  data: {
    loading: true,
    factors: [],
    dataSource: '',
    lastUpdate: '--'
  },

  onLoad() {
    this.loadFactors()
  },

  onPullDownRefresh() {
    var that = this
    this.loadFactors().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadFactors() {
    var that = this
    wx.showLoading({ title: '加载因子数据...' })

    return api.fetchFactors().then(function (data) {
      if (data && data.factors) {
        var factors = data.factors.map(function (f) {
          var zs = f.zScore != null ? f.zScore : 0
          var val = f.rawValue != null ? f.rawValue : f.value
          return {
            id: f.id,
            name: f.name,
            displayName: f.displayName || f.name,
            value: util.formatNumber(val, 2),
            unit: f.rawUnit || '',
            rawValue: val,
            zScore: util.formatNumber(zs),
            zScoreColor: zs > 1 ? '#10B981' : zs > 0.5 ? '#34D399' :
                         zs < -1 ? '#EF4444' : zs < -0.5 ? '#F87171' : '#9CA3AF',
            zScoreWidth: Math.min(Math.abs(zs) / 3 * 100, 100),
            zScoreDir: zs >= 0 ? 'positive' : 'negative',
            signal: f.signal || 'Neutral',
            signalClass: (f.signal || '').toLowerCase().indexOf('bull') !== -1 ? 'badge-buy' :
                         (f.signal || '').toLowerCase().indexOf('bear') !== -1 ? 'badge-sell' : 'badge-neutral',
            percentile: f.percentile != null ? Math.round(f.percentile) : null,
            description: getFactorDescription(f.id)
          }
        })

        var sources = []
        if (data.dataSource) {
          if (data.dataSource.fred) sources.push('FRED')
          if (data.dataSource.yahoo) sources.push('Yahoo')
          if (data.dataSource.stooq) sources.push('Stooq')
        }

        that.setData({
          loading: false,
          factors: factors,
          dataSource: sources.join(' + ') || 'API',
          lastUpdate: util.formatDateTime(new Date().toISOString())
        })
      }
      wx.hideLoading()
    }).catch(function (err) {
      console.error('Load factors failed:', err)
      that.setData({ loading: false })
      wx.hideLoading()
      wx.showToast({ title: '因子数据加载失败', icon: 'none' })
    })
  }
})

function getFactorDescription(id) {
  var descriptions = {
    'F1': '美元指数 — 与金价负相关',
    'F2': '联邦基金利率 — 加息利空黄金',
    'F3': 'TIPS 10Y 实际利率 — 金价核心驱动',
    'F4': '通胀预期 BEI — 通胀利好黄金',
    'F5': '原油波动率 OVX — 风险情绪指标',
    'F6': '黄金波动率 GVZ — 市场恐慌指标',
    'F7': '央行购金需求 — 实物需求支撑',
    'F8': 'ETF 资金流 — 投资者情绪',
    'F9': '矿业股/金价比 — 板块相对强弱'
  }
  return descriptions[id] || ''
}
