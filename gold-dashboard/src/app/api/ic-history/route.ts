import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = { rolling_ic: [], factor_ic: [], cv_mean_ic: 0 }

export async function GET() {
  const data = await readPipelineJson('ic_history.json', FALLBACK)
  return NextResponse.json(data)
}
