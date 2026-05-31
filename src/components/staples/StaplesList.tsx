'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addStapleAction, addFromCatalogAction, updateStapleAction, moveStapleToShoppingAction, deleteStapleAction } from '@/app/actions/staples'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Plus, Trash2, ArrowRightLeft, BookOpen } from 'lucide-react'

type Staple = { id: number; name: string; category: string | null; isChecked: boolean; isCustom: boolean; sortOrder: number; assignedPerson: { id: number; name: string } | null }
type Person = { id: number; name: string }
type StoreType = { id: number; name: string }
type Suggestion = { id: number; name: string; category: string }

interface StaplesListProps {
  staples: Staple[]
  people: Person[]
  stores: StoreType[]
  suggestions: Suggestion[]
}

export function StaplesList({ staples: initialStaples, people, stores, suggestions }: StaplesListProps) {
  const [staples, setStaples] = useState(initialStaples)
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [newPersonId, setNewPersonId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogPersonId, setCatalogPersonId] = useState('')
  const [shoppingOpen, setShoppingOpen] = useState<number | null>(null)
  const [selectedStore, setSelectedStore] = useState('')

  const grouped = people.reduce<Record<string, Staple[]>>(
    (acc, p) => { acc[p.name] = staples.filter(s => s.assignedPerson?.id === p.id); return acc },
    {}
  )
  const unassigned = staples.filter(s => !s.assignedPerson)
  if (unassigned.length > 0) grouped['Unassigned'] = unassigned

  function changePerson(id: number, personId: string) {
    const pid = personId === 'none' ? null : Number(personId)
    const person = people.find(p => p.id === pid) ?? null
    setStaples(prev => prev.map(s => s.id === id ? { ...s, assignedPerson: person } : s))
    startTransition(async () => {
      await updateStapleAction(id, { assignedPersonId: pid })
    })
  }

  function toggleCheck(id: number) {
    const staple = staples.find(s => s.id === id)!
    const checked = !staple.isChecked
    setStaples(prev => prev.map(s => s.id === id ? { ...s, isChecked: checked } : s))
    startTransition(async () => {
      await updateStapleAction(id, { isChecked: checked })
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    startTransition(async () => {
      await addStapleAction(newName.trim(), newPersonId ? Number(newPersonId) : undefined)
      const person = people.find(p => p.id === Number(newPersonId)) ?? null
      setStaples(prev => [...prev, { id: Date.now(), name: newName.trim(), category: null, isChecked: false, isCustom: true, sortOrder: prev.length, assignedPerson: person }])
      setNewName('')
      setNewPersonId('')
      setAddOpen(false)
      toast.success('Item added.')
    })
  }

  function handleAddFromCatalog(suggestion: Suggestion) {
    startTransition(async () => {
      await addFromCatalogAction(suggestion.name, suggestion.category, catalogPersonId ? Number(catalogPersonId) : undefined)
      const person = people.find(p => p.id === Number(catalogPersonId)) ?? null
      setStaples(prev => [...prev, { id: Date.now(), name: suggestion.name, category: suggestion.category, isChecked: false, isCustom: false, sortOrder: prev.length, assignedPerson: person }])
      toast.success(`"${suggestion.name}" added.`)
    })
  }

  function handleMoveToShopping(id: number) {
    if (!selectedStore) { toast.error('Select a store'); return }
    startTransition(async () => {
      await moveStapleToShoppingAction(id, Number(selectedStore))
      setStaples(prev => prev.filter(s => s.id !== id))
      setShoppingOpen(null)
      setSelectedStore('')
      toast.success('Moved to shopping list.')
    })
  }

  function handleDelete(id: number) {
    setStaples(prev => prev.filter(s => s.id !== id))
    startTransition(async () => {
      const result = await deleteStapleAction(id)
      if (result?.error) toast.error(result.error)
    })
  }

  const filteredSuggestions = suggestions.filter(s =>
    !staples.some(st => st.name === s.name) &&
    (catalogSearch === '' || s.name.toLowerCase().includes(catalogSearch.toLowerCase()) || s.category.toLowerCase().includes(catalogSearch.toLowerCase()))
  )

  const groupedSuggestions = filteredSuggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s]
    return acc
  }, {})

  const checkedCount = staples.filter(s => s.isChecked).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bring from Home</h1>
          <p className="text-sm text-muted-foreground">{checkedCount}/{staples.length} checked off</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <BookOpen className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add from Catalog</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
              <DialogHeader><DialogTitle>Bring from Home Catalog</DialogTitle></DialogHeader>
              <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Search…" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
                  <Select value={catalogPersonId || 'none'} onValueChange={v => setCatalogPersonId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-y-auto flex-1 space-y-3">
                  {Object.entries(groupedSuggestions).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{category}</h4>
                      <div className="space-y-0.5">
                        {items.map(s => (
                          <button key={s.id} onClick={() => handleAddFromCatalog(s)} disabled={isPending}
                            className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted transition-colors flex items-center justify-between group">
                            {s.name}
                            <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredSuggestions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All catalog items already added.</p>}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add Custom</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Custom Item</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item name" autoFocus /></div>
                <div className="space-y-1.5">
                  <Label>Assign to (optional)</Label>
                  <Select value={newPersonId || 'none'} onValueChange={v => setNewPersonId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={!newName.trim() || isPending}>Add</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {staples.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No items yet</p>
          <p className="text-sm mt-1">Add from the catalog or add custom items.</p>
        </div>
      )}

      {Object.entries(grouped).filter(([, items]) => items.length > 0).map(([personName, personItems]) => (
        <Card key={personName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{personName}</CardTitle>
              <Badge variant="outline">{personItems.filter(i => i.isChecked).length}/{personItems.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {personItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-2.5 border-b border-border/40 last:border-0">
                <Checkbox checked={item.isChecked} onCheckedChange={() => toggleCheck(item.id)} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className={cn('text-sm', item.isChecked && 'line-through text-muted-foreground')}>{item.name}</span>
                </div>
                {item.category && (
                  <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">{item.category}</Badge>
                )}
                <Select value={item.assignedPerson?.id.toString() ?? 'none'} onValueChange={v => changePerson(item.id, v)}>
                  <SelectTrigger className="h-7 w-24 sm:w-32 text-xs shrink-0">
                    <SelectValue placeholder="Person…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground">Unassigned</span></SelectItem>
                    {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Dialog open={shoppingOpen === item.id} onOpenChange={open => { setShoppingOpen(open ? item.id : null); if (!open) setSelectedStore('') }}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Move to shopping">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Move "{item.name}" to Shopping</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Assign to store</Label>
                        <Select value={selectedStore} onValueChange={setSelectedStore}>
                          <SelectTrigger><SelectValue placeholder="Select store…" /></SelectTrigger>
                          <SelectContent>
                            {stores.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => handleMoveToShopping(item.id)} disabled={!selectedStore || isPending}>Move to Shopping</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
