import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK: unknown[] = []

export async function GET() {
  const data = await readPipelineJson('equity_curve.json', FALLBACK)
  return NextResponse.json(data)
}
