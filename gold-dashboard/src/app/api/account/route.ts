import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = {
  initial_equity: 100000,
  final_equity: 100000,
  total_return: 0,
  total_trades: 0,
  win_rate: 0,
  max_drawdown: 0,
  sharpe_ratio: 0,
}

export async function GET() {
  const data = await readPipelineJson('account.json', FALLBACK)
  return NextResponse.json(data)
}
