import React from 'react';
import { MatchState } from '../types';

interface ScoreboardProps {
  state: MatchState;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ state }) => {
  const { players, currentSetIndex, isTiebreak, matchTitle, status, settings } = state;

  const scoreNumberClass = "font-black text-3xl tracking-tighter";

  return (
    <div className="flex flex-col w-fit mx-auto select-none font-sans overflow-hidden shadow-2xl rounded-lg">
      {/* Заголовок - Ширина зависит от контента, наклон задан в index.html */}
      <div className="bg-[#002B5B] text-[#5EDFFF] px-8 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] scoreboard-clip w-fit border-b border-[#5EDFFF]/20 rounded-tl-lg">
        {status === 'finished' ? `${matchTitle} - МАТЧ ЗАВЕРШЕН` : matchTitle}
      </div>

      <div className="flex flex-col bg-[#001D3D] border-l-4 border-[#00A8E8]">
        {players.map((player, idx) => {
          const opponent = players[1 - idx];
          
          return (
            <div key={idx} className={`relative flex items-center h-20 ${idx === 0 ? 'border-b border-white/10' : ''}`}>
              
              {/* Секция игрока: иконка + имя + рейтинг. Добавлен min-w для простора */}
              <div className="flex items-center px-6 whitespace-nowrap min-w-[320px]">
                <div className="w-12 h-12 bg-slate-800 mr-5 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-white/10 shadow-inner">
                  {player.icon ? (
                    <img 
                      src={player.icon} 
                      alt={player.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-[12px] text-slate-500 font-black">П{idx + 1}</div>
                  )}
                </div>
                <div className="flex items-baseline flex-shrink-0">
                  <span className="text-white text-2xl font-black uppercase tracking-tight mr-3 italic">
                    {player.name || `ИГРОК ${idx + 1}`}
                  </span>
                  {player.seed && (
                    <span className="text-[#8E9AAF] text-sm font-bold opacity-80">({player.seed})</span>
                  )}
                </div>
              </div>

              {/* Индикатор подачи - отнесен дальше за счет ml-auto и фиксированной ширины секции имени */}
              <div className="w-12 flex justify-center flex-shrink-0 ml-auto px-2">
                {player.isServing && (
                  <div className="w-6 h-4 bg-[#CCFF00] slanted-divider shadow-[0_0_10px_rgba(204,255,0,0.5)] animate-pulse"></div>
                )}
              </div>

              {/* Сеты */}
              <div className="flex h-full items-center bg-black/30 flex-shrink-0 ml-4">
                {player.sets.slice(0, currentSetIndex + 1).map((score, sIdx) => {
                  const isCurrentSet = sIdx === currentSetIndex && status !== 'finished';
                  const isSetWinner = score > opponent.sets[sIdx];
                  const isCompletedSet = sIdx < currentSetIndex || status === 'finished';
                  const isSuperTBSet = settings.bestOf === 3 && sIdx === 2 && settings.thirdSetFormat === 'superTB';
                  
                  const tbPoint = player.tiebreakScores[sIdx];
                  const hasTb = !isSuperTBSet && tbPoint !== undefined && tbPoint > 0;

                  let cellBg = isCompletedSet && !isCurrentSet ? 'bg-black/20' : 'bg-transparent';
                  let textColor = 'text-[#8E9AAF] opacity-40';

                  if (isCurrentSet) {
                    cellBg = 'bg-[#5EDFFF]';
                    textColor = 'text-[#001D3D]';
                  } else if (isCompletedSet && isSetWinner) {
                    textColor = 'text-[#CCFF00]';
                  }

                  return (
                    <div 
                      key={sIdx} 
                      className={`relative w-16 h-full flex flex-col items-center justify-center border-r border-white/5 transition-all
                        ${cellBg} ${textColor}
                      `}
                    >
                      {hasTb && (
                        <div className={`absolute top-1 right-2 text-[10px] font-black leading-none ${isCurrentSet ? 'text-[#001D3D]/60' : 'text-white/80'}`}>
                          {tbPoint}
                        </div>
                      )}
                      
                      <span className={scoreNumberClass}>
                        {isSuperTBSet && status === 'finished' ? tbPoint : score}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Текущие очки (Гейм) - Ширина w-16, как и у сетов */}
              <div className={`w-16 h-full flex items-center justify-center bg-white text-black px-1 flex-shrink-0 ${scoreNumberClass}`}>
                {player.currentPoints}
              </div>
            </div>
          );
        })}
      </div>
      
      {(isTiebreak || (settings.bestOf === 3 && currentSetIndex === 2 && settings.thirdSetFormat === 'superTB' && status !== 'finished')) && (
        <div className="bg-[#CCFF00] text-black text-[11px] font-black uppercase py-1 px-4 text-center tracking-[0.3em] shadow-inner">
          {settings.bestOf === 3 && currentSetIndex === 2 && settings.thirdSetFormat === 'superTB' ? 'ИДЕТ МАТЧ-ТАЙ-БРЕЙК' : 'ИДЕТ ТАЙ-БРЕЙК'}
        </div>
      )}
    </div>
  );
};

export default Scoreboard;