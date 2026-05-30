import { cookies } from 'next/headers'

export async function requireAuth() {
  const jar = await cookies()
  if (jar.get('cottage_auth')?.value !== process.env.COTTAGE_PASSWORD) {
    throw new Error('Unauthorized')
  }
}
