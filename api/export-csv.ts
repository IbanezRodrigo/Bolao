import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select(`
        id, user_id, group_id, match_id,
        home_score, away_score,
        pts_exact_score, pts_winner, pts_goal_diff, pts_one_team,
        pts_total_base, pts_multiplier, pts_final,
        submitted_at, created_at
      `)
      .order('created_at', { ascending: true })

    if (predError) throw predError

    const { data: leaderboard, error: lbError } = await supabase
      .from('leaderboard')
      .select('group_id, user_id, name, surname, total_points, exact_count, winner_count, total_predictions')
      .order('total_points', { ascending: false })

    if (lbError) throw lbError

    const predHeaders = [
      'id', 'user_id', 'group_id', 'match_id',
      'home_score', 'away_score',
      'pts_exact_score', 'pts_winner', 'pts_goal_diff', 'pts_one_team',
      'pts_total_base', 'pts_multiplier', 'pts_final',
      'submitted_at', 'created_at'
    ]
    const predCsv = [
      predHeaders.join(','),
      ...(predictions || []).map(p =>
        predHeaders.map(h => JSON.stringify(p[h as keyof typeof p] ?? '')).join(',')
      )
    ].join('\n')

    const lbHeaders = ['group_id', 'user_id', 'name', 'surname', 'total_points', 'exact_count', 'winner_count', 'total_predictions']
    const lbCsv = [
      lbHeaders.join(','),
      ...(leaderboard || []).map(l =>
        lbHeaders.map(h => JSON.stringify(l[h as keyof typeof l] ?? '')).join(',')
      )
    ].join('\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    const [predUpload, lbUpload] = await Promise.all([
      supabase.storage.from('backups').upload(`predictions_${timestamp}.csv`, predCsv, { contentType: 'text/csv', upsert: false }),
      supabase.storage.from('backups').upload(`leaderboard_${timestamp}.csv`, lbCsv, { contentType: 'text/csv', upsert: false })
    ])

    if (predUpload.error) throw predUpload.error
    if (lbUpload.error) throw lbUpload.error

    return res.json({
      success: true,
      timestamp,
      predictions_rows: predictions?.length ?? 0,
      leaderboard_rows: leaderboard?.length ?? 0,
      files: [`predictions_${timestamp}.csv`, `leaderboard_${timestamp}.csv`]
    })

  } catch (err) {
    console.error('export-csv error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
