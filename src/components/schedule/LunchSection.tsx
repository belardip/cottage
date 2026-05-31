'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ExternalLink, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { createLunchRecipeAction, deleteLunchRecipeAction, updateLunchRecipeAction, updateLunchPeopleAction } from '@/app/actions/lunch'
import { cn } from '@/lib/utils'

type Person = { id: number; name: string }
type LunchIngredient = { id: number }
type LunchRecipe = { id: number; name: string | null; recipeUrl: string | null; peopleIds: string; ingredients: LunchIngredient[] }

function parsePeopleIds(json: string): number[] {
  try { return JSON.parse(json) as number[] } catch { return [] }
}

export function LunchSection({ lunchRecipes: initial, people, shoppingGenerated }: { lunchRecipes: LunchRecipe[]; people: Person[]; shoppingGenerated?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [recipes, setRecipes] = useState(initial)
  const [editingName, setEditingName] = useState<number | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  function handleAdd() {
    startTransition(async () => {
      const id = await createLunchRecipeAction()
      router.push(`/lunch/${id}`)
    })
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteLunchRecipeAction(id)
      setRecipes(r => r.filter(x => x.id !== id))
      setConfirmDelete(null)
    })
  }

  function startEditName(recipe: LunchRecipe) {
    setEditingName(recipe.id)
    setNameValue(recipe.name ?? '')
  }

  function saveName(id: number) {
    const trimmed = nameValue.trim() || null
    setRecipes(r => r.map(x => x.id === id ? { ...x, name: trimmed } : x))
    startTransition(async () => {
      await updateLunchRecipeAction(id, { name: trimmed })
    })
    setEditingName(null)
  }

  function togglePerson(recipe: LunchRecipe, personId: number) {
    const current = parsePeopleIds(recipe.peopleIds)
    const next = current.includes(personId) ? current.filter(id => id !== personId) : [...current, personId]
    setRecipes(r => r.map(x => x.id === recipe.id ? { ...x, peopleIds: JSON.stringify(next) } : x))
    startTransition(async () => {
      await updateLunchPeopleAction(recipe.id, next)
    })
  }

  return (
    <div className="mt-10 pt-8 border-t">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Lunch Ideas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {shoppingGenerated
              ? 'Shopping list generated — editing locked.'
              : "Ingredients count toward the shopping list but these don't affect the cook schedule."}
          </p>
        </div>
        {!shoppingGenerated && (
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1.5" />Add recipe
          </Button>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lunch recipes yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recipes.map(recipe => {
            const assignedIds = parsePeopleIds(recipe.peopleIds)
            return (
              <Card key={recipe.id}>
                <CardContent className="pt-4 space-y-3">
                  {!shoppingGenerated && editingName === recipe.id ? (
                    <Input
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onBlur={() => saveName(recipe.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(recipe.id); if (e.key === 'Escape') setEditingName(null) }}
                      autoFocus
                      placeholder="Recipe name…"
                      className="h-8 text-sm font-medium"
                    />
                  ) : (
                    <div
                      className={cn('font-medium text-sm min-h-6', !shoppingGenerated && 'cursor-pointer hover:text-primary')}
                      onClick={() => !shoppingGenerated && startEditName(recipe)}
                    >
                      {recipe.name ?? <span className="text-muted-foreground italic font-normal">{shoppingGenerated ? 'Untitled' : 'Untitled — click to name'}</span>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {people.map(p => {
                      const assigned = assignedIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePerson(recipe, p.id)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            assigned
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                          }`}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-3">
                      {recipe.recipeUrl && (
                        <a href={recipe.recipeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!shoppingGenerated && (confirmDelete === recipe.id ? (
                        <span className="flex items-center gap-2">
                          <button onClick={() => handleDelete(recipe.id)} disabled={isPending} className="text-destructive hover:underline">Delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(recipe.id)} className="hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ))}
                      {!shoppingGenerated && (
                        <Link href={`/lunch/${recipe.id}`} className="hover:text-foreground flex items-center gap-0.5">
                          Edit <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
