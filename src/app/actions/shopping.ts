'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateJson } from '@/lib/ai'
import { requireAuth } from '@/lib/auth'

export async function generateShoppingListAction() {
  await requireAuth()
  const [mealIngredients, lunchIngredients, stores] = await Promise.all([
    db.mealIngredient.findMany(),
    db.lunchIngredient.findMany(),
    db.store.findMany(),
  ])
  const ingredients = [...mealIngredients, ...lunchIngredients]
  if (!ingredients.length) return { error: 'No ingredients found. Add ingredients to meals first.' }

  const lines = ingredients.map(i => i.name + (i.quantity ? ` (${i.quantity}${i.unit ? ' ' + i.unit : ''})` : '')).join('\n')
  const shoppingStores = stores.filter(s => s.name !== 'Bring from Home')
  const storeNames = shoppingStores.map(s => s.name)
  const categories = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Dry Goods', 'Frozen', 'Canned', 'Condiments', 'Beverages', 'Cleaning', 'Other']

  const prompt = `Consolidate this grocery list from multiple recipes into a practical shopping list. Combine duplicates and sum quantities.

Return a JSON object with two keys — "items" (array) and "notes" (array of strings explaining any judgment calls).

QUANTITY RULES (strict):
- NEVER round down. If rounding, always round UP.
- For items naturally counted as whole units (onions, eggs, lemons, limes, avocados, apples, bananas, peppers, potatoes, carrots, etc.) always round UP to the nearest whole integer. Never output a decimal for these. 1.167 onions → 2 onions.
- For measured quantities (mL, cups, grams, tbsp, etc.) only round up when the result lands on a clean number and the difference is under 10% (950 mL → 1000 mL is ok).
- Do the arithmetic exactly — 1 dozen eggs + 2 eggs = 14 eggs.
- When combining items with incompatible units, pick the most useful unit, err on the side of more, and add a note.
- Include EVERY ingredient. Do not drop any item.
- Only add a note when there's a genuine judgment call worth flagging (e.g. incompatible units, significant assumptions). Do not add notes for routine rounding of whole-count items.
- If an ingredient has no quantity, include it with null quantity.

OTHER RULES:
- Clean generic names only (e.g. "garlic cloves, roughly chopped" → "garlic")
- Do NOT use package words like "carton", "bottle", "bag", "box" as units
- Set bring_from_home: true for pantry staples (oils, vinegars, spices, salt, pepper, sugar, flour, butter, soy sauce, hot sauce, baking soda, etc.)
- Assign a category from: ${categories.join(', ')}
- Assign a store from this list (by name): ${storeNames.length ? storeNames.join(', ') : '(none — use null)'}. Use your knowledge of each store type (Costco = bulk, No Frills = grocery, etc.). Use null if unsure. Items with bring_from_home: true should have store: null.

Return format (example):
{"items":[{"name":"eggs","quantity":14,"unit":null,"bring_from_home":false,"category":"Dairy & Eggs","store":"No Frills"},{"name":"olive oil","quantity":null,"unit":null,"bring_from_home":true,"category":"Condiments","store":null}],"notes":["Combined 1 dozen eggs + 2 eggs = 14 eggs (kept exact)"]}

Ingredients from recipes:
${lines}`

  type ConsolidatedItem = { name: string; quantity?: number | null; unit?: string | null; bring_from_home?: boolean; category?: string | null; store?: string | null }
  type GenerateResult = { items: ConsolidatedItem[]; notes?: string[] }

  const result = await generateJson(prompt) as GenerateResult
  if (!result || !Array.isArray(result.items)) {
    return { error: 'AI failed to generate shopping list. Please try again.' }
  }

  const bringFromHome = stores.find(s => s.name === 'Bring from Home')
  const storeByName = Object.fromEntries(stores.map(s => [s.name.toLowerCase(), s.id]))

  await db.shoppingItem.deleteMany({ where: { source: 'generated' } })
  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i]
    if (!item.name) continue
    let storeId: number | null = null
    if (item.bring_from_home && bringFromHome) {
      storeId = bringFromHome.id
    } else if (item.store) {
      storeId = storeByName[item.store.toLowerCase()] ?? null
    }
    await db.shoppingItem.create({
      data: {
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        category: item.category ?? null,
        source: 'generated',
        sortOrder: i,
        storeId,
      },
    })
  }

  revalidatePath('/shopping')
  const notes: string[] = Array.isArray(result.notes) ? result.notes : []
  return { success: `Shopping list generated — ${result.items.length} items.`, notes }
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
