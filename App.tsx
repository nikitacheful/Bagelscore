import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MatchState, MatchSettings, PlayerState } from './types';
import Scoreboard from './components/Scoreboard';
import Controls from './components/Controls';
import { updateMatchScore } from './utils/tennisLogic';

const CHANNEL_NAME = 'bagel_tennis_sync_v2';
const STORAGE_KEY = 'bagel_match_state_v2';

const createEmptyState = (): MatchState => ({
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

const getInitialMatchState = (): MatchState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.status) return parsed;
    } catch (e) {
      console.error("Parse error", e);
    }
  }
  return createEmptyState();
};

const App: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(getInitialMatchState());
  const [history, setHistory] = useState<MatchState[]>([]);
  const [isObsView, setIsObsView] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const matchRef = useRef<MatchState>(match);
  const bc = useRef<BroadcastChannel | null>(null);

  // Обновляем реф и локальное хранилище при каждом изменении состояния
  useEffect(() => {
    matchRef.current = match;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  }, [match]);

  // Основная функция рассылки состояния
  const broadcastState = useCallback((newState: MatchState) => {
    setMatch(newState);
    if (bc.current) {
      bc.current.postMessage({ type: 'UPDATE_STATE', payload: newState });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isObs = params.get('view') === 'obs';
    setIsObsView(isObs);

    bc.current = new BroadcastChannel(CHANNEL_NAME);
    
    bc.current.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'UPDATE_STATE') {
        setMatch(payload);
      } else if (type === 'REQUEST_STATE' && !isObs) {
        // Ответ на запрос состояния от новой вкладки OBS
        bc.current?.postMessage({ type: 'UPDATE_STATE', payload: matchRef.current });
      }
    };

    // Слушатель для синхронизации через хранилище (доп. канал)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setMatch(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);

    // Если это OBS, при загрузке запрашиваем актуальное состояние
    if (isObs) {
      bc.current.postMessage({ type: 'REQUEST_STATE' });
    }

    return () => {
      bc.current?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // "Пульсация" (Heartbeat) - Каждые 2 секунды шлем состояние, чтобы OBS не терял связь
  useEffect(() => {
    if (isObsView) return; // Пульсирует только панель управления
    
    const interval = setInterval(() => {
      if (matchRef.current.status !== 'setup') {
        bc.current?.postMessage({ type: 'UPDATE_STATE', payload: matchRef.current });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isObsView]);

  const handlePoint = useCallback((winnerIndex: number) => {
    if (match.status !== 'playing') return;
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
    if (window.confirm("Сбросить текущий матч и вернуться к настройкам?")) {
      const fresh = createEmptyState();
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY);
      broadcastState(fresh);
      // Принудительно уведомляем всех
      bc.current?.postMessage({ type: 'UPDATE_STATE', payload: fresh });
    }
  }, [broadcastState]);

  const handleStart = (settings: MatchSettings) => {
    const startedState: MatchState = {
      matchTitle: settings.matchTitle || 'ПРЯМОЙ ЭФИР',
      status: 'playing',
      settings,
      players: [
        { 
          ...createEmptyState().players[0],
          name: settings.player1Name || 'ИГРОК 1', 
          seed: settings.player1Seed, 
          icon: settings.player1Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
          isServing: true
        },
        { 
          ...createEmptyState().players[1],
          name: settings.player2Name || 'ИГРОК 2', 
          seed: settings.player2Seed, 
          icon: settings.player2Icon,
          sets: new Array(settings.bestOf).fill(0),
          tiebreakScores: new Array(settings.bestOf).fill(0),
          isServing: false
        }
      ],
      currentSetIndex: 0,
      isTiebreak: false
    };
    setHistory([]);
    broadcastState(startedState);
  };

  const handleCopyObsLink = () => {
    const url = new URL(window.location.href);
    url.search = '?view=obs'; // Используем query-параметр для максимальной совместимости
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (isObsView) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === '1') handlePoint(0);
      if (key === '2') handlePoint(1);
      if (key === 's' || key === 'ы') handleToggleServer();
      if (key === 'z' || key === 'я') handleUndo();
      if (key === 'r' || key === 'к') handleReset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match.status, handlePoint, handleUndo, handleReset, handleToggleServer, isObsView]);

  if (isObsView) {
    return (
      <div className="w-screen h-screen flex items-start justify-start p-10 bg-transparent overflow-hidden">
        {match.status !== 'setup' && <Scoreboard state={match} />}
        {/* Технический маркер для отладки в OBS (почти невидим) */}
        <div className="fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none">.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0f172a]">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase flex items-center justify-center gap-3">
          <span className="bg-[#CCFF00] text-black px-2 py-0.5">Bagel</span> 
          Tennis score
        </h1>
        
        {match.status !== 'setup' && (
          <div className="flex flex-col items-center gap-2 mt-6">
            <button 
              onClick={handleCopyObsLink}
              className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all active:scale-95 text-xs font-black uppercase tracking-widest shadow-xl ${
                copied 
                ? 'bg-[#CCFF00] border-[#CCFF00] text-black' 
                : 'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30'
              }`}
            >
              {copied ? '✓ Ссылка скопирована' : '🔗 Ссылка для OBS (Browser Source)'}
            </button>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Добавьте эту ссылку в OBS как "Браузер"</p>
          </div>
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