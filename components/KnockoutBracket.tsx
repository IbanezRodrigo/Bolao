import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Language } from '../types';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import type { Match, Team } from '../types';
import { R32_BRACKET_ORDER } from './bracketConfig';

interface Props {
  lang: Language;
  onShowTable?: () => void;
}

type KnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';

const ROUNDS: KnockoutRound[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

const ROUND_PILL: Record<KnockoutRound, Record<Language, string>> = {
  R32:   { pt: 'R32',     en: 'R32',     es: 'R32'     },
  R16:   { pt: 'Oitavas', en: 'R16',     es: 'Octavos' },
  QF:    { pt: 'Quartas', en: 'QF',      es: 'Cuartos' },
  SF:    { pt: 'Semis',   en: 'SF',      es: 'Semis'   },
  FINAL: { pt: 'Final',   en: 'Final',   es: 'Final'   },
};

const ROUND_LABEL: Record<KnockoutRound, Record<Language, string>> = {
  R32:   { pt: 'Round de 32',      en: 'Round of 32',    es: 'Ronda de 32'      },
  R16:   { pt: 'Oitavas de Final', en: 'Round of 16',    es: 'Octavos de Final' },
  QF:    { pt: 'Quartas de Final', en: 'Quarter-Finals', es: 'Cuartos de Final' },
  SF:    { pt: 'Semifinais',       en: 'Semi-Finals',    es: 'Semifinales'      },
  FINAL: { pt: 'Final',            en: 'Final',          es: 'Final'            },
};

const LOCALE_MAP: Record<Language, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_H     = 96;           // px — fixed height of each match card
const CARD_W     = 172;          // px — width of each match card
const COL_GAP    = 40;           // px — width of connector SVG between columns
const HDR_H      = 32;           // px — column header height (round label)
const TOTAL_H    = 16 * CARD_H;  // px — full bracket height (driven by R32's 16 slots)

const SLOT_COUNT: Record<KnockoutRound, number> = {
  R32: 16, R16: 8, QF: 4, SF: 2, FINAL: 1,
};

// ─── Position helpers (all pure, module-level for stability) ──────────────────
const ri        = (r: KnockoutRound) => ROUNDS.indexOf(r);
const spacing   = (roundIdx: number) => CARD_H * Math.pow(2, roundIdx);
const topOff    = (roundIdx: number) => (spacing(roundIdx) - CARD_H) / 2;
const cardTop   = (roundIdx: number, slot: number) => topOff(roundIdx) + slot * spacing(roundIdx);
const cardCtr   = (roundIdx: number, slot: number) => cardTop(roundIdx, slot) + CARD_H / 2;

// ─── TBD detection ────────────────────────────────────────────────────────────
const isTBD = (team: Team): boolean =>
  !team.flag || /^tbd$/i.test((team.name.en ?? '').trim());

const isTBDId = (id: string): boolean => !id || /^tbd$/i.test(id.trim());

// ─── Bracket-slot resolution ──────────────────────────────────────────────────
// Index every (non-TBD) team in the hardcoded R32 order to its slot. Each team
// belongs to exactly one slot, so a single known team identifies the match.
const R32_TEAM_SLOT: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  R32_BRACKET_ORDER.forEach(([a, b], slot) => {
    if (!isTBDId(a)) map[a] = slot;
    if (!isTBDId(b)) map[b] = slot;
  });
  return map;
})();

// R32 slot is resolved by ANY one known team — not the full pair. The group
// stage may still be unfinished, so a match can be e.g. "CIV x TBD" in the DB
// while the config has "CIV x NOR"; matching on either side alone still lands
// it in the right slot. Returns -1 only when neither team is known/configured.
const r32Slot = (m: Match): number => {
  const h = m.homeTeam.id, w = m.awayTeam.id;
  if (!isTBDId(h) && R32_TEAM_SLOT[h] !== undefined) return R32_TEAM_SLOT[h];
  if (!isTBDId(w) && R32_TEAM_SLOT[w] !== undefined) return R32_TEAM_SLOT[w];
  return -1;
};

// For rounds after R32, a match's slot is derived by lineage: each of its teams
// is the winner of exactly one match in the previous round, so the parent slot
// is floor(prevSlot / 2). TBD teams are skipped; -1 when neither team resolves.
const lineageSlot = (m: Match, prevOrdered: (Match | null)[]): number => {
  for (const teamId of [m.homeTeam.id, m.awayTeam.id]) {
    if (isTBDId(teamId)) continue;
    const pi = prevOrdered.findIndex(
      pm => pm != null && (pm.homeTeam.id === teamId || pm.awayTeam.id === teamId),
    );
    if (pi >= 0) return Math.floor(pi / 2);
  }
  return -1;
};

const byStartTime = (a: Match, b: Match) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

// Place a round (R16 and later) into a fixed-length slot array by lineage from
// the previous round. Matches whose teams trace back to a known slot land
// there; anything left over (still-TBD) fills the remaining holes in kickoff
// order so nothing is dropped. R32 does NOT go through here — it's built from
// the hardcoded config (see buildR32).
const orderRound = (
  round: KnockoutRound,
  roundMatches: Match[],
  prevOrdered: (Match | null)[],
): (Match | null)[] => {
  const slots = SLOT_COUNT[round];
  const arr: (Match | null)[] = new Array(slots).fill(null);
  const placed = new Set<string>();

  for (const m of roundMatches) {
    const slot = lineageSlot(m, prevOrdered);
    if (slot >= 0 && slot < slots && arr[slot] === null) {
      arr[slot] = m;
      placed.add(m.id);
    }
  }

  const leftovers = roundMatches.filter(m => !placed.has(m.id)).sort(byStartTime);
  let k = 0;
  for (let i = 0; i < slots && k < leftovers.length; i++) {
    if (arr[i] === null) arr[i] = leftovers[k++];
  }
  return arr;
};

// Placeholder team used when a hardcoded slot references a team not present in
// the loaded match data (or a 'TBD' slot still to be filled in).
const TBD_FALLBACK: Team = {
  id: 'TBD',
  name: { pt: 'A Definir', en: 'TBD', es: 'Por Definir' },
  flag: '',
  color: '#888888',
};

// Build the Round-of-32 column ENTIRELY from the hardcoded bracket order.
// Teams come from config (never the DB), so the slots always show what was
// configured. The DB match is used only to overlay kickoff time, status and
// score — linked by the one known team, with home/away score alignment. Slots
// whose teams aren't in the DB yet simply show the configured teams with no
// result. R16+ then read the DB and flow winners down from here.
const buildR32 = (dbMatches: Match[], teamFor: (tla: string) => Team): Match[] => {
  const linked: (Match | null)[] = new Array(16).fill(null);
  for (const m of dbMatches) {
    const slot = r32Slot(m);
    if (slot >= 0 && slot < 16 && linked[slot] === null) linked[slot] = m;
  }

  return R32_BRACKET_ORDER.map(([a, b], slot): Match => {
    const db = linked[slot];
    let homeScore = db?.actualHomeScore;
    let awayScore = db?.actualAwayScore;

    // Align the DB score to the configured home/away orientation.
    if (db && (homeScore !== undefined || awayScore !== undefined)) {
      const known = !isTBDId(a) ? a : (!isTBDId(b) ? b : null);
      if (known) {
        const knownIsConfigHome = known === a;
        const knownIsDbHome = db.homeTeam.id === known;
        const homeIsDbHome = knownIsConfigHome === knownIsDbHome;
        homeScore = homeIsDbHome ? db.actualHomeScore : db.actualAwayScore;
        awayScore = homeIsDbHome ? db.actualAwayScore : db.actualHomeScore;
      }
    }

    return {
      id: db?.id ?? `r32-slot-${slot}`,
      homeTeam: teamFor(a),
      awayTeam: teamFor(b),
      startTime: db?.startTime ?? '',
      venue: db?.venue ?? '',
      group: db?.group ?? '',
      phase: 'R32',
      status: db?.status ?? 'SCHEDULED',
      actualHomeScore: homeScore,
      actualAwayScore: awayScore,
      externalId: db?.externalId,
    };
  });
};

// ─── TBD placeholder icon (Google shield style) ───────────────────────────────
const TBDIcon: React.FC = () => (
  <svg
    height={20} width={20} aria-hidden="true" viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}
  >
    <path
      fill="#e2e8f0"
      d="M12 23.55a2.27 2.27 0 0 1-.38-.03 2.689 2.689 0 0 1-.32-.087c-2.644-.875-4.744-2.489-6.3-4.841-1.556-2.373-2.333-4.93-2.333-7.671V5.379c0-.466.136-.885.408-1.254a2.161 2.161 0 0 1 1.05-.817L11.213.625c.272-.097.534-.146.787-.146s.515.049.787.146l7.088 2.683a2.16 2.16 0 0 1 1.05.817c.272.37.408.787.408 1.254v5.542c0 2.742-.777 5.298-2.333 7.67-1.556 2.353-3.656 3.967-6.3 4.842a2.297 2.297 0 0 1-.7.117Z"
    />
  </svg>
);

// ─── Match card ───────────────────────────────────────────────────────────────
interface MatchCardProps {
  match: Match | null;
  lang: Language;
  roundIdx: number;
  slot: number;
}

const MatchCard = React.memo<MatchCardProps>(({ match, lang, roundIdx, slot }) => {
  const top = cardTop(roundIdx, slot);
  const locale = LOCALE_MAP[lang];

  // Empty slot — render a muted TBD placeholder
  if (!match) {
    return (
      <div style={{ position: 'absolute', top, left: 0, width: CARD_W, height: CARD_H, display: 'flex', flexDirection: 'column' }}
        className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
        <TeamRow tbd lang={lang} />
        <div className="h-px bg-slate-100 mx-2.5 flex-shrink-0" />
        <TeamRow tbd lang={lang} />
      </div>
    );
  }

  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'LIVE';
  const hasScore   = match.actualHomeScore !== undefined && match.actualAwayScore !== undefined;
  const homeWins   = isFinished && hasScore && match.actualHomeScore! > match.actualAwayScore!;
  const awayWins   = isFinished && hasScore && match.actualAwayScore! > match.actualHomeScore!;

  const matchDate = new Date(match.startTime);
  const hasDate   = !!match.startTime && !isNaN(matchDate.getTime());
  const dateStr   = hasDate ? matchDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const timeStr   = hasDate ? matchDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      style={{ position: 'absolute', top, left: 0, width: CARD_W, height: CARD_H, display: 'flex', flexDirection: 'column' }}
      className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm"
    >
      {/* Date / status header */}
      <div className={`flex items-center justify-between px-2.5 flex-shrink-0 ${isLive ? 'bg-red-50' : 'bg-slate-50/60'}`}
        style={{ height: 20 }}>
        {isLive ? (
          <span className="text-[8.5px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />
            Live
          </span>
        ) : isFinished ? (
          <span className="text-[8.5px] font-black text-slate-300 uppercase tracking-widest">
            {lang === 'pt' ? 'Encerrado' : lang === 'es' ? 'Finalizado' : 'FT'}
          </span>
        ) : (
          <>
            <span className="text-[8.5px] font-semibold text-slate-400 truncate">{dateStr}</span>
            <span className="text-[8.5px] font-semibold text-slate-400 flex-shrink-0 ml-1">{timeStr}</span>
          </>
        )}
      </div>

      {/* Home team */}
      <TeamRow
        team={match.homeTeam}
        lang={lang}
        winner={homeWins}
        score={hasScore && (isFinished || isLive) ? match.actualHomeScore : undefined}
      />

      <div className="h-px bg-slate-100 mx-2.5 flex-shrink-0" />

      {/* Away team */}
      <TeamRow
        team={match.awayTeam}
        lang={lang}
        winner={awayWins}
        score={hasScore && (isFinished || isLive) ? match.actualAwayScore : undefined}
      />
    </div>
  );
});

// ─── Team row (reused for home, away, and TBD states) ─────────────────────────
interface TeamRowProps {
  team?: Team;
  lang?: Language;
  winner?: boolean;
  score?: number;
  tbd?: boolean;
}

const TeamRow: React.FC<TeamRowProps> = ({ team, lang = 'en', winner = false, score, tbd = false }) => {
  const isTbd = tbd || (team ? isTBD(team) : true);
  const name  = isTbd ? 'TBD' : team!.name[lang];

  return (
    <div
      className={`flex items-center px-2.5 gap-1.5 flex-1 min-h-0 ${winner ? 'bg-emerald-50/50' : ''}`}
    >
      {isTbd ? (
        <TBDIcon />
      ) : (
        <span className="text-[15px] leading-none flex-shrink-0">{team!.flag}</span>
      )}
      <span
        className={`text-[11px] font-bold truncate flex-1 leading-tight ${
          winner ? 'text-slate-900' : isTbd ? 'text-slate-300' : 'text-slate-600'
        }`}
      >
        {name}
      </span>
      {score !== undefined && (
        <span className={`text-[12px] font-black flex-shrink-0 ${winner ? 'text-slate-900' : 'text-slate-400'}`}>
          {score}
        </span>
      )}
    </div>
  );
};

// ─── Connector SVG (bracket lines between two adjacent rounds) ────────────────
interface ConnectorSVGProps {
  fromRoundIdx: number;
}

const ConnectorSVG: React.FC<ConnectorSVGProps> = ({ fromRoundIdx }) => {
  const toRoundIdx = fromRoundIdx + 1;
  const count      = SLOT_COUNT[ROUNDS[toRoundIdx]];

  return (
    <svg
      width={COL_GAP}
      height={TOTAL_H}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {Array.from({ length: count }, (_, j) => {
        const topY  = cardCtr(fromRoundIdx, j * 2);
        const botY  = cardCtr(fromRoundIdx, j * 2 + 1);
        const tgtY  = cardCtr(toRoundIdx, j);
        const midX  = COL_GAP / 2;

        return (
          <g key={j}>
            {/* Horizontal stub from top source match */}
            <line x1={0} y1={topY} x2={midX} y2={topY} stroke="#e2e8f0" strokeWidth={1.5} />
            {/* Horizontal stub from bottom source match */}
            <line x1={0} y1={botY} x2={midX} y2={botY} stroke="#e2e8f0" strokeWidth={1.5} />
            {/* Vertical bridge between the two source matches */}
            <line x1={midX} y1={topY} x2={midX} y2={botY} stroke="#e2e8f0" strokeWidth={1.5} />
            {/* Horizontal stub to target match */}
            <line x1={midX} y1={tgtY} x2={COL_GAP} y2={tgtY} stroke="#e2e8f0" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const KnockoutBracket: React.FC<Props> = ({ lang, onShowTable }) => {
  const { matches, loading: matchesLoading } = useMatches();
  const { teamsById, loading: teamsLoading } = useTeams();
  const loading = matchesLoading || teamsLoading;
  const bracketRef       = useRef<HTMLDivElement>(null);
  const pillsRef         = useRef<HTMLDivElement>(null);
  const hasAutoScrolled  = useRef(false);
  const isClickScrolling = useRef(false);
  const clickScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedRound, setSelectedRound] = useState<KnockoutRound | null>(null);

  // ── Order matches into canonical bracket slots, round by round ─────────────
  // R32 is built purely from the hardcoded config; team flags/names come from
  // the teams reference table (so projected teams not yet in any match still
  // render). R16 → Final read the DB and derive their slots by lineage from the
  // previous round, so winners flow down the bracket as the DB fills them in.
  const matchesByRound = useMemo(() => {
    const teamFor = (tla: string): Team =>
      (isTBDId(tla) ? undefined : teamsById[tla]) ?? TBD_FALLBACK;

    const result = {} as Record<KnockoutRound, (Match | null)[]>;
    result.R32 = buildR32(matches.filter(m => m.phase === 'R32'), teamFor);

    let prevOrdered: (Match | null)[] = result.R32;
    for (const r of ROUNDS.slice(1)) {
      const ordered = orderRound(r, matches.filter(m => m.phase === r), prevOrdered);
      result[r] = ordered;
      prevOrdered = ordered;
    }
    return result;
  }, [matches, teamsById]);

  const availableRounds = useMemo(
    () => ROUNDS.filter(r => matchesByRound[r].some(m => m != null)),
    [matchesByRound],
  );

  // ── Determine the default active round (most current with live/scheduled) ──
  const defaultRound = useMemo((): KnockoutRound => {
    if (availableRounds.length === 0) return 'R32';
    for (const r of availableRounds) {
      if (matchesByRound[r].some(m => m != null && (m.status === 'LIVE' || m.status === 'SCHEDULED'))) {
        return r;
      }
    }
    return availableRounds[availableRounds.length - 1];
  }, [availableRounds, matchesByRound]);

  // User-selected round takes priority; falls back to auto-detected default
  const activeRound = selectedRound ?? defaultRound;

  // ── Scroll bracket to a specific round ────────────────────────────────────
  const getColLeft = useCallback(
    (round: KnockoutRound) => ROUNDS.indexOf(round) * (CARD_W + COL_GAP),
    [],
  );

  const scrollToRound = useCallback(
    (round: KnockoutRound, smooth = true) => {
      // Marca que este scroll foi disparado por clique, não por swipe manual —
      // evita que o listener de scroll recalcule e sobrescreva o pill certo
      // enquanto a animação ainda está em andamento (bug de clique rápido
      // sequencial entre pills).
      isClickScrolling.current = true;
      if (clickScrollTimeout.current) clearTimeout(clickScrollTimeout.current);
      bracketRef.current?.scrollTo({
        left: getColLeft(round),
        behavior: smooth ? 'smooth' : 'auto',
      });
      clickScrollTimeout.current = setTimeout(() => {
        isClickScrolling.current = false;
      }, 500);
    },
    [getColLeft],
  );

  // ── On first data load: commit initial round and jump to it ───────────────
  useEffect(() => {
    if (availableRounds.length === 0 || hasAutoScrolled.current) return;
    hasAutoScrolled.current = true;
    setSelectedRound(defaultRound);
    requestAnimationFrame(() => scrollToRound(defaultRound, false));
  }, [defaultRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll listener: update active pill as user swipes ────────────────────
  const handleBracketScroll = useCallback(() => {
    if (isClickScrolling.current) return; // scroll disparado por clique — não recalcular
    const el = bracketRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;

    // Compara pela borda esquerda (mesma referência usada em scrollToRound),
    // não pelo centro do viewport — evita que o pill "pule" pra coluna
    // seguinte quando mais de uma coluna cabe na tela.
    let closest: KnockoutRound = ROUNDS[0];
    let minDist = Infinity;
    for (const r of ROUNDS) {
      const dist = Math.abs(getColLeft(r) - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = r; }
    }
    setSelectedRound(prev => (prev === closest ? prev : closest));
  }, [getColLeft]);

  // ── Keep active pill scrolled into view in pill bar ───────────────────────
  useEffect(() => {
    const btn = pillsRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeRound]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  const hasAnyKnockout = availableRounds.length > 0;
  if (!hasAnyKnockout) {
    return (
      <div className="p-8 text-center">
        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
          {lang === 'pt'
            ? 'Fase eliminatória ainda não iniciou.'
            : lang === 'es'
            ? 'La fase eliminatoria aún no ha comenzado.'
            : 'Knockout stage has not started yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* ── Link: tabela da fase de grupos ──────────────────────────────── */}
      {onShowTable && (
        <div className="flex justify-start mb-2 px-1">
          <button
            onClick={onShowTable}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
            </svg>
            {lang === 'pt' ? 'Ver tabela da fase de grupos' : lang === 'es' ? 'Ver tabla de fase de grupos' : 'View group stage table'}
          </button>
        </div>
      )}

      {/* ── Pill nav ─────────────────────────────────────────────────────── */}
      <div
        ref={pillsRef}
        className="flex gap-1 pb-2 mb-3"
        style={{ overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {ROUNDS.map(round => {
          const hasData = availableRounds.includes(round);
          const isActive = round === activeRound;
          return (
            <button
              key={round}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                setSelectedRound(round);
                scrollToRound(round);
              }}
              disabled={!hasData}
              className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                isActive && hasData
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isActive
                  ? 'bg-slate-200 text-slate-500 cursor-default'
                  : hasData
                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-200 cursor-default'
              }`}
            >
              {ROUND_PILL[round][lang]}
            </button>
          );
        })}
      </div>

      {/* ── Bracket scroll container ─────────────────────────────────────── */}
      <div
        ref={bracketRef}
        onScroll={handleBracketScroll}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingBottom: 8,
        } as React.CSSProperties}
      >
        {/* Inner row: all round columns + connector SVGs */}
        <div style={{ display: 'inline-flex', alignItems: 'flex-start', padding: '0 4px' }}>
          {ROUNDS.map((round, idx) => {
            const roundIdx = ri(round);
            const slotCount = SLOT_COUNT[round];
            const roundMatches = matchesByRound[round];

            return (
              <React.Fragment key={round}>
                {/* ── Round column ─────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: CARD_W }}>
                  {/* Column header */}
                  <div
                    style={{ height: HDR_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="px-1"
                  >
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center leading-tight">
                      {ROUND_LABEL[round][lang]}
                    </span>
                  </div>

                  {/* Cards — absolutely positioned within this container */}
                  <div style={{ position: 'relative', width: CARD_W, height: TOTAL_H, flexShrink: 0 }}>
                    {Array.from({ length: slotCount }, (_, slot) => (
                      <MatchCard
                        key={slot}
                        match={roundMatches[slot] ?? null}
                        lang={lang}
                        roundIdx={roundIdx}
                        slot={slot}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Connector SVG between this column and the next ───── */}
                {idx < ROUNDS.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: COL_GAP }}>
                    {/* Spacer to align SVG with cards (not the header) */}
                    <div style={{ height: HDR_H, flexShrink: 0 }} />
                    <ConnectorSVG fromRoundIdx={roundIdx} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KnockoutBracket;
