import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'

const FALLBACK = {
  date: new Date().toISOString().slice(0, 10),
  signal: 'Neutral',
  predicted_return: 0,
  confidence: 0,
  gold_price: 0,
  atr: 0,
  stop_loss: 0,
  take_profit: 0,
  position_size: 0,
  regime: 'Transition',
  regime_multiplier: 0.5,
  factors: [],
}

export async function GET() {
  const data = await readPipelineJson('signal.json', FALLBACK)
  return NextResponse.json(data)
}
