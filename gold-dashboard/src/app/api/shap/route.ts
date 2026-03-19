import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = { base_value: 0, prediction: 0, bars: [] }

export async function GET() {
  const data = await readPipelineJson('shap_values.json', FALLBACK)
  return NextResponse.json(data)
}
