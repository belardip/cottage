'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateMealAction, addIngredientAction, updateIngredientAction, deleteIngredientAction, parseMealTextAction, importRecipeAction, deleteMealAction } from '@/app/actions/meals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, Link2, FileText, Check, X, ExternalLink, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

type Ingredient = { id: number; mealId: number; name: string; quantity: number | null; unit: string | null; sortOrder: number }
type Meal = { id: number; day: number; type: string; name: string | null; recipeUrl: string | null; originalServings: number | null; notes: string | null; ingredients: Ingredient[] }

interface MealEditorProps {
  meal: Meal
  cooks: string[]
  suggestions: string[]
}

function formatDay(day: number, type: string): string {
  return `Day ${day} — ${type.charAt(0).toUpperCase() + type.slice(1)}`
}

type ActivePanel = 'url' | 'paste' | null

export function MealEditor({ meal, cooks, suggestions }: MealEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mealName, setMealName] = useState(meal.name ?? '')

  const [recipeUrl, setRecipeUrl] = useState(meal.recipeUrl ?? '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal.ingredients)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState(meal.recipeUrl ?? '')
  const [parseText, setParseText] = useState('')
  const [pasteServings, setPasteServings] = useState(meal.originalServings ?? 4)
  const [newIng, setNewIng] = useState({ name: '', quantity: '', unit: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', quantity: '', unit: '' })

  function saveMealName(value: string) {
    startTransition(async () => {
      await updateMealAction(meal.id, { name: value || null })
    })
  }

  function handleAddIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!newIng.name.trim()) return
    startTransition(async () => {
      await addIngredientAction(meal.id, newIng.name.trim(), newIng.quantity ? Number(newIng.quantity) : undefined, newIng.unit || undefined)
      setIngredients(prev => [...prev, {
        id: Date.now(), mealId: meal.id, name: newIng.name.trim(),
        quantity: newIng.quantity ? Number(newIng.quantity) : null,
        unit: newIng.unit || null, sortOrder: prev.length,
      }])
      setNewIng({ name: '', quantity: '', unit: '' })
    })
  }

  function handleDeleteIngredient(id: number) {
    startTransition(async () => {
      await deleteIngredientAction(id)
      setIngredients(prev => prev.filter(i => i.id !== id))
    })
  }

  function startEdit(ing: Ingredient) {
    setEditingId(ing.id)
    setEditValues({ name: ing.name, quantity: ing.quantity?.toString() ?? '', unit: ing.unit ?? '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({ name: '', quantity: '', unit: '' })
  }

  function saveEdit(id: number) {
    startTransition(async () => {
      await updateIngredientAction(id, {
        name: editValues.name,
        quantity: editValues.quantity ? Number(editValues.quantity) : null,
        unit: editValues.unit || null,
      })
      setIngredients(prev => prev.map(i => i.id === id
        ? { ...i, name: editValues.name, quantity: editValues.quantity ? Number(editValues.quantity) : null, unit: editValues.unit || null }
        : i
      ))
      setEditingId(null)
    })
  }

  function handleImport() {
    if (!importUrl.trim()) { setPanelError('Enter a recipe URL first.'); return }
    setPanelError(null)
    startTransition(async () => {
      try {
        const result = await importRecipeAction(meal.id, importUrl.trim())
        setIngredients(result.ingredients.filter(r => r.name).map((r, i) => ({
          id: Date.now() + i, mealId: meal.id, name: r.name,
          quantity: r.quantity ?? null, unit: r.unit ?? null, sortOrder: i,
        })))
        setRecipeUrl(importUrl.trim())
        setActivePanel(null)
        const servingsMsg = result.servings ? ` (detected ${result.servings} servings)` : ''
        toast.success(`${result.ingredients.length} ingredients imported, scaled to 7${servingsMsg}.`)
      } catch (e) {
        setPanelError((e as Error).message)
      }
    })
  }

  function handleParseText() {
    if (!parseText.trim()) return
    setPanelError(null)
    startTransition(async () => {
      try {
        const result = await parseMealTextAction(meal.id, parseText, pasteServings)
        setIngredients(result.filter(r => r.name).map((r, i) => ({
          id: Date.now() + i, mealId: meal.id, name: r.name,
          quantity: r.quantity ?? null, unit: r.unit ?? null, sortOrder: i,
        })))
        setActivePanel(null)
        setParseText('')
        toast.success(`${result.length} ingredients extracted, scaled to 7.`)
      } catch (e) {
        setPanelError((e as Error).message)
      }
    })
  }

  function handleDeleteMeal() {
    startTransition(async () => {
      await deleteMealAction(meal.id)
      router.push('/schedule')
    })
  }

  function togglePanel(panel: ActivePanel) {
    setActivePanel(prev => prev === panel ? null : panel)
    setPanelError(null)
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/schedule">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Schedule</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{formatDay(meal.day, meal.type)}</h1>
            {cooks.length > 0 && (
              <div className="flex gap-1 mt-1">
                {cooks.map(name => <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>)}
              </div>
            )}
          </div>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-muted-foreground">Delete this meal?</span>
            <Button size="sm" variant="destructive" onClick={handleDeleteMeal} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Yes, delete'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-1.5" />Delete meal
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input
            value={mealName}
            onChange={e => setMealName(e.target.value)}
            onBlur={() => saveMealName(mealName)}
            placeholder="Meal name (e.g. Pasta Night)"
            className="text-base font-medium"
          />
          {recipeUrl && (
            <a href={recipeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <ExternalLink className="h-3 w-3" />View recipe
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Ingredients{ingredients.length > 0 ? ` (${ingredients.length})` : ''}
            </CardTitle>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={activePanel === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => togglePanel('url')}
            >
              <Link2 className="h-4 w-4 mr-1.5" />Import from URL
            </Button>
            <Button
              variant={activePanel === 'paste' ? 'default' : 'outline'}
              size="sm"
              onClick={() => togglePanel('paste')}
            >
              <FileText className="h-4 w-4 mr-1.5" />Paste Recipe
            </Button>
          </div>
        </CardHeader>

        {activePanel === 'url' && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-muted/50 space-y-2 border">
            <p className="text-xs text-muted-foreground">Paste the recipe URL — AI will grab the ingredients and scale to 7 servings automatically.</p>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://..."
                type="url"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleImport()}
              />
              <Button onClick={handleImport} disabled={isPending || !importUrl.trim()}>
                {isPending ? 'Importing…' : 'Import'}
              </Button>
            </div>
            {panelError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{panelError}</span>
              </div>
            )}
          </div>
        )}

        {activePanel === 'paste' && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-muted/50 space-y-3 border">
            <p className="text-xs text-muted-foreground">Paste the recipe text — AI will extract the ingredients and scale to 7 servings.</p>
            <Textarea
              value={parseText}
              onChange={e => setParseText(e.target.value)}
              placeholder="Paste the recipe here…"
              className="h-36 resize-y bg-background"
            />
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Recipe makes</Label>
              <Input
                value={pasteServings}
                onChange={e => setPasteServings(Number(e.target.value))}
                type="number"
                min={1}
                className="w-16 bg-background"
              />
              <span className="text-sm text-muted-foreground">servings</span>
              <Button onClick={handleParseText} disabled={isPending || !parseText.trim()} className="ml-auto">
                {isPending ? 'Extracting…' : 'Extract →'}
              </Button>
            </div>
            {panelError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{panelError}</span>
              </div>
            )}
          </div>
        )}

        <CardContent className="pt-0 space-y-0">
          {ingredients.length === 0 && activePanel === null && (
            <p className="text-sm text-muted-foreground py-4 text-center">No ingredients yet — import a recipe or add them manually below.</p>
          )}

          {ingredients.map(ing => (
            <div key={ing.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
              {editingId === ing.id ? (
                <>
                  <Input value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} className="flex-1 h-7 text-sm" />
                  <Input value={editValues.quantity} onChange={e => setEditValues(v => ({ ...v, quantity: e.target.value }))} className="w-20 h-7 text-sm" placeholder="Qty" type="number" />
                  <Input value={editValues.unit} onChange={e => setEditValues(v => ({ ...v, unit: e.target.value }))} className="w-20 h-7 text-sm" placeholder="Unit" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(ing.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm cursor-pointer hover:text-primary" onClick={() => startEdit(ing)}>{ing.name}</span>
                  {(ing.quantity != null || ing.unit) && (
                    <span className="text-sm text-muted-foreground cursor-pointer tabular-nums" onClick={() => startEdit(ing)}>
                      {ing.quantity} {ing.unit}
                    </span>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteIngredient(ing.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}

          <form onSubmit={handleAddIngredient} className="flex gap-2 items-center pt-3 mt-1 border-t border-border/40">
            <div className="flex-1">
              <Input
                list="ingredient-suggestions"
                value={newIng.name}
                onChange={e => setNewIng(v => ({ ...v, name: e.target.value }))}
                placeholder="Add ingredient…"
                className="h-8 text-sm"
              />
              <datalist id="ingredient-suggestions">
                {suggestions.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <Input value={newIng.quantity} onChange={e => setNewIng(v => ({ ...v, quantity: e.target.value }))} placeholder="Qty" type="number" className="w-16 h-8 text-sm" />
            <Input value={newIng.unit} onChange={e => setNewIng(v => ({ ...v, unit: e.target.value }))} placeholder="Unit" className="w-16 h-8 text-sm" />
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={isPending || !newIng.name.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
