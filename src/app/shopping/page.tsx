import { db } from '@/lib/db'
import { ShoppingList } from '@/components/shopping/ShoppingList'

export default async function ShoppingPage() {
  const [items, stores, people, mealIngredientCount, lunchIngredientCount] = await Promise.all([
    db.shoppingItem.findMany({ include: { store: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    db.store.findMany({ include: { assignedPerson: true }, orderBy: { sortOrder: 'asc' } }),
    db.person.findMany({ orderBy: { name: 'asc' } }),
    db.mealIngredient.count(),
    db.lunchIngredient.count(),
  ])

  const ingredientCount = mealIngredientCount + lunchIngredientCount

  return <ShoppingList items={items} stores={stores} people={people} ingredientCount={ingredientCount} />
}
