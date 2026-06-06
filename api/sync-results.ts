import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4'
const WC_2026_ID = 2000  // football-data.org ID para FIFA World Cup

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Segurança — só aceita chamadas com secret correto
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Busca jogos no Supabase que não estão FINISHED mas já passaram do horário
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: pendingMatches, error } = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id, start_time, status')
      .neq('status', 'FINISHED')
      .lt('start_time', twoHoursAgo)

    if (error) throw error
    if (!pendingMatches || pendingMatches.length === 0) {
      return res.json({ synced: 0, message: 'No pending matches' })
    }

    // Busca resultados da Copa na API
    const apiRes = await fetch(
      `${FOOTBALL_API_BASE}/competitions/${WC_2026_ID}/matches?status=FINISHED`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )
    if (!apiRes.ok) throw new Error(`Football API error: ${apiRes.status}`)
    const apiData = await apiRes.json()
    const finishedMatches: any[] = apiData.matches || []

    // Cruza por external_id e actualiza
    let synced = 0
    for (const pending of pendingMatches) {
      const apiMatch = finishedMatches.find(
        (m: any) => String(m.id) === String(pending.external_id)
      )
      if (!apiMatch) continue

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          status: 'FINISHED',
          actual_home_score: apiMatch.score.fullTime.home,
          actual_away_score: apiMatch.score.fullTime.away,
          updated_at: new Date().toISOString()
        })
        .eq('id', pending.id)

      if (!updateError) synced++
    }

    return res.json({ synced, total: pendingMatches.length })
  } catch (err) {
    console.error('sync-results error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
