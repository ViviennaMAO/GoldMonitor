import { readFile } from 'fs/promises'
import path from 'path'

const PIPELINE_OUTPUT = path.join(process.cwd(), 'pipeline', 'output')

export async function readPipelineJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(PIPELINE_OUTPUT, filename)
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
