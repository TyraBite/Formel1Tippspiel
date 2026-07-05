import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { appendFileSync } from 'fs'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// Session keys in Firestore event.sessions that hold tippable session times
const TIPPABLE_SESSION_KEYS = ['qualifying', 'race', 'sprint_race', 'fp3_or_sprint_q']

// Trigger sync if a tippable session ended in this window (90 min after end → results stabilise)
const SYNC_WINDOW_MINUTES = 90

async function check() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - SYNC_WINDOW_MINUTES * 60_000)

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
      if (endTime >= windowStart && endTime <= now) {
        shouldSync = true
        matchedSession = `${docSnap.id}/${key} ended ${Math.round((now.getTime() - endTime.getTime()) / 60_000)}min ago`
        break outer
      }
    }
  }

  if (shouldSync) {
    console.log(`[schedule] sync triggered: ${matchedSession}`)
  } else {
    console.log(`[schedule] no session ended in last ${SYNC_WINDOW_MINUTES}min — skip`)
  }

  const output = `should_sync=${shouldSync}`
  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) appendFileSync(githubOutput, `${output}\n`)
}

check().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
