import { db } from '@/lib/db'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { LunchSection } from '@/components/schedule/LunchSection'

export default async function SchedulePage() {
  const [setting, meals, cookSlots, people, lunchRecipes] = await Promise.all([
    db.setting.findFirst(),
    db.meal.findMany({ include: { ingredients: true }, orderBy: [{ day: 'asc' }, { type: 'asc' }] }),
    db.cookSlot.findMany({ include: { person: true } }),
    db.person.findMany({ orderBy: { id: 'asc' } }),
    db.lunchRecipe.findMany({ include: { ingredients: true }, orderBy: { createdAt: 'asc' } }),
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
  const skippedSlots: string[] = JSON.parse(setting?.skippedSlots ?? '[]')

  const dates: Record<number, string> = {}
  if (tripStartDate) {
    const start = new Date(tripStartDate)
    for (let d = 1; d <= 8; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + d - 1)
      dates[d] = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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
      />
      <LunchSection lunchRecipes={lunchRecipes} people={people} />
    </>
  )
}
