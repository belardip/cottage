'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CalendarDays, ShoppingCart, Package, Settings, Users, ChevronDown, ChevronRight } from 'lucide-react'

type Person = { id: number; name: string }

const navLinks = [
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/staples', label: 'Bring', icon: Package },
  { href: '/setup', label: 'Setup', icon: Settings },
]

export function Nav({ people }: { people: Person[] }) {
  const pathname = usePathname()
  const [myListOpen, setMyListOpen] = useState(false)

  return (
    <>
      {/* Top header */}
      <header className="border-b border-border/60 bg-card/90 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between h-14">
            <Link href="/schedule" className="font-bold text-base tracking-tight text-foreground">
              🏡 Cottage
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center h-full">
              {navLinks.map(({ href, label }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'relative h-full flex items-center px-4 text-sm font-medium transition-colors',
                      active
                        ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </Link>
                )
              })}
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(
                  'relative h-full flex items-center gap-1 px-4 text-sm font-medium transition-colors outline-none',
                  pathname.startsWith('/person')
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                  My List <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {people.map(p => (
                    <DropdownMenuItem key={p.id} asChild>
                      <Link href={`/person/${encodeURIComponent(p.name)}`}>{p.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-card/95 backdrop-blur-md border-t border-border/60">
        <div className="flex items-stretch h-16">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                {label}
              </Link>
            )
          })}
          <button
            onClick={() => setMyListOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              pathname.startsWith('/person') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Users className={cn('h-5 w-5', pathname.startsWith('/person') && 'stroke-[2.5]')} />
            My List
          </button>
        </div>
        {/* Safe area spacer for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </nav>

      {/* My List sheet (mobile) */}
      <Sheet open={myListOpen} onOpenChange={setMyListOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>My List</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-0.5 pb-4">
            {people.map(p => (
              <Link
                key={p.id}
                href={`/person/${encodeURIComponent(p.name)}`}
                onClick={() => setMyListOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-sm transition-colors flex items-center justify-between',
                  pathname === `/person/${encodeURIComponent(p.name)}`
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {p.name}
                <ChevronRight className="h-4 w-4 opacity-40" />
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
