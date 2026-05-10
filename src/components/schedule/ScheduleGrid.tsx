'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { generateScheduleAction, resetScheduleAction, skipSlotAction, tradeCookAction } from '@/app/actions/schedule'
import { createMealAction } from '@/app/actions/meals'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { CalendarDays, RefreshCw, Shuffle } from 'lucide-react'

type MealMap = Record<string, { id: number; day: number; type: string; name: string | null; ingredients: unknown[] }>
type SlotMap = Record<string, string[]>

interface ScheduleGridProps {
  mealMap: MealMap
  slotMap: SlotMap
  people: { id: number; name: string }[]
  tripStartDate: string | null
  scheduleLocked: boolean
  skippedSlots: string[]
  dates: Record<number, string>
}

const DAYS = [1, 2, 3, 4, 5, 6, 7]
const MEAL_TYPES = ['breakfast', 'dinner'] as const

type Selected = { slotKey: string; name: string }

export function ScheduleGrid({ mealMap, slotMap: initialSlotMap, scheduleLocked, skippedSlots: initialSkipped, dates }: ScheduleGridProps) {
  const [isPending, startTransition] = useTransition()
  const [skipped, setSkipped] = useState<string[]>(initialSkipped)
  const [slotMap, setSlotMap] = useState<SlotMap>(initialSlotMap)
  const [selected, setSelected] = useState<Selected | null>(null)
  const router = useRouter()

  const isScheduled = Object.keys(mealMap).length > 0

  function handleSkip(day: number, type: string, checked: boolean) {
    const key = `${day}-${type}`
    setSkipped(prev => checked ? [...new Set([...prev, key])] : prev.filter(s => s !== key))
    startTransition(async () => {
      await skipSlotAction(day, type, checked)
    })
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateScheduleAction()
      if (result.error) toast.error(result.error)
      else { toast.success(result.success); router.refresh() }
    })
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetScheduleAction()
      if (result.success) { toast.success(result.success); router.refresh() }
    })
  }

  function handleEmptySlotClick(day: number, type: string) {
    startTransition(async () => {
      const id = await createMealAction(day, type)
      router.push(`/meals/${id}`)
    })
  }

  function handleBadgeClick(slotKey: string, name: string) {
    if (!selected) {
      setSelected({ slotKey, name })
      return
    }
    if (selected.slotKey === slotKey && selected.name === name) {
      setSelected(null)
      return
    }
    const [dayA, typeA] = selected.slotKey.split('-')
    const [dayB, typeB] = slotKey.split('-')
    const nameA = selected.name
    const nameB = name
    setSelected(null)
    // Optimistic update
    setSlotMap(prev => {
      const next = { ...prev }
      next[selected.slotKey] = (prev[selected.slotKey] ?? []).map(n => n === nameA ? nameB : n)
      next[slotKey] = (prev[slotKey] ?? []).map(n => n === nameB ? nameA : n)
      return next
    })
    startTransition(async () => {
      const result = await tradeCookAction(nameA, Number(dayA), typeA, nameB, Number(dayB), typeB)
      if (result?.error) {
        toast.error(result.error)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {selected && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm">
          <span><span className="font-semibold">{selected.name}</span> selected — click another cook to trade slots.</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="shrink-0 h-7">Cancel</Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          {scheduleLocked && (
            <p className="text-sm text-muted-foreground mt-0.5">Schedule is locked — reset to change.</p>
          )}
        </div>
        <div className="flex gap-2">
          {scheduleLocked ? (
            <Button variant="outline" onClick={handleReset} disabled={isPending} size="sm">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={isPending} size="sm">
              <Shuffle className="h-4 w-4 mr-1.5" />
              {isPending ? 'Generating…' : 'Generate Schedule'}
            </Button>
          )}
        </div>
      </div>

      {!isScheduled && !scheduleLocked && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No schedule yet</p>
          <p className="text-sm mt-1">Generate a schedule to assign cooking duties across the week.</p>
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4">
      <div className="grid grid-cols-7 gap-2 min-w-150">
        {DAYS.map(day => {
          const [weekday, date] = (dates[day] ?? `Day ${day}`).split(', ')
          return (
            <div key={day} className="col-span-1 flex flex-col gap-2">
              <div className="text-center py-1">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">{weekday}</div>
                <div className="text-[11px] text-muted-foreground">{date}</div>
              </div>

              {MEAL_TYPES.map(type => {
                const key = `${day}-${type}`
                const meal = mealMap[key]
                const cooks = slotMap[key] ?? []
                const isSkipped = skipped.includes(key)
                const isBreakfast = type === 'breakfast'

                return (
                  <div
                    key={type}
                    className={cn(
                      'relative rounded-xl border-2 p-3 flex flex-col min-h-32.5 transition-all',
                      isSkipped ? 'opacity-35 bg-muted' : 'bg-card',
                      isBreakfast
                        ? 'border-accent/40 hover:border-accent/80'
                        : 'border-primary/30 hover:border-primary/70',
                      !isSkipped && 'cursor-pointer'
                    )}
                  >
                    {/* Overlay — sits above static content (z-10) but below interactive elements (z-20) */}
                    {!isSkipped && (meal
                      ? <Link href={`/meals/${meal.id}`} className="absolute inset-0 rounded-xl z-10" aria-label={meal.name ?? 'Edit meal'} />
                      : <button className="absolute inset-0 rounded-xl z-10 cursor-pointer" onClick={() => handleEmptySlotClick(day, type)} aria-label="Add meal" />
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md',
                        isBreakfast
                          ? 'bg-accent/20 text-amber-800 dark:text-amber-300'
                          : 'bg-primary/12 text-primary'
                      )}>
                        {isBreakfast ? 'BF' : 'Din'}
                      </span>
                      {!scheduleLocked && (
                        <div className="relative z-20">
                          <Checkbox
                            className="h-3.5 w-3.5"
                            checked={isSkipped}
                            onCheckedChange={checked => handleSkip(day, type, !!checked)}
                            title="Skip this slot"
                          />
                        </div>
                      )}
                    </div>

                    {/* Meal name — grows to fill space */}
                    <div className="flex-1">
                      {meal ? (
                        <span className="text-xs font-semibold line-clamp-2 leading-snug">
                          {meal.name || <span className="text-muted-foreground font-normal italic">Add meal…</span>}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Cooks — always at bottom */}
                    <div className="mt-2 space-y-1">
                      {cooks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cooks.map(name => {
                            const isSelected = selected?.slotKey === key && selected?.name === name
                            return scheduleLocked ? (
                              <button
                                key={name}
                                className="relative z-20"
                                onClick={() => handleBadgeClick(key, name)}
                                disabled={isPending}
                                title={selected ? `Trade ${selected.name} with ${name}` : `Select ${name} to trade`}
                              >
                                <Badge
                                  variant={isSelected ? 'default' : 'secondary'}
                                  className={cn('text-[11px] px-1.5 h-5 cursor-pointer transition-all', isSelected && 'ring-2 ring-primary ring-offset-1')}
                                >
                                  {name}
                                </Badge>
                              </button>
                            ) : (
                              <Badge key={name} variant="secondary" className="text-[11px] px-1.5 h-5">
                                {name}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                      {meal?.ingredients && meal.ingredients.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {meal.ingredients.length} ingredient{meal.ingredients.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      </div>

      {isScheduled && (
        <>
          <Separator />
          <CookSummary slotMap={slotMap} mealMap={mealMap} />
        </>
      )}
    </div>
  )
}

function CookSummary({ slotMap, mealMap }: { slotMap: SlotMap; mealMap: MealMap }) {
  const counts: Record<string, number> = {}
  for (const key of Object.keys(mealMap)) {
    const cooks = slotMap[key] ?? []
    for (const name of cooks) counts[name] = (counts[name] ?? 0) + 1
  }

  if (Object.keys(counts).length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Cook Totals</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, count]) => (
            <div key={name} className="flex items-center gap-1.5 text-sm">
              <span className="font-medium">{name}</span>
              <Badge variant="outline">{count}</Badge>
            </div>
          ))}
      </div>
    </div>
  )
}
