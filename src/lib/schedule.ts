const COUPLES: [number, number][] = [[1, 2], [3, 4], [6, 7]]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function buildPool(mealCount: number, existingPool: number[] = []): number[] {
  if (mealCount === 0) return []
  const total = 2 * mealCount
  const base = Math.floor(total / 7)
  const extras = total % 7

  if (extras === 0) {
    const pool: number[] = []
    for (let pid = 1; pid <= 7; pid++)
      for (let j = 0; j < base; j++) pool.push(pid)
    return pool
  }

  let extraPeople: number[]
  if (existingPool.length === 0) {
    extraPeople = shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, extras)
  } else {
    const counts: Record<number, number> = {}
    for (let pid = 1; pid <= 7; pid++) counts[pid] = 0
    for (const pid of existingPool) counts[pid]++
    extraPeople = Object.entries(counts)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .slice(0, extras)
      .map(([pid]) => Number(pid))
  }

  const pool: number[] = []
  for (let pid = 1; pid <= 7; pid++) {
    const count = base + (extraPeople.includes(pid) ? 1 : 0)
    for (let j = 0; j < count; j++) pool.push(pid)
  }
  return pool
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`
}

function hasDuplicatePairs(newPairs: number[][], priorPairs: number[][]): boolean {
  const seen = new Set<string>()
  for (const pair of priorPairs) {
    if (pair.length >= 2) seen.add(pairKey(pair[0], pair[1]))
  }
  for (const pair of newPairs) {
    if (pair.length < 2) continue
    const key = pairKey(pair[0], pair[1])
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function hasCouplePair(pairs: number[][]): boolean {
  for (const pair of pairs) {
    if (pair.length < 2) continue
    if (pair[0] === pair[1]) return true
    for (const couple of COUPLES) {
      if (couple.includes(pair[0]) && couple.includes(pair[1])) return true
    }
  }
  return false
}

function hasSameDayDouble(
  bDays: number[], bPairs: number[][],
  dDays: number[], dPairs: number[][]
): boolean {
  const bByDay: Record<number, number[]> = {}
  bDays.forEach((day, i) => { bByDay[day] = bPairs[i] ?? [] })
  for (let i = 0; i < dDays.length; i++) {
    const dPair = dPairs[i] ?? []
    const bPair = bByDay[dDays[i]] ?? []
    if (dPair.some(p => bPair.includes(p))) return true
  }
  return false
}

function drawPairs(
  pool: number[],
  existingDays: number[] = [],
  existingPairs: number[][] = [],
  proposedDays: number[] = []
): number[][] {
  const checkSameDay = existingDays.length > 0 && proposedDays.length > 0 && existingPairs.length > 0
  for (let i = 0; i < 1000; i++) {
    const pairs = chunk(shuffle(pool), 2)
    if (!hasCouplePair(pairs) && !hasDuplicatePairs(pairs, existingPairs)) {
      if (!checkSameDay || !hasSameDayDouble(existingDays, existingPairs, proposedDays, pairs))
        return pairs
    }
  }
  for (let i = 0; i < 1000; i++) {
    const pairs = chunk(shuffle(pool), 2)
    if (!hasCouplePair(pairs) && !hasDuplicatePairs(pairs, existingPairs)) return pairs
  }
  throw new Error('Schedule generation failed after 2000 attempts')
}

function isBalanced(breakfast: number[][], dinner: number[][]): boolean {
  const counts: Record<number, number> = {}
  for (let pid = 1; pid <= 7; pid++) counts[pid] = 0
  for (const pair of [...breakfast, ...dinner]) for (const pid of pair) counts[pid]++
  const vals = Object.values(counts)
  return Math.max(...vals) - Math.min(...vals) <= 1
}

export interface ScheduleResult {
  bDays: number[]
  dDays: number[]
  breakfast: number[][]
  dinner: number[][]
}

export function generateSchedule(skippedSlots: string[]): ScheduleResult {
  const bDays = [1, 2, 3, 4, 5, 6, 7].filter(d => !skippedSlots.includes(`${d}-breakfast`))
  const dDays = [1, 2, 3, 4, 5, 6, 7].filter(d => !skippedSlots.includes(`${d}-dinner`))

  let bPool = buildPool(bDays.length)
  let dPool = buildPool(dDays.length, bPool)
  let breakfast: number[][] = []
  let dinner: number[][] = []

  for (let attempt = 0; attempt < 3; attempt++) {
    breakfast = bPool.length > 0 ? drawPairs(bPool) : []
    dinner = dPool.length > 0 ? drawPairs(dPool, bDays, breakfast, dDays) : []
    if (isBalanced(breakfast, dinner)) break
    bPool = buildPool(bDays.length)
    dPool = buildPool(dDays.length, bPool)
  }

  return { bDays, dDays, breakfast, dinner }
}
