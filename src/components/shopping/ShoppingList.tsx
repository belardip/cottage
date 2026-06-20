'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  generateShoppingListAction, exportIngredientsAction,
  addShoppingItemAction, updateShoppingItemAction, moveToStapleAction, deleteShoppingItemAction,
} from '@/app/actions/shopping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ShoppingCart, Trash2, Plus, X, Download } from 'lucide-react'

type Item = { id: number; name: string; quantity: number | null; unit: string | null; category: string | null; source: string; storeId: number | null; isChecked: boolean; sortOrder: number; store: { id: number; name: string } | null }
type StoreType = { id: number; name: string; sortOrder: number; assignedPerson: { name: string } | null }
type Person = { id: number; name: string }

interface ShoppingListProps {
  items: Item[]
  stores: StoreType[]
  people: Person[]
  ingredientCount: number
}

const CATEGORY_COLORS: Record<string, string> = {
  'Produce': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Meat & Seafood': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Dairy & Eggs': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Bakery': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Dry Goods': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Frozen': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Canned': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  'Condiments': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Beverages': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'Cleaning': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
}

export function ShoppingList({ items: initialItems, stores, people, ingredientCount }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState<string[]>([])

  useEffect(() => { setItems(initialItems) }, [initialItems])
  const router = useRouter()
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: '', category: '' })
  const [addOpen, setAddOpen] = useState(false)

  const hasGenerated = items.some(i => i.source === 'generated')

  const unassigned = items.filter(i => !i.storeId)
  const byStore = stores.map(store => ({ store, items: items.filter(i => i.storeId === store.id) }))

  function toggleCheck(id: number) {
    const item = items.find(i => i.id === id)!
    const checked = !item.isChecked
    setItems(prev => prev.map(i => i.id === id ? { ...i, isChecked: checked } : i))
    startTransition(async () => {
      await updateShoppingItemAction(id, { isChecked: checked })
    })
  }

  function changeStore(id: number, storeId: string) {
    const sid = storeId === 'none' ? null : Number(storeId)
    const store = stores.find(s => s.id === sid) ?? null
    setItems(prev => prev.map(i => i.id === id ? { ...i, storeId: sid, store } : i))
    startTransition(async () => {
      await updateShoppingItemAction(id, { storeId: sid })
    })
  }

  function handleDelete(id: number) {
    setItems(prev => prev.filter(i => i.id !== id))
    startTransition(async () => {
      await deleteShoppingItemAction(id)
    })
  }

  async function handleExport() {
    const items = await exportIngredientsAction()
    const rows = [
      ['Name', 'Quantity', 'Unit', 'Used In'],
      ...items.map(i => [i.name, i.quantity ?? '', i.unit ?? '', i.meals.join(' | ')]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cottage-ingredients.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleGenerate() {
    startTransition(async () => {
      setNotes([])
      const result = await generateShoppingListAction()
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        if (result.notes && result.notes.length > 0) setNotes(result.notes)
        router.refresh()
      }
    })
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.name.trim()) return
    startTransition(async () => {
      await addShoppingItemAction(newItem.name.trim(), newItem.quantity ? Number(newItem.quantity) : undefined, newItem.unit || undefined, newItem.category || undefined)
      setNewItem({ name: '', quantity: '', unit: '', category: '' })
      setAddOpen(false)
      toast.success('Item added.')
    })
  }

  function handleBFHAssign(itemId: number, personId: number) {
    const person = people.find(p => p.id === personId)
    startTransition(async () => {
      await moveToStapleAction(itemId, personId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      toast.success(`Added to ${person?.name ?? 'person'}'s Bring from Home list.`)
    })
  }

  const total = items.length
  const checked = items.filter(i => i.isChecked).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          <p className="text-sm text-muted-foreground">{checked}/{total} items checked</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending} size="sm">
                <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{isPending ? 'Working…' : hasGenerated ? 'Regenerate' : 'Generate from Meals'}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{hasGenerated ? 'Regenerate Shopping List?' : 'Generate Shopping List?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {hasGenerated
                    ? 'This will replace the current generated list with a fresh one from your current meal and lunch ingredients. Manually added items will be kept. Meal and lunch editing will remain locked.'
                    : 'Make sure all meal and lunch ingredients are entered first — once you generate, meal and lunch editing will be locked. You can still add items to the list manually afterwards.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerate}>{hasGenerated ? 'Regenerate' : 'Generate'}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add Item</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Shopping Item</DialogTitle></DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} placeholder="Item name" autoFocus /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Quantity</Label><Input value={newItem.quantity} onChange={e => setNewItem(v => ({ ...v, quantity: e.target.value }))} type="number" placeholder="e.g. 2" /></div>
                  <div className="space-y-1.5"><Label>Unit</Label><Input value={newItem.unit} onChange={e => setNewItem(v => ({ ...v, unit: e.target.value }))} placeholder="e.g. cups" /></div>
                </div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={newItem.category} onChange={e => setNewItem(v => ({ ...v, category: e.target.value }))} placeholder="e.g. Produce" /></div>
                <Button type="submit" disabled={isPending || !newItem.name.trim()}>Add Item</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-200 mb-1.5">Notes from generation</p>
              <ul className="space-y-1 text-amber-800 dark:text-amber-300">
                {notes.map((note, i) => <li key={i}>• {note}</li>)}
              </ul>
            </div>
            <button onClick={() => setNotes([])} className="shrink-0 text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          {ingredientCount > 0 ? (
            <>
              <p className="font-medium">{ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''} ready</p>
              <p className="text-sm mt-1">Make sure all meals and lunches are entered, then generate.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No ingredients yet</p>
              <p className="text-sm mt-1">Add ingredients to meals and lunch on the schedule page first.</p>
            </>
          )}
        </div>
      )}

      {unassigned.length > 0 && (
        <ItemGroup title="Unassigned" items={unassigned} stores={stores} people={people}
          toggleCheck={toggleCheck} changeStore={changeStore} handleDelete={handleDelete} isPending={isPending} />
      )}

      {byStore.filter(({ items }) => items.length > 0).map(({ store, items: storeItems }) => {
        const isBFH = store.name === 'Bring from Home'
        return (
          <ItemGroup key={store.id} title={store.name} subtitle={isBFH ? undefined : store.assignedPerson?.name}
            items={storeItems} stores={stores} people={people}
            toggleCheck={toggleCheck} changeStore={changeStore} handleDelete={handleDelete}
            onBFHAssign={isBFH ? handleBFHAssign : undefined}
            isPending={isPending} />
        )
      })}
    </div>
  )
}

interface ItemGroupProps {
  title: string
  subtitle?: string
  items: Item[]
  stores: StoreType[]
  people: Person[]
  toggleCheck: (id: number) => void
  changeStore: (id: number, storeId: string) => void
  handleDelete: (id: number) => void
  onBFHAssign?: (itemId: number, personId: number) => void
  isPending: boolean
}

function ItemGroup({ title, subtitle, items, stores, people, toggleCheck, changeStore, handleDelete, onBFHAssign, isPending }: ItemGroupProps) {
  const checkedCount = items.filter(i => i.isChecked).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}'s store</p>}
          </div>
          <Badge variant="outline">{checkedCount}/{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
            <Checkbox checked={item.isChecked} onCheckedChange={() => toggleCheck(item.id)} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <span className={cn('text-sm', item.isChecked && 'line-through text-muted-foreground')}>{item.name}</span>
              {(item.quantity || item.unit) && (
                <span className="text-xs text-muted-foreground ml-2">{item.quantity} {item.unit}</span>
              )}
            </div>
            {item.category && (
              <Badge className={cn('text-xs shrink-0 hidden sm:inline-flex', CATEGORY_COLORS[item.category] ?? 'bg-muted text-muted-foreground')}>
                {item.category}
              </Badge>
            )}

            {onBFHAssign ? (
              <div className="flex gap-1 flex-wrap shrink-0">
                {people.map(p => (
                  <button key={p.id} onClick={() => onBFHAssign(item.id, p.id)} disabled={isPending}
                    className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <Select value={item.storeId?.toString() ?? 'none'} onValueChange={v => changeStore(item.id, v)}>
                <SelectTrigger className="h-7 w-28 sm:w-36 text-xs shrink-0">
                  <SelectValue placeholder="Store…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground">No store</span></SelectItem>
                  {stores.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
