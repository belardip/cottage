'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { generateScheduleAction, reshuffleScheduleAction, skipSlotAction, tradeCookAction, swapMealsAction } from '@/app/actions/schedule'
import { createMealAction } from '@/app/actions/meals'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, CalendarDays, Shuffle } from 'lucide-react'

type Ingredient = { id: number; name: string; quantity: number | null; unit: string | null }
type MealMap = Record<string, { id: number; day: number; type: string; name: string | null; ingredients: Ingredient[] }>
type SlotMap = Record<string, string[]>

interface ScheduleGridProps {
  mealMap: MealMap
  slotMap: SlotMap
  people: { id: number; name: string }[]
  tripStartDate: string | null
  scheduleLocked: boolean
  skippedSlots: string[]
  dates: Record<number, string>
  shoppingGenerated?: boolean
  todayDayNum: number | null
}

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8]
const MEAL_TYPES = ['breakfast', 'dinner'] as const

type Selected = { slotKey: string; name: string }

export function ScheduleGrid({ mealMap, slotMap: initialSlotMap, scheduleLocked, skippedSlots: initialSkipped, dates, shoppingGenerated, todayDayNum }: ScheduleGridProps) {
  const [isPending, startTransition] = useTransition()
  const [skipped, setSkipped] = useState<string[]>(initialSkipped)
  const [slotMap, setSlotMap] = useState<SlotMap>(initialSlotMap)
  const initialSlotMapJson = JSON.stringify(initialSlotMap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSlotMap(initialSlotMap) }, [initialSlotMapJson])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [hoveredCook, setHoveredCook] = useState<string | null>(null)
  const [dialogMeal, setDialogMeal] = useState<{ id: number; name: string | null; ingredients: Ingredient[]; cooks: string[]; day: number; type: string } | null>(null)
  const [swapMode, setSwapMode] = useState(false)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapFirst, setSwapFirst] = useState<{ day: number; type: string; name: string | null } | null>(null)
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

  function handleReshuffle() {
    startTransition(async () => {
      const result = await reshuffleScheduleAction()
      if (result.error) toast.error(result.error)
      else { toast.success(result.success!); router.refresh() }
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
      {selected && !scheduleLocked && (
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
          {shoppingGenerated && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
              Shopping list generated — meal editing locked. To add missing items, go to the{' '}
              <Link href="/shopping" className="underline underline-offset-2">shopping list</Link>.
            </p>
          )}
        </div>
        {scheduleLocked ? (
          <Button variant="outline" onClick={() => { setSwapFirst(null); setSwapDialogOpen(true) }} disabled={isPending} size="sm">
            <ArrowLeftRight className="h-4 w-4 mr-1.5" />
            Swap Meals
          </Button>
        ) : (
          <Button onClick={handleGenerate} disabled={isPending} size="sm">
            <Shuffle className="h-4 w-4 mr-1.5" />
            {isPending ? 'Generating…' : 'Generate Schedule'}
          </Button>
        )}
      </div>

      {!isScheduled && !scheduleLocked && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No schedule yet</p>
          <p className="text-sm mt-1">Generate a schedule to assign cooking duties across the week.</p>
        </div>
      )}

      {(() => {
        const activeDays = DAYS.filter(day => dates[day])
        const numDays = activeDays.length
        return (
      <div className="overflow-x-auto -mx-4 px-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numDays}, minmax(0, 1fr))`, minWidth: `${numDays * 8}rem` }}>
        {/* Date headers — one per column */}
        {activeDays.map(day => {
          const [weekday, date] = (dates[day] ?? `Day ${day}`).split(', ')
          return (
            <div key={`h-${day}`} className="text-center py-1">
              <div className="text-xs font-bold uppercase tracking-wider text-foreground">{weekday}</div>
              <div className="text-[11px] text-muted-foreground">{date}</div>
            </div>
          )
        })}

        {/* Meal cards — all breakfast across all days, then all dinner. CSS grid gives equal row heights. */}
        {MEAL_TYPES.flatMap(type =>
          activeDays.map(day => {
            const key = `${day}-${type}`
            const meal = mealMap[key]
            const cooks = slotMap[key] ?? []
            const isSkipped = skipped.includes(key)
            const isBreakfast = type === 'breakfast'
            const isEmpty = !meal && !isSkipped
            const hasIngredients = !!(meal?.ingredients && meal.ingredients.length > 0)

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'relative rounded-xl p-3 flex flex-col transition-all min-h-32',
                      isEmpty
                        ? 'border border-dashed opacity-40 hover:opacity-70'
                        : 'border-2',
                      isSkipped ? 'opacity-35 bg-muted border-2' : 'bg-card',
                      !isEmpty && (isBreakfast
                        ? 'border-accent/40 hover:border-accent/80'
                        : 'border-primary/30 hover:border-primary/70'),
                      isEmpty && (isBreakfast ? 'border-accent/40' : 'border-primary/25'),
                      !isSkipped && 'cursor-pointer'
                    )}
                  >
                    {/* Overlay — sits above static content (z-10) but below interactive elements (z-20) */}
                    {!isSkipped && (meal ? (
                      <button
                        className="absolute inset-0 rounded-xl z-10 cursor-pointer"
                        style={{ touchAction: 'manipulation' }}
                        onClick={() => { setSwapMode(false); setDialogMeal({ id: meal.id, name: meal.name, ingredients: meal.ingredients, cooks, day, type }) }}
                        aria-label={meal.name ?? 'View meal'}
                      />
                    ) : (!shoppingGenerated && (
                      <button
                        className="absolute inset-0 rounded-xl z-10 cursor-pointer"
                        style={{ touchAction: 'manipulation' }}
                        onClick={() => handleEmptySlotClick(day, type)}
                        aria-label="Add meal"
                      />
                    )))}

                    {isEmpty ? (
                      <span className="text-[10px] text-muted-foreground self-center">{isBreakfast ? 'BF' : 'DIN'}</span>
                    ) : (
                      <>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md',
                            isBreakfast
                              ? 'bg-accent/20 text-amber-800 dark:text-amber-300'
                              : 'bg-primary/12 text-primary'
                          )}>
                            {isBreakfast ? 'BF' : 'DIN'}
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
                          <span className="text-xs font-semibold line-clamp-2 leading-snug">
                            {meal?.name || <span className="text-muted-foreground font-normal italic">Add meal…</span>}
                          </span>
                        </div>

                        {/* Cooks + ingredient count — always at bottom */}
                        <div className="mt-2 space-y-1">
                          {cooks.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {cooks.map(name => {
                                const isSelected = selected?.slotKey === key && selected?.name === name
                                const isHighlighted = hoveredCook === name
                                return !scheduleLocked ? (
                                  <button
                                    key={name}
                                    className="relative z-20"
                                    onClick={() => handleBadgeClick(key, name)}
                                    disabled={isPending}
                                    title={selected ? `Trade ${selected.name} with ${name}` : `Select ${name} to trade`}
                                  >
                                    <Badge
                                      variant={isSelected ? 'default' : 'secondary'}
                                      className={cn('text-[11px] px-1.5 h-5 cursor-pointer transition-all', isSelected && 'ring-2 ring-primary ring-offset-1', isHighlighted && !isSelected && 'bg-primary text-primary-foreground')}
                                    >
                                      {name}
                                    </Badge>
                                  </button>
                                ) : (
                                  <Badge key={name} variant="secondary" className={cn('text-[11px] px-1.5 h-5 transition-all', isHighlighted && 'bg-primary text-primary-foreground')}>
                                    {name}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                          {hasIngredients && (
                            <p className="text-xs text-muted-foreground">
                              {meal!.ingredients.length} ingredient{meal!.ingredients.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                {hasIngredients && (
                  <TooltipContent side="bottom" align="start" className="max-w-55">
                    <p className="font-semibold mb-1.5">{meal!.name}</p>
                    <ul className="space-y-0.5">
                      {meal!.ingredients.map(ing => (
                        <li key={ing.id} className="text-xs text-muted-foreground">
                          {ing.name}{ing.quantity != null ? ` — ${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}` : ''}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })
        )}
      </div>
      </div>
        )
      })()}

      {isScheduled && (
        <>
          <Separator />
          <CookSummary slotMap={slotMap} mealMap={mealMap} hoveredCook={hoveredCook} onHoverCook={setHoveredCook} />
        </>
      )}

      <Dialog open={dialogMeal !== null} onOpenChange={open => { if (!open) { setDialogMeal(null); setSwapMode(false) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {swapMode ? `Swap "${dialogMeal?.name}" with…` : (dialogMeal?.name ?? 'Meal')}
            </DialogTitle>
          </DialogHeader>
          {dialogMeal && !swapMode && (
            <div className="space-y-3">
              {dialogMeal.cooks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dialogMeal.cooks.map(c => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
              )}
              {dialogMeal.ingredients.length > 0 ? (
                <ul className="space-y-1">
                  {dialogMeal.ingredients.map(ing => (
                    <li key={ing.id} className="text-sm text-muted-foreground">
                      {ing.name}{ing.quantity != null ? ` — ${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No ingredients added.</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                {scheduleLocked && todayDayNum !== null && dialogMeal.day >= todayDayNum && (
                  <Button variant="outline" size="sm" onClick={() => setSwapMode(true)}>
                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                    Swap meal
                  </Button>
                )}
                {!shoppingGenerated && (
                  <Link
                    href={`/meals/${dialogMeal.id}`}
                    className="text-sm text-primary underline underline-offset-2"
                    onClick={() => setDialogMeal(null)}
                  >
                    Edit →
                  </Link>
                )}
              </div>
            </div>
          )}
          {dialogMeal && swapMode && (() => {
            const candidates = Object.values(mealMap).filter(m =>
              m.type === dialogMeal.type &&
              m.day !== dialogMeal.day &&
              todayDayNum !== null && m.day >= todayDayNum
            ).sort((a, b) => a.day - b.day)
            return candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No other future {dialogMeal.type} meals to swap with.</p>
            ) : (
              <ul className="space-y-1">
                {candidates.map(m => (
                  <li key={m.id}>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await swapMealsAction(dialogMeal.day, dialogMeal.type, m.day)
                          if (result?.error) { toast.error(result.error) }
                          else { setDialogMeal(null); setSwapMode(false); router.refresh() }
                        })
                      }}
                    >
                      <span className="font-medium">{dates[m.day]?.split(', ')[0]}</span>
                      <span className="text-muted-foreground ml-2">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Top-level Swap Meals dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={open => { if (!open) { setSwapDialogOpen(false); setSwapFirst(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Swap Meals</DialogTitle>
          </DialogHeader>
          {(() => {
            const futureMeals = Object.values(mealMap)
              .filter(m => todayDayNum !== null && m.day > todayDayNum)
              .sort((a, b) => a.day - b.day)
            if (futureMeals.length === 0) return <p className="text-sm text-muted-foreground italic">No upcoming meals.</p>
            const groups = [
              { label: 'Breakfast', type: 'breakfast', meals: futureMeals.filter(m => m.type === 'breakfast') },
              { label: 'Dinner', type: 'dinner', meals: futureMeals.filter(m => m.type === 'dinner') },
            ].filter(g => g.meals.length > 0)
            return (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {groups.map(group => (
                  <div key={group.type}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1">{group.label}</p>
                    <ul className="space-y-0.5">
                      {group.meals.map(m => {
                        const isSelected = swapFirst?.day === m.day && swapFirst?.type === m.type
                        const isCompatible = swapFirst && m.type === swapFirst.type && !isSelected
                        const dimmed = swapFirst && !isCompatible && !isSelected
                        return (
                          <li key={m.id}>
                            <button
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg transition-colors',
                                isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                                dimmed ? 'opacity-30 cursor-default' : ''
                              )}
                              disabled={isPending || !!dimmed}
                              onClick={() => {
                                if (isSelected) { setSwapFirst(null); return }
                                if (!swapFirst) { setSwapFirst({ day: m.day, type: m.type, name: m.name }); return }
                                if (isCompatible) {
                                  startTransition(async () => {
                                    const result = await swapMealsAction(swapFirst.day, swapFirst.type, m.day)
                                    if (result?.error) toast.error(result.error)
                                    else { setSwapDialogOpen(false); setSwapFirst(null); router.refresh() }
                                  })
                                }
                              }}
                            >
                              <span className="text-xs font-semibold">{dates[m.day]?.split(', ')[0]}</span>
                              <span className={cn('text-sm ml-2', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{m.name}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}
          {swapFirst && <p className="text-xs text-muted-foreground pt-1">"{swapFirst.name}" selected — tap another {swapFirst.type} to swap.</p>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CookSummary({ slotMap, mealMap, hoveredCook, onHoverCook }: { slotMap: SlotMap; mealMap: MealMap; hoveredCook: string | null; onHoverCook: (name: string | null) => void }) {
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
            <div
              key={name}
              className="flex items-center gap-1.5 text-sm cursor-default"
              onMouseEnter={() => onHoverCook(name)}
              onMouseLeave={() => onHoverCook(null)}
            >
              <span className={cn('font-medium transition-colors', hoveredCook === name && 'text-primary')}>{name}</span>
              <Badge variant={hoveredCook === name ? 'default' : 'outline'}>{count}</Badge>
            </div>
          ))}
      </div>
    </div>
  )
}
