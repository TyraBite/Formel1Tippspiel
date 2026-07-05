const BASE = 'https://api.openf1.org/v1'

function getAuthHeaders(): HeadersInit {
  const nodeKey = typeof process !== 'undefined' && typeof window === 'undefined'
    ? process.env.OPENF1_API_KEY : undefined
  const viteKey = typeof window !== 'undefined'
    ? (import.meta as any)?.env?.VITE_OPENF1_API_KEY : undefined
  const key = nodeKey ?? viteKey
  return key ? { Authorization: `Bearer ${key}` } : {}
}

export interface OpenF1Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  circuit_short_name: string
  date_start: string
  year: number
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string
  meeting_key: number
  year: number
}

export interface OpenF1Driver {
  driver_number: number
  full_name: string
  name_acronym: string
  team_name: string
  session_key: number
}

export interface OpenF1Position {
  session_key: number
  driver_number: number
  date: string
  meeting_key: number
  position: number | null  // null for unclassified DNF in live data
}

export interface OpenF1SessionResult {
  session_key: number
  meeting_key: number
  driver_number: number
  position: number | null  // null for unclassified DNF/DNS
  points: number
  dnf: boolean
  dns: boolean
  dsq: boolean
  duration: number | null
  gap_to_leader: number | string
  number_of_laps: number
}

// Sprint and regular sessions share the same session_type name in OpenF1 ("Race"/"Qualifying"),
// so slug-based matching fails. Time-based matching works because they are always on different days.
export function findOpenF1Session(sessions: OpenF1Session[], expectedStart: Date): number | undefined {
  const MAX_DIFF_MS = 2 * 3_600_000
  let best: number | undefined
  let bestDiff = MAX_DIFF_MS
  for (const s of sessions) {
    const diff = Math.abs(new Date(s.date_start).getTime() - expectedStart.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = s.session_key
    }
  }
  return best
}

async function get<T>(path: string, emptyOn404 = false): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`, { headers: getAuthHeaders() })
  if (!res.ok) {
    if (emptyOn404 && res.status === 404) return []
    if (res.status === 401 || res.status === 403) {
      console.warn(`[OpenF1] ${res.status} für ${path} — Auth fehlt, nutze Firestore-Fallback`)
      return []
    }
    throw new Error(`OpenF1 ${res.status}: ${path}`)
  }
  return res.json()
}

export interface OpenF1Weather {
  session_key: number
  date: string
  air_temp: number
  track_temp: number
  humidity: number
  wind_speed: number
  wind_direction: number
  rainfall: boolean
  pressure: number
}

export interface OpenF1RaceControl {
  session_key: number
  date: string
  category: string
  flag: string | null
  message: string
  lap_number: number | null
  scope: string | null
  sector: number | null
  driver_number: number | null
}

// Cache meetings/sessions per year so parallel callers share one HTTP request
const _meetingsCache = new Map<number, Promise<OpenF1Meeting[]>>()
const _sessionsCache = new Map<number, Promise<OpenF1Session[]>>()

export interface OpenF1Interval {
  session_key: number
  driver_number: number
  date: string
  gap_to_leader: number | string | null
  interval: number | string | null
}

export interface OpenF1Stint {
  session_key: number
  driver_number: number
  stint_number: number
  compound: string
  lap_start: number
  lap_end: number | null
  tyre_age_at_start: number
}

export interface OpenF1Pit {
  session_key: number
  driver_number: number
  lap_number: number
  pit_duration: number | null
  stop_duration: number | null
}

export const openf1 = {
  meetings: (year: number): Promise<OpenF1Meeting[]> => {
    if (!_meetingsCache.has(year)) {
      const p = get<OpenF1Meeting>(`/meetings?year=${year}`)
      p.catch(() => _meetingsCache.delete(year))
      _meetingsCache.set(year, p)
    }
    return _meetingsCache.get(year)!
  },
  sessions: (year: number): Promise<OpenF1Session[]> => {
    if (!_sessionsCache.has(year)) {
      const p = get<OpenF1Session>(`/sessions?year=${year}`)
      p.catch(() => _sessionsCache.delete(year)) // clear on failure so retry re-fetches
      _sessionsCache.set(year, p)
    }
    return _sessionsCache.get(year)!
  },
  drivers: (sessionKey: number) => get<OpenF1Driver>(`/drivers?session_key=${sessionKey}`),
  positions: (sessionKey: number) => get<OpenF1Position>(`/position?session_key=${sessionKey}`, true),
  sessionResults: (sessionKey: number) => get<OpenF1SessionResult>(`/session_result?session_key=${sessionKey}`, true),
  weather: (sessionKey: number) => get<OpenF1Weather>(`/weather?session_key=${sessionKey}`, true),
  raceControl: (sessionKey: number) => get<OpenF1RaceControl>(`/race_control?session_key=${sessionKey}`, true),
  intervals: (sessionKey: number) => get<OpenF1Interval>(`/intervals?session_key=${sessionKey}`, true),
  stints: (sessionKey: number) => get<OpenF1Stint>(`/stints?session_key=${sessionKey}`, true),
  pits: (sessionKey: number) => get<OpenF1Pit>(`/pit?session_key=${sessionKey}`, true),
}
