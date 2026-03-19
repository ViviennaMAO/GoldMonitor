import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = { factors: [], matrix: [] }

export async function GET() {
  const data = await readPipelineJson('correlation.json', FALLBACK)
  return NextResponse.json(data)
}
