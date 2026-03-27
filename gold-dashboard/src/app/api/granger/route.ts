import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = {
  factors: {},
  regime_ic: {},
  summary: {
    granger_pass: 0,
    granger_fail: 0,
    total_factors: 0,
    pass_rate: 0,
    recommendation: 'No Granger analysis data available',
  },
}

export async function GET() {
  const data = await readPipelineJson('granger_test.json', FALLBACK)
  return NextResponse.json(data)
}
