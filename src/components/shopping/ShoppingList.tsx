'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  generateShoppingListAction, categorizeShoppingAction, assignStoresAction,
  addShoppingItemAction, updateShoppingItemAction, moveToStapleAction, deleteShoppingItemAction,
} from '@/app/actions/shopping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ShoppingCart, Tag, Store, Trash2, Plus } from 'lucide-react'

type Item = { id: number; name: string; quantity: number | null; unit: string | null; category: string | null; source: string; storeId: number | null; isChecked: boolean; sortOrder: number; store: { id: number; name: string } | null }
type StoreType = { id: number; name: string; sortOrder: number; assignedPerson: { name: string } | null }
type Person = { id: number; name: string }

interface ShoppingListProps {
  items: Item[]
  stores: StoreType[]
  people: Person[]
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

export function ShoppingList({ items: initialItems, stores, people }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { setItems(initialItems) }, [initialItems])
  const router = useRouter()
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: '', category: '' })
  const [addOpen, setAddOpen] = useState(false)
  const [stapleOpen, setStapleOpen] = useState<number | null>(null)
  const [selectedPerson, setSelectedPerson] = useState('')

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

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateShoppingListAction()
      if ('error' in result) toast.error(result.error)
      else { toast.success(result.success); router.refresh() }
    })
  }

  function handleCategorize() {
    startTransition(async () => {
      const result = await categorizeShoppingAction()
      if ('error' in result) toast.error(result.error)
      else { toast.success(result.success); router.refresh() }
    })
  }

  function handleAssignStores() {
    startTransition(async () => {
      const result = await assignStoresAction()
      if ('error' in result) toast.error(result.error)
      else { toast.success(result.success); router.refresh() }
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

  function handleMoveToStaple(itemId: number) {
    if (!selectedPerson) { toast.error('Select a person'); return }
    startTransition(async () => {
      await moveToStapleAction(itemId, Number(selectedPerson))
      setItems(prev => prev.filter(i => i.id !== itemId))
      setStapleOpen(null)
      setSelectedPerson('')
      toast.success('Moved to staples.')
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
          <Button onClick={handleGenerate} disabled={isPending} size="sm">
            <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{isPending ? 'Working…' : 'Generate from Meals'}</span>
          </Button>
          <Button onClick={handleCategorize} disabled={isPending} variant="outline" size="sm">
            <Tag className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Categorize</span>
          </Button>
          <Button onClick={handleAssignStores} disabled={isPending} variant="outline" size="sm">
            <Store className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Assign Stores</span>
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

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No items yet</p>
          <p className="text-sm mt-1">Generate from meals or add items manually.</p>
        </div>
      )}

      {unassigned.length > 0 && (
        <ItemGroup title="Unassigned" items={unassigned} stores={stores} people={people}
          toggleCheck={toggleCheck} changeStore={changeStore} handleDelete={handleDelete}
          stapleOpen={stapleOpen} setStapleOpen={setStapleOpen} selectedPerson={selectedPerson}
          setSelectedPerson={setSelectedPerson} handleMoveToStaple={handleMoveToStaple} isPending={isPending} />
      )}

      {byStore.filter(({ items }) => items.length > 0).map(({ store, items: storeItems }) => (
        <ItemGroup key={store.id} title={store.name} subtitle={store.assignedPerson?.name} items={storeItems} stores={stores} people={people}
          toggleCheck={toggleCheck} changeStore={changeStore} handleDelete={handleDelete}
          stapleOpen={stapleOpen} setStapleOpen={setStapleOpen} selectedPerson={selectedPerson}
          setSelectedPerson={setSelectedPerson} handleMoveToStaple={handleMoveToStaple} isPending={isPending} />
      ))}
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
  stapleOpen: number | null
  setStapleOpen: (id: number | null) => void
  selectedPerson: string
  setSelectedPerson: (v: string) => void
  handleMoveToStaple: (id: number) => void
  isPending: boolean
}

function ItemGroup({ title, subtitle, items, stores, people, toggleCheck, changeStore, handleDelete, stapleOpen, setStapleOpen, selectedPerson, setSelectedPerson, handleMoveToStaple, isPending }: ItemGroupProps) {
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
            <Checkbox
              checked={item.isChecked}
              onCheckedChange={() => toggleCheck(item.id)}
              className="shrink-0"
            />
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
            <Select value={item.storeId?.toString() ?? 'none'} onValueChange={v => changeStore(item.id, v)}>
              <SelectTrigger className="h-7 w-28 sm:w-36 text-xs shrink-0">
                <SelectValue placeholder="Store…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none"><span className="text-muted-foreground">No store</span></SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Dialog open={stapleOpen === item.id} onOpenChange={open => { setStapleOpen(open ? item.id : null); if (!open) setSelectedPerson('') }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0 text-xs text-muted-foreground">
                  → Staples
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Move "{item.name}" to Staples</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Assign to</Label>
                    <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                      <SelectTrigger><SelectValue placeholder="Select person…" /></SelectTrigger>
                      <SelectContent>
                        {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => handleMoveToStaple(item.id)} disabled={!selectedPerson || isPending}>Move to Staples</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
