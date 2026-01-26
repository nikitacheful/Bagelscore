import { Point, PlayerState, MatchState } from '../types';

export const POINT_SEQUENCE: Point[] = ['0', '15', '30', '40', 'Ad'];

export const getNextPoint = (current: Point, opponent: Point, decidingPoint: boolean): { point: Point; wonGame: boolean } => {
  if (decidingPoint) {
    if (current === '40') return { point: '0', wonGame: true };
    return { point: POINT_SEQUENCE[POINT_SEQUENCE.indexOf(current) + 1], wonGame: false };
  }

  if (current === '40') {
    if (opponent === '40') return { point: 'Ad', wonGame: false };
    if (opponent === 'Ad') return { point: '40', wonGame: false };
    return { point: '0', wonGame: true };
  }
  
  if (current === 'Ad') return { point: '0', wonGame: true };

  return { point: POINT_SEQUENCE[POINT_SEQUENCE.indexOf(current) + 1], wonGame: false };
};

export const updateMatchScore = (state: MatchState, winnerIndex: number): MatchState => {
  const newState = JSON.parse(JSON.stringify(state)) as MatchState;
  const { settings } = newState;
  const winner = newState.players[winnerIndex];
  const loser = newState.players[1 - winnerIndex];

  // Handle Match Tiebreak (Super TB) for the deciding set
  const isBestOf3SuperTB = settings.bestOf === 3 && newState.currentSetIndex === 2 && settings.thirdSetFormat === 'superTB';
  
  if (newState.isTiebreak || isBestOf3SuperTB) {
    const winPoints = parseInt(winner.currentPoints) || 0;
    const losePoints = parseInt(loser.currentPoints) || 0;
    
    const nextPoints = winPoints + 1;
    winner.currentPoints = nextPoints.toString() as Point;

    const totalPoints = nextPoints + losePoints;
    if (totalPoints % 2 === 1) {
       newState.players[0].isServing = !newState.players[0].isServing;
       newState.players[1].isServing = !newState.players[1].isServing;
    }

    const targetPoints = isBestOf3SuperTB ? settings.superTBPoints : 7;

    if (nextPoints >= targetPoints && nextPoints - losePoints >= 2) {
      winner.tiebreakScores[newState.currentSetIndex] = nextPoints;
      loser.tiebreakScores[newState.currentSetIndex] = losePoints;
      
      winner.sets[newState.currentSetIndex] = isBestOf3SuperTB ? 1 : winner.sets[newState.currentSetIndex] + 1;
      loser.sets[newState.currentSetIndex] = 0; // In Super TB, we often just show points, but we'll increment sets won
      
      winner.currentPoints = '0';
      loser.currentPoints = '0';
      newState.isTiebreak = false;
      return checkSetWin(newState, winnerIndex);
    }
    return newState;
  }

  const { point, wonGame } = getNextPoint(winner.currentPoints, loser.currentPoints, settings.decidingPoint);
  
  if (wonGame) {
    winner.currentPoints = '0';
    loser.currentPoints = '0';
    winner.sets[newState.currentSetIndex]++;
    
    newState.players[0].isServing = !newState.players[0].isServing;
    newState.players[1].isServing = !newState.players[1].isServing;

    const winGames = winner.sets[newState.currentSetIndex];
    const loseGames = loser.sets[newState.currentSetIndex];

    // Tiebreak Trigger Logic
    let triggerTiebreak = false;
    if (settings.setFormat === 'standard' && winGames === 6 && loseGames === 6) triggerTiebreak = true;
    if (settings.setFormat === 'tb55' && winGames === 5 && loseGames === 5) triggerTiebreak = true;
    if (settings.setFormat === 'short4' && winGames === 4 && loseGames === 4) triggerTiebreak = true;

    if (triggerTiebreak) {
      newState.isTiebreak = true;
      return newState;
    }

    // Set Win Logic
    let setWon = false;
    if (settings.setFormat === 'standard') {
      if ((winGames >= 6 && winGames - loseGames >= 2) || winGames === 7) setWon = true;
    } else if (settings.setFormat === 'tb55') {
      if (winGames >= 6 && winGames - loseGames >= 2) setWon = true;
    } else if (settings.setFormat === 'short4') {
      if ((winGames >= 4 && winGames - loseGames >= 2) || winGames === 5) setWon = true;
    }

    if (setWon) return checkSetWin(newState, winnerIndex);
  } else {
    winner.currentPoints = point;
    // Special deuce logic for non-deciding point
    if (!settings.decidingPoint && point === '40' && loser.currentPoints === 'Ad') {
        loser.currentPoints = '40';
        winner.currentPoints = '40';
    }
  }

  return newState;
};

const checkSetWin = (state: MatchState, winnerIndex: number): MatchState => {
  const winner = state.players[winnerIndex];
  winner.matchesWon++;
  
  const targetMatches = state.settings.bestOf === 3 ? 2 : 3;
  
  if (winner.matchesWon >= targetMatches) {
    state.status = 'finished';
  } else {
    state.currentSetIndex++;
    // If next set is a super tiebreak, start it immediately
    if (state.settings.bestOf === 3 && state.currentSetIndex === 2 && state.settings.thirdSetFormat === 'superTB') {
      // Nothing needed here, updateMatchScore handles the logic if setIndex is 2 and format is superTB
    }
  }
  return state;
};