import { db } from '@/lib/db'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { LunchSection } from '@/components/schedule/LunchSection'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const [setting, meals, cookSlots, people, lunchRecipes, generatedCount] = await Promise.all([
    db.setting.findFirst(),
    db.meal.findMany({ include: { ingredients: true }, orderBy: [{ day: 'asc' }, { type: 'asc' }] }),
    db.cookSlot.findMany({ include: { person: true } }),
    db.person.findMany({ orderBy: { id: 'asc' } }),
    db.lunchRecipe.findMany({ include: { ingredients: true }, orderBy: { createdAt: 'asc' } }),
    db.shoppingItem.count({ where: { source: 'generated' } }),
  ])

  const mealMap: Record<string, typeof meals[0]> = {}
  for (const m of meals) mealMap[`${m.day}-${m.type}`] = m

  const slotMap: Record<string, string[]> = {}
  for (const s of cookSlots) {
    const key = `${s.day}-${s.type}`
    if (!slotMap[key]) slotMap[key] = []
    slotMap[key].push(s.person.name)
  }

  const tripStartDate = setting?.tripStartDate ?? null
  const scheduleLocked = setting?.scheduleLocked ?? false

  let todayDayNum: number | null = null
  if (tripStartDate) {
    const startUtc = Date.UTC(tripStartDate.getUTCFullYear(), tripStartDate.getUTCMonth(), tripStartDate.getUTCDate())
    const now = new Date()
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    todayDayNum = Math.round((todayUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1
  }
  const skippedSlots: string[] = JSON.parse(setting?.skippedSlots ?? '[]')
  const shoppingGenerated = generatedCount > 0

  const dates: Record<number, string> = {}
  if (tripStartDate) {
    const baseYear = tripStartDate.getUTCFullYear()
    const baseMonth = tripStartDate.getUTCMonth()
    const baseDay = tripStartDate.getUTCDate()
    for (let d = 1; d <= 8; d++) {
      const date = new Date(Date.UTC(baseYear, baseMonth, baseDay + d - 1))
      dates[d] = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
  }

  return (
    <>
      <ScheduleGrid
        key={`${scheduleLocked}-${meals.length}`}
        mealMap={mealMap}
        slotMap={slotMap}
        people={people}
        tripStartDate={tripStartDate?.toISOString() ?? null}
        scheduleLocked={scheduleLocked}
        skippedSlots={skippedSlots}
        dates={dates}
        shoppingGenerated={shoppingGenerated}
        todayDayNum={todayDayNum}
      />
      {!scheduleLocked && <LunchSection lunchRecipes={lunchRecipes} people={people} shoppingGenerated={shoppingGenerated} />}
    </>
  )
}
