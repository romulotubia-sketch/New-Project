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
    const nextBiome = props.currentFloor === 1 ? 'Ancient Crypt' : 'Infernal Caldera';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
        <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#140e09] border-2 border-[#b45309] rounded-xl p-4 sm:p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-amber-300 font-cinzel tracking-wider">
                {isFinalFloor ? 'STEP INTO REALM VICTORY PORTAL?' : 'STEP INTO THE LOWER CATACOMBS?'}
              </h2>
              <p className="text-sm sm:text-base font-vt text-amber-100/90 mt-1 leading-snug">
                {isFinalFloor
                  ? 'Step through the Ancient Archway to seal the Magic Core and claim your Victory Bounty!'
                  : `Descend to Depth ${props.currentFloor + 1} (${nextBiome})? Ensure all relics and treasure chests have been claimed.`}
              </p>
            </div>
            <button
              type="button"
              onClick={props.onCancel}
              className="p-1.5 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#1d120a] border border-[#573922] rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between text-xs font-vt tabular-nums">
            <span className="text-amber-300/70 font-cinzel text-[10px]">Active Trial</span>
            <span className="text-amber-300 font-bold">
              {diffCfg.name.toUpperCase()} · {diffCfg.gemMult.toFixed(1)}x Gems · {diffCfg.goldMult.toFixed(1)}x Gold
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={props.onCancel}
              className="py-2.5 px-3 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[10px] font-bold cursor-pointer min-h-[40px] whitespace-nowrap font-cinzel"
            >
              STAY HERE
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap font-cinzel shadow-md"
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{isFinalFloor ? 'CLAIM VICTORY' : 'ENTER DEPTHS'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hero = CHARACTERS.find(c => c.id === props.heroId) || CHARACTERS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
      <div className="w-full max-w-lg max-h-[94dvh] overflow-y-auto bg-[#140e09] border-2 border-[#b45309] rounded-xl p-4 sm:p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-amber-300 font-cinzel tracking-wider">ENTER DUNGEON PORTAL?</h2>
            <p className="text-sm sm:text-base font-vt text-amber-100/90 mt-0.5 leading-snug">
              Confirm your trial difficulty and embark into the catacombs as{' '}
              <span className="text-amber-300 font-bold">{hero.name}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onCancel}
            className="p-1.5 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chosen Hero & Equipped Skills Summary */}
        <div className="bg-[#1d120a] border border-[#573922] rounded-lg px-3 py-2.5 mb-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="text-[9px] text-amber-300 font-bold font-cinzel">{hero.name.toUpperCase()}</div>
            <div className="text-xs font-vt text-amber-200/70">{hero.title}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {props.skills.map((s, idx) => (
              <div
                key={`${s.id}_${idx}`}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg bg-[#140e09] ${
                  s.isUltimate ? 'border-amber-400/90' : 'border-indigo-500/80'
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
            <span className="text-[9px] font-bold text-amber-200 flex items-center gap-1.5 font-cinzel">
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>SELECT TRIAL</span>
            </span>
            <span className="text-xs font-vt text-amber-300">Greater trials = Grander spoils</span>
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
                  className={`py-2 px-1 rounded-lg border text-[8px] sm:text-[9px] font-bold cursor-pointer transition-colors min-h-[38px] text-center whitespace-nowrap font-cinzel ${
                    isSelected
                      ? dId === 'hell'
                        ? 'bg-rose-700 text-white border-rose-300 shadow-md'
                        : dId === 'nightmare'
                        ? 'bg-purple-700 text-white border-purple-300 shadow-md'
                        : dId === 'hard'
                        ? 'bg-amber-600 text-slate-950 border-amber-200 shadow-md'
                        : dId === 'easy'
                        ? 'bg-emerald-600 text-slate-950 border-emerald-200 shadow-md'
                        : 'bg-amber-500 text-slate-950 border-amber-200 shadow-md'
                      : 'bg-[#1e130c] hover:bg-[#2c1c11] text-amber-200/80 border-[#573922]'
                  }`}
                >
                  {cfg.name.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div className="bg-[#1d120a] border border-[#573922] rounded-lg p-3 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-200 font-cinzel">{diffCfg.name.toUpperCase()} TRIAL</span>
              {diffCfg.id === 'medium' && (
                <span className="text-xs font-vt text-amber-300">Standard Baseline</span>
              )}
            </div>
            <p className="text-sm font-vt text-amber-100/80 leading-tight">{diffCfg.tagline}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#3d2314] text-xs font-vt">
              <span className="text-rose-400">
                Foe Vitality {Math.round(diffCfg.enemyHpMult * 100)}% · Strike DMG {Math.round(diffCfg.enemyDamageMult * 100)}%
              </span>
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>
                  Gems {diffCfg.gemMult.toFixed(1)}x · Gold {diffCfg.goldMult.toFixed(1)}x · Victory +{diffCfg.victoryGemBonus}G
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
            className="py-2.5 px-3 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[10px] font-bold cursor-pointer min-h-[42px] whitespace-nowrap font-cinzel"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] whitespace-nowrap font-cinzel shadow-lg"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>ENTER DUNGEON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
