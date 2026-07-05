import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { appendFileSync } from 'fs'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// Session keys in Firestore event.sessions that hold tippable session times
const TIPPABLE_SESSION_KEYS = ['qualifying', 'race', 'sprint_race', 'fp3_or_sprint_q']

// Poll window: start 30 min before expected session end, keep going 90 min after
const PRE_SESSION_BUFFER_MINUTES = 30
const POST_SESSION_WINDOW_MINUTES = 90

async function check() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - POST_SESSION_WINDOW_MINUTES * 60_000)
  const windowEnd = new Date(now.getTime() + PRE_SESSION_BUFFER_MINUTES * 60_000)

  const snap = await db.collection('events').get()
  let shouldSync = false
  let matchedSession = ''

  outer: for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const sessions = data.sessions ?? {}
    for (const key of TIPPABLE_SESSION_KEYS) {
      const session = sessions[key]
      const endTime: Date | undefined = session?.endTime?.toDate?.()
      if (!endTime) continue
      if (endTime >= windowStart && endTime <= windowEnd) {
        shouldSync = true
        const diffMin = Math.round((now.getTime() - endTime.getTime()) / 60_000)
        matchedSession = diffMin >= 0
          ? `${docSnap.id}/${key} ended ${diffMin}min ago`
          : `${docSnap.id}/${key} ends in ${-diffMin}min`
        break outer
      }
    }
  }

  if (shouldSync) {
    console.log(`[schedule] sync triggered: ${matchedSession}`)
  } else {
    console.log(`[schedule] no session in active window — skip`)
  }

  const output = `should_sync=${shouldSync}`
  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) appendFileSync(githubOutput, `${output}\n`)
}

check().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
