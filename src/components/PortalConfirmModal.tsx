/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CHARACTERS, DIFFICULTY_CONFIGS, DIFFICULTY_ORDER } from '../game/constants';
import { CharacterClass, DifficultyId, Skill } from '../game/types';
import { Sparkles, Swords, X, Check } from 'lucide-react';

interface LobbyPortalConfirmProps {
  mode: 'lobby';
  heroId: CharacterClass;
  skills: Skill[];
  difficulty: DifficultyId;
  onSelectDifficulty: (diff: DifficultyId) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface DungeonPortalConfirmProps {
  mode: 'dungeon';
  currentFloor: number;
  difficulty: DifficultyId;
  onConfirm: () => void;
  onCancel: () => void;
}

export type PortalConfirmModalProps = LobbyPortalConfirmProps | DungeonPortalConfirmProps;

export const PortalConfirmModal: React.FC<PortalConfirmModalProps> = props => {
  const diffCfg = DIFFICULTY_CONFIGS[props.difficulty] || DIFFICULTY_CONFIGS.medium;

  if (props.mode === 'dungeon') {
    const isFinalFloor = props.currentFloor >= 3;
    const nextBiome = props.currentFloor === 1 ? 'Crypt' : 'Volcano';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
        <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-slate-950 border-2 border-purple-500 rounded-xl p-4 sm:p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-purple-300">
                {isFinalFloor ? 'ENTER VICTORY PORTAL?' : 'ENTER NEXT FLOOR PORTAL?'}
              </h2>
              <p className="text-sm sm:text-base font-vt text-slate-300 mt-1 leading-snug">
                {isFinalFloor
                  ? 'Step through the Magic Stone Portal to complete your run and claim your Victory Bounty!'
                  : `Advance to Floor ${props.currentFloor + 1} (${nextBiome})? Make sure you have collected all loot in this room first.`}
              </p>
            </div>
            <button
              type="button"
              onClick={props.onCancel}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between text-xs font-vt tabular-nums">
            <span className="text-slate-400">Active Difficulty</span>
            <span className="text-amber-300 font-bold">
              {diffCfg.name.toUpperCase()} · {diffCfg.gemMult.toFixed(1)}x Gems · {diffCfg.goldMult.toFixed(1)}x Gold
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={props.onCancel}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer min-h-[40px] whitespace-nowrap"
            >
              STAY HERE
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              className="py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white border border-purple-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{isFinalFloor ? 'CLAIM VICTORY' : 'ENTER PORTAL'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hero = CHARACTERS.find(c => c.id === props.heroId) || CHARACTERS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
      <div className="w-full max-w-lg max-h-[94dvh] overflow-y-auto bg-slate-950 border-2 border-purple-500 rounded-xl p-4 sm:p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-purple-300">ENTER DUNGEON PORTAL?</h2>
            <p className="text-sm sm:text-base font-vt text-slate-300 mt-0.5 leading-snug">
              Confirm your difficulty and embark into the dungeon as{' '}
              <span className="text-amber-300 font-bold">{hero.name}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onCancel}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chosen Hero & Equipped Skills Summary */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2.5 mb-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="text-[9px] text-amber-300 font-bold">{hero.name.toUpperCase()}</div>
            <div className="text-xs font-vt text-slate-400">{hero.title}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {props.skills.map((s, idx) => (
              <div
                key={`${s.id}_${idx}`}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg bg-slate-950 ${
                  s.isUltimate ? 'border-amber-400/90' : 'border-sky-500/80'
                }`}
                title={s.name}
              >
                {s.icon}
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Selector (Easy -> Hell, Default Medium) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-slate-300 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>SELECT DIFFICULTY</span>
            </span>
            <span className="text-xs font-vt text-purple-300">Higher difficulty = More rewards</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mb-2.5">
            {DIFFICULTY_ORDER.map(dId => {
              const cfg = DIFFICULTY_CONFIGS[dId];
              const isSelected = dId === props.difficulty;
              return (
                <button
                  key={dId}
                  type="button"
                  onClick={() => props.onSelectDifficulty(dId)}
                  className={`py-2 px-1 rounded-lg border text-[8px] sm:text-[9px] font-bold cursor-pointer transition-colors min-h-[38px] text-center whitespace-nowrap ${
                    isSelected
                      ? dId === 'hell'
                        ? 'bg-rose-600 text-white border-rose-300'
                        : dId === 'nightmare'
                        ? 'bg-purple-600 text-white border-purple-300'
                        : dId === 'hard'
                        ? 'bg-amber-500 text-slate-950 border-amber-200'
                        : dId === 'easy'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                        : 'bg-sky-500 text-slate-950 border-sky-200'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {cfg.name.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white">{diffCfg.name.toUpperCase()} MODE</span>
              {diffCfg.id === 'medium' && (
                <span className="text-xs font-vt text-sky-300">Standard Baseline</span>
              )}
            </div>
            <p className="text-sm font-vt text-slate-300 leading-tight">{diffCfg.tagline}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800 text-xs font-vt">
              <span className="text-rose-300">
                Enemy HP {Math.round(diffCfg.enemyHpMult * 100)}% · DMG {Math.round(diffCfg.enemyDamageMult * 100)}%
              </span>
              <span className="text-purple-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>
                  Gems {diffCfg.gemMult.toFixed(1)}x · Gold {diffCfg.goldMult.toFixed(1)}x · Win +{diffCfg.victoryGemBonus}G
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Confirm / Cancel Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={props.onCancel}
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white border border-purple-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>ENTER DUNGEON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
