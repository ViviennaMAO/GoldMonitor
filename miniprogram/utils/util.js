/**
 * Formatting utilities for Gold Monitor miniprogram.
 */

function formatPrice(price) {
  if (!price && price !== 0) return '--'
  return Number(price).toFixed(2)
}

function formatPercent(value) {
  if (!value && value !== 0) return '--'
  var sign = value >= 0 ? '+' : ''
  return sign + Number(value).toFixed(2) + '%'
}

function formatNumber(value, decimals) {
  if (!value && value !== 0) return '--'
  decimals = decimals !== undefined ? decimals : 2
  return Number(value).toFixed(decimals)
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  var d = new Date(dateStr)
  var month = (d.getMonth() + 1).toString().padStart(2, '0')
  var day = d.getDate().toString().padStart(2, '0')
  return month + '-' + day
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--'
  var d = new Date(dateStr)
  var year = d.getFullYear()
  var month = (d.getMonth() + 1).toString().padStart(2, '0')
  var day = d.getDate().toString().padStart(2, '0')
  var hour = d.getHours().toString().padStart(2, '0')
  var min = d.getMinutes().toString().padStart(2, '0')
  return year + '-' + month + '-' + day + ' ' + hour + ':' + min
}

function getSignalColor(signal) {
  if (!signal) return '#9CA3AF'
  var s = signal.toLowerCase()
  if (s.indexOf('buy') !== -1) return '#10B981'
  if (s.indexOf('sell') !== -1) return '#EF4444'
  return '#9CA3AF'
}

function getSignalBadgeClass(signal) {
  if (!signal) return 'badge-neutral'
  var s = signal.toLowerCase()
  if (s.indexOf('buy') !== -1) return 'badge-buy'
  if (s.indexOf('sell') !== -1) return 'badge-sell'
  return 'badge-neutral'
}

function getSignalLabel(signal) {
  var labels = {
    'Strong Buy': '强烈买入',
    'Buy': '买入',
    'Hold': '持有',
    'Neutral': '中性',
    'Sell': '卖出',
    'Strong Sell': '强烈卖出'
  }
  return labels[signal] || signal || '--'
}

function getChangeColor(value) {
  if (value > 0) return '#10B981'
  if (value < 0) return '#EF4444'
  return '#9CA3AF'
}

module.exports = {
  formatPrice: formatPrice,
  formatPercent: formatPercent,
  formatNumber: formatNumber,
  formatDate: formatDate,
  formatDateTime: formatDateTime,
  getSignalColor: getSignalColor,
  getSignalBadgeClass: getSignalBadgeClass,
  getSignalLabel: getSignalLabel,
  getChangeColor: getChangeColor
}
