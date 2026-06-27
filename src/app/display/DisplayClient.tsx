'use client'

import { useEffect, useState } from 'react'

type MealInfo = { name: string | null; chefs: string[] } | null

interface Props {
  fontVariable: string
  weekday: string | null
  isValidDay: boolean
  breakfast: MealInfo
  dinner: MealInfo
}

// Change this to match the cottage location for weather
const WEATHER_LOCATION = 'Dickie Lake, Ontario'

type WeatherData = {
  temp: string
  desc: string
  emoji: string
  high: string
  low: string
}

type SpotifyData = {
  isPlaying: boolean
  trackName: string
  artistName: string
  albumArt: string | null
  progressMs: number
  durationMs: number
} | null

type JaysData = {
  status: 'no-game' | 'Preview' | 'Live' | 'Final'
  awayTeam: string
  homeTeam: string
  awayScore: number | null
  homeScore: number | null
  inning: string
  venue?: string
  isJaysAway: boolean
}

function getWeatherEmoji(code: number) {
  if (code === 113) return '☀️'
  if (code <= 116) return '⛅'
  if (code <= 122) return '☁️'
  if (code <= 260) return '🌫️'
  if (code <= 299) return '🌦️'
  if (code <= 321) return '🌧️'
  if (code <= 377) return '❄️'
  if (code <= 395) return '⛈️'
  return '🌤️'
}

function shortTeamName(full: string) {
  const abbrevMap: Record<string, string> = {
    'Toronto Blue Jays': 'TOR',
    'New York Yankees': 'NYY',
    'New York Mets': 'NYM',
    'Boston Red Sox': 'BOS',
    'Tampa Bay Rays': 'TB',
    'Baltimore Orioles': 'BAL',
    'Chicago White Sox': 'CWS',
    'Chicago Cubs': 'CHC',
    'Minnesota Twins': 'MIN',
    'Cleveland Guardians': 'CLE',
    'Detroit Tigers': 'DET',
    'Kansas City Royals': 'KC',
    'Houston Astros': 'HOU',
    'Seattle Mariners': 'SEA',
    'Los Angeles Angels': 'LAA',
    'Texas Rangers': 'TEX',
    'Oakland Athletics': 'OAK',
    'Atlanta Braves': 'ATL',
    'Philadelphia Phillies': 'PHI',
    'Miami Marlins': 'MIA',
    'Washington Nationals': 'WSH',
    'New York Giants': 'SF',
    'San Francisco Giants': 'SF',
    'Los Angeles Dodgers': 'LAD',
    'San Diego Padres': 'SD',
    'Colorado Rockies': 'COL',
    'Arizona Diamondbacks': 'ARI',
    'Milwaukee Brewers': 'MIL',
    'St. Louis Cardinals': 'STL',
    'Cincinnati Reds': 'CIN',
    'Pittsburgh Pirates': 'PIT',
  }
  return abbrevMap[full] ?? full.split(' ').slice(-1)[0]
}

export function DisplayClient({ fontVariable, weekday, isValidDay, breakfast, dinner }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [jays, setJays] = useState<JaysData | null>(null)
  const [jaysLoading, setJaysLoading] = useState(true)
  const [spotify, setSpotify] = useState<SpotifyData>(null)

  // Weather — refresh every 10 minutes
  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://wttr.in/${encodeURIComponent(WEATHER_LOCATION)}?format=j1`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        const curr = data.current_condition[0]
        const today = data.weather[0]
        setWeather({
          temp: curr.temp_C,
          desc: curr.weatherDesc[0].value,
          emoji: getWeatherEmoji(parseInt(curr.weatherCode)),
          high: today.maxtempC,
          low: today.mintempC,
        })
      } catch {}
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Blue Jays score — refresh every minute
  useEffect(() => {
    async function fetchJays() {
      try {
        const dateStr = new Date().toISOString().split('T')[0]
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=141&hydrate=linescore&date=${dateStr}`,
          { cache: 'no-store' }
        )
        const data = await res.json()

        if (!data.dates?.length || !data.dates[0].games?.length) {
          setJays({ status: 'no-game', awayTeam: '', homeTeam: '', awayScore: null, homeScore: null, inning: '', isJaysAway: false })
          setJaysLoading(false)
          return
        }

        const game = data.dates[0].games[0]
        const away = game.teams.away
        const home = game.teams.home
        const abstractState = game.status.abstractGameState as string

        let inning = ''
        if (abstractState === 'Live' && game.linescore) {
          const half = game.linescore.inningHalf === 'Top' ? '▲' : '▼'
          inning = `${game.linescore.currentInningOrdinal} ${half}`
        } else if (abstractState === 'Final') {
          inning = 'Final'
        } else if (game.gameDate) {
          inning = new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
        }

        setJays({
          status: abstractState as JaysData['status'],
          awayTeam: away.team.name,
          homeTeam: home.team.name,
          awayScore: abstractState !== 'Preview' ? (away.score ?? null) : null,
          homeScore: abstractState !== 'Preview' ? (home.score ?? null) : null,
          inning,
          venue: game.venue?.name,
          isJaysAway: away.team.id === 141,
        })
      } catch {
        setJays(null)
      }
      setJaysLoading(false)
    }
    fetchJays()
    const id = setInterval(fetchJays, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Spotify now-playing — refresh every 10 seconds
  useEffect(() => {
    async function fetchSpotify() {
      try {
        const res = await fetch('/api/spotify/now-playing', { cache: 'no-store' })
        if (res.ok) setSpotify(await res.json())
      } catch {}
    }
    fetchSpotify()
    const id = setInterval(fetchSpotify, 10 * 1000)
    return () => clearInterval(id)
  }, [])

  const jaysWinning =
    jays &&
    jays.status !== 'no-game' &&
    jays.awayScore !== null &&
    jays.homeScore !== null &&
    ((jays.isJaysAway && jays.awayScore > jays.homeScore) ||
      (!jays.isJaysAway && jays.homeScore > jays.awayScore))

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-hidden"
      style={{
        backgroundImage:
          'url(https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/45" />

      {/* Layout */}
      <div className="relative z-10 flex w-full h-full p-5 gap-5">

        {/* ── LEFT PANEL ── Menu */}
        <div className={`flex flex-col ${fontVariable}`} style={{ flex: '1 1 58%' }}>
          <div
            className="flex flex-col h-full rounded-2xl px-12 py-10 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {/* Day of week */}
            <h1
              className="text-white mb-10 leading-none"
              style={{ fontFamily: 'var(--font-playfair)', fontSize: '5rem', fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              {weekday ?? '—'}
            </h1>

            {/* Breakfast */}
            <div className="flex-1">
              <p className="text-white/70 mb-5" style={{ fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Breakfast
              </p>
              {!isValidDay ? (
                <p className="text-white/25 italic text-lg">Trip dates not configured</p>
              ) : breakfast ? (
                <>
                  <p
                    className="text-white leading-tight mb-4"
                    style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.8rem', fontStyle: 'italic', fontWeight: 400 }}
                  >
                    {breakfast.name ?? 'TBD'}
                  </p>
                  <p className="text-white/80" style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>
                    {breakfast.chefs.join('  ·  ')}
                  </p>
                </>
              ) : (
                <p className="text-white/25 italic">No breakfast planned</p>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <span className="text-white/20" style={{ fontSize: '0.6rem', letterSpacing: '0.3em' }}>✦</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Dinner */}
            <div className="flex-1">
              <p className="text-white/70 mb-5" style={{ fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Dinner
              </p>
              {!isValidDay ? (
                <p className="text-white/25 italic text-lg">Trip dates not configured</p>
              ) : dinner ? (
                <>
                  <p
                    className="text-white leading-tight mb-4"
                    style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.8rem', fontStyle: 'italic', fontWeight: 400 }}
                  >
                    {dinner.name ?? 'TBD'}
                  </p>
                  <p className="text-white/80" style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>
                    {dinner.chefs.join('  ·  ')}
                  </p>
                </>
              ) : (
                <p className="text-white/25 italic">No dinner planned</p>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── Widgets */}
        <div className="flex flex-col gap-4" style={{ flex: '1 1 42%' }}>

          {/* Weather */}
          <div
            className="rounded-2xl px-6 py-4 flex flex-col justify-center"
            style={{ flex: '1 1 0', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <p className="text-white/40 text-xs tracking-widest uppercase font-semibold mb-2">
              📍 {WEATHER_LOCATION}
            </p>
            {weather ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-white font-bold" style={{ fontSize: '2.8rem', lineHeight: 1 }}>{weather.temp}°</span>
                    <span className="text-white/40 mb-0.5">C</span>
                  </div>
                  <p className="text-white/60 text-base mt-0.5">{weather.desc}</p>
                  <p className="text-white/30 text-sm mt-0.5">H: {weather.high}° · L: {weather.low}°</p>
                </div>
                <span style={{ fontSize: '3rem' }}>{weather.emoji}</span>
              </div>
            ) : (
              <p className="text-white/30 text-sm">Loading weather…</p>
            )}
          </div>

          {/* Blue Jays */}
          <div
            className="rounded-2xl px-6 py-4 flex flex-col justify-center"
            style={{ flex: '1 1 0', background: 'rgba(0,51,160,0.35)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,163,255,0.25)' }}
          >
            <p className="text-blue-300/70 text-xs tracking-widest uppercase font-semibold mb-2">
              ⚾ Toronto Blue Jays
            </p>
            {jaysLoading ? (
              <p className="text-white/30 text-sm">Loading…</p>
            ) : jays === null ? (
              <p className="text-white/40 text-sm">Unable to load scores</p>
            ) : jays.status === 'no-game' ? (
              <p className="text-white/50 text-base">No game today</p>
            ) : jays.status === 'Preview' ? (
              <div>
                <p className="text-white text-base font-medium">
                  {shortTeamName(jays.awayTeam)} @ {shortTeamName(jays.homeTeam)}
                </p>
                <p className="text-blue-300 text-sm mt-0.5">{jays.inning}</p>
                {jays.venue && <p className="text-white/30 text-xs mt-0.5">{jays.venue}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-center" style={{ minWidth: '4rem' }}>
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-0.5">
                    {shortTeamName(jays.awayTeam)}
                  </p>
                  <p
                    className="text-white font-bold tabular-nums"
                    style={{
                      fontSize: '2.4rem',
                      lineHeight: 1,
                      color: jays.isJaysAway && jaysWinning ? '#86efac' : 'white',
                    }}
                  >
                    {jays.awayScore ?? '—'}
                  </p>
                </div>
                <p className="text-blue-300/60 text-xs font-medium">{jays.inning}</p>
                <div className="text-center" style={{ minWidth: '4rem' }}>
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-0.5">
                    {shortTeamName(jays.homeTeam)}
                  </p>
                  <p
                    className="text-white font-bold tabular-nums"
                    style={{
                      fontSize: '2.4rem',
                      lineHeight: 1,
                      color: !jays.isJaysAway && jaysWinning ? '#86efac' : 'white',
                    }}
                  >
                    {jays.homeScore ?? '—'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Spotify */}
          <div
            className="rounded-2xl p-6 flex flex-col"
            style={{ flex: '2 2 0', background: 'rgba(18,18,18,0.55)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              <p className="text-[#1DB954] text-xs tracking-widest uppercase font-semibold">Now Playing</p>
            </div>

            {!spotify ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="rounded-2xl flex items-center justify-center" style={{ width: '120px', height: '120px', background: 'rgba(255,255,255,0.05)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                <p className="text-white/30 text-sm">Nothing playing</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Album art + track info */}
                <div className="flex gap-5 flex-1 items-center">
                  {spotify.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spotify.albumArt}
                      alt="Album art"
                      className="rounded-xl object-cover shrink-0"
                      style={{ width: '130px', height: '130px' }}
                    />
                  ) : (
                    <div className="rounded-xl shrink-0 flex items-center justify-center" style={{ width: '130px', height: '130px', background: 'rgba(255,255,255,0.07)' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold leading-tight truncate" style={{ fontSize: '1.4rem' }}>
                      {spotify.trackName}
                    </p>
                    <p className="text-white/50 text-base mt-1 truncate">{spotify.artistName}</p>
                    <p className="text-white/25 text-xs mt-2">
                      {spotify.isPlaying ? '▶ Playing' : '⏸ Paused'}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <div
                    className="h-1 rounded-full"
                    style={{
                      background: '#1DB954',
                      width: spotify.durationMs > 0 ? `${Math.min(100, (spotify.progressMs / spotify.durationMs) * 100)}%` : '0%',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
