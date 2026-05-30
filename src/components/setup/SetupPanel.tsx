'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { saveTripDateAction, addStoreAction, updateStoreAction, deleteStoreAction } from '@/app/actions/setup'
import { resetScheduleAction } from '@/app/actions/schedule'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Check, X, Pencil, CalendarIcon } from 'lucide-react'

type StoreType = { id: number; name: string; sortOrder: number; assignedPerson: { id: number; name: string } | null }
type Person = { id: number; name: string }

interface SetupPanelProps {
  tripStartDate: string
  stores: StoreType[]
  people: Person[]
}

export function SetupPanel({ tripStartDate: initialDate, stores: initialStores, people }: SetupPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)
  const router = useRouter()
  const [tripDate, setTripDate] = useState(initialDate)
  const [calOpen, setCalOpen] = useState(false)

  const selectedDate = tripDate ? new Date(tripDate + 'T12:00:00') : undefined
  const [stores, setStores] = useState(initialStores)
  const [newStore, setNewStore] = useState('')
  const [newStorePersonId, setNewStorePersonId] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', personId: '' })

  function handleDateSelect(date: Date | undefined) {
    const str = date ? format(date, 'yyyy-MM-dd') : ''
    setTripDate(str)
    setCalOpen(false)
    startTransition(async () => {
      await saveTripDateAction(str)
      toast.success('Trip date saved.')
    })
  }

  function handleAddStore(e: React.FormEvent) {
    e.preventDefault()
    if (!newStore.trim()) return
    startTransition(async () => {
      await addStoreAction(newStore.trim(), newStorePersonId ? Number(newStorePersonId) : undefined)
      const person = people.find(p => p.id === Number(newStorePersonId)) ?? null
      setStores(prev => [...prev, { id: Date.now(), name: newStore.trim(), sortOrder: prev.length, assignedPerson: person }])
      setNewStore('')
      setNewStorePersonId('')
      toast.success('Store added.')
    })
  }

  function startEdit(store: StoreType) {
    setEditingId(store.id)
    setEditValues({ name: store.name, personId: store.assignedPerson?.id.toString() ?? '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({ name: '', personId: '' })
  }

  function saveEdit(id: number) {
    startTransition(async () => {
      await updateStoreAction(id, {
        name: editValues.name,
        assignedPersonId: editValues.personId ? Number(editValues.personId) : null,
      })
      const person = people.find(p => p.id === Number(editValues.personId)) ?? null
      setStores(prev => prev.map(s => s.id === id ? { ...s, name: editValues.name, assignedPerson: person } : s))
      setEditingId(null)
      toast.success('Store updated.')
    })
  }

  function handleDelete(id: number) {
    setStores(prev => prev.filter(s => s.id !== id))
    startTransition(async () => {
      await deleteStoreAction(id)
    })
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Setup</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Trip Start Date</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isPending}
                  className={cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          {selectedDate && (
            <p className="text-sm text-muted-foreground">
              Trip runs {format(selectedDate, 'EEEE, MMMM d')} → {format(new Date(selectedDate.getTime() + 7 * 86400000), 'EEEE, MMMM d')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stores ({stores.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stores.map(store => (
            <div key={store.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
              {editingId === store.id ? (
                <>
                  <Input value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} className="flex-1 h-8 text-sm" />
                  <Select value={editValues.personId || 'none'} onValueChange={v => setEditValues(prev => ({ ...prev, personId: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Person…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(store.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{store.name}</span>
                    {store.assignedPerson && (
                      <span className="text-xs text-muted-foreground ml-2">({store.assignedPerson.name})</span>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(store)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(store.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          ))}

          <Separator className="my-3" />

          <form onSubmit={handleAddStore} className="flex gap-2 items-end">
            <Input value={newStore} onChange={e => setNewStore(e.target.value)} placeholder="Store name" className="flex-1 h-8 text-sm" />
            <Select value={newStorePersonId || 'none'} onValueChange={v => setNewStorePersonId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Person…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {people.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" disabled={!newStore.trim() || isPending}><Plus className="h-4 w-4" /></Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Permanently erase all meals, ingredients, and cook assignments and unlock the schedule.</p>
          <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)} disabled={isPending}>
            Reset Everything
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset everything?</DialogTitle>
            <DialogDescription>
              This will permanently erase all meals, ingredients, and cook assignments. The schedule will be unlocked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await resetScheduleAction()
                  setResetOpen(false)
                  if (result.success) { toast.success(result.success); router.refresh() }
                })
              }}
            >
              Yes, reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
