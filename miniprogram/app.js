App({
  onLaunch() {
    console.log('Gold Monitor Mini Program launched')
  },
  globalData: {
    apiBase: 'https://gold-monitor-delta.vercel.app/api',
    goldPrice: null,
    signal: null,
    factors: null
  }
})
