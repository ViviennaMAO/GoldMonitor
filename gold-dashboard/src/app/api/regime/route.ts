import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = { current: { regime: 'Transition', multiplier: 0.5 }, heatmap: [] }

export async function GET() {
  const data = await readPipelineJson('regime.json', FALLBACK)
  return NextResponse.json(data)
}
