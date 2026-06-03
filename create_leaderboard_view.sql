-- ============================================================================
-- GROUP LEADERBOARD VIEW WITH COMPLETE SCORING LOGIC
-- ============================================================================
-- This view calculates points for all prediction types:
-- - Exact Score (25 pts)
-- - Correct Difference (18 pts)
-- - Correct Outcome (10 pts)
-- - One Score Correct (4 pts)
-- - Joker Bonus (2x multiplier)
-- ============================================================================

CREATE OR REPLACE VIEW group_leaderboard AS
SELECT 
  ug.group_id,
  ug.user_id,
  CONCAT(p.name, ' ', p.surname) AS display_name,
  p.photo_url AS avatar_url,
  
  -- Total Points Calculation
  COALESCE(SUM(
    CASE 
      -- Only calculate if match is finished and has scores
      WHEN m.actual_home_score IS NOT NULL 
        AND m.actual_away_score IS NOT NULL 
        AND (m.status = 'FINISHED' OR m.status = 'POSTPONED' OR m.status = 'SUSPENDED')
      THEN 
        CASE
          -- Exact Score (25 points)
          WHEN pred.home_score = m.actual_home_score 
            AND pred.away_score = m.actual_away_score 
          THEN 
            CASE WHEN pred.is_joker THEN 50 ELSE 25 END
          
          -- Correct Difference (18 points)
          WHEN (pred.home_score - pred.away_score) = (m.actual_home_score - m.actual_away_score)
            AND SIGN(pred.home_score - pred.away_score) = SIGN(m.actual_home_score - m.actual_away_score)
          THEN 
            CASE WHEN pred.is_joker THEN 36 ELSE 18 END
          
          -- Correct Outcome (10 points)
          WHEN SIGN(pred.home_score - pred.away_score) = SIGN(m.actual_home_score - m.actual_away_score)
          THEN 
            CASE WHEN pred.is_joker THEN 20 ELSE 10 END
          
          -- One Score Correct (4 points)
          WHEN pred.home_score = m.actual_home_score OR pred.away_score = m.actual_away_score
          THEN 
            CASE WHEN pred.is_joker THEN 8 ELSE 4 END
          
          -- Wrong Result (0 points)
          ELSE 0
        END
      ELSE 0
    END
  ), 0) AS total_points,
  
  -- Count of Exact Scores
  COUNT(CASE 
    WHEN pred.home_score = m.actual_home_score 
      AND pred.away_score = m.actual_away_score 
      AND m.actual_home_score IS NOT NULL
    THEN 1 
  END) AS exact_scores

FROM user_groups ug
JOIN profiles p ON ug.user_id = p.id
LEFT JOIN predictions pred ON pred.user_id = ug.user_id
LEFT JOIN matches m ON pred.match_id = m.id
WHERE ug.is_active = TRUE
GROUP BY ug.group_id, ug.user_id, p.name, p.surname, p.photo_url;

-- ============================================================================
-- GRANT SELECT PERMISSION TO AUTHENTICATED USERS
-- ============================================================================
GRANT SELECT ON group_leaderboard TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test: View all leaderboards
-- SELECT * FROM group_leaderboard ORDER BY total_points DESC LIMIT 10;

-- Test: View specific group leaderboard
-- SELECT * FROM group_leaderboard WHERE group_id = 'YOUR_GROUP_ID' ORDER BY total_points DESC;

-- Test: Check if view returns data
-- SELECT COUNT(*) as total_entries FROM group_leaderboard;
