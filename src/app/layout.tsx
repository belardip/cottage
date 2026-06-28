import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Toaster } from '@/components/ui/sonner'
import { db } from '@/lib/db'

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cottage',
  description: 'Meal planning for the cottage trip',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const people = await db.person.findMany({ orderBy: { name: 'asc' } })

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav people={people} />
        <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          {children}
        </main>
        <Toaster position="bottom-center" />
      </body>
    </html>
  )
}
