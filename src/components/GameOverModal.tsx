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
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-slate-950 border-4 border-red-700 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="text-3xl sm:text-4xl mb-1.5">💀</div>

        <h2 className="text-sm sm:text-base md:text-lg font-bold text-red-500 mb-1">
          {canOfferRevive ? 'YOU HAVE FALLEN!' : 'GAME OVER'}
        </h2>

        <p className="text-slate-300 font-vt text-base mb-3.5 leading-snug">
          {canOfferRevive
            ? `Spend ${engine.reviveCost} Soul Gems to revive on the spot, or return to Lobby to claim your kill rewards.`
            : `All ${engine.maxRevives} revives used! +${reward.killGems} Kill Gems rewarded · Redirecting to Lobby in ${redirectSeconds}s...`}
        </p>

        {/* Run Stats, Kill Gem Calculation & Revive Counter */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-4 mb-4 space-y-1.5 text-[10px] tabular-nums">
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">FLOOR &amp; DIFFICULTY</span>
            <span className="text-amber-400 font-bold">
              Floor {floor.floorNumber} · {diffCfg.name} ({reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">ENEMIES SLAIN</span>
            <span className="text-rose-300 font-bold">
              {reward.totalKills} KILLS
              {reward.totalKills > 0
                ? ` (${reward.normalKills}N · ${reward.eliteKills}E · ${reward.bossKills}B)`
                : ''}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">
              {canOfferRevive ? 'KILL GEMS (ON EXIT)' : 'KILL GEMS REWARDED'}
            </span>
            <span className="text-emerald-400 font-bold">
              +{reward.killGems} GEMS ({reward.baseKillGems} × {reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">REVIVES REMAINING</span>
            <span className={revivesLeft > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {revivesLeft} / {engine.maxRevives}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">GOLD COLLECTED</span>
            <span className="text-yellow-400 font-bold">{player.coins} G</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">YOUR SOUL GEMS</span>
            <span className="text-purple-400 font-bold flex items-center gap-1">
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
              className={`w-full py-3 px-4 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 border-2 transition-all min-h-[44px] whitespace-nowrap ${
                canAffordRevive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 cursor-pointer shadow-lg active:scale-95'
                  : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <HeartPulse className="w-4 h-4 shrink-0" />
              <span>
                {canAffordRevive
                  ? `REVIVE · ${engine.reviveCost} GEMS (${revivesLeft} LEFT)`
                  : `NEED ${engine.reviveCost} GEMS TO REVIVE`}
              </span>
            </button>

            <button
              type="button"
              onClick={onReturnToLobby}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>
                {reward.killGems > 0
                  ? `BACK TO LOBBY (+${reward.killGems} GEMS)`
                  : 'BACK TO LOBBY'}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[10px] sm:text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all min-h-[44px] whitespace-nowrap"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>BACK TO LOBBY NOW</span>
          </button>
        )}
      </div>
    </div>
  );
};
