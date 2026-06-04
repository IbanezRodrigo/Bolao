// ============================================================================
// BOLÃO FIFA 2026 — TYPES v2.0
// ============================================================================

export type Language   = 'pt' | 'en' | 'es';
export type GroupRole  = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MatchPhase = 'GROUP' | 'R16' | 'QF' | 'SF' | 'FINAL';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

// ----------------------------------------------------------------------------
// USER / PROFILE
// ----------------------------------------------------------------------------
export interface User {
  id?: string;
  email: string;
  name: string;
  surname: string;
  photo?: string;
  preferredTeam: string;
  predictions: Record<string, Prediction>;
  groupIds: string[];
}

// ----------------------------------------------------------------------------
// GROUP
// ----------------------------------------------------------------------------
export interface Group {
  id: string;
  code: string;
  name: string;
  description?: string;
  photoUrl?: string;
  initials: string;
  languageDefault: Language;
  ownerUserId: string;
  isPrivate: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: number;
  updatedAt: number;
}

export interface UserGroup {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  joinedAt: number;
  isActive: boolean;
}

// ----------------------------------------------------------------------------
// TEAM
// ----------------------------------------------------------------------------
export interface Team {
  id: string;
  name: Record<Language, string>;
  flag: string;
  color: string;
}

// ----------------------------------------------------------------------------
// MATCH
// ----------------------------------------------------------------------------
export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;       // ISO format
  venue: string;
  group: string;           // 'A', 'B', ... ou 'R16', 'QF', etc.
  phase: MatchPhase;       // NOVO: para multiplicador de pontos
  actualHomeScore?: number;
  actualAwayScore?: number;
  status: MatchStatus;
  externalId?: string;     // ID da API externa
}

// ----------------------------------------------------------------------------
// PREDICTION
// ----------------------------------------------------------------------------
export interface Prediction {
  homeScore: number;
  awayScore: number;
  timestamp: number;       // submitted_at para desempate
  isJoker?: boolean;

  // Pontuação calculada (preenchida após jogo terminar)
  ptsExactScore?: number;  // 10 pts
  ptsWinner?: number;      // 5 pts
  ptsGoalDiff?: number;    // 3 pts
  ptsOneTeam?: number;     // 1 pt
  ptsTotalBase?: number;   // soma base
  ptsMultiplier?: number;  // fator da fase
  ptsFinal?: number;       // total final
}

// ----------------------------------------------------------------------------
// SCORING
// ----------------------------------------------------------------------------
export interface ScoringConfig {
  exactScore:   number;   // 10
  winner:       number;   // 5
  correctDraw:  number;   // 5
  goalDiff:     number;   // 3
  oneTeamScore: number;   // 1
  multGroup:    number;   // 1.0
  multR16:      number;   // 1.2
  multQF:       number;   // 1.4
  multSF:       number;   // 1.6
  multFinal:    number;   // 2.0
}

// ----------------------------------------------------------------------------
// LEADERBOARD
// ----------------------------------------------------------------------------
export interface LeaderboardEntry {
  userId:              string;
  name:                string;
  surname:             string;
  photoUrl?:           string;
  totalPoints:         number;
  exactCount:          number;
  winnerCount:         number;
  totalPredictions:    number;
  avgSubmissionOffset: number;
}

// ----------------------------------------------------------------------------
// TRANSLATIONS
// ----------------------------------------------------------------------------
export interface Translations {
  login: string;
  register: string;
  email: string;
  password: string;
  name: string;
  surname: string;
  preferredTeam: string;
  prefTeamInfo: string;
  save: string;
  cancel: string;
  edit: string;
  locked: string;
  matchStartMessage: string;
  logout: string;
  welcome: string;
  predictions: string;
  noPredictions: string;
  alreadyRegistered: string;
  invalidCredentials: string;
  ranking: string;
  matches: string;
  points: string;
  rank: string;
  player: string;
  groups: string;
  joinGroup: string;
  createGroup: string;
  groupCode: string;
  selectGroup: string;
  noGroups: string;
  myGroups: string;
  joker: string;
  doublePoints: string;
  rules: string;
  scoringTitle: string;
  deadlineTitle: string;
  deadlineInfo: string;
  tiebreakerTitle: string;
  tiebreaker1: string;
  tiebreaker2: string;
  tiebreaker3: string;
  exactScoreDesc: string;
  diffScoreDesc: string;
  outcomeScoreDesc: string;
  oneSideScoreDesc: string;
}
