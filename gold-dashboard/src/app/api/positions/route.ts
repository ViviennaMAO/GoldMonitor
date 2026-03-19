import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = { active: [], recent_trades: [] }

export async function GET() {
  const data = await readPipelineJson('positions.json', FALLBACK)
  return NextResponse.json(data)
}
