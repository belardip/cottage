'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateJson } from '@/lib/ai'
import { requireAuth } from '@/lib/auth'

export async function generateShoppingListAction() {
  await requireAuth()
  const [mealIngredients, lunchIngredients] = await Promise.all([
    db.mealIngredient.findMany(),
    db.lunchIngredient.findMany(),
  ])
  const ingredients = [...mealIngredients, ...lunchIngredients]
  if (!ingredients.length) return { error: 'No meal ingredients found. Add ingredients to meals first.' }

  const lines = ingredients.map(i => i.name + (i.quantity ? ` (${i.quantity} ${i.unit ?? ''})` : '')).join('\n')

  const prompt = `You are consolidating a grocery list from multiple recipes into a practical shopping list. Many ingredients appear multiple times under different names (e.g. "garlic cloves, roughly chopped" and "minced garlic" are both garlic). Combine duplicates and round quantities up to sensible amounts.

Return ONLY a JSON array with no explanation:
[{"name":"chicken broth","quantity":1050,"unit":"mL","bring_from_home":false},{"name":"olive oil","quantity":0.5,"unit":"cups","bring_from_home":true}]

Rules:
- Use clean generic names (not recipe descriptions)
- Sum quantities when units match, then round UP to a practical amount (e.g. 4.38 cups → 4.5 cups, 950 mL → 1000 mL). Keep the original unit type — do NOT use container/package words like "carton", "bottle", "bag", "box"
- Convert to sensible units where helpful: cups of liquid → mL or L, garlic cloves → heads (1 head ≈ 10 cloves), butter tbsp → grams
- Set bring_from_home: true for pantry staples people typically already own at home: oils, vinegars, spices, salt, pepper, sugar, flour, butter, soy sauce, hot sauce, baking soda, etc.
- Use null for quantity or unit if not applicable

Ingredients from recipes:
${lines}`

  type ConsolidatedItem = { name: string; quantity?: number; unit?: string; bring_from_home?: boolean }
  const consolidated = await generateJson(prompt) as ConsolidatedItem[]
  const bringFromHome = await db.store.findFirst({ where: { name: 'Bring from Home' } })

  await db.shoppingItem.deleteMany({ where: { source: 'generated' } })
  for (let i = 0; i < consolidated.length; i++) {
    const item = consolidated[i]
    if (!item.name) continue
    await db.shoppingItem.create({
      data: {
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        source: 'generated',
        sortOrder: i,
        storeId: item.bring_from_home && bringFromHome ? bringFromHome.id : null,
      },
    })
  }

  revalidatePath('/shopping')
  return { success: 'Shopping list generated and consolidated by AI.' }
}

export async function categorizeShoppingAction() {
  await requireAuth()
  const items = await db.shoppingItem.findMany()
  if (!items.length) return { error: 'No items to categorize.' }

  const names = items.map(i => i.name)
  const prompt = `Categorize each grocery item into one of these categories: Produce, Meat & Seafood, Dairy & Eggs, Bakery, Dry Goods, Frozen, Canned, Condiments, Beverages, Cleaning, Other.

Return ONLY a JSON object mapping item name to category: {"chicken breast": "Meat & Seafood", "milk": "Dairy & Eggs"}

Items:
${names.join('\n')}`

  const map = await generateJson(prompt) as Record<string, string>
  for (const item of items) {
    if (map[item.name]) {
      await db.shoppingItem.update({ where: { id: item.id }, data: { category: map[item.name] } })
    }
  }

  revalidatePath('/shopping')
  return { success: 'Items categorized.' }
}

export async function assignStoresAction() {
  await requireAuth()
  const stores = await db.store.findMany()
  const bringFromHome = stores.find(s => s.name === 'Bring from Home')
  const items = await db.shoppingItem.findMany({
    where: bringFromHome
      ? { OR: [{ storeId: null }, { storeId: { not: bringFromHome.id } }] }
      : undefined,
  })

  if (!items.length || !stores.length) return { error: 'Need items and stores first.' }

  const storeLines = stores.map(s => `${s.id}: ${s.name}`).join('\n')
  const itemLines = items.map(i => `${i.id}: ${i.name}${i.quantity ? ` (${i.quantity} ${i.unit ?? ''})` : ''}`).join('\n')

  const prompt = `Assign each grocery item to the most appropriate store. Use your knowledge of store types from their names (e.g. "Costco" = bulk warehouse, a bakery name = bread/pastries, a grocery store = general items).
Prefer warehouse/bulk stores for large quantities. Use null if no store is a clear fit.

Stores:
${storeLines}

Items (id: name, quantity):
${itemLines}

Return ONLY a JSON object mapping item id to store id or null:
{"1": 2, "3": null}`

  const map = await generateJson(prompt) as Record<string, number | null>
  for (const [itemId, storeId] of Object.entries(map)) {
    await db.shoppingItem.update({ where: { id: Number(itemId) }, data: { storeId: storeId ?? null } })
  }

  revalidatePath('/shopping')
  return { success: 'Items assigned to stores.' }
}

export async function addShoppingItemAction(name: string, quantity?: number, unit?: string, category?: string) {
  await requireAuth()
  const max = await db.shoppingItem.aggregate({ _max: { sortOrder: true } })
  await db.shoppingItem.create({
    data: { name, quantity: quantity ?? null, unit: unit ?? null, category: category ?? null, source: 'manual', sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  revalidatePath('/shopping')
}

export async function updateShoppingItemAction(id: number, data: {
  name?: string
  quantity?: number | null
  unit?: string | null
  category?: string | null
  storeId?: number | null
  isChecked?: boolean
  sortOrder?: number
}) {
  await requireAuth()
  await db.shoppingItem.update({ where: { id }, data })
  revalidatePath('/shopping')
}

export async function moveToStapleAction(itemId: number, personId: number) {
  await requireAuth()
  const item = await db.shoppingItem.findUnique({ where: { id: itemId } })
  if (!item) return

  const max = await db.stapleItem.aggregate({ _max: { sortOrder: true } })
  await db.stapleItem.create({
    data: { name: item.name, assignedPersonId: personId, isCustom: true, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  await db.shoppingItem.delete({ where: { id: itemId } })

  revalidatePath('/shopping')
  revalidatePath('/staples')
}

export async function deleteShoppingItemAction(id: number) {
  await requireAuth()
  await db.shoppingItem.delete({ where: { id } })
  revalidatePath('/shopping')
}
