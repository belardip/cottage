'use server'

import { cookies } from 'next/headers'

export async function loginAction(password: string) {
  if (!process.env.COTTAGE_PASSWORD) throw new Error('COTTAGE_PASSWORD not set')

  if (password !== process.env.COTTAGE_PASSWORD) {
    return { error: 'Wrong password. Try again.' }
  }

  const jar = await cookies()
  jar.set('cottage_auth', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  return { success: true }
}
