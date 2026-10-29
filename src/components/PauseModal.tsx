/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameEngine } from '../game/gameEngine';
import { gameSettings, useGameSettings } from '../game/settings';
import { sounds } from '../game/sound';
import { Volume2, VolumeX, Sparkles, Home, Play, Smartphone, Keyboard } from 'lucide-react';
import { PWAInstallButton, LandscapeModeButton } from './PWAInstallButton';

interface PauseModalProps {
  engine?: GameEngine;
  onResume: () => void;
  onOpenSkillTree: () => void;
  onReturnToLobby: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  engine,
  onResume,
  onOpenSkillTree,
  onReturnToLobby,
}) => {
  const [, setRefresh] = React.useState(0);
  const { hidePcKeyLabels } = useGameSettings();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 font-pixel select-none">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#140e09] border-4 border-[#78593a] rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col items-center text-center">
        <h2 className="text-xs sm:text-sm font-bold text-amber-300 font-cinzel mb-3 flex items-center gap-2 tracking-wider">
          <span>⏸️</span>
          <span>CHRONICLE PAUSED &amp; SETTINGS</span>
        </h2>

        {engine && engine.player.exclusiveBuffs.length > 0 && (
          <div className="w-full mb-3.5 text-left">
            <div className="text-[9px] text-amber-300 font-bold font-cinzel mb-1.5">
              ACTIVE ENCHANTMENTS &amp; BLESSINGS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {engine.player.exclusiveBuffs.map(buff => (
                <div
                  key={buff.id}
                  className="bg-[#1e130c] border border-[#573922] rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{buff.icon}</span>
                    <span className="text-[9px] font-bold text-amber-200 font-cinzel">{buff.name}</span>
                  </div>
                  <p className="text-xs font-vt text-amber-100/80 leading-tight">{buff.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="sm:col-span-2 w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-amber-100 font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all font-cinzel border border-amber-300"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME TRIAL</span>
          </button>

          {/* Hide PC Keybind Labels Setting Toggle */}
          <button
            type="button"
            onClick={() => {
              sounds.shoot('pistol');
              gameSettings.toggleHidePcKeyLabels();
            }}
            className={`sm:col-span-2 w-full py-2.5 px-3 rounded-lg border text-[10px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
              hidePcKeyLabels
                ? 'bg-amber-950/40 hover:bg-amber-950/60 border-amber-500/80 text-amber-200'
                : 'bg-[#241710] hover:bg-[#342217] border-[#78593a] text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {hidePcKeyLabels ? (
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Keyboard className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="truncate">HIDE PC SPELL KEYS ([Space], [E], [R])</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[8px] font-bold shrink-0 font-cinzel ${
                hidePcKeyLabels
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#18110b] text-amber-500/60'
              }`}
            >
              {hidePcKeyLabels ? 'HIDDEN' : 'SHOWN'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.toggleMute();
              setRefresh(r => r + 1);
            }}
            className="w-full py-2.5 px-3 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {sounds.enabled ? <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>AUDIO: {sounds.enabled ? 'ON' : 'MUTED'}</span>
          </button>

          <LandscapeModeButton fullWidth />

          <button
            type="button"
            onClick={onOpenSkillTree}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-900 to-indigo-950 hover:from-purple-800 hover:to-indigo-900 text-purple-200 border border-purple-500/80 rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap font-cinzel"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span>TALENT GRIMOIRE</span>
          </button>

          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-2.5 px-3 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap font-cinzel"
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>
              {engine && engine.getKillRewardPreview(false).killGems > 0
                ? `GUILD HALL (+${engine.getKillRewardPreview(false).killGems} GEMS)`
                : 'GUILD HALL'}
            </span>
          </button>

          <div className="sm:col-span-2">
            <PWAInstallButton fullWidth />
          </div>
        </div>
      </div>
    </div>
  );
};
