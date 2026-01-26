export type Point = '0' | '15' | '30' | '40' | 'Ad';
export type SetFormat = 'standard' | 'tb55' | 'short4';
export type ThirdSetFormat = 'full' | 'superTB';

export interface PlayerState {
  name: string;
  seed: string;
  icon: string;
  sets: number[];
  tiebreakScores: number[];
  currentPoints: Point;
  isServing: boolean;
  matchesWon: number;
}

export interface MatchSettings {
  matchTitle: string;
  bestOf: 3 | 5;
  setFormat: SetFormat;
  decidingPoint: boolean;
  thirdSetFormat: ThirdSetFormat;
  superTBPoints: number;
  player1Name: string;
  player1Seed: string;
  player1Icon: string;
  player2Name: string;
  player2Seed: string;
  player2Icon: string;
}

export interface MatchState {
  matchTitle: string;
  players: [PlayerState, PlayerState];
  status: 'setup' | 'playing' | 'finished';
  currentSetIndex: number;
  isTiebreak: boolean;
  settings: MatchSettings;
}
