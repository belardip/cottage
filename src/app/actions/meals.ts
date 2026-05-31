'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateJson } from '@/lib/ai'
import { requireAuth } from '@/lib/auth'

export async function updateMealAction(id: number, data: {
  name?: string | null
  recipeUrl?: string | null
  originalServings?: number | null
  notes?: string | null
}) {
  await requireAuth()
  await db.meal.update({ where: { id }, data })
  revalidatePath(`/meals/${id}`)
  revalidatePath('/schedule')
}

export async function addIngredientAction(mealId: number, name: string, quantity?: number, unit?: string) {
  await requireAuth()
  const max = await db.mealIngredient.aggregate({ _max: { sortOrder: true }, where: { mealId } })
  await db.mealIngredient.create({
    data: { mealId, name, quantity: quantity ?? null, unit: unit ?? null, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/schedule')
}

export async function deleteMealAction(id: number) {
  await requireAuth()
  await db.meal.delete({ where: { id } })
  revalidatePath('/schedule')
}

export async function createMealAction(day: number, type: string) {
  await requireAuth()
  const meal = await db.meal.create({ data: { day, type } })
  revalidatePath('/schedule')
  return meal.id
}

export async function updateIngredientAction(id: number, data: {
  name?: string
  quantity?: number | null
  unit?: string | null
}) {
  await requireAuth()
  await db.mealIngredient.update({ where: { id }, data })
  const ing = await db.mealIngredient.findUnique({ where: { id } })
  if (ing) {
    revalidatePath(`/meals/${ing.mealId}`)
    revalidatePath('/schedule')
  }
}

export async function deleteIngredientAction(id: number) {
  await requireAuth()
  const ing = await db.mealIngredient.findUnique({ where: { id } })
  await db.mealIngredient.delete({ where: { id } })
  if (ing) {
    revalidatePath(`/meals/${ing.mealId}`)
    revalidatePath('/schedule')
  }
}

export async function parseMealTextAction(mealId: number, text: string, originalServings: number) {
  await requireAuth()
  const prompt = `Extract all ingredients from this recipe text. Scale the quantities from ${originalServings} servings to 7 servings.
Return ONLY a JSON array with no explanation, no markdown. Format:
[{"name":"flour","quantity":2.5,"unit":"cups"},{"name":"salt","quantity":null,"unit":null}]
If quantity is unknown, use null. If unit is not applicable, use null.

Recipe text:
${text.substring(0, 8000)}`

  const result = await generateJson(prompt)

  if (!Array.isArray(result)) {
    throw new Error('Failed to parse recipe — AI did not return an ingredients list.')
  }

  const validIngredients = result.filter((ing: { name?: string }) => ing.name?.trim())
  if (validIngredients.length === 0) {
    throw new Error('No ingredients found in the pasted text.')
  }

  await db.meal.update({ where: { id: mealId }, data: { originalServings } })
  await db.mealIngredient.deleteMany({ where: { mealId } })
  for (let i = 0; i < validIngredients.length; i++) {
    const ing = validIngredients[i]
    await db.mealIngredient.create({
      data: { mealId, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit ?? null, sortOrder: i },
    })
  }

  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/schedule')
  return validIngredients
}

export async function importRecipeAction(mealId: number, recipeUrl: string) {
  await requireAuth()
  if (!recipeUrl) throw new Error('Recipe URL is required')

  const res = await fetch(recipeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error("This website won't let us read it automatically — they block that kind of access. Open the recipe, select all the text, copy it, and use 'Paste Recipe' instead.")
    }
    if (res.status === 404) {
      throw new Error("That page doesn't exist (404). Double-check the URL and try again.")
    }
    throw new Error(`Couldn't load that page (error ${res.status}). Try copying the recipe text and using 'Paste Recipe' instead.`)
  }

  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000)

  if (text.length < 50) throw new Error("We loaded the page but couldn't find any text on it. The URL might be behind a login or paywall — try 'Paste Recipe' instead.")

  const prompt = `Extract all ingredients from this recipe and detect the original serving count.
Scale all quantities to 7 servings.
Return ONLY a JSON object, no explanation, no markdown:
{"servings": 6, "ingredients": [{"name":"green lentils","quantity":1.17,"unit":"cup"},{"name":"salt","quantity":null,"unit":null}]}
Use null for unknown quantities or units. If servings are unclear, estimate from context.

Recipe text:
${text}`

  const result = await generateJson(prompt) as { servings?: number; ingredients?: { name: string; quantity: number | null; unit: string | null }[] }

  if (!result || !Array.isArray(result.ingredients)) {
    throw new Error('Failed to extract ingredients from the page.')
  }

  const validIngredients = result.ingredients.filter(ing => ing.name?.trim())
  if (validIngredients.length === 0) {
    throw new Error('No ingredients found on that page.')
  }

  const detectedServings = typeof result.servings === 'number' && result.servings > 0 ? result.servings : null

  await db.meal.update({ where: { id: mealId }, data: { recipeUrl, originalServings: detectedServings } })
  await db.mealIngredient.deleteMany({ where: { mealId } })
  for (let i = 0; i < validIngredients.length; i++) {
    const ing = validIngredients[i]
    await db.mealIngredient.create({
      data: { mealId, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit ?? null, sortOrder: i },
    })
  }

  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/schedule')
  return { ingredients: validIngredients, servings: detectedServings }
}
