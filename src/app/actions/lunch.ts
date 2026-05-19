'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateJson } from '@/lib/ai'

export async function createLunchRecipeAction(): Promise<number> {
  const recipe = await db.lunchRecipe.create({ data: {} })
  revalidatePath('/schedule')
  return recipe.id
}

export async function deleteLunchRecipeAction(id: number): Promise<void> {
  await db.lunchRecipe.delete({ where: { id } })
  revalidatePath('/schedule')
}

export async function updateLunchRecipeAction(id: number, data: {
  name?: string | null
  recipeUrl?: string | null
  originalServings?: number | null
  notes?: string | null
}) {
  await db.lunchRecipe.update({ where: { id }, data })
  revalidatePath(`/lunch/${id}`)
  revalidatePath('/schedule')
}

export async function updateLunchPeopleAction(id: number, peopleIds: number[]): Promise<void> {
  await db.lunchRecipe.update({ where: { id }, data: { peopleIds: JSON.stringify(peopleIds) } })
  revalidatePath('/schedule')
}

export async function addLunchIngredientAction(recipeId: number, name: string, quantity?: number, unit?: string) {
  const max = await db.lunchIngredient.aggregate({ _max: { sortOrder: true }, where: { lunchRecipeId: recipeId } })
  await db.lunchIngredient.create({
    data: { lunchRecipeId: recipeId, name, quantity: quantity ?? null, unit: unit ?? null, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  revalidatePath(`/lunch/${recipeId}`)
}

export async function updateLunchIngredientAction(id: number, data: {
  name?: string
  quantity?: number | null
  unit?: string | null
}) {
  await db.lunchIngredient.update({ where: { id }, data })
  const ing = await db.lunchIngredient.findUnique({ where: { id } })
  if (ing) revalidatePath(`/lunch/${ing.lunchRecipeId}`)
}

export async function deleteLunchIngredientAction(id: number) {
  const ing = await db.lunchIngredient.findUnique({ where: { id } })
  await db.lunchIngredient.delete({ where: { id } })
  if (ing) revalidatePath(`/lunch/${ing.lunchRecipeId}`)
}

export async function parseLunchTextAction(recipeId: number, text: string, originalServings: number) {
  const prompt = `Extract all ingredients from this recipe text. Scale the quantities from ${originalServings} servings to 7 servings.
Return ONLY a JSON array with no explanation, no markdown. Format:
[{"name":"flour","quantity":2.5,"unit":"cups"},{"name":"salt","quantity":null,"unit":null}]
If quantity is unknown, use null. If unit is not applicable, use null.

Recipe text:
${text.substring(0, 8000)}`

  const result = await generateJson(prompt)
  if (!Array.isArray(result)) throw new Error('Failed to parse recipe — AI did not return an ingredients list.')
  const valid = result.filter((ing: { name?: string }) => ing.name?.trim())
  if (valid.length === 0) throw new Error('No ingredients found in the pasted text.')

  await db.lunchRecipe.update({ where: { id: recipeId }, data: { originalServings } })
  await db.lunchIngredient.deleteMany({ where: { lunchRecipeId: recipeId } })
  for (let i = 0; i < valid.length; i++) {
    const ing = valid[i]
    await db.lunchIngredient.create({
      data: { lunchRecipeId: recipeId, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit ?? null, sortOrder: i },
    })
  }

  revalidatePath(`/lunch/${recipeId}`)
  return valid
}

export async function importLunchRecipeAction(recipeId: number, recipeUrl: string) {
  if (!recipeUrl) throw new Error('Recipe URL is required')

  const res = await fetch(recipeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) throw new Error("This website won't let us read it automatically. Try 'Paste Recipe' instead.")
    if (res.status === 404) throw new Error("That page doesn't exist (404). Double-check the URL.")
    throw new Error(`Couldn't load that page (error ${res.status}). Try 'Paste Recipe' instead.`)
  }

  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000)

  if (text.length < 50) throw new Error("Couldn't find any text on the page. Try 'Paste Recipe' instead.")

  const prompt = `Extract all ingredients from this recipe and detect the original serving count.
Scale all quantities to 7 servings.
Return ONLY a JSON object, no explanation, no markdown:
{"servings": 6, "ingredients": [{"name":"green lentils","quantity":1.17,"unit":"cup"},{"name":"salt","quantity":null,"unit":null}]}
Use null for unknown quantities or units. If servings are unclear, estimate from context.

Recipe text:
${text}`

  const result = await generateJson(prompt) as { servings?: number; ingredients?: { name: string; quantity: number | null; unit: string | null }[] }
  if (!result || !Array.isArray(result.ingredients)) throw new Error('Failed to extract ingredients from the page.')
  const valid = result.ingredients.filter(ing => ing.name?.trim())
  if (valid.length === 0) throw new Error('No ingredients found on that page.')

  const detectedServings = typeof result.servings === 'number' && result.servings > 0 ? result.servings : null

  await db.lunchRecipe.update({ where: { id: recipeId }, data: { recipeUrl, originalServings: detectedServings } })
  await db.lunchIngredient.deleteMany({ where: { lunchRecipeId: recipeId } })
  for (let i = 0; i < valid.length; i++) {
    const ing = valid[i]
    await db.lunchIngredient.create({
      data: { lunchRecipeId: recipeId, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit ?? null, sortOrder: i },
    })
  }

  revalidatePath(`/lunch/${recipeId}`)
  return { ingredients: valid, servings: detectedServings }
}
