import type { Timestamp } from 'firebase/firestore'

export type SessionType =
  | 'fp1' | 'fp2' | 'fp3_or_sprint_q'
  | 'qualifying' | 'sprint_qualifying'
  | 'sprint_race' | 'race'

export type TippableSessionType =
  | 'qualifying' | 'race'
  | 'sprint_qualifying' | 'sprint_race'

export type ReferenceSessionType =
  | 'fp1' | 'fp3_or_sprint_q' | 'qualifying' | 'sprint_qualifying'

export type SessionStatus = 'upcoming' | 'active' | 'provisional' | 'official'

export interface SessionInfo {
  startTime: Timestamp
  endTime: Timestamp
  status: SessionStatus
}

export interface F1Event {
  id: string
  round: number
  name: string        // "Bahrain Grand Prix"
  circuit: string     // "Bahrain International Circuit"
  country: string
  isSprintWeekend: boolean
  sessions: {
    fp1?: SessionInfo
    fp2?: SessionInfo
    fp3_or_sprint_q?: SessionInfo   // FP3 normal WE, Sprint Qualifying on sprint WE
    qualifying: SessionInfo
    sprint_race?: SessionInfo        // sprint weekends only
    race: SessionInfo
  }
}

export interface Driver {
  id: string          // "max_verstappen"
  code: string        // "VER"
  name: string        // "Max Verstappen"
  team: string
  number: number
}

export interface DriverResult {
  position: number
  driverId: string    // matches Driver.id
  driverCode: string
  driverName: string
}

export interface SessionResult {
  id: string          // "${eventId}_${sessionType}"
  eventId: string
  sessionType: SessionType
  results: DriverResult[]   // up to 20 entries
  status: 'provisional' | 'official'
  fetchedAt: Timestamp
  officialAt?: Timestamp
}

export interface Tip {
  id: string          // "${userId}_${eventId}_${sessionType}"
  userId: string
  eventId: string
  sessionType: TippableSessionType
  predictions: Record<string, string>   // { "1": driverId, ..., "10": driverId }
  lockedAt?: Timestamp
  updatedAt: Timestamp
}

export interface ScoreBreakdown {
  pos: number
  predictedDriverId: string
  actualDriverId: string   // "" if position has no actual result
  points: number           // 3 = exact, 1 = in top 10, 0 = miss
}

export interface Score {
  id: string          // "${userId}_${eventId}_${sessionType}"
  userId: string
  eventId: string
  sessionType: TippableSessionType
  points: number
  breakdown: ScoreBreakdown[]
  isProvisional: boolean
  calculatedAt: Timestamp
}

export interface AppUser {
  id: string
  email: string
  displayName: string
}
