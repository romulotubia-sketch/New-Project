/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Volume2,
  VolumeX,
  Smartphone,
  Keyboard,
  X,
  HelpCircle,
  FileDown,
  Eye,
  Compass,
  Swords,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { gameSettings, useGameSettings } from '../game/settings';
import { sounds } from '../game/sound';
import { PWAInstallButton, LandscapeModeButton, isStandaloneHtmlBuild } from './PWAInstallButton';

interface SettingsModalProps {
  onClose: () => void;
  onOpenControls?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onOpenControls }) => {
  const {
    hidePcKeyLabels,
    joystickScale,
    skillButtonsScale,
    screenDragEnabled,
    screenDragSensitivity,
  } = useGameSettings();
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);

  const getSensLabel = (val: number): string => {
    if (val <= 0.6) return 'Gentle';
    if (val <= 1.2) return 'Standard';
    if (val <= 1.8) return 'Swift';
    return 'Hyper';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-pixel select-none">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#140e09] border-2 border-[#b45309] rounded-xl p-4 sm:p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#573922] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-amber-300 font-cinzel tracking-wider">
              GAME &amp; CONTROLS SETTINGS
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* ========================================================= */}
          {/* SECTION: TOUCH & CONTROLS SIZING & SENSITIVITY           */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 border-b border-[#452817] pb-1">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300 font-cinzel tracking-wider">
                CONTROLS &amp; LOOK-AHEAD
              </span>
            </div>

            {/* Joystick Size Slider */}
            <div className="bg-[#1c120b] border border-[#573922] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-200 font-cinzel">
                    JOYSTICK SIZE
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#140e09] border border-amber-600/60 text-amber-300 font-vt">
                  {Math.round(joystickScale * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="75"
                  max="140"
                  step="5"
                  value={Math.round(joystickScale * 100)}
                  onChange={e => {
                    const nextVal = Number(e.target.value) / 100;
                    gameSettings.setJoystickScale(nextVal);
                  }}
                  className="w-full h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-[#573922]"
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {[
                  { label: '80% Compact', scale: 0.8 },
                  { label: '100% Default', scale: 1.0 },
                  { label: '125% Large', scale: 1.25 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      sounds.shoot('pistol');
                      gameSettings.setJoystickScale(preset.scale);
                    }}
                    className={`flex-1 py-1 px-1.5 rounded text-[8px] border font-cinzel transition-colors cursor-pointer text-center ${
                      Math.abs(joystickScale - preset.scale) < 0.04
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                        : 'bg-[#140e09] border-[#573922] text-amber-400/80 hover:border-[#78593a]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill Buttons Size Slider */}
            <div className="bg-[#1c120b] border border-[#573922] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-200 font-cinzel">
                    SKILL &amp; STRIKE BUTTONS SIZE
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#140e09] border border-amber-600/60 text-amber-300 font-vt">
                  {Math.round(skillButtonsScale * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="75"
                  max="140"
                  step="5"
                  value={Math.round(skillButtonsScale * 100)}
                  onChange={e => {
                    const nextVal = Number(e.target.value) / 100;
                    gameSettings.setSkillButtonsScale(nextVal);
                  }}
                  className="w-full h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-[#573922]"
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {[
                  { label: '80% Compact', scale: 0.8 },
                  { label: '100% Default', scale: 1.0 },
                  { label: '125% Large', scale: 1.25 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      sounds.shoot('pistol');
                      gameSettings.setSkillButtonsScale(preset.scale);
                    }}
                    className={`flex-1 py-1 px-1.5 rounded text-[8px] border font-cinzel transition-colors cursor-pointer text-center ${
                      Math.abs(skillButtonsScale - preset.scale) < 0.04
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                        : 'bg-[#140e09] border-[#573922] text-amber-400/80 hover:border-[#78593a]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drag Screen / Look Beyond Toggle */}
            <button
              type="button"
              onClick={() => {
                sounds.shoot('pistol');
                gameSettings.toggleScreenDragEnabled();
              }}
              className={`w-full p-3 rounded-lg border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                screenDragEnabled
                  ? 'bg-amber-950/40 border-amber-500/80 hover:border-amber-400'
                  : 'bg-[#1c120b] border-[#573922] hover:border-[#78593a]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Eye className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-amber-200 font-cinzel">
                    DRAG SCREEN TO LOOK BEYOND
                  </div>
                  <p className="text-xs font-vt text-amber-100/80 leading-snug mt-0.5">
                    Drag the screen like a joystick to scout ahead. Camera automatically centers upon release.
                  </p>
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded text-[9px] font-bold border shrink-0 whitespace-nowrap font-cinzel ${
                  screenDragEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/70'
                    : 'bg-[#140e09] text-stone-400 border-[#573922]'
                }`}
              >
                {screenDragEnabled ? 'ENABLED' : 'DISABLED'}
              </div>
            </button>

            {/* Look Beyond Drag Sensitivity Slider */}
            {screenDragEnabled && (
              <div className="bg-[#1c120b] border border-[#573922] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-200 font-cinzel">
                      LOOK-JOYSTICK SENSITIVITY
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-amber-400 font-cinzel">
                      {getSensLabel(screenDragSensitivity)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#140e09] border border-amber-600/60 text-amber-300 font-vt">
                      {screenDragSensitivity.toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.4"
                    max="2.5"
                    step="0.1"
                    value={screenDragSensitivity}
                    onChange={e => {
                      const nextVal = Number(e.target.value);
                      gameSettings.setScreenDragSensitivity(nextVal);
                    }}
                    className="w-full h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-[#573922]"
                  />
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  {[
                    { label: '0.6x Slow', val: 0.6 },
                    { label: '1.0x Normal', val: 1.0 },
                    { label: '1.6x Fast', val: 1.6 },
                    { label: '2.2x High', val: 2.2 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        sounds.shoot('pistol');
                        gameSettings.setScreenDragSensitivity(preset.val);
                      }}
                      className={`flex-1 py-1 px-1 rounded text-[8px] border font-cinzel transition-colors cursor-pointer text-center ${
                        Math.abs(screenDragSensitivity - preset.val) < 0.08
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                          : 'bg-[#140e09] border-[#573922] text-amber-400/80 hover:border-[#78593a]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      sounds.shoot('pistol');
                      gameSettings.setScreenDragSensitivity(1.0);
                    }}
                    className="p-1 rounded bg-[#140e09] hover:bg-[#241710] border border-[#573922] text-amber-400 shrink-0 cursor-pointer"
                    title="Reset to 1.0x"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <p className="text-[11px] font-vt text-amber-200/70 pt-0.5 leading-tight">
                  Tip: Pull screen to look in that direction; release to smoothly recenter view on hero.
                </p>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION: INTERFACE & SOUND                               */}
          {/* ========================================================= */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 border-b border-[#452817] pb-1">
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300 font-cinzel tracking-wider">
                INTERFACE &amp; AUDIO
              </span>
            </div>

            {/* Hide PC Keybind Letters Toggle */}
            <button
              type="button"
              onClick={() => {
                sounds.shoot('pistol');
                gameSettings.toggleHidePcKeyLabels();
              }}
              className={`w-full p-3 rounded-lg border-2 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                hidePcKeyLabels
                  ? 'bg-amber-950/40 border-amber-500/80 hover:border-amber-400'
                  : 'bg-[#1c120b] border-[#573922] hover:border-[#78593a]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {hidePcKeyLabels ? (
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Keyboard className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-amber-200 font-cinzel">
                    HIDE PC SPELL LABELS
                  </div>
                  <p className="text-xs sm:text-sm font-vt text-amber-100/80 leading-snug mt-0.5">
                    Hide keyboard letters like [Space], [E], [R], [Q], and [F] for a clean touch interface.
                  </p>
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded text-[9px] font-bold border shrink-0 whitespace-nowrap font-cinzel ${
                  hidePcKeyLabels
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-[#140e09] text-amber-500/60 border-[#573922]'
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
              className="w-full p-3 rounded-lg border-2 border-[#573922] hover:border-[#78593a] bg-[#1c120b] text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="text-[10px] font-bold text-amber-200 font-cinzel">
                    REALM AUDIO &amp; SFX
                  </div>
                  <p className="text-xs sm:text-sm font-vt text-amber-100/80 leading-snug mt-0.5">
                    Toggle combat spell effects and medieval dungeon melodies.
                  </p>
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded text-[9px] font-bold border shrink-0 whitespace-nowrap font-cinzel ${
                  soundEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/70'
                    : 'bg-rose-950/60 text-rose-300 border-rose-700'
                }`}
              >
                {soundEnabled ? 'ON' : 'MUTED'}
              </div>
            </button>
          </div>

          {/* ========================================================= */}
          {/* SECTION: UTILITIES & SYSTEM                              */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <LandscapeModeButton fullWidth />
            {onOpenControls && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenControls();
                }}
                className="w-full py-2.5 px-3 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded-lg text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px] font-cinzel"
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>CONTROLS GUIDE</span>
              </button>
            )}
          </div>

          <PWAInstallButton fullWidth />

          {!isStandaloneHtmlBuild() && (
            <a
              href="/Soul-Rogue.html"
              download="Soul-Rogue.html"
              className="w-full py-2.5 px-4 bg-[#241710] hover:bg-[#342217] border-2 border-[#b45309] text-amber-300 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors no-underline font-cinzel"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>DOWNLOAD OFFLINE FILE (.HTML)</span>
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-2 border-amber-300 rounded-lg text-[10px] cursor-pointer transition-colors min-h-[40px] font-cinzel tracking-wider"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
