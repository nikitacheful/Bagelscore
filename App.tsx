import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MatchState, MatchSettings, PlayerState } from './types';
import Scoreboard from './components/Scoreboard';
import Controls from './components/Controls';
import { updateMatchScore } from './utils/tennisLogic';

const CHANNEL_NAME = 'bagel_tennis_sync';

const getInitialMatchState = (): MatchState => ({
  matchTitle: 'ПРЯМОЙ ЭФИР',
  status: 'setup',
  settings: {
    matchTitle: 'ПРЯМОЙ ЭФИР',
    bestOf: 3,
    setFormat: 'standard',
    decidingPoint: false,
    thirdSetFormat: 'full',
    superTBPoints: 10,
    player1Name: '',
    player1Seed: '',
    player1Icon: '',
    player2Name: '',
    player2Seed: '',
    player2Icon: '',
  },
  players: [
    { name: '', seed: '', icon: '', sets: [0, 0, 0, 0, 0], tiebreakScores: [0, 0, 0, 0, 0], currentPoints: '0', isServing: true, matchesWon: 0 },
    { name: '', seed: '', icon: '', sets: [0, 0, 0, 0, 0], tiebreakScores: [0, 0, 0, 0, 0], currentPoints: '0', isServing: false, matchesWon: 0 }
  ],
  currentSetIndex: 0,
  isTiebreak: false
});

const App: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(getInitialMatchState());
  const [history, setHistory] = useState<MatchState[]>([]);
  const [isObsView, setIsObsView] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Используем Ref для доступа к актуальному состоянию внутри слушателя событий без переподписки
  const matchRef = useRef<MatchState>(match);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const bc = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const isObs = view === 'obs';
    setIsObsView(isObs);

    bc.current = new BroadcastChannel(CHANNEL_NAME);
    
    bc.current.onmessage = (event) => {
      const { type, payload } = event.data;
      
      if (type === 'UPDATE_STATE') {
        setMatch(payload);
      } else if (type === 'REQUEST_STATE' && !isObs) {
        // Только вкладка управления отвечает на запрос состояния
        bc.current?.postMessage({ type: 'UPDATE_STATE', payload: matchRef.current });
      }
    };

    // Если это OBS, запрашиваем состояние у вкладки управления при загрузке
    if (isObs) {
      bc.current.postMessage({ type: 'REQUEST_STATE' });
    }

    return () => bc.current?.close();
  }, []); // Пустой массив зависимостей - подписываемся один раз

  const broadcastState = (newState: MatchState) => {
    setMatch(newState);
    bc.current?.postMessage({ type: 'UPDATE_STATE', payload: newState });
  };

  const handlePoint = useCallback((winnerIndex: number) => {
    if (match.status === 'finished') return;
    setHistory(prev => [...prev, match]);
    const newState = updateMatchScore(match, winnerIndex);
    broadcastState(newState);
  }, [match]);

  const handleToggleServer = useCallback(() => {
    if (match.status !== 'playing') return;
    setHistory(prev => [...prev, match]);
    const newPlayers = [...match.players] as [PlayerState, PlayerState];
    newPlayers[0] = { ...newPlayers[0], isServing: !newPlayers[0].isServing };
    newPlayers[1] = { ...newPlayers[1], isServing: !newPlayers[1].isServing };
    broadcastState({ ...match, players: newPlayers });
  }, [match]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    broadcastState(lastState);
  }, [history]);

  const handleReset = useCallback(() => {
    const fresh = getInitialMatchState();
    setHistory([]);
    broadcastState(fresh);
  }, []);

  const handleStart = (settings: MatchSettings) => {
    const fresh = getInitialMatchState();
    const startedState: MatchState = {
      ...fresh,
      matchTitle: settings.matchTitle || 'ПРЯМОЙ ЭФИР',
      status: 'playing',
      settings,
      players: [
        { 
          ...fresh.players[0], 
          name: settings.player1Name, 
          seed: settings.player1Seed, 
          icon: settings.player1Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
        },
        { 
          ...fresh.players[1], 
          name: settings.player2Name, 
          seed: settings.player2Seed, 
          icon: settings.player2Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
        }
      ]
    };
    setHistory([]);
    broadcastState(startedState);
  };

  const handleCopyObsLink = () => {
    // Формируем чистую ссылку без дублирования слешей
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'obs');
    const obsUrl = url.toString();
    
    navigator.clipboard.writeText(obsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (isObsView) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch(e.key.toLowerCase()) {
        case 'r': case 'к': handleReset(); break;
        case '1': if(match.status === 'playing') handlePoint(0); break;
        case '2': if(match.status === 'playing') handlePoint(1); break;
        case 'z': case 'я': if(match.status === 'playing') handleUndo(); break;
        case 's': case 'ы': if(match.status === 'playing') handleToggleServer(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match.status, handlePoint, handleUndo, handleReset, handleToggleServer, isObsView]);

  if (isObsView) {
    return (
      <div className="w-screen h-screen flex items-start justify-start p-6 bg-transparent">
        {match.status !== 'setup' && <Scoreboard state={match} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
      <header className="mb-8 text-center flex flex-col items-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
          <span className="bg-[#CCFF00] text-black px-2 py-0.5">Bagel</span> 
          Tennis score
        </h1>
        <p className="text-slate-400 text-[10px] mt-1 font-black tracking-widest uppercase opacity-60">интерфейс для YouTube трансляций</p>
        
        {match.status !== 'setup' && (
          <button 
            onClick={handleCopyObsLink}
            className={`mt-6 flex items-center gap-2 px-4 py-2 rounded-full border transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest ${
              copied 
              ? 'bg-[#CCFF00] border-[#CCFF00] text-black' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
            }`}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Скопировано!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                Копировать ссылку для OBS
              </>
            )}
          </button>
        )}
      </header>

      <div className="w-full max-w-5xl">
        {match.status !== 'setup' && <Scoreboard state={match} />}
        
        <div className="mt-8">
          <Controls 
            key={match.status}
            state={match} 
            onPoint={handlePoint} 
            onUndo={handleUndo} 
            onReset={handleReset}
            onStart={handleStart}
            onToggleServer={handleToggleServer}
          />
        </div>
      </div>

      <footer className="mt-auto py-8"></footer>
    </div>
  );
};

export default App;