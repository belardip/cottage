import { db } from '@/lib/db'
import { DisplayClient } from './DisplayClient'

export const dynamic = 'force-dynamic'

export default async function DisplayPage() {
  const [setting, meals, cookSlots, people, lunchRecipes] = await Promise.all([
    db.setting.findFirst(),
    db.meal.findMany({ orderBy: [{ day: 'asc' }, { type: 'asc' }] }),
    db.cookSlot.findMany({ include: { person: true } }),
    db.person.findMany({ orderBy: { id: 'asc' } }),
    db.lunchRecipe.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  const tripStartDate = setting?.tripStartDate ?? null
  let todayDayNum: number | null = null
  let todayDateStr: string | null = null

  if (tripStartDate) {
    // Trip start is stored as UTC midnight — use UTC date components so TZ offset doesn't shift it
    const startUtc = Date.UTC(tripStartDate.getUTCFullYear(), tripStartDate.getUTCMonth(), tripStartDate.getUTCDate())
    // Today uses local (Eastern) date components — what day the user actually sees
    const now = new Date()
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((todayUtc - startUtc) / (1000 * 60 * 60 * 24))
    todayDayNum = diffDays + 1
    todayDateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const isValidDay = todayDayNum !== null && todayDayNum >= 1 && todayDayNum <= 8

  const todayDinner = isValidDay
    ? (meals.find(m => m.day === todayDayNum && m.type === 'dinner') ?? null)
    : null

  const dinnerChefs = isValidDay
    ? cookSlots.filter(s => s.day === todayDayNum && s.type === 'dinner').map(s => s.person.name)
    : []

  const parsedLunchRecipes = lunchRecipes.map(r => {
    let ids: number[] = []
    try { ids = JSON.parse(r.peopleIds) } catch {}
    return {
      id: r.id,
      name: r.name ?? 'Untitled',
      participants: ids.map(id => people.find(p => p.id === id)?.name ?? '').filter(Boolean) as string[],
    }
  })

  return (
    <DisplayClient
      todayDayNum={todayDayNum}
      todayDateStr={todayDateStr}
      isValidDay={isValidDay}
      dinner={todayDinner ? { name: todayDinner.name, chefs: dinnerChefs } : null}
      lunchRecipes={parsedLunchRecipes}
    />
  )
}
