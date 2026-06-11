import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4'
const WC_2026_ID = 2000

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

    // Jogos pendentes: ainda não FINISHED e já começaram (passou start_time)
    const { data: pendingMatches, error: pendingError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', twoHoursAgo)

    if (pendingError) throw pendingError

    // Jogos que começaram há menos de 2h (podem estar LIVE agora)
    const now = new Date().toISOString()
    const { data: liveMatches, error: liveError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', now)
      .gte('start_time', twoHoursAgo)

    if (liveError) throw liveError

    // Jogos com times TBD
    const { data: tbdMatches, error: tbdError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, phase')
      .or('home_team_id.eq.TBD,away_team_id.eq.TBD')
      .neq('status', 'FINISHED')

    if (tbdError) throw tbdError

    const allPending = [...(pendingMatches || []), ...(liveMatches || [])]
    const hasPending = allPending.length > 0
    const hasTbd = (tbdMatches?.length ?? 0) > 0

    if (!hasPending && !hasTbd) {
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
        total_pending: allPending.length,
        total_tbd: tbdMatches?.length ?? 0,
        warning: `Football API returned ${apiRes.status} — skipped`
      })
    }

    const apiData = await apiRes.json()
    const allApiMatches: any[] = apiData.matches || []

    let synced = 0
    let liveUpdated = 0
    let teamsUpdated = 0

    // 1 — Atualizar jogos FINISHED e LIVE/IN_PLAY
    for (const pending of allPending) {
      const apiMatch = allApiMatches.find(
        (m: any) => String(m.id) === String(pending.external_id)
      )
      if (!apiMatch) continue

      const apiStatus = apiMatch.status // FINISHED | IN_PLAY | PAUSED | HALFTIME

      if (apiStatus === 'FINISHED') {
        // Jogo terminou — salva placar final
        const updatePayload: any = {
          status: 'FINISHED',
          actual_home_score: apiMatch.score.fullTime.home,
          actual_away_score: apiMatch.score.fullTime.away,
          updated_at: new Date().toISOString()
        }

        if (pending.home_team_id === 'TBD' && apiMatch.homeTeam?.tla) {
          updatePayload.home_team_id = apiMatch.homeTeam.tla
        }
        if (pending.away_team_id === 'TBD' && apiMatch.awayTeam?.tla) {
          updatePayload.away_team_id = apiMatch.awayTeam.tla
        }

        const { error } = await supabase
          .from('matches')
          .update(updatePayload)
          .eq('id', pending.id)

        if (!error) synced++

      } else if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(apiStatus)) {
        // Jogo ao vivo — salva placar parcial e muda status para LIVE
        const homeScore = apiMatch.score?.fullTime?.home ?? apiMatch.score?.halfTime?.home ?? null
        const awayScore = apiMatch.score?.fullTime?.away ?? apiMatch.score?.halfTime?.away ?? null

        const updatePayload: any = {
          status: 'LIVE',
          updated_at: new Date().toISOString()
        }

        // Só salva placar se a API retornou valores válidos
        if (homeScore !== null) updatePayload.actual_home_score = homeScore
        if (awayScore !== null) updatePayload.actual_away_score = awayScore

        const { error } = await supabase
          .from('matches')
          .update(updatePayload)
          .eq('id', pending.id)

        if (!error) liveUpdated++
      }
    }

    // 2 — Atualizar times TBD em jogos futuros
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

      const { error } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', tbd.id)

      if (!error) teamsUpdated++
    }

    return res.json({
      synced,
      live_updated: liveUpdated,
      teams_updated: teamsUpdated,
      total_pending: pendingMatches?.length ?? 0,
      total_live: liveMatches?.length ?? 0,
      total_tbd: tbdMatches?.length ?? 0
    })

  } catch (err) {
    console.error('sync-results error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
