'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function addStapleAction(name: string, assignedPersonId?: number) {
  await requireAuth()
  const max = await db.stapleItem.aggregate({ _max: { sortOrder: true } })
  await db.stapleItem.create({
    data: {
      name,
      assignedPersonId: assignedPersonId ?? null,
      isCustom: true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  })
  revalidatePath('/staples')
}

export async function addFromCatalogAction(name: string, category: string, assignedPersonId?: number) {
  await requireAuth()
  const max = await db.stapleItem.aggregate({ _max: { sortOrder: true } })
  await db.stapleItem.create({
    data: {
      name,
      category,
      assignedPersonId: assignedPersonId ?? null,
      isCustom: false,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  })
  revalidatePath('/staples')
}

export async function updateStapleAction(id: number, data: {
  isChecked?: boolean
  assignedPersonId?: number | null
}) {
  await requireAuth()
  await db.stapleItem.update({ where: { id }, data })
  revalidatePath('/staples')
}

export async function moveStapleToShoppingAction(itemId: number, storeId: number) {
  await requireAuth()
  const item = await db.stapleItem.findUnique({ where: { id: itemId } })
  if (!item) return

  const max = await db.shoppingItem.aggregate({ _max: { sortOrder: true } })
  await db.shoppingItem.create({
    data: { name: item.name, storeId, source: 'manual', sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  await db.stapleItem.delete({ where: { id: itemId } })

  revalidatePath('/staples')
  revalidatePath('/shopping')
}

export async function deleteStapleAction(id: number) {
  await requireAuth()
  const item = await db.stapleItem.findUnique({ where: { id } })
  if (item && !item.isCustom) return { error: 'Cannot delete default staple items.' }
  await db.stapleItem.delete({ where: { id } })
  revalidatePath('/staples')
}
