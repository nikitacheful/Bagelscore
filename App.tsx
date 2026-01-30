import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MatchState, MatchSettings, PlayerState } from './types';
import Scoreboard from './components/Scoreboard';
import Controls from './components/Controls';
import { updateMatchScore } from './utils/tennisLogic';

declare var Peer: any; // PeerJS из index.html

const STORAGE_KEY = 'bagel_match_state_v3';
const MATCH_ID_KEY = 'bagel_match_id_v3';

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

const generateMatchId = () => `bagel-${Math.floor(Math.random() * 900) + 100}-${Math.random().toString(36).substring(7)}`;

const App: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(createEmptyState());
  const [history, setHistory] = useState<MatchState[]>([]);
  const [matchId, setMatchId] = useState<string>(localStorage.getItem(MATCH_ID_KEY) || generateMatchId());
  const [isObsView, setIsObsView] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const peerRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);
  const matchRef = useRef<MatchState>(match);

  useEffect(() => {
    matchRef.current = match;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
    // Если мы в режиме управления и есть соединение - шлем данные
    if (!isObsView && connectionRef.current) {
      connectionRef.current.send(match);
    }
  }, [match, isObsView]);

  useEffect(() => {
    localStorage.setItem(MATCH_ID_KEY, matchId);
  }, [matchId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const urlMatchId = params.get('matchId');
    const isObs = view === 'obs';
    setIsObsView(isObs);

    const targetMatchId = urlMatchId || matchId;
    if (urlMatchId) setMatchId(urlMatchId);

    // Инициализация PeerJS
    peerRef.current = new Peer(isObs ? undefined : targetMatchId);

    peerRef.current.on('open', (id: string) => {
      console.log('Peer connected with ID:', id);
      if (isObs) {
        // Если это OBS - подключаемся к основной панели
        const conn = peerRef.current.connect(targetMatchId);
        setupConnection(conn);
      }
    });

    peerRef.current.on('connection', (conn: any) => {
      // Это срабатывает на стороне управления, когда подключается OBS
      setupConnection(conn);
    });

    peerRef.current.on('error', (err: any) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id' && !isObs) {
        // Если ID занят (например, вкладка уже открыта), генерируем новый
        const newId = generateMatchId();
        setMatchId(newId);
        window.location.reload();
      }
    });

    function setupConnection(conn: any) {
      connectionRef.current = conn;
      
      conn.on('open', () => {
        setIsLive(true);
        // Шлем текущее состояние сразу после коннекта
        if (!isObs) conn.send(matchRef.current);
      });

      conn.on('data', (data: any) => {
        if (isObs) setMatch(data);
      });

      conn.on('close', () => {
        setIsLive(false);
        // Авто-переподключение для OBS
        if (isObs) {
          setTimeout(() => {
            const newConn = peerRef.current.connect(targetMatchId);
            setupConnection(newConn);
          }, 3000);
        }
      });
    }

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const broadcastState = useCallback((newState: MatchState) => {
    setMatch(newState);
  }, []);

  const handlePoint = (idx: number) => {
    setHistory(prev => [...prev, match]);
    broadcastState(updateMatchScore(match, idx));
  };

  const handleToggleServer = () => {
    setHistory(prev => [...prev, match]);
    const newPlayers = [...match.players] as [PlayerState, PlayerState];
    newPlayers[0] = { ...newPlayers[0], isServing: !newPlayers[0].isServing };
    newPlayers[1] = { ...newPlayers[1], isServing: !newPlayers[1].isServing };
    broadcastState({ ...match, players: newPlayers });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    broadcastState(last);
  };

  const handleReset = () => {
    if (window.confirm("Сбросить матч?")) {
      const fresh = createEmptyState();
      setHistory([]);
      broadcastState(fresh);
    }
  };

  const handleStart = (settings: MatchSettings) => {
    const started: MatchState = {
      ...createEmptyState(),
      matchTitle: settings.matchTitle || 'ПРЯМОЙ ЭФИР',
      status: 'playing',
      settings,
      players: [
        { ...createEmptyState().players[0], name: settings.player1Name || 'ИГРОК 1', seed: settings.player1Seed, icon: settings.player1Icon, sets: new Array(settings.bestOf).fill(0), tiebreakScores: new Array(settings.bestOf).fill(0) },
        { ...createEmptyState().players[1], name: settings.player2Name || 'ИГРОК 2', seed: settings.player2Seed, icon: settings.player2Icon, sets: new Array(settings.bestOf).fill(0), tiebreakScores: new Array(settings.bestOf).fill(0) }
      ]
    };
    setHistory([]);
    broadcastState(started);
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.origin);
    url.search = `?view=obs&matchId=${matchId}`;
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isObsView) {
    return (
      <div className="w-screen h-screen flex items-start justify-start p-10 bg-transparent">
        {match.status !== 'setup' && <Scoreboard state={match} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center p-6">
      <header className="mb-12 text-center relative">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase flex items-center justify-center gap-4">
          <span className="bg-[#CCFF00] text-black px-3 py-1 rounded-sm">Bagel</span>
          <span>Scoreboard</span>
        </h1>
        
        {match.status !== 'setup' && (
          <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${isLive ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#CCFF00] pulse-green' : 'bg-red-500'}`}></span>
              {isLive ? 'OBS Подключен' : 'Ожидание OBS...'}
            </div>

            <button 
              onClick={handleCopyLink}
              className={`group flex items-center gap-3 px-8 py-4 rounded-xl border transition-all active:scale-95 shadow-2xl ${
                copied ? 'bg-[#CCFF00] border-[#CCFF00] text-black' : 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white'
              }`}
            >
              <span className="font-black uppercase tracking-wider text-sm">
                {copied ? '✓ Ссылка скопирована!' : '🔗 Скопировать ссылку для OBS'}
              </span>
            </button>
            <p className="text-[10px] text-slate-500 font-bold uppercase">ID матча: <span className="text-slate-400">{matchId}</span></p>
          </div>
        )}
      </header>

      <main className="w-full max-w-5xl">
        {match.status !== 'setup' && <Scoreboard state={match} />}
        <Controls 
          state={match}
          onPoint={handlePoint}
          onUndo={handleUndo}
          onReset={handleReset}
          onToggleServer={handleToggleServer}
          onStart={handleStart}
        />
      </main>
    </div>
  );
};

export default App;