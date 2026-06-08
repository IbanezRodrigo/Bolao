import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4'
const WC_2026_ID = 2000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Busca jogos pendentes de resultado (já passaram 2h do início)
    const { data: pendingMatches, error } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', twoHoursAgo)

    if (error) throw error

    // Busca jogos com equipas TBD que ainda não começaram
    const { data: tbdMatches, error: tbdError } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, phase')
      .or('home_team_id.eq.TBD,away_team_id.eq.TBD')
      .neq('status', 'FINISHED')

    if (tbdError) throw tbdError

    // Uma só chamada à API — busca TODOS os jogos da Copa (não só FINISHED)
    const apiRes = await fetch(
      `${FOOTBALL_API_BASE}/competitions/${WC_2026_ID}/matches`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )
    if (!apiRes.ok) throw new Error(`Football API error: ${apiRes.status}`)

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

      // Se as equipas ainda eram TBD, actualiza também
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

      // Só actualiza se a API já tem as equipas definidas (não TBD/null)
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
