/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { DIFFICULTY_CONFIGS } from '../game/constants';
import { GameEngine } from '../game/gameEngine';
import { skillTreeManager } from '../game/skillTree';
import { Sparkles, Trophy, Home } from 'lucide-react';

interface VictoryModalProps {
  engine: GameEngine;
  onReturnToLobby: () => void;
  onOpenSkillTree: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  engine,
  onReturnToLobby,
  onOpenSkillTree,
}) => {
  const { player } = engine;
  const diffCfg = DIFFICULTY_CONFIGS[engine.difficulty] || DIFFICULTY_CONFIGS.medium;
  const reward = engine.claimedRewardSummary || engine.claimEndOfRunRewards(true);

  useEffect(() => {
    // Fire fireworks confetti
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const totalGemsNow = skillTreeManager.getSoulGems();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 font-pixel select-none">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-slate-950 border-4 border-amber-500 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col items-center text-center">
        
        {/* Trophy */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-500/20 border-2 border-amber-400 rounded-full flex items-center justify-center mb-2 shrink-0">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
        </div>

        <h2 className="text-sm sm:text-base md:text-lg font-bold text-amber-400 mb-1">DUNGEON CONQUERED!</h2>
        <p className="text-slate-300 font-vt text-base mb-4 leading-snug">
          The Magic Stones are restored! Your kills and victory on <span className="text-amber-300 font-bold">{diffCfg.name}</span> earned <span className="text-emerald-300 font-bold">+{reward.totalGemsEarned} Soul Gems</span>!
        </p>

        {/* Kill Calculation & Victory Bounty */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-4 mb-4 space-y-1.5 text-[10px] tabular-nums">
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">DIFFICULTY</span>
            <span className="text-amber-300 font-bold">
              {diffCfg.name.toUpperCase()} ({reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">ENEMIES SLAIN</span>
            <span className="text-rose-300 font-bold">
              {reward.totalKills} KILLS ({reward.normalKills}N · {reward.eliteKills}E · {reward.bossKills}B)
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">KILL GEM REWARD</span>
            <span className="text-emerald-400 font-bold">
              +{reward.killGems} GEMS ({reward.baseKillGems} × {reward.gemMultiplier.toFixed(1)}x)
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">VICTORY BOUNTY</span>
            <span className="text-emerald-400 font-bold">+{reward.victoryBonusGems} BONUS GEMS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">TOTAL EARNED</span>
            <span className="text-amber-300 font-bold">+{reward.totalGemsEarned} GEMS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-1.5">
            <span className="text-slate-400">GOLD HOARD</span>
            <span className="text-yellow-400 font-bold">{player.coins} G</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">TOTAL SOUL GEMS</span>
            <span className="text-purple-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{totalGemsNow} GEMS</span>
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={onOpenSkillTree}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>SKILL TREE</span>
          </button>

          <button
            onClick={onReturnToLobby}
            className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[10px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>LOBBY</span>
          </button>
        </div>

      </div>
    </div>
  );
};
