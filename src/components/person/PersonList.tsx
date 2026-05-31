'use client'

import { useState, useTransition } from 'react'
import { updateShoppingItemAction } from '@/app/actions/shopping'
import { updateStapleAction } from '@/app/actions/staples'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ShoppingItem = {
  id: number
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  isChecked: boolean
  storeId: number | null
}

type StapleItem = {
  id: number
  name: string
  category: string | null
  isChecked: boolean
}

type Store = { id: number; name: string }

interface PersonListProps {
  byStore: { store: Store; items: ShoppingItem[] }[]
  staples: StapleItem[]
  personName: string
}

export function PersonList({ byStore, staples, personName }: PersonListProps) {
  const [shoppingChecked, setShoppingChecked] = useState<Record<number, boolean>>(
    Object.fromEntries(byStore.flatMap(({ items }) => items.map(i => [i.id, i.isChecked])))
  )
  const [staplesChecked, setStaplesChecked] = useState<Record<number, boolean>>(
    Object.fromEntries(staples.map(s => [s.id, s.isChecked]))
  )
  const [, startTransition] = useTransition()

  function toggleShopping(id: number) {
    const next = !shoppingChecked[id]
    setShoppingChecked(prev => ({ ...prev, [id]: next }))
    startTransition(async () => {
      await updateShoppingItemAction(id, { isChecked: next })
    })
  }

  function toggleStaple(id: number) {
    const next = !staplesChecked[id]
    setStaplesChecked(prev => ({ ...prev, [id]: next }))
    startTransition(async () => {
      await updateStapleAction(id, { isChecked: next })
    })
  }

  const hasNothing = byStore.every(({ items }) => items.length === 0) && staples.length === 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{personName}'s List</h1>

      {byStore.map(({ store, items }) => (
        <Card key={store.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{store.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items assigned to this store.</p>
            ) : (
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item.id} className="flex items-center gap-3 py-1 border-b border-border/40 last:border-0">
                    <Checkbox
                      checked={shoppingChecked[item.id] ?? false}
                      onCheckedChange={() => toggleShopping(item.id)}
                      className="shrink-0"
                    />
                    <span className={cn('text-sm flex-1', shoppingChecked[item.id] && 'line-through text-muted-foreground')}>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                      {item.quantity && <span className="text-xs">{item.quantity} {item.unit}</span>}
                      {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {staples.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bring from Home</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {staples.map(item => (
                <li key={item.id} className="flex items-center gap-3 py-1 border-b border-border/40 last:border-0">
                  <Checkbox
                    checked={staplesChecked[item.id] ?? false}
                    onCheckedChange={() => toggleStaple(item.id)}
                    className="shrink-0"
                  />
                  <span className={cn('text-sm flex-1', staplesChecked[item.id] && 'line-through text-muted-foreground')}>
                    {item.name}
                  </span>
                  {item.category && <Badge variant="outline" className="text-xs shrink-0">{item.category}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasNothing && (
        <p className="text-muted-foreground">No items assigned to {personName} yet.</p>
      )}
    </div>
  )
}
