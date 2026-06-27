import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('cottage_auth')?.value
  if (auth === process.env.COTTAGE_PASSWORD) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!login|display|_next/static|_next/image|favicon.ico).*)'],
}
