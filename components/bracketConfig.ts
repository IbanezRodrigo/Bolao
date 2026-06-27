// ============================================================================
// KNOCKOUT BRACKET CONFIG — FIFA World Cup 2026
// ----------------------------------------------------------------------------
// The bracket TREE (which winners meet next) cannot be derived from kickoff
// times, and for not-yet-decided rounds it cannot be derived from teams either
// (they're still TBD). So the canonical structure is hardcoded here.
//
// We only hardcode the ROUND OF 32. Every later round positions itself
// automatically by lineage: an R16 match sits under the two R32 slots its
// teams advanced from, a QF under R16, and so on. Because the connector lines
// are purely positional, getting R32 into correct bracket order is enough to
// render the whole tree correctly — even while later rounds are still TBD.
//
// ORDER MATTERS: entry i is bracket slot i (top → bottom). Slots 2j and 2j+1
// feed into R16 slot j. Team order within a pair is irrelevant (home/away are
// matched in either direction). Use team TLAs exactly as stored in teams.id.
// ============================================================================

export type TLA = string;

/**
 * The 16 Round-of-32 matches in canonical FIFA-2026 bracket order (top→bottom).
 *
 * Grouping (each consecutive pair feeds one R16 match):
 *   slots 0,1 → R16 slot 0
 *   slots 2,3 → R16 slot 1
 *   ...
 *   slots 14,15 → R16 slot 7
 */
export const R32_BRACKET_ORDER: ReadonlyArray<readonly [TLA, TLA]> = [
  ['RSA', 'CAN'], // slot 0  ┐ R16 slot 0
  ['NED', 'MAR'], // slot 1  ┘
  ['GER', 'PAR'], // slot 2  ┐ R16 slot 1
  ['FRA', 'SWE'], // slot 3  ┘
  ['BEL', 'TBD'], // slot 4  ┐ R16 slot 2
  ['USA', 'BIH'], // slot 5  ┘
  ['ESP', 'TBD'], // slot 6  ┐ R16 slot 3
  ['TBD', 'TBD'], // slot 7  ┘
  ['BRA', 'JPN'], // slot 8  ┐ R16 slot 4
  ['CIV', 'NOR'], // slot 9  ┘
  ['MEX', 'TBD'], // slot 10 ┐ R16 slot 5
  ['TBD', 'TBD'], // slot 11 ┘
  ['SUI', 'TBD'], // slot 12 ┐ R16 slot 6
  ['TBD', 'TBD'], // slot 13 ┘
  ['AUS', 'EGY'], // slot 14 ┐ R16 slot 7
  ['ARG', 'CPV'], // slot 15 ┘
];
// NOTE: 'TBD' entries are placeholders for matchups not yet decided by the
// group stage. Once those are known, replace each 'TBD' with the real team TLA
// so the pairing is unique — duplicate ['TBD','TBD'] rows can only be matched
// positionally and fall back to kickoff order until resolved.
