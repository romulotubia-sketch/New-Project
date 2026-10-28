/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Volume2, VolumeX, Smartphone, Keyboard, X, HelpCircle, FileDown } from 'lucide-react';
import { gameSettings, useGameSettings } from '../game/settings';
import { sounds } from '../game/sound';
import { PWAInstallButton, LandscapeModeButton, isStandaloneHtmlBuild } from './PWAInstallButton';

interface SettingsModalProps {
  onClose: () => void;
  onOpenControls?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onOpenControls }) => {
  const { hidePcKeyLabels } = useGameSettings();
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-slate-950 border-2 border-amber-500/90 rounded-xl p-4 sm:p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-amber-300">SETTINGS</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Hide PC Keybind Letters Toggle */}
          <button
            type="button"
            onClick={() => {
              sounds.shoot('pistol');
              gameSettings.toggleHidePcKeyLabels();
            }}
            className={`w-full p-3.5 rounded-lg border-2 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
              hidePcKeyLabels
                ? 'bg-emerald-950/35 border-emerald-500/80 hover:border-emerald-400'
                : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {hidePcKeyLabels ? (
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Keyboard className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-100">
                  HIDE PC KEY LABELS
                </div>
                <p className="text-xs sm:text-sm font-vt text-slate-300 leading-snug mt-0.5">
                  Hide keyboard letters like [Space], [E], [R], [Q], and [F] for a clean mobile interface.
                </p>
              </div>
            </div>

            <div
              className={`px-2.5 py-1 rounded text-[9px] font-bold border shrink-0 whitespace-nowrap ${
                hidePcKeyLabels
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                  : 'bg-slate-950 text-slate-400 border-slate-700'
              }`}
            >
              {hidePcKeyLabels ? 'HIDDEN' : 'SHOWN'}
            </div>
          </button>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={() => {
              sounds.toggleMute();
              setSoundEnabled(sounds.enabled);
            }}
            className="w-full p-3.5 rounded-lg border-2 border-slate-700 hover:border-slate-500 bg-slate-900/80 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <div className="text-[10px] font-bold text-slate-100">GAME AUDIO &amp; SFX</div>
                <p className="text-xs sm:text-sm font-vt text-slate-400 leading-snug mt-0.5">
                  Toggle combat sound effects and dungeon chiptune music.
                </p>
              </div>
            </div>

            <div
              className={`px-2.5 py-1 rounded text-[9px] font-bold border shrink-0 whitespace-nowrap ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/70'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700'
              }`}
            >
              {soundEnabled ? 'ON' : 'MUTED'}
            </div>
          </button>

          {/* Display & Controls Utilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <LandscapeModeButton fullWidth />
            {onOpenControls && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenControls();
                }}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px]"
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>CONTROLS GUIDE</span>
              </button>
            )}
          </div>

          <PWAInstallButton fullWidth />

          {!isStandaloneHtmlBuild() && (
            <a
              href="/Soul-Rogue.html"
              download="Soul-Rogue.html"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border-2 border-amber-500/70 text-amber-300 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors no-underline"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>DOWNLOAD OFFLINE FILE (.HTML)</span>
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-2 border-amber-300 rounded-lg text-[10px] cursor-pointer transition-colors min-h-[40px]"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
