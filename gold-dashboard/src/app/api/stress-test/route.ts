import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = {
  periods: {},
  summary: {
    total_periods_tested: 0,
    total_logic_breaks: 0,
    overall_assessment: 'No stress test data available',
  },
}

export async function GET() {
  const data = await readPipelineJson('stress_test.json', FALLBACK)
  return NextResponse.json(data)
}
