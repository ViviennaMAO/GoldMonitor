/**
 * API utility for Gold Monitor miniprogram.
 * All data fetched from Vercel-deployed Next.js backend.
 */
const app = getApp()

function request(path) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + path,
      method: 'GET',
      dataType: 'json',
      timeout: 15000,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error('HTTP ' + res.statusCode))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function fetchGoldPrice() {
  return request('/gold-price')
}

function fetchSignal() {
  return request('/signal')
}

function fetchFactors() {
  return request('/factors')
}

function fetchShap() {
  return request('/shap')
}

function fetchRegime() {
  return request('/regime')
}

function fetchPositions() {
  return request('/positions')
}

function fetchEquityCurve() {
  return request('/equity-curve')
}

function fetchICHistory() {
  return request('/ic-history')
}

function fetchStressTest() {
  return request('/stress-test')
}

function fetchGranger() {
  return request('/granger')
}

function fetchModelHealth() {
  return request('/model-health')
}

module.exports = {
  request,
  fetchGoldPrice,
  fetchSignal,
  fetchFactors,
  fetchShap,
  fetchRegime,
  fetchPositions,
  fetchEquityCurve,
  fetchICHistory,
  fetchStressTest,
  fetchGranger,
  fetchModelHealth
}
