import React, { useRef } from 'react';
import { MatchState, MatchSettings, SetFormat, ThirdSetFormat } from '../types';

interface ControlsProps {
  state: MatchState;
  onPoint: (winnerIndex: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onStart: (settings: MatchSettings) => void;
  onToggleServer: () => void;
}

const Controls: React.FC<ControlsProps> = ({ state, onPoint, onUndo, onReset, onStart, onToggleServer }) => {
  const [setup, setSetup] = React.useState<MatchSettings>({
    matchTitle: 'ПРЯМОЙ ЭФИР',
    bestOf: 3,
    setFormat: 'standard',
    decidingPoint: false,
    thirdSetFormat: 'full',
    superTBPoints: 10,
    player1Name: 'ИГРОК 1',
    player1Seed: '',
    player1Icon: '',
    player2Name: 'ИГРОК 2',
    player2Seed: '',
    player2Icon: '',
  });

  const fileInput1 = useRef<HTMLInputElement>(null);
  const fileInput2 = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, playerNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (playerNum === 1) setSetup(s => ({ ...s, player1Icon: base64 }));
        else setSetup(s => ({ ...s, player2Icon: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (state.status === 'setup') {
    return (
      <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-xl mx-auto border border-slate-800">
        <div className="text-center mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Настройка матча</h2>
        </div>
        
        <div className="space-y-6">
          {/* Checkpoint 1: Tournament Title */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-black">1</span>
              <label className="text-[10px] font-black text-slate-400 uppercase">Название турнира / матча</label>
            </div>
            <input 
              className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-white font-bold uppercase tracking-tight focus:ring-1 focus:ring-[#CCFF00] outline-none"
              value={setup.matchTitle}
              onChange={e => setSetup({...setup, matchTitle: e.target.value.toUpperCase()})}
            />
          </div>

          {/* Checkpoint 2: Set Format & Tie-break */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-black">2</span>
              <label className="text-[10px] font-black text-slate-400 uppercase">Формат сета</label>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setSetup({...setup, setFormat: 'standard'})}
                className={`py-3 px-2 text-[10px] font-black uppercase rounded-lg border transition-all ${setup.setFormat !== 'short4' ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              >
                Обычный (до 6 геймов)
              </button>
              <button 
                onClick={() => setSetup({...setup, setFormat: 'short4'})}
                className={`py-3 px-2 text-[10px] font-black uppercase rounded-lg border transition-all ${setup.setFormat === 'short4' ? 'bg-[#CCFF00] text-black border-[#CCFF00]' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              >
                Короткий (до 4 геймов)
              </button>
            </div>

            {/* Sub-selection for Tie-break trigger (only if 6 games set) */}
            {setup.setFormat !== 'short4' && (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase px-1 text-center">Тай-брейк при счете:</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSetup({...setup, setFormat: 'standard'})}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded border transition-all ${setup.setFormat === 'standard' ? 'bg-slate-700 text-white border-slate-500' : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-700'}`}
                  >
                    6 : 6
                  </button>
                  <button 
                    onClick={() => setSetup({...setup, setFormat: 'tb55'})}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded border transition-all ${setup.setFormat === 'tb55' ? 'bg-slate-700 text-white border-slate-500' : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-700'}`}
                  >
                    5 : 5
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Checkpoint 3: Additional Rules */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-black">3</span>
              <label className="text-[10px] font-black text-slate-400 uppercase">Специальные правила</label>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setSetup({...setup, decidingPoint: !setup.decidingPoint})}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${setup.decidingPoint ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-[#CCFF00]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                <span className="text-[10px] font-black uppercase">Решающее очко</span>
                <div className={`w-2 h-2 rounded-full ${setup.decidingPoint ? 'bg-[#CCFF00]' : 'bg-slate-600'}`} />
              </button>

              <button 
                onClick={() => setSetup({...setup, thirdSetFormat: setup.thirdSetFormat === 'full' ? 'superTB' : 'full'})}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${setup.thirdSetFormat === 'superTB' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                <span className="text-[10px] font-black uppercase">{setup.thirdSetFormat === 'full' ? 'Полный 3-й сет' : `Супер ТБ (${setup.superTBPoints})`}</span>
              </button>
            </div>
          </div>

          {/* Checkpoint 4: Competitors */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-black">4</span>
              <label className="text-[10px] font-black text-slate-400 uppercase">Участники</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((num) => (
                <div key={num} className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700 focus-within:border-[#CCFF00]">
                  <div 
                    onClick={() => (num === 1 ? fileInput1 : fileInput2).current?.click()}
                    className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 overflow-hidden flex-shrink-0 cursor-pointer"
                  >
                    {(num === 1 ? setup.player1Icon : setup.player2Icon) ? (
                      <img src={num === 1 ? setup.player1Icon : setup.player2Icon} className="w-full h-full object-cover" alt="p" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600 font-black">?</div>
                    )}
                  </div>
                  <input type="file" ref={num === 1 ? fileInput1 : fileInput2} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, num as 1 | 2)} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <input 
                      className="bg-transparent text-xs font-bold text-white uppercase outline-none truncate"
                      placeholder={`ИГРОК ${num}`}
                      value={num === 1 ? setup.player1Name : setup.player2Name}
                      onChange={e => setSetup({...setup, [`player${num}Name`]: e.target.value.toUpperCase()})}
                    />
                    <input 
                      className="bg-transparent text-[9px] text-slate-500 font-bold uppercase outline-none"
                      placeholder="РЕЙТИНГ"
                      value={num === 1 ? setup.player1Seed : setup.player2Seed}
                      onChange={e => setSetup({...setup, [`player${num}Seed`]: e.target.value})}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onStart(setup)}
            className="w-full bg-[#CCFF00] hover:bg-[#ddff33] text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest mt-4 shadow-lg active:scale-95"
          >
            Начать матч
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-6">
      <div className="flex gap-4">
        <button 
          onClick={() => onPoint(0)}
          className="px-8 py-4 bg-white text-black font-black text-xl rounded-lg hover:bg-[#CCFF00] transition-all transform active:scale-95 shadow-lg border-b-4 border-gray-300 min-w-[200px]"
        >
          {state.players[0].name} (1)
        </button>
        <button 
          onClick={() => onPoint(1)}
          className="px-8 py-4 bg-white text-black font-black text-xl rounded-lg hover:bg-[#CCFF00] transition-all transform active:scale-95 shadow-lg border-b-4 border-gray-300 min-w-[200px]"
        >
          {state.players[1].name} (2)
        </button>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button 
          onClick={onToggleServer}
          className="px-6 py-2 bg-[#CCFF00]/20 text-[#CCFF00] font-bold rounded hover:bg-[#CCFF00]/30 transition-colors uppercase text-sm border border-[#CCFF00]/40 flex items-center gap-2"
        >
          <span className="w-3 h-3 bg-[#CCFF00] rounded-full inline-block"></span>
          Смена подачи (S)
        </button>
        <button 
          onClick={onUndo}
          className="px-6 py-2 bg-slate-700 text-white font-bold rounded hover:bg-slate-600 transition-colors uppercase text-sm border border-slate-600"
        >
          Отмена (Z)
        </button>
        <button 
          onClick={onReset}
          className="px-6 py-2 bg-red-900/40 text-red-200 font-bold rounded hover:bg-red-800 transition-colors uppercase text-sm border border-red-800"
        >
          Сброс матча (R)
        </button>
      </div>

      <div className="text-slate-500 text-[10px] mt-4 flex flex-col items-center gap-1 uppercase tracking-widest font-bold">
        <p>Клавиши: [1][2] Очко, [S] Подача, [Z] Отмена, [R] Сброс</p>
      </div>
    </div>
  );
};

export default Controls;