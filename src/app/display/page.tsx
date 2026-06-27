import { db } from '@/lib/db'
import { DisplayClient } from './DisplayClient'
import { Playfair_Display } from 'next/font/google'

export const dynamic = 'force-dynamic'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export default async function DisplayPage() {
  const [setting, meals, cookSlots] = await Promise.all([
    db.setting.findFirst(),
    db.meal.findMany({ orderBy: [{ day: 'asc' }, { type: 'asc' }] }),
    db.cookSlot.findMany({ include: { person: true } }),
  ])

  const tripStartDate = setting?.tripStartDate ?? null
  let todayDayNum: number | null = null
  let weekday: string | null = null

  if (tripStartDate) {
    const startUtc = Date.UTC(tripStartDate.getUTCFullYear(), tripStartDate.getUTCMonth(), tripStartDate.getUTCDate())
    const now = new Date()
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((todayUtc - startUtc) / (1000 * 60 * 60 * 24))
    todayDayNum = diffDays + 1
    weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  }

  const isValidDay = todayDayNum !== null && todayDayNum >= 1 && todayDayNum <= 8

  const todayBreakfast = isValidDay
    ? (meals.find(m => m.day === todayDayNum && m.type === 'breakfast') ?? null)
    : null

  const breakfastChefs = isValidDay
    ? cookSlots.filter(s => s.day === todayDayNum && s.type === 'breakfast').map(s => s.person.name)
    : []

  const todayDinner = isValidDay
    ? (meals.find(m => m.day === todayDayNum && m.type === 'dinner') ?? null)
    : null

  const dinnerChefs = isValidDay
    ? cookSlots.filter(s => s.day === todayDayNum && s.type === 'dinner').map(s => s.person.name)
    : []

  return (
    <DisplayClient
      fontVariable={playfair.variable}
      weekday={weekday}
      isValidDay={isValidDay}
      breakfast={todayBreakfast ? { name: todayBreakfast.name, chefs: breakfastChefs } : null}
      dinner={todayDinner ? { name: todayDinner.name, chefs: dinnerChefs } : null}
    />
  )
}
