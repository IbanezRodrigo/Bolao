import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4'
const WC_2026_ID = 2000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Aceita tanto "Authorization: Bearer <secret>" quanto "x-cron-secret: <secret>"
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

    // Busca jogos pendentes de resultado (já passaram 2h do início)
    const { data: pendingMatches, error: pendingError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', twoHoursAgo)

    if (pendingError) throw pendingError

    // Busca jogos com equipas TBD que ainda não começaram
    const { data: tbdMatches, error: tbdError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, phase')
      .or('home_team_id.eq.TBD,away_team_id.eq.TBD')
      .neq('status', 'FINISHED')

    if (tbdError) throw tbdError

    // Se não há nada para sincronizar, retorna 200 sem chamar a API externa
    const hasPending = (pendingMatches?.length ?? 0) > 0
    const hasTbd = (tbdMatches?.length ?? 0) > 0

    if (!hasPending && !hasTbd) {
      return res.json({
        synced: 0,
        teams_updated: 0,
        total_pending: 0,
        total_tbd: 0,
        message: 'Nothing to sync'
      })
    }

    // Busca TODOS os jogos da Copa na API externa
    const apiRes = await fetch(
      `${FOOTBALL_API_BASE}/competitions/${WC_2026_ID}/matches`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )

    if (!apiRes.ok) {
      // API externa falhou — retorna 200 com aviso em vez de 500
      console.error(`Football API error: ${apiRes.status}`)
      return res.json({
        synced: 0,
        teams_updated: 0,
        total_pending: pendingMatches?.length ?? 0,
        total_tbd: tbdMatches?.length ?? 0,
        warning: `Football API returned ${apiRes.status} — skipped`
      })
    }

    const apiData = await apiRes.json()
    const allApiMatches: any[] = apiData.matches || []
    const finishedApiMatches = allApiMatches.filter((m: any) => m.status === 'FINISHED')

    let synced = 0
    let teamsUpdated = 0

    // 1 — Actualizar resultados dos jogos terminados
    for (const pending of (pendingMatches || [])) {
      const apiMatch = finishedApiMatches.find(
        (m: any) => String(m.id) === String(pending.external_id)
      )
      if (!apiMatch) continue

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

      const { error: updateError } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', pending.id)

      if (!updateError) synced++
    }

    // 2 — Actualizar equipas TBD em jogos futuros que a API já conhece
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
      teams_updated: teamsUpdated,
      total_pending: pendingMatches?.length ?? 0,
      total_tbd: tbdMatches?.length ?? 0
    })

  } catch (err) {
    console.error('sync-results error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
