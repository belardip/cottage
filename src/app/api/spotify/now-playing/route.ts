import { NextResponse } from 'next/server'

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const data = await res.json()
  return data.access_token ?? null
}

export async function GET() {
  const accessToken = await getAccessToken()
  if (!accessToken) return NextResponse.json(null)

  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (res.status === 204 || !res.ok) return NextResponse.json(null)

  const text = await res.text()
  if (!text) return NextResponse.json(null)

  const data = JSON.parse(text)
  if (!data.item) return NextResponse.json(null)

  return NextResponse.json({
    isPlaying: data.is_playing ?? false,
    trackName: data.item.name ?? 'Unknown',
    artistName: data.item.artists?.[0]?.name ?? 'Unknown',
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item.duration_ms ?? 0,
  })
}
