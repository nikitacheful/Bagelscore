import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MatchState, MatchSettings, PlayerState } from './types';
import Scoreboard from './components/Scoreboard';
import Controls from './components/Controls';
import { updateMatchScore } from './utils/tennisLogic';

const CHANNEL_NAME = 'bagel_tennis_sync';
const STORAGE_KEY = 'bagel_match_state';

const getInitialMatchState = (): MatchState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Убеждаемся, что загруженные данные имеют правильную структуру
      if (parsed && parsed.status) return parsed;
    } catch (e) {
      console.error("Error parsing saved state", e);
    }
  }
  return {
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
  };
};

const App: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(getInitialMatchState());
  const [history, setHistory] = useState<MatchState[]>([]);
  const [isObsView, setIsObsView] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const matchRef = useRef<MatchState>(match);
  const bc = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    matchRef.current = match;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  }, [match]);

  const broadcastState = useCallback((newState: MatchState) => {
    setMatch(newState);
    if (bc.current) {
      bc.current.postMessage({ type: 'UPDATE_STATE', payload: newState });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isObs = window.location.pathname.endsWith('/obs') || params.get('view') === 'obs';
    setIsObsView(isObs);

    bc.current = new BroadcastChannel(CHANNEL_NAME);
    
    bc.current.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'UPDATE_STATE') {
        setMatch(payload);
      } else if (type === 'REQUEST_STATE' && !isObs) {
        bc.current?.postMessage({ type: 'UPDATE_STATE', payload: matchRef.current });
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          setMatch(newState);
        } catch (err) {
          console.error("Storage sync error", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    if (isObs) {
      bc.current.postMessage({ type: 'REQUEST_STATE' });
    }

    return () => {
      bc.current?.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handlePoint = useCallback((winnerIndex: number) => {
    if (match.status === 'finished' || match.status === 'setup') return;
    setHistory(prev => [...prev, match]);
    const newState = updateMatchScore(match, winnerIndex);
    broadcastState(newState);
  }, [match, broadcastState]);

  const handleToggleServer = useCallback(() => {
    if (match.status !== 'playing') return;
    setHistory(prev => [...prev, match]);
    const newPlayers = [...match.players] as [PlayerState, PlayerState];
    newPlayers[0] = { ...newPlayers[0], isServing: !newPlayers[0].isServing };
    newPlayers[1] = { ...newPlayers[1], isServing: !newPlayers[1].isServing };
    broadcastState({ ...match, players: newPlayers });
  }, [match, broadcastState]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    broadcastState(lastState);
  }, [history, broadcastState]);

  const handleReset = useCallback(() => {
    if (window.confirm("Вы уверены, что хотите сбросить матч и вернуться к настройкам?")) {
      const fresh: MatchState = {
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
      };
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY);
      broadcastState(fresh);
    }
  }, [broadcastState]);

  const handleStart = (settings: MatchSettings) => {
    const startedState: MatchState = {
      matchTitle: settings.matchTitle || 'ПРЯМОЙ ЭФИР',
      status: 'playing',
      settings,
      players: [
        { 
          name: settings.player1Name || 'ИГРОК 1', 
          seed: settings.player1Seed, 
          icon: settings.player1Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
          currentPoints: '0',
          isServing: true,
          matchesWon: 0
        },
        { 
          name: settings.player2Name || 'ИГРОК 2', 
          seed: settings.player2Seed, 
          icon: settings.player2Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
          currentPoints: '0',
          isServing: false,
          matchesWon: 0
        }
      ],
      currentSetIndex: 0,
      isTiebreak: false
    };
    setHistory([]);
    broadcastState(startedState);
  };

  const handleCopyObsLink = () => {
    const url = new URL(window.location.origin);
    url.pathname = '/obs';
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (isObsView) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
      <div className="w-screen h-screen flex items-start justify-start p-6 bg-transparent overflow-hidden">
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
              ? 'bg-[#CCFF00] border-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 shadow-lg'
            }`}
          >
            {copied ? '✓ Скопировано' : '🔗 Копировать ссылку для OBS'}
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