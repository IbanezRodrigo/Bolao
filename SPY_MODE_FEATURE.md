# Spy Mode Feature - Implementation Guide

## Overview
The Spy Mode feature allows users to view other group members' predictions for matches that have already started or finished, while preserving the existing betting functionality for upcoming matches.

## Components

### 1. MatchPredictionsList.tsx (NEW)
**Location**: `components/MatchPredictionsList.tsx`

**Purpose**: Fetches and displays predictions from other users in the same group for a specific match.

**Props**:
- `matchId: string` - The match to show predictions for
- `groupId: string` - The current group context
- `currentUserId?: string` - Current user ID (to filter out their own prediction)
- `matchStatus: 'SCHEDULED' | 'LIVE' | 'FINISHED'` - Match status for conditional rendering

**Features**:
- Fetches predictions from Supabase database (replaces localStorage mock data)
- Joins with user_groups to ensure only group members' predictions are shown
- Joins with profiles to display user names and photos
- Filters out the current user's prediction
- Sorts by points (for FINISHED matches) or alphabetically
- Displays points earned for FINISHED matches
- Shows user photos or initials
- Handles loading, error, and empty states

**Database Queries**:
```typescript
// 1. Get group members
supabase.from('user_groups').select('user_id').eq('group_id', groupId)

// 2. Get predictions for those members
supabase.from('predictions')
  .select('id, user_id, home_score, away_score, is_joker, points')
  .eq('match_id', matchId)
  .in('user_id', userIds)

// 3. Get user profiles
supabase.from('profiles')
  .select('id, name, photo_url')
  .in('id', predUserIds)
```

### 2. MatchCard.tsx (UPDATED)
**Location**: `components/MatchCard.tsx`

**Changes**:
1. **New Props**:
   - `groupId?: string` - Required for fetching group predictions
   - `currentUserId?: string` - Required for filtering out own predictions

2. **New Import**:
   - `MatchPredictionsList` component

3. **Removed Code**:
   - Removed `getOthersPredictions()` function (localStorage-based)
   - Removed `others` variable

4. **New Logic**:
   - Added `isMatchStarted` check: `status !== 'SCHEDULED' || new Date(match.startTime) <= new Date()`

5. **Updated Rendering**:
   - Replaced manual "Other Players" section with `<MatchPredictionsList />` component
   - Conditional rendering: `{showOthers && isMatchStarted && groupId && <MatchPredictionsList ... />}`

**Before**:
```tsx
const others = getOthersPredictions(); // localStorage

{showOthers && (status !== 'SCHEDULED') && (
  <div className="mt-4 ...">
    {others.map((o, idx) => ...)}
  </div>
)}
```

**After**:
```tsx
const isMatchStarted = status !== 'SCHEDULED' || new Date(match.startTime) <= new Date();

{showOthers && isMatchStarted && groupId && (
  <MatchPredictionsList 
    matchId={match.id}
    groupId={groupId}
    currentUserId={currentUserId}
    matchStatus={status}
  />
)}
```

### 3. MatchList.tsx (UPDATED)
**Location**: `components/MatchList.tsx`

**Changes**:
1. **New Prop**:
   - `currentUserId?: string` - Passed from App.tsx

2. **Prop Forwarding**:
   - Passes `groupId` and `currentUserId` to all `<MatchCard />` instances

**Example**:
```tsx
<MatchCard 
  key={match.id}
  match={match}
  lang={lang}
  prediction={predictions[match.id]}
  onClick={() => setSelectedMatch(match)}
  groupId={groupId}
  currentUserId={currentUserId}
/>
```

### 4. App.tsx (UPDATED)
**Location**: `App.tsx`

**Changes**:
- Passes `user?.id` as `currentUserId` prop to `<MatchList />`

**Example**:
```tsx
<MatchList 
  lang={lang} 
  groupId={activeGroupId}
  currentUserId={user?.id}
/>
```

## User Flow

### For Upcoming Matches (SCHEDULED)
1. User sees match card with "PALPITAR" button or existing prediction
2. Click opens PredictionModal to enter/edit scores
3. "Spy Others" button is NOT shown (match hasn't started)
4. Predictions are editable until match starts

### For Live Matches (LIVE)
1. User sees match card with 🔴 LIVE badge
2. Actual scores are displayed (if available)
3. Score inputs are locked (cannot edit prediction)
4. "Spy Others" button appears at bottom
5. Clicking "Spy Others" reveals MatchPredictionsList
6. Shows all group members' predictions in real-time

### For Finished Matches (FINISHED)
1. User sees match card with ✅ FINISHED badge
2. Final scores are displayed
3. User's points earned are shown (e.g., "+25 PTS")
4. "Match Summary" button appears at bottom
5. Clicking reveals MatchPredictionsList with points for each user
6. Users are sorted by points earned (highest first)

## UI States

### MatchCard Footer (Action Bar)
**SCHEDULED**: 
```
"Predictions close 10m before start"
```

**LIVE**:
```
[🔒 LOCKED] ........................... [Spy Others 👁️]
```

**FINISHED**:
```
[+25 PTS] ............................. [Match Summary]
```

### MatchPredictionsList States

**Loading**:
```
[Spinner animation]
```

**Error**:
```
"Failed to load predictions"
```

**Empty**:
```
"No other predictions found."
```

**Populated** (LIVE or FINISHED):
```
OTHER PLAYERS (3)
─────────────────────────
[JD] João Silva       5-2 🃏
[AM] Ana Maria        4-1
[PC] Pedro Costa      3-3
                          [+18 PTS]  ← Only for FINISHED
```

## Database Schema Requirements

### Tables Used:
1. **predictions** - Stores user predictions
   - `id`, `user_id`, `match_id`, `home_score`, `away_score`, `is_joker`, `points`
   
2. **user_groups** - Maps users to groups
   - `user_id`, `group_id`
   
3. **profiles** - User profile information
   - `id`, `name`, `photo_url`

### RLS Policies:
- Ensure authenticated users can read all predictions (for spy mode)
- Ensure authenticated users can only write their own predictions

## Key Features

✅ **Database-Driven**: Replaces localStorage with real Supabase queries
✅ **Group Context**: Only shows predictions from users in the same group
✅ **Privacy**: Current user's prediction is filtered out
✅ **Performance**: Efficient queries with proper joins
✅ **Defensive Rendering**: Loading, error, and empty states handled
✅ **Visual Feedback**: Spinner for loading, error messages, empty states
✅ **Smart Sorting**: By points (FINISHED) or name (LIVE)
✅ **Points Display**: Shows points earned for finished matches
✅ **User Photos**: Displays profile photos or initials fallback
✅ **Animation**: Smooth slide-in transition when revealed
✅ **Accessibility**: Clear labels and ARIA-friendly markup

## Testing Checklist

- [ ] Verify spy mode button appears for LIVE matches
- [ ] Verify "Match Summary" appears for FINISHED matches
- [ ] Verify no spy mode for SCHEDULED matches
- [ ] Verify predictions load correctly from database
- [ ] Verify only group members' predictions are shown
- [ ] Verify current user's prediction is filtered out
- [ ] Verify sorting by points for FINISHED matches
- [ ] Verify user photos/initials display correctly
- [ ] Verify loading spinner appears during fetch
- [ ] Verify error message appears on failure
- [ ] Verify "No other predictions" message when empty
- [ ] Verify points display for FINISHED matches only
- [ ] Verify joker icon (🃏) appears correctly
- [ ] Verify animation when toggling spy mode
- [ ] Verify multiple group members can view simultaneously

## Performance Considerations

1. **Query Optimization**:
   - Fetches group members once per match view
   - Uses `in()` clause for batch queries
   - Joins handled in application layer (not database views)

2. **Caching**:
   - Component uses `useEffect` with dependencies
   - Only refetches when `matchId` or `groupId` changes

3. **Pagination**:
   - Not implemented (assumes <100 predictions per match)
   - Can be added if groups grow very large

## Future Enhancements

1. **Real-time Updates**:
   - Add Supabase real-time subscriptions
   - Auto-refresh when new predictions are added
   - Live updates when points are calculated

2. **Filtering**:
   - Filter by user name
   - Filter by points range
   - Show only users who got exact score

3. **Statistics**:
   - Show average prediction
   - Show most common outcome
   - Show joker usage percentage

4. **Social Features**:
   - Like/comment on predictions
   - Share predictions to social media
   - Challenge other users

## Migration Notes

This feature is **backward compatible** - existing functionality is preserved:
- Prediction saving still works for SCHEDULED matches
- PredictionModal unchanged
- Points calculation unchanged
- Existing UI states unchanged

The only changes visible to users are:
- New "Spy Others" / "Match Summary" buttons
- New predictions list display
- Data now comes from database instead of localStorage mock data
