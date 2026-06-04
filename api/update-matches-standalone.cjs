/**
 * Standalone Match Sync Script (Fixed for MVP Schema)
 * * Usage: node api/update-matches-standalone.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Team name mapping (API names -> Your DB team codes)
const TEAM_MAPPING = {
  'Brazil': 'BRA', 'Brasil': 'BRA',
  'Argentina': 'ARG', 'United States': 'USA', 'USA': 'USA',
  'Mexico': 'MEX', 'México': 'MEX', 'Germany': 'GER',
  'France': 'FRA', 'Spain': 'ESP', 'England': 'ENG',
  'Portugal': 'POR', 'Netherlands': 'NED', 'Belgium': 'BEL',
  'Italy': 'ITA', 'Uruguay': 'URU', 'Colombia': 'COL',
  'Chile': 'CHI', 'Ecuador': 'ECU', 'Peru': 'PER',
  'Canada': 'CAN', 'Morocco': 'MAR', 'Japan': 'JPN',
  'South Korea': 'KOR', 'Korea Republic': 'KOR',
  'Australia': 'AUS', 'Saudi Arabia': 'KSA', 'Iran': 'IRN',
  'Senegal': 'SEN', 'Ghana': 'GHA', 'Cameroon': 'CMR',
  'Tunisia': 'TUN', 'Nigeria': 'NGA', 'Costa Rica': 'CRC',
  'Jamaica': 'JAM', 'Panama': 'PAN',
  // Champions League Teams (Add more as needed)
  'Manchester City FC': 'MCI', 'FC Copenhagen': 'COP',
  'Real Madrid CF': 'RMA', 'RB Leipzig': 'RBL',
  'Paris Saint-Germain FC': 'PSG', 'Real Sociedad de Fútbol': 'RSO',
  'FC Bayern München': 'BAY', 'SS Lazio': 'LAZ',
  'Arsenal FC': 'ARS', 'PSV Eindhoven': 'PSV',
  'FC Barcelona': 'BAR', 'SSC Napoli': 'NAP',
  'Borussia Dortmund': 'BVB', 'Club Atlético de Madrid': 'ATM',
  'FC Interrazionale Milano': 'INT', 'Inter Milan': 'INT',
  'FC Porto': 'FCP'
};

function getTeamId(apiTeamName, tla) {
  if (!apiTeamName) return null; // Safety check
  
  // Try exact match with TLA
  if (tla && tla.length === 3) return tla;
  
  // Try mapping
  if (TEAM_MAPPING[apiTeamName]) return TEAM_MAPPING[apiTeamName];
  
  // Try fuzzy match
  const normalized = apiTeamName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, value] of Object.entries(TEAM_MAPPING)) {
    if (key.toLowerCase().replace(/[^a-z]/g, '') === normalized) return value;
  }
  
  return null; // Return null if not found (don't force it)
}

async function syncMatches() {
  console.log('🔄 Starting match sync (MVP Schema Compatible)...\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Supabase credentials missing in .env');
    process.exit(1);
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('📡 Fetching matches from football-data.org (CL)...');
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY } }
    );

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    console.log(`✅ Fetched ${data.matches.length} matches\n`);

    let updated = 0, created = 0, skipped = 0;
    const errors = [];

    for (const match of data.matches) {
      try {
        // Safety: Ensure team objects exist
        if (!match.homeTeam || !match.awayTeam) {
            skipped++; continue;
        }

        const homeTeamCode = getTeamId(match.homeTeam.name, match.homeTeam.tla);
        const awayTeamCode = getTeamId(match.awayTeam.name, match.awayTeam.tla);

        // If we can't map the team, we use the API Name as fallback (or skip)
        // For MVP, let's store the API Name if mapping fails, so we at least see the match
        const finalHome = homeTeamCode || match.homeTeam.shortName || match.homeTeam.name;
        const finalAway = awayTeamCode || match.awayTeam.shortName || match.awayTeam.name;

        // PREPARE DATA (Mapped to MVP Schema: home_team, away_team)
        const matchData = {
          external_id: match.id.toString(),
          home_team: finalHome,        // <--- FIXED: using 'home_team'
          away_team: finalAway,        // <--- FIXED: using 'away_team'
          start_time: match.utcDate,
          venue: match.venue || 'TBD',
          "group": match.group || 'Group Stage', // <--- FIXED: 'group' reserved word
          status: match.status,
          actual_home_score: match.score.fullTime.home,
          actual_away_score: match.score.fullTime.away,
          full_time_home_score: match.score.fullTime.home,
          full_time_away_score: match.score.fullTime.away,
          last_synced_at: new Date().toISOString()
        };

        // Check if match exists
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id')
          .eq('external_id', match.id.toString())
          .maybeSingle();

        if (existingMatch) {
          const { error } = await supabase
            .from('matches')
            .update(matchData)
            .eq('id', existingMatch.id);
          
          if (error) throw error;
          updated++;
        } else {
          // For Insert, we need a random ID (since table is TEXT PK, not Auto-Increment)
          // We can use the external_id as the ID for simplicity, or generate one
          matchData.id = `match_${match.id}`; 
          
          const { error } = await supabase.from('matches').insert(matchData);
          if (error) throw error;
          created++;
          console.log(`➕ Created: ${finalHome} vs ${finalAway}`);
        }

      } catch (err) {
        errors.push(`Match ${match.id}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Updated: ${updated} | ➕ Created: ${created} | ⏭️ Skipped: ${skipped}`);
    if (errors.length) console.log(`❌ First 5 Errors:`, errors.slice(0, 5));

  } catch (error) {
    console.error('Fatal:', error);
  }
}

syncMatches();