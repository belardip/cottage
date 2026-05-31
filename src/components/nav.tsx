'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu, ChevronDown, ChevronRight } from 'lucide-react'

type Person = { id: number; name: string }

const navLinks = [
  { href: '/schedule', label: 'Schedule' },
  { href: '/shopping', label: 'Shopping' },
  { href: '/staples', label: 'Bring from Home' },
  { href: '/setup', label: 'Setup' },
]

export function Nav({ people }: { people: Person[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <Link href="/schedule" className="font-semibold text-lg text-primary tracking-tight">
            🏡 Cottage
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors outline-none',
                pathname.startsWith('/person')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">🏡 Cottage</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'px-4 py-3 rounded-md text-sm font-medium transition-colors',
                      pathname.startsWith(href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </Link>
                ))}
                <div className="mt-2 pt-2 border-t">
                  <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">My List</p>
                  {people.map(p => (
                    <Link
                      key={p.id}
                      href={`/person/${encodeURIComponent(p.name)}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'px-4 py-3 rounded-md text-sm transition-colors flex items-center justify-between',
                        pathname === `/person/${encodeURIComponent(p.name)}`
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      {p.name}
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </Link>
                  ))}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
