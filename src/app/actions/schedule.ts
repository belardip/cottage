'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateSchedule } from '@/lib/schedule'
import { requireAuth } from '@/lib/auth'

export async function generateScheduleAction() {
  await requireAuth()
  const setting = await db.setting.findFirst()
  if (!setting) return { error: 'No settings found.' }
  if (setting.scheduleLocked) return { error: 'Schedule is already locked.' }
  if (!setting.tripStartDate) return { error: 'Set a trip start date in Setup first.' }

  const skippedSlots: string[] = JSON.parse(setting.skippedSlots || '[]')
  const { bDays, dDays, breakfast, dinner } = generateSchedule(skippedSlots)

  await db.$transaction(async (tx) => {
    await tx.cookSlot.deleteMany()
    await tx.meal.deleteMany()

    for (let i = 0; i < bDays.length; i++) {
      const day = bDays[i]
      await tx.meal.create({ data: { day, type: 'breakfast' } })
      for (const personId of breakfast[i] ?? []) {
        await tx.cookSlot.create({ data: { day, type: 'breakfast', personId } })
      }
    }

    for (let i = 0; i < dDays.length; i++) {
      const day = dDays[i]
      await tx.meal.create({ data: { day, type: 'dinner' } })
      for (const personId of dinner[i] ?? []) {
        await tx.cookSlot.create({ data: { day, type: 'dinner', personId } })
      }
    }

    await tx.setting.updateMany({ data: { scheduleLocked: true } })
  })

  revalidatePath('/schedule')
  return { success: 'Schedule generated!' }
}

export async function reshuffleScheduleAction() {
  await requireAuth()
  const setting = await db.setting.findFirst()
  if (!setting) return { error: 'No settings found.' }

  const skippedSlots: string[] = JSON.parse(setting.skippedSlots || '[]')
  const { bDays, dDays, breakfast, dinner } = generateSchedule(skippedSlots)

  await db.$transaction(async (tx) => {
    await tx.cookSlot.deleteMany()
    for (let i = 0; i < bDays.length; i++)
      for (const personId of breakfast[i] ?? [])
        await tx.cookSlot.create({ data: { day: bDays[i], type: 'breakfast', personId } })
    for (let i = 0; i < dDays.length; i++)
      for (const personId of dinner[i] ?? [])
        await tx.cookSlot.create({ data: { day: dDays[i], type: 'dinner', personId } })
  })

  revalidatePath('/schedule')
  return { success: 'Schedule reshuffled!' }
}

export async function resetScheduleAction() {
  await requireAuth()
  await db.$transaction(async (tx) => {
    await tx.cookSlot.deleteMany()
    await tx.meal.deleteMany()
    await tx.setting.updateMany({ data: { scheduleLocked: false } })
  })
  revalidatePath('/schedule')
  return { success: 'Schedule reset.' }
}

export async function tradeCookAction(
  nameA: string, dayA: number, typeA: string,
  nameB: string, dayB: number, typeB: string
) {
  await requireAuth()
  const [personA, personB] = await Promise.all([
    db.person.findFirst({ where: { name: nameA } }),
    db.person.findFirst({ where: { name: nameB } }),
  ])
  if (!personA || !personB) return { error: 'Person not found.' }

  const [slotA, slotB] = await Promise.all([
    db.cookSlot.findFirst({ where: { day: dayA, type: typeA, personId: personA.id } }),
    db.cookSlot.findFirst({ where: { day: dayB, type: typeB, personId: personB.id } }),
  ])
  if (!slotA || !slotB) return { error: 'Cook slot not found.' }

  await db.cookSlot.update({ where: { id: slotA.id }, data: { day: dayB, type: typeB } })
  await db.cookSlot.update({ where: { id: slotB.id }, data: { day: dayA, type: typeA } })

  revalidatePath('/schedule')
  return { success: true }
}

export async function swapMealsAction(dayA: number, type: string, dayB: number) {
  await requireAuth()
  const setting = await db.setting.findFirst()
  if (!setting?.scheduleLocked) return { error: 'Schedule is not locked.' }

  // Swap meals (use day 999 as temp to avoid unique constraint collisions)
  await db.$executeRawUnsafe(`UPDATE meals SET day=999 WHERE day=? AND type=?`, dayA, type)
  await db.$executeRawUnsafe(`UPDATE meals SET day=? WHERE day=? AND type=?`, dayA, dayB, type)
  await db.$executeRawUnsafe(`UPDATE meals SET day=? WHERE day=999 AND type=?`, dayB, type)

  // Swap cook slots
  await db.$executeRawUnsafe(`UPDATE cook_slots SET day=999 WHERE day=? AND type=?`, dayA, type)
  await db.$executeRawUnsafe(`UPDATE cook_slots SET day=? WHERE day=? AND type=?`, dayA, dayB, type)
  await db.$executeRawUnsafe(`UPDATE cook_slots SET day=? WHERE day=999 AND type=?`, dayB, type)

  revalidatePath('/schedule')
  return { success: true }
}

export async function skipSlotAction(day: number, type: string, skipped: boolean) {
  await requireAuth()
  const setting = await db.setting.findFirst()
  if (!setting) return

  const current: string[] = JSON.parse(setting.skippedSlots || '[]')
  const key = `${day}-${type}`
  const updated = skipped
    ? [...new Set([...current, key])]
    : current.filter(s => s !== key)

  await db.setting.updateMany({ data: { skippedSlots: JSON.stringify(updated) } })
  revalidatePath('/schedule')
}
