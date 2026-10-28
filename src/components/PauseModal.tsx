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
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-slate-950 border-4 border-slate-700 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col items-center text-center">
        <h2 className="text-xs sm:text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <span>⏸️</span>
          <span>GAME PAUSED &amp; SETTINGS</span>
        </h2>

        {engine && engine.player.exclusiveBuffs.length > 0 && (
          <div className="w-full mb-3.5 text-left">
            <div className="text-[9px] text-emerald-400 font-bold mb-1.5">
              ACTIVE EXCLUSIVE BUFFS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {engine.player.exclusiveBuffs.map(buff => (
                <div
                  key={buff.id}
                  className="bg-emerald-950/25 border border-emerald-600/60 rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{buff.icon}</span>
                    <span className="text-[9px] font-bold text-emerald-200">{buff.name}</span>
                  </div>
                  <p className="text-xs font-vt text-slate-300 leading-tight">{buff.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="sm:col-span-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME</span>
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
                ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {hidePcKeyLabels ? (
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Keyboard className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="truncate">HIDE PC KEYS ([Space], [E], [R])</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                hidePcKeyLabels
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
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
            className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {sounds.enabled ? <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>AUDIO: {sounds.enabled ? 'ON' : 'MUTED'}</span>
          </button>

          <LandscapeModeButton fullWidth />

          <button
            type="button"
            onClick={onOpenSkillTree}
            className="w-full py-2.5 px-3 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600 rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
            <span>TALENT TREE</span>
          </button>

          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>
              {engine && engine.getKillRewardPreview(false).killGems > 0
                ? `LOBBY (+${engine.getKillRewardPreview(false).killGems} GEMS)`
                : 'LOBBY'}
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
