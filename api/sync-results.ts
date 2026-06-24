import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4'
const WC_2026_ID = 2000

// Extrai placar final com fallback: fullTime → regularTime → penalties
const extractScore = (score: any): { home: number | null; away: number | null } => {
  const ft = score?.fullTime
  if (ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away }
  }
  const rt = score?.regularTime
  if (rt?.home != null && rt?.away != null) {
    return { home: rt.home, away: rt.away }
  }
  const pen = score?.penalties
  if (pen?.home != null && pen?.away != null) {
    return { home: pen.home, away: pen.away }
  }
  return { home: null, away: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization']
  const cronHeader = req.headers['x-cron-secret']
  const secret = process.env.CRON_SECRET

  const authorized =
    authHeader === `Bearer ${secret}` ||
    cronHeader === secret

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Jogos pendentes de resultado (já passaram 2h do início)
    const { data: pendingMatches, error: pendingError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', twoHoursAgo)

    if (pendingError) throw pendingError

    // Jogos LIVE (entre start_time e 2h atrás) — para placar parcial
    const now = new Date().toISOString()
    const { data: liveMatches, error: liveError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .gte('start_time', twoHoursAgo)
      .lte('start_time', now)

    if (liveError) throw liveError

    // Jogos com times TBD
    const { data: tbdMatches, error: tbdError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, phase')
      .or('home_team_id.eq.TBD,away_team_id.eq.TBD')
      .neq('status', 'FINISHED')

    if (tbdError) throw tbdError

    const hasPending = (pendingMatches?.length ?? 0) > 0
    const hasLive    = (liveMatches?.length ?? 0) > 0
    const hasTbd     = (tbdMatches?.length ?? 0) > 0

    if (!hasPending && !hasLive && !hasTbd) {
      return res.json({
        synced: 0,
        live_updated: 0,
        teams_updated: 0,
        total_pending: 0,
        total_live: 0,
        total_tbd: 0,
        message: 'Nothing to sync'
      })
    }

    // Busca todos os jogos da Copa na API externa
    const apiRes = await fetch(
      `${FOOTBALL_API_BASE}/competitions/${WC_2026_ID}/matches`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )

    if (!apiRes.ok) {
      console.error(`Football API error: ${apiRes.status}`)
      return res.json({
        synced: 0,
        live_updated: 0,
        teams_updated: 0,
        total_pending: pendingMatches?.length ?? 0,
        total_live: liveMatches?.length ?? 0,
        total_tbd: tbdMatches?.length ?? 0,
        warning: `Football API returned ${apiRes.status} — skipped`
      })
    }

    const apiData = await apiRes.json()
    const allApiMatches: any[] = apiData.matches || []
    const finishedApiMatches = allApiMatches.filter((m: any) => m.status === 'FINISHED')

    let synced = 0
    let liveUpdated = 0
    let teamsUpdated = 0
    let skippedNullScore = 0
    let skippedTeamMismatch = 0

    // 1 — Jogos terminados: só grava se placar vier válido
    for (const pending of (pendingMatches || [])) {
      const apiMatch = finishedApiMatches.find(
        (m: any) => String(m.id) === String(pending.external_id)
      )
      if (!apiMatch) continue

      // Guard: verify teams match before writing any score.
      // Catches swapped external_ids (e.g. FRA row holding NOR's external_id).
      // Skip TBD slots — those are resolved by the TBD loop below.
      const apiHome = apiMatch.homeTeam?.tla
      const apiAway = apiMatch.awayTeam?.tla
      const homeOk = pending.home_team_id === 'TBD' || !apiHome || apiHome === pending.home_team_id
      const awayOk = pending.away_team_id === 'TBD' || !apiAway || apiAway === pending.away_team_id
      if (!homeOk || !awayOk) {
        skippedTeamMismatch++
        console.error(
          `❌ Team mismatch on external_id ${pending.external_id}: ` +
          `DB expects ${pending.home_team_id} vs ${pending.away_team_id}, ` +
          `API returned ${apiHome} vs ${apiAway} — skipping to prevent wrong score`
        )
        continue
      }

      const { home, away } = extractScore(apiMatch.score)

      // Se placar ainda nulo, não grava — aguarda próximo cron
      if (home === null || away === null) {
        skippedNullScore++
        console.warn(`⚠️ Score null for match ${pending.external_id} — skipping`)
        continue
      }

      const updatePayload: any = {
        status: 'FINISHED',
        actual_home_score: home,
        actual_away_score: away,
        updated_at: new Date().toISOString()
      }

      if (pending.home_team_id === 'TBD' && apiMatch.homeTeam?.tla) {
        updatePayload.home_team_id = apiMatch.homeTeam.tla
      }
      if (pending.away_team_id === 'TBD' && apiMatch.awayTeam?.tla) {
        updatePayload.away_team_id = apiMatch.awayTeam.tla
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', pending.id)

      if (!updateError) synced++
    }

    // 2 — Jogos LIVE: salva placar parcial
    for (const live of (liveMatches || [])) {
      const apiMatch = allApiMatches.find(
        (m: any) => String(m.id) === String(live.external_id)
      )
      if (!apiMatch) continue

      const liveStatuses = ['IN_PLAY', 'PAUSED', 'HALFTIME', 'LIVE']
      if (!liveStatuses.includes(apiMatch.status)) continue

      // Guard: same team mismatch check as the FINISHED loop
      const apiHomeLive = apiMatch.homeTeam?.tla
      const apiAwayLive = apiMatch.awayTeam?.tla
      const homeOkLive = live.home_team_id === 'TBD' || !apiHomeLive || apiHomeLive === live.home_team_id
      const awayOkLive = live.away_team_id === 'TBD' || !apiAwayLive || apiAwayLive === live.away_team_id
      if (!homeOkLive || !awayOkLive) {
        skippedTeamMismatch++
        console.error(
          `❌ Team mismatch (LIVE) on external_id ${live.external_id}: ` +
          `DB expects ${live.home_team_id} vs ${live.away_team_id}, ` +
          `API returned ${apiHomeLive} vs ${apiAwayLive} — skipping to prevent wrong score`
        )
        continue
      }

      const { home, away } = extractScore(apiMatch.score)

      const updatePayload: any = {
        status: 'LIVE',
        updated_at: new Date().toISOString()
      }

      if (home !== null) updatePayload.actual_home_score = home
      if (away !== null) updatePayload.actual_away_score = away

      const { error } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', live.id)

      if (!error) liveUpdated++
    }

    // 3 — Times TBD
    for (const tbd of (tbdMatches || [])) {
      const apiMatch = allApiMatches.find(
        (m: any) => String(m.id) === String(tbd.external_id)
      )
      if (!apiMatch) continue

      const homeTla = apiMatch.homeTeam?.tla
      const awayTla = apiMatch.awayTeam?.tla

      const needsUpdate =
        (tbd.home_team_id === 'TBD' && homeTla && homeTla !== 'TBD') ||
        (tbd.away_team_id === 'TBD' && awayTla && awayTla !== 'TBD')

      if (!needsUpdate) continue

      const updatePayload: any = { updated_at: new Date().toISOString() }
      if (tbd.home_team_id === 'TBD' && homeTla && homeTla !== 'TBD') {
        updatePayload.home_team_id = homeTla
      }
      if (tbd.away_team_id === 'TBD' && awayTla && awayTla !== 'TBD') {
        updatePayload.away_team_id = awayTla
      }

      const { error: tbdUpdateError } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', tbd.id)

      if (!tbdUpdateError) teamsUpdated++
    }

    return res.json({
      synced,
      live_updated: liveUpdated,
      teams_updated: teamsUpdated,
      skipped_null_score: skippedNullScore,
      skipped_team_mismatch: skippedTeamMismatch,
      total_pending: pendingMatches?.length ?? 0,
      total_live: liveMatches?.length ?? 0,
      total_tbd: tbdMatches?.length ?? 0
    })

  } catch (err) {
    console.error('sync-results error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
