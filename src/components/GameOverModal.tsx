/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { DIFFICULTY_CONFIGS } from '../game/constants';
import { GameEngine } from '../game/gameEngine';
import { skillTreeManager } from '../game/skillTree';
import { Sparkles, HeartPulse, Home } from 'lucide-react';

interface GameOverModalProps {
  engine: GameEngine;
  onRevived: () => void;
  onReturnToLobby: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  engine,
  onRevived,
  onReturnToLobby,
}) => {
  const { floor, player } = engine;
  const diffCfg = DIFFICULTY_CONFIGS[engine.difficulty] || DIFFICULTY_CONFIGS.medium;
  const canOfferRevive = engine.isAwaitingRevive && engine.revivesUsed < engine.maxRevives;
  const revivesLeft = Math.max(0, engine.maxRevives - engine.revivesUsed);
  const reward = canOfferRevive
    ? engine.getKillRewardPreview(false)
    : engine.claimedRewardSummary || engine.claimEndOfRunRewards(false);
  const currentGems = skillTreeManager.getSoulGems();
  const canAffordRevive = currentGems >= engine.reviveCost;

  const [redirectSeconds, setRedirectSeconds] = useState(4);

  // On final death after reviving twice, game is over, kill gems are rewarded, and player is redirected back to the lobby!
  useEffect(() => {
    if (canOfferRevive) return;
    setRedirectSeconds(4);
    const countdown = window.setInterval(() => {
      setRedirectSeconds(prev => (prev > 1 ? prev - 1 : 0));
    }, 900);
    const redirectTimer = window.setTimeout(() => {
      onReturnToLobby();
    }, 3600);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirectTimer);
    };
  }, [canOfferRevive, onReturnToLobby]);

  const handleReviveClick = () => {
    if (!canOfferRevive || !canAffordRevive) return;
    if (engine.revivePlayer()) {
      onRevived();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 font-pixel select-none">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#140e09] border-4 border-[#851e1e] rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="text-3xl sm:text-4xl mb-1.5">⚔️💀⚔️</div>

        <h2 className="text-sm sm:text-base md:text-lg font-bold text-red-500 font-cinzel tracking-wider mb-1">
          {canOfferRevive ? 'THOU HAST FALLEN!' : 'VALIANT DEFEAT'}
        </h2>

        <p className="text-amber-100/90 font-vt text-base mb-3.5 leading-snug">
          {canOfferRevive
            ? `Channel ${engine.reviveCost} Soul Gems to resurrect on the spot, or return to Guild Hall with your slain monster bounty.`
            : `All ${engine.maxRevives} resurrections exhausted! +${reward.killGems} Soul Gems claimed · Returning to Guild Hall in ${redirectSeconds}s...`}
        </p>

        {/* Run Stats, Kill Gem Calculation & Revive Counter */}
        <div className="w-full bg-[#1c120b] border border-[#573922] rounded-lg p-3 sm:p-4 mb-4 space-y-1.5 text-[10px] tabular-nums">
          <div className="flex justify-between border-b border-[#3d2314] pb-1.5">
            <span className="text-amber-300/70 font-cinzel text-[9px]">DEPTH &amp; TRIAL</span>
            <span className="text-amber-300 font-bold">
              Depth {floor.floorNumber} · {diffCfg.name} ({reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-[#3d2314] pb-1.5">
            <span className="text-amber-300/70 font-cinzel text-[9px]">FOES SLAIN</span>
            <span className="text-rose-300 font-bold">
              {reward.totalKills} SLAIN
              {reward.totalKills > 0
                ? ` (${reward.normalKills}N · ${reward.eliteKills}E · ${reward.bossKills}B)`
                : ''}
            </span>
          </div>
          <div className="flex justify-between border-b border-[#3d2314] pb-1.5">
            <span className="text-amber-300/70 font-cinzel text-[9px]">
              {canOfferRevive ? 'SOUL GEMS (ON EXIT)' : 'SOUL GEMS REAPED'}
            </span>
            <span className="text-emerald-400 font-bold">
              +{reward.killGems} GEMS ({reward.baseKillGems} × {reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-[#3d2314] pb-1.5">
            <span className="text-amber-300/70 font-cinzel text-[9px]">RESURRECTIONS LEFT</span>
            <span className={revivesLeft > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {revivesLeft} / {engine.maxRevives}
            </span>
          </div>
          <div className="flex justify-between border-b border-[#3d2314] pb-1.5">
            <span className="text-amber-300/70 font-cinzel text-[9px]">GOLD PLUNDERED</span>
            <span className="text-yellow-400 font-bold">{player.coins} G</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-300/70 font-cinzel text-[9px]">TOTAL SOUL GEMS</span>
            <span className="text-purple-300 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{currentGems} GEMS</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {canOfferRevive ? (
          <div className="w-full space-y-2">
            <button
              type="button"
              disabled={!canAffordRevive}
              onClick={handleReviveClick}
              className={`w-full py-3 px-4 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 border-2 transition-all min-h-[44px] whitespace-nowrap font-cinzel ${
                canAffordRevive
                  ? 'bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white border-emerald-300 cursor-pointer shadow-lg active:scale-95'
                  : 'bg-[#241710] text-amber-900 border-[#573922] cursor-not-allowed'
              }`}
            >
              <HeartPulse className="w-4 h-4 shrink-0" />
              <span>
                {canAffordRevive
                  ? `RESURRECT · ${engine.reviveCost} GEMS (${revivesLeft} LEFT)`
                  : `NEED ${engine.reviveCost} GEMS TO RESURRECT`}
              </span>
            </button>

            <button
              type="button"
              onClick={onReturnToLobby}
              className="w-full py-2.5 px-4 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 cursor-pointer min-h-[42px] whitespace-nowrap font-cinzel"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>
                {reward.killGems > 0
                  ? `RETURN TO GUILD HALL (+${reward.killGems} GEMS)`
                  : 'RETURN TO GUILD HALL'}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-3 px-4 bg-gradient-to-r from-red-700 to-amber-800 hover:from-red-600 hover:to-amber-700 text-amber-100 font-bold rounded-lg text-[10px] sm:text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all min-h-[44px] whitespace-nowrap font-cinzel"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>RETURN TO GUILD HALL</span>
          </button>
        )}
      </div>
    </div>
  );
};
