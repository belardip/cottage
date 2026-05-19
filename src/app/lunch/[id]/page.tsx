import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { LunchEditor } from '@/components/meals/LunchEditor'

export default async function LunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipeId = Number(id)

  const recipe = await db.lunchRecipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!recipe) notFound()

  const [people, suggestions] = await Promise.all([
    db.person.findMany({ orderBy: { id: 'asc' } }),
    db.ingredientSuggestion.findMany({ orderBy: { name: 'asc' } }),
  ])

  return <LunchEditor recipe={recipe} people={people} suggestions={suggestions.map(s => s.name)} />
}
