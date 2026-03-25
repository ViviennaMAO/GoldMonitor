import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = {
  status: 'unknown',
  warnings: [],
  n_factors: 7,
  oos_ic: 0,
  recent_60d_ic: 0,
  high_corr_pairs: 0,
}

export async function GET() {
  const data = await readPipelineJson('model_health.json', FALLBACK)
  return NextResponse.json(data)
}
