/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_CONFIGS } from '../game/constants';
import { GameEngine } from '../game/gameEngine';
import { formatInteractPrompt, useGameSettings } from '../game/settings';
import { sounds } from '../game/sound';
import { Volume2, VolumeX, Pause, Sparkles, Coins, RefreshCw, Map, Hand, Swords } from 'lucide-react';
import { LandscapeModeButton } from './PWAInstallButton';

interface HUDProps {
  engine: GameEngine;
  onOpenSkillTree: () => void;
  onPause: () => void;
  onSwitchWeapon: () => void;
}

const WIDTH_STEPS = [
  'w-0', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]',
  'w-[25%]', 'w-[30%]', 'w-[35%]', 'w-[40%]', 'w-[45%]',
  'w-[50%]', 'w-[55%]', 'w-[60%]', 'w-[65%]', 'w-[70%]',
  'w-[75%]', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-full',
];

function getProgressWidthClass(current: number, max: number): string {
  if (max <= 0 || current <= 0) return 'w-0';
  const ratio = Math.max(0, Math.min(1, current / max));
  const idx = Math.round(ratio * 20);
  return WIDTH_STEPS[idx] || 'w-full';
}

const HEIGHT_STEPS = [
  'h-0', 'h-[10%]', 'h-[20%]', 'h-[30%]', 'h-[40%]',
  'h-[50%]', 'h-[60%]', 'h-[70%]', 'h-[80%]', 'h-[90%]', 'h-full',
];

function getCooldownHeightClass(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const idx = Math.round(clamped * 10);
  return HEIGHT_STEPS[idx] || 'h-0';
}

const HOLD_INSPECT_MS = 240;

export const HUD: React.FC<HUDProps> = ({
  engine,
  onOpenSkillTree,
  onPause,
  onSwitchWeapon,
}) => {
  const [, setHudTick] = useState(0);
  const { hidePcKeyLabels } = useGameSettings();

  const attackPointerIdRef = useRef<number | null>(null);
  const skillPressRef = useRef<{
    pointerId: number;
    skillIndex: number;
    didLongPress: boolean;
    timerId: number;
  } | null>(null);

  const [heldSkillIndex, setHeldSkillIndex] = useState<number | null>(null);
  const [heldBuffIndex, setHeldBuffIndex] = useState<number | null>(null);

  // Self-contained HUD refresh (keeps GameCanvas & MobileControls 100% isolated from React re-renders)
  useEffect(() => {
    const interval = setInterval(() => {
      setHudTick(t => t + 1);
    }, 80);
    return () => clearInterval(interval);
  }, [engine]);

  // Ensure any active hold-to-inspect state cleans up on window blur or unmount
  useEffect(() => {
    const clearHoldState = () => {
      if (skillPressRef.current) {
        window.clearTimeout(skillPressRef.current.timerId);
        skillPressRef.current = null;
      }
      setHeldSkillIndex(null);
      setHeldBuffIndex(null);
    };

    window.addEventListener('blur', clearHoldState);
    return () => {
      window.removeEventListener('blur', clearHoldState);
      if (skillPressRef.current) {
        window.clearTimeout(skillPressRef.current.timerId);
      }
    };
  }, []);

  const { player, floor, interactPrompt, activeEffects } = engine;
  const formattedInteractPrompt = formatInteractPrompt(interactPrompt, hidePcKeyLabels);

  const currentWeapon = player.weapons[player.currentWeaponIndex];
  const secondaryWeapon =
    player.weapons.length > 1
      ? player.weapons[(player.currentWeaponIndex + 1) % player.weapons.length]
      : null;

  const currentRoom = engine.getCurrentRoom();
  const boss = currentRoom?.enemies.find(e => e.isBoss);

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'mythic':
        return 'border-rose-500 text-rose-300 bg-rose-950/80 shadow-[0_0_12px_rgba(244,63,94,0.3)]';
      case 'legendary':
        return 'border-amber-400 text-amber-300 bg-amber-950/80 shadow-[0_0_12px_rgba(251,191,36,0.3)]';
      case 'epic':
        return 'border-purple-400 text-purple-300 bg-purple-950/80 shadow-[0_0_10px_rgba(192,132,252,0.25)]';
      case 'rare':
        return 'border-indigo-400 text-indigo-300 bg-indigo-950/80';
      default:
        return 'border-[#78593a] text-amber-100 bg-[#171424]/90';
    }
  };

  const formatSkillKeyLabel = (rawHint: string) => {
    if (rawHint === 'SPACE') return '[Space]';
    return `[${rawHint}]`;
  };

  const formatSlotBadge = (index: number, isUlt: boolean, rawHint: string) => {
    if (hidePcKeyLabels) {
      return isUlt ? 'ULTIMATE' : `SKILL ${index + 1}`;
    }
    return isUlt ? `ULTIMATE ${formatSkillKeyLabel(rawHint)}` : `SKILL ${index + 1} ${formatSkillKeyLabel(rawHint)}`;
  };

  // Active status buffs for clean readout above skill bar
  const auras = activeEffects.auras;
  const activeBuffLabels: Array<{ label: string; time: number; color: string }> = [];
  if (player.dualWieldTimer > 0) activeBuffLabels.push({ label: 'DUAL WIELD', time: player.dualWieldTimer, color: 'text-amber-300 border-amber-500' });
  if (player.fortressShieldTimer > 0) activeBuffLabels.push({ label: 'FORTRESS', time: player.fortressShieldTimer, color: 'text-sky-300 border-sky-500' });
  if (auras.berserkTimer > 0) activeBuffLabels.push({ label: 'BERSERK', time: auras.berserkTimer, color: 'text-red-300 border-red-500' });
  if (auras.stealthTimer > 0) activeBuffLabels.push({ label: 'STEALTH', time: auras.stealthTimer, color: 'text-emerald-300 border-emerald-500' });
  if (auras.astralOverloadTimer > 0) activeBuffLabels.push({ label: '0 MP OVERLOAD', time: auras.astralOverloadTimer, color: 'text-indigo-300 border-indigo-500' });
  if (auras.blizzardTimer > 0) activeBuffLabels.push({ label: 'GLACIAL', time: auras.blizzardTimer, color: 'text-cyan-300 border-cyan-500' });
  if (auras.flameBarrierTimer > 0) activeBuffLabels.push({ label: 'FLAME RING', time: auras.flameBarrierTimer, color: 'text-orange-300 border-orange-500' });
  if (auras.archangelTimer > 0) activeBuffLabels.push({ label: 'ARCHANGEL', time: auras.archangelTimer, color: 'text-yellow-200 border-yellow-400' });
  if (auras.aegisAbsorbTimer > 0) activeBuffLabels.push({ label: 'HOLY AEGIS', time: auras.aegisAbsorbTimer, color: 'text-amber-200 border-amber-400' });
  if (auras.wraithTimer > 0) activeBuffLabels.push({ label: 'WRAITH', time: auras.wraithTimer, color: 'text-fuchsia-300 border-fuchsia-500' });
  if (auras.lichTimer > 0) activeBuffLabels.push({ label: 'LICH SOVEREIGN', time: auras.lichTimer, color: 'text-purple-300 border-purple-500' });
  if (auras.undyingTimer > 0) activeBuffLabels.push({ label: 'UNDYING RAGE', time: auras.undyingTimer, color: 'text-orange-300 border-orange-500' });
  if (auras.bloodboilTimer > 0) activeBuffLabels.push({ label: 'BLOODBOIL', time: auras.bloodboilTimer, color: 'text-rose-300 border-rose-500' });
  if (auras.killMomentumTimer > 0) activeBuffLabels.push({ label: 'MOMENTUM', time: auras.killMomentumTimer, color: 'text-emerald-300 border-emerald-500' });
  const isRestingNow = player.animState === 'rest' && player.animFrame >= 5;

  const heldSkill = heldSkillIndex !== null ? player.skills[heldSkillIndex] || null : null;
  const heldBuff = heldBuffIndex !== null ? player.exclusiveBuffs[heldBuffIndex] || null : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between safe-hud lg:p-3 font-pixel tabular-nums">
      {/* Top Header Bar */}
      <div className="flex justify-between items-start w-full gap-2">
        {/* Left: Player Stats (HP, Shield, Energy, Currencies) */}
        <div className="flex flex-col gap-1 lg:gap-1.5 pointer-events-auto">
          {/* HP Bar */}
          <div className="flex items-center gap-2 bg-[#0e0c18]/90 backdrop-blur-sm border-2 border-[#684c30] px-2.5 py-1 lg:px-3 lg:py-1.5 rounded shadow-lg w-44 sm:w-48 lg:w-56">
            <span className="text-red-500 text-[10px] lg:text-xs">❤️</span>
            <div className="flex-1 bg-stone-900 h-2.5 lg:h-3.5 border border-[#3e2e1e] rounded-xs overflow-hidden">
              <div
                className={`bg-red-500 h-full transition-all duration-150 ${getProgressWidthClass(player.hp, player.maxHp)}`}
              />
            </div>
            <span className="text-red-200 font-vt text-xs lg:text-sm w-11 lg:w-12 text-right">
              {Math.ceil(player.hp)}/{player.maxHp}
            </span>
          </div>

          {/* Shield Bar */}
          <div className="flex items-center gap-2 bg-[#0e0c18]/90 backdrop-blur-sm border-2 border-[#684c30] px-2.5 py-1 lg:px-3 lg:py-1.5 rounded shadow-lg w-44 sm:w-48 lg:w-56">
            <span className="text-amber-400 text-[10px] lg:text-xs">🛡️</span>
            <div className="flex-1 bg-stone-900 h-2.5 lg:h-3.5 border border-[#3e2e1e] rounded-xs overflow-hidden">
              <div
                className={`bg-amber-400 h-full transition-all duration-150 ${getProgressWidthClass(player.shield, player.maxShield)}`}
              />
            </div>
            <span className="text-amber-200 font-vt text-xs lg:text-sm w-11 lg:w-12 text-right">
              {Math.floor(player.shield)}/{player.maxShield}
            </span>
          </div>

          {/* Energy Bar (Mana) */}
          <div className="flex items-center gap-2 bg-[#0e0c18]/90 backdrop-blur-sm border-2 border-[#684c30] px-2.5 py-1 lg:px-3 lg:py-1.5 rounded shadow-lg w-44 sm:w-48 lg:w-56">
            <span className="text-indigo-400 text-[10px] lg:text-xs">🔮</span>
            <div className="flex-1 bg-stone-900 h-2.5 lg:h-3 border border-[#3e2e1e] rounded-xs overflow-hidden">
              <div
                className={`bg-indigo-500 h-full transition-all duration-100 ${getProgressWidthClass(player.energy, player.maxEnergy)}`}
              />
            </div>
            <span className="text-indigo-200 font-vt text-xs lg:text-sm w-11 lg:w-12 text-right">
              {Math.round(player.energy)}/{player.maxEnergy}
            </span>
          </div>

          {/* Currencies (Coins, Banked Soul Gems & Live Run Kills) + Active Hero's 2 Exclusive Buffs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-2.5 bg-[#0e0c18]/90 backdrop-blur-sm border border-[#684c30] px-2.5 py-0.5 lg:px-3 lg:py-1 rounded w-fit text-[10px] lg:text-xs">
              <div className="flex items-center gap-1 text-amber-400" title="Gold Coins">
                <Coins className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-amber-400" />
                <span>{player.coins}</span>
              </div>
              <div className="flex items-center gap-1 text-rose-400" title="Monsters Slain This Run">
                <Swords className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-rose-400" />
                <span>{engine.killCounter}</span>
              </div>
              <div className="flex items-center gap-1 text-purple-400" title="Soul Gems">
                <Sparkles className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-purple-400" />
                <span>{player.soulGems}</span>
              </div>
            </div>

            {player.exclusiveBuffs.map((buff, idx) => (
              <button
                key={buff.id}
                type="button"
                onContextMenu={e => e.preventDefault()}
                onPointerDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore synthetic pointer
                  }
                  setHeldBuffIndex(idx);
                }}
                onPointerUp={() => setHeldBuffIndex(null)}
                onPointerCancel={() => setHeldBuffIndex(null)}
                onLostPointerCapture={() => setHeldBuffIndex(null)}
                className={`flex items-center justify-center bg-slate-950/85 border px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-emerald-300 cursor-pointer touch-none transition-colors ${
                  heldBuffIndex === idx
                    ? 'border-emerald-300 bg-emerald-950/80'
                    : 'border-emerald-600/70 hover:border-emerald-400'
                }`}
                title="Hold to view passive description"
              >
                <span className="text-xs leading-none">{buff.icon}</span>
              </button>
            ))}
          </div>

          {/* Floating Hold-to-Inspect Card for Top-Left Exclusive Buffs */}
          {heldBuff && (
            <div className="mt-1 max-w-xs bg-slate-950/95 border-2 border-emerald-400 rounded-lg p-3 shadow-2xl pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none shrink-0">{heldBuff.icon}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-emerald-200">{heldBuff.name}</div>
                  <div className="text-xs font-vt text-amber-300 leading-tight">{heldBuff.tagline}</div>
                </div>
              </div>
              <p className="mt-1.5 text-sm font-vt text-slate-100 leading-snug">{heldBuff.description}</p>
            </div>
          )}
        </div>

        {/* Center: Floor Indicator, Difficulty & Boss Bar */}
        <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="bg-[#0e0c18]/95 border-2 border-[#78593a] px-3.5 py-1 lg:px-4 lg:py-1.5 rounded-lg shadow-xl text-center">
            <div className="text-[8px] lg:text-[9px] text-amber-200/80 uppercase tracking-widest font-cinzel">
              {floor.biome} · {(DIFFICULTY_CONFIGS[engine.difficulty] || DIFFICULTY_CONFIGS.medium).name.toUpperCase()} REALM
            </div>
            <div className="text-[10px] lg:text-xs text-amber-300 font-bold whitespace-nowrap">
              FLOOR {floor.floorNumber} · {Math.max(0, engine.maxRevives - engine.revivesUsed)}/{engine.maxRevives} LIVES
            </div>
          </div>

          {boss && (
            <div
              className={`flex flex-col items-center gap-1 bg-[#130f1e]/95 border-2 px-4 py-1.5 rounded-lg shadow-2xl w-64 sm:w-76 lg:w-88 ${
                boss.bossPhase === 3
                  ? 'border-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                  : boss.bossPhase === 2
                  ? 'border-orange-500'
                  : 'border-red-700'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="text-[10px] lg:text-xs text-red-400 font-bold tracking-wide uppercase truncate font-cinzel">
                  ☠ {boss.name}
                </div>
                <span
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                    boss.bossPhase === 3
                      ? 'bg-rose-700 text-white'
                      : boss.bossPhase === 2
                      ? 'bg-orange-700 text-white'
                      : 'bg-stone-900 border border-red-800 text-red-300'
                  }`}
                >
                  {boss.bossPhase === 3 ? 'BERSERK' : boss.bossPhase === 2 ? 'ENRAGED' : 'PHASE I'}
                </span>
              </div>
              <div className="w-full bg-stone-950 border border-[#4a1c1d] h-3 rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    boss.bossPhase === 3
                      ? 'bg-rose-600'
                      : boss.bossPhase === 2
                      ? 'bg-orange-600'
                      : 'bg-red-600'
                  } ${getProgressWidthClass(boss.hp, boss.maxHp)}`}
                />
              </div>
              <div className="text-xs text-red-200 font-vt">
                {Math.max(0, Math.round(boss.hp))} / {boss.maxHp} HP
              </div>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 lg:gap-1.5">
            <button
              type="button"
              onClick={() => {
                engine.toggleMap();
                setHudTick(t => t + 1);
              }}
              className={`px-2.5 py-1.5 border rounded-lg text-[9px] flex items-center gap-1 cursor-pointer shadow-md transition-all min-h-[34px] whitespace-nowrap shrink-0 ${
                engine.isMapExpanded
                  ? 'bg-amber-600 border-amber-300 text-stone-950 font-bold'
                  : 'bg-[#151222]/90 hover:bg-[#201c33] text-amber-200 border-[#78593a]'
              }`}
              title={hidePcKeyLabels ? 'Toggle Realm Map' : 'Toggle Realm Map [M / Tab]'}
            >
              <Map className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline font-bold">MAP</span>
            </button>

            <LandscapeModeButton iconOnly />

            <button
              type="button"
              onClick={() => {
                sounds.toggleMute();
                setHudTick(t => t + 1);
              }}
              className="p-1.5 bg-[#151222]/90 hover:bg-[#201c33] text-amber-100 border border-[#78593a] rounded-lg cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
              title="Toggle Audio"
            >
              {sounds.enabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>

            <button
              type="button"
              onClick={onOpenSkillTree}
              className="px-2.5 py-1.5 bg-purple-950/85 hover:bg-purple-900 text-purple-200 border border-purple-500 rounded-lg text-[9px] flex items-center gap-1 cursor-pointer shadow-md min-h-[34px] whitespace-nowrap shrink-0"
              title={hidePcKeyLabels ? 'Heroic Talent Grimoire' : 'Heroic Talent Grimoire [T]'}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
              <span className="hidden md:inline font-bold">GRIMOIRE</span>
            </button>

            <button
              type="button"
              onClick={onPause}
              className="p-1.5 bg-[#151222]/90 hover:bg-[#201c33] text-amber-100 border border-[#78593a] rounded-lg cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
              title={hidePcKeyLabels ? 'Pause & Settings' : 'Pause & Settings [ESC]'}
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center Prompt (Tappable Interaction Banner) */}
      {formattedInteractPrompt && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            engine.interact();
            setHudTick(t => t + 1);
          }}
          className="self-center flex items-center gap-2 bg-slate-950/95 hover:bg-amber-950/90 border-2 border-amber-400 text-amber-300 px-3.5 py-2 lg:px-4 lg:py-2 rounded shadow-2xl text-[10px] lg:text-xs pointer-events-auto cursor-pointer active:scale-95 transition-transform touch-none min-h-[40px]"
          title={hidePcKeyLabels ? 'Tap to interact' : 'Tap or press F to interact'}
        >
          <Hand className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-300 shrink-0" />
          <span>{formattedInteractPrompt}</span>
        </button>
      )}

      {/* Bottom Bar: Center Equipped Weapon Card & Right 3-Skill + Attack Tray (active across all Landscape sm: 640px+ & Desktop viewports) */}
      <div className="hidden sm:flex justify-between items-end w-full pl-36 lg:pl-40 gap-2">
        {/* Equipped Weapons Card */}
        <div className="flex items-center gap-2 lg:gap-3 bg-[#0e0c18]/90 border-2 border-[#78593a] p-1.5 lg:p-2.5 rounded-lg shadow-xl pointer-events-auto touch-none">
          {currentWeapon && (
            <div className={`flex flex-col gap-0.5 lg:gap-1 p-1.5 lg:p-2 border rounded ${getRarityBadgeColor(currentWeapon.rarity)}`}>
              <div className="flex justify-between items-center gap-2 text-[9px] lg:text-[10px]">
                <span className="font-bold whitespace-nowrap">{currentWeapon.name}</span>
                <span className="hidden md:inline text-[8px] uppercase tracking-wider whitespace-nowrap">{currentWeapon.rarity}</span>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 text-xs text-amber-200/90 font-vt whitespace-nowrap">
                <span>DMG {currentWeapon.damage}</span>
                <span>MANA {currentWeapon.energyCost}</span>
                <span>CRIT {Math.round(currentWeapon.critChance * 100)}%</span>
              </div>
            </div>
          )}

          {secondaryWeapon && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSwitchWeapon();
                setHudTick(t => t + 1);
              }}
              className="flex flex-col items-center justify-center gap-0.5 p-1.5 lg:p-2 min-h-[44px] bg-[#181427] hover:bg-[#251e3a] border border-[#78593a] rounded cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0 touch-none"
              title={hidePcKeyLabels ? 'Switch Weapon' : 'Switch Weapon [Q]'}
            >
              <div className="text-[8px] text-amber-300 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-amber-400" />
                <span>{hidePcKeyLabels ? 'SWAP' : 'SWAP [Q]'}</span>
              </div>
              <div className="text-xs font-vt text-amber-100 truncate max-w-[84px] lg:max-w-[96px]">{secondaryWeapon.name}</div>
            </button>
          )}
        </div>

        {/* Active Buff Readout + Hold-to-Inspect Skill Description Popup + 3-Skill Loadout Tray + Attack/Interact */}
        <div className="relative flex flex-col items-end gap-1.5 pointer-events-auto touch-none">
          {/* In-Dungeon Hold-to-Inspect Skill Description Card (Positioned cleanly above the skill tray so thumb never blocks text!) */}
          {heldSkill && heldSkillIndex !== null && (
            <div
              className={`w-72 sm:w-80 lg:w-92 rounded-xl border-2 p-3 shadow-2xl bg-slate-950/95 backdrop-blur-md pointer-events-none mb-0.5 ${
                heldSkill.isUltimate
                  ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                  : 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg bg-slate-900 border flex items-center justify-center text-xl shrink-0 ${
                      heldSkill.isUltimate ? 'border-amber-500/70' : 'border-sky-500/70'
                    }`}
                  >
                    {heldSkill.icon}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-[10px] sm:text-xs font-bold leading-snug ${
                        heldSkill.isUltimate ? 'text-amber-200' : 'text-white'
                      }`}
                    >
                      {heldSkill.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-vt tabular-nums mt-0.5">
                      <span className="text-cyan-300 font-bold">{heldSkill.energyCost} MP</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-amber-300 font-bold">{heldSkill.cooldown}s CD</span>
                      {heldSkill.currentCooldown > 0 && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="text-rose-300 font-bold">
                            Ready in {heldSkill.currentCooldown.toFixed(1)}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[7px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${
                    heldSkill.isUltimate
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-sky-500/20 border border-sky-400 text-sky-200'
                  }`}
                >
                  {formatSlotBadge(heldSkillIndex, Boolean(heldSkill.isUltimate), heldSkill.keyHint)}
                </span>
              </div>

              {heldSkill.statBonusText && (
                <div className="mt-2 inline-block text-xs font-vt font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-600/50 px-2 py-0.5 rounded">
                  Passive: {heldSkill.statBonusText}
                </div>
              )}

              <p className="mt-2 text-sm sm:text-base font-vt text-slate-100 leading-snug">
                {heldSkill.description}
              </p>
            </div>
          )}

          {(activeBuffLabels.length > 0 || isRestingNow) && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isRestingNow && (
                <div className="bg-slate-950/90 border border-amber-400/70 text-amber-300 px-2 py-0.5 rounded text-xs font-vt whitespace-nowrap">
                  CAMP REST (+MP)
                </div>
              )}
              {activeBuffLabels.map(buff => (
                <div
                  key={buff.label}
                  className={`bg-slate-950/90 border px-2 py-0.5 rounded text-xs font-vt whitespace-nowrap ${buff.color}`}
                >
                  {buff.label} {buff.time.toFixed(1)}s
                </div>
              ))}
            </div>
          )}

          {/* MOBA-Style Circular Skill Wheel: Central Strike Button Surrounded by 3 Skills in an Arc */}
          <div className="relative w-[210px] h-[210px] sm:w-[230px] sm:h-[230px] lg:w-[250px] lg:h-[250px] pointer-events-auto touch-none select-none">
            {/* Switch Weapon Circular Button (Outer Left) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSwitchWeapon();
                setHudTick(t => t + 1);
              }}
              className="absolute bottom-2 sm:bottom-3 right-[152px] sm:right-[168px] lg:right-[184px] w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] rounded-full bg-[#241710] hover:bg-[#382317] border border-[#78593a] flex flex-col items-center justify-center text-amber-200 active:scale-90 touch-none shadow-lg cursor-pointer transition-transform z-10"
              title={hidePcKeyLabels ? 'Switch Weapon' : 'Switch Weapon [Q]'}
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              {!hidePcKeyLabels && (
                <span className="text-[7px] font-bold text-amber-300/80 leading-none">Q</span>
              )}
            </button>

            {/* Interact Button (Appears dynamically at Top-Left outer arc) */}
            {interactPrompt && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine.interact();
                  setHudTick(t => t + 1);
                }}
                className="absolute bottom-[128px] sm:bottom-[142px] lg:bottom-[154px] right-[70px] sm:right-[80px] lg:right-[88px] w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-300 flex flex-col items-center justify-center text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)] active:scale-90 touch-none animate-pulse cursor-pointer z-10"
                title={hidePcKeyLabels ? 'Pick Up / Interact' : 'Pick Up / Interact [F]'}
              >
                <Hand className="w-4 h-4 text-amber-200" />
                <span className="text-[7px] font-bold text-amber-100 leading-none">
                  {hidePcKeyLabels ? 'PICK' : '[F]'}
                </span>
              </button>
            )}

            {/* 3 Circular Skills Surrounding the Strike Hub */}
            {player.skills.slice(0, 3).map((skill, index) => {
              const isCoolingDown = skill.currentCooldown > 0;
              const cooldownRatio = skill.cooldown > 0 ? skill.currentCooldown / skill.cooldown : 0;
              const isUlt = Boolean(skill.isUltimate);
              const isHeldInspecting = heldSkillIndex === index;

              // Positioning surrounding the Strike button:
              // index 0 (Skill 1): to the Left of Strike (9 o'clock)
              // index 1 (Skill 2): to the Top-Left of Strike (10:30 o'clock / 135° diagonal)
              // index 2 (Ultimate): directly Above Strike (12 o'clock / 90° top)
              const positionClass =
                index === 0
                  ? 'bottom-2 sm:bottom-2.5 right-[92px] sm:right-[102px] lg:right-[112px] w-[50px] h-[50px] sm:w-[56px] sm:h-[56px] lg:w-[60px] lg:h-[60px]'
                  : index === 1
                  ? 'bottom-[70px] sm:bottom-[78px] lg:bottom-[86px] right-[70px] sm:right-[78px] lg:right-[86px] w-[50px] h-[50px] sm:w-[56px] sm:h-[56px] lg:w-[60px] lg:h-[60px]'
                  : 'bottom-[92px] sm:bottom-[102px] lg:bottom-[112px] right-2 sm:right-2.5 w-[54px] h-[54px] sm:w-[60px] sm:h-[60px] lg:w-[64px] lg:h-[64px]';

              const readyStyles = isUlt
                ? 'border-amber-400 bg-gradient-to-br from-amber-950 via-stone-900 to-red-950 text-amber-200 ring-2 ring-amber-400/40 shadow-[0_0_16px_rgba(245,158,11,0.4)]'
                : 'border-indigo-400 bg-gradient-to-br from-[#1b1933] to-[#120f22] text-indigo-100 shadow-[0_0_12px_rgba(129,140,248,0.3)] hover:border-indigo-300';

              return (
                <button
                  key={skill.id}
                  type="button"
                  onContextMenu={e => e.preventDefault()}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore synthetic pointer
                    }
                    if (skillPressRef.current) {
                      window.clearTimeout(skillPressRef.current.timerId);
                    }
                    const pid = e.pointerId;
                    const timerId = window.setTimeout(() => {
                      if (skillPressRef.current && skillPressRef.current.pointerId === pid) {
                        skillPressRef.current.didLongPress = true;
                        setHeldSkillIndex(index);
                      }
                    }, HOLD_INSPECT_MS);

                    skillPressRef.current = {
                      pointerId: pid,
                      skillIndex: index,
                      didLongPress: false,
                      timerId,
                    };
                  }}
                  onPointerUp={(e) => {
                    const active = skillPressRef.current;
                    if (!active || active.pointerId !== e.pointerId) return;
                    window.clearTimeout(active.timerId);
                    const wasLongPress = active.didLongPress;
                    skillPressRef.current = null;
                    setHeldSkillIndex(null);

                    if (!wasLongPress) {
                      engine.triggerSkill(index);
                      setHudTick(t => t + 1);
                    }
                  }}
                  onPointerCancel={(e) => {
                    const active = skillPressRef.current;
                    if (active && active.pointerId === e.pointerId) {
                      window.clearTimeout(active.timerId);
                      skillPressRef.current = null;
                    }
                    setHeldSkillIndex(null);
                  }}
                  onLostPointerCapture={(e) => {
                    const active = skillPressRef.current;
                    if (active && active.pointerId === e.pointerId) {
                      window.clearTimeout(active.timerId);
                      skillPressRef.current = null;
                    }
                    setHeldSkillIndex(null);
                  }}
                  className={`absolute ${positionClass} rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-90 touch-none ${
                    isHeldInspecting
                      ? 'ring-2 ring-white scale-105 border-white bg-[#3d2314] text-white z-20'
                      : isCoolingDown
                      ? 'border-[#573922] bg-[#14100c] text-stone-500 opacity-80'
                      : readyStyles
                  }`}
                  title={
                    hidePcKeyLabels
                      ? `${skill.name} — Tap to cast, hold for description`
                      : `${skill.name} ${formatSkillKeyLabel(skill.keyHint)} — Tap to cast, hold for description`
                  }
                >
                  <span className={`${isUlt ? 'text-lg sm:text-xl lg:text-2xl' : 'text-base sm:text-lg lg:text-xl'} leading-none`}>
                    {skill.icon}
                  </span>
                  {!hidePcKeyLabels && (
                    <span
                      className={`absolute -top-1 px-1.5 py-0.2 rounded-full border text-[7px] font-bold leading-tight ${
                        isUlt
                          ? 'bg-[#2a170d] border-amber-400 text-amber-300'
                          : 'bg-[#18110b] border-indigo-400/80 text-indigo-300'
                      }`}
                    >
                      {formatSkillKeyLabel(skill.keyHint)}
                    </span>
                  )}
                  <span className="text-[8px] sm:text-[9px] text-amber-200/90 font-vt leading-tight mt-0.5">
                    {skill.energyCost} MP
                  </span>

                  {isCoolingDown && (
                    <div className="absolute inset-0 rounded-full bg-black/80 flex items-center justify-center overflow-hidden">
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-purple-950/85 border-t border-amber-400 ${getCooldownHeightClass(cooldownRatio)}`}
                      />
                      <span className="relative text-[9px] sm:text-[10px] lg:text-xs font-bold text-amber-300 z-10 tabular-nums">
                        {skill.currentCooldown.toFixed(1)}s
                      </span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* Central Normal Attack / Strike Button (Large Circle Hub) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore if synthetic pointer
                }
                attackPointerIdRef.current = e.pointerId;
                engine.isMouseDown = true;
                setHudTick(t => t + 1);
              }}
              onPointerUp={(e) => {
                if (attackPointerIdRef.current === e.pointerId || attackPointerIdRef.current === null) {
                  attackPointerIdRef.current = null;
                  engine.isMouseDown = false;
                  setHudTick(t => t + 1);
                }
              }}
              onPointerCancel={() => {
                attackPointerIdRef.current = null;
                engine.isMouseDown = false;
                setHudTick(t => t + 1);
              }}
              onLostPointerCapture={() => {
                attackPointerIdRef.current = null;
                engine.isMouseDown = false;
                setHudTick(t => t + 1);
              }}
              className={`absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] lg:w-[88px] lg:h-[88px] rounded-full border-4 flex flex-col items-center justify-center cursor-pointer transition-transform touch-none shadow-2xl ${
                engine.isMouseDown
                  ? 'bg-gradient-to-br from-red-600 to-amber-700 border-amber-200 scale-95 shadow-[0_0_24px_rgba(245,158,11,0.6)]'
                  : 'bg-gradient-to-br from-red-700 to-amber-950 border-[#fbbf24] shadow-[0_0_18px_rgba(251,191,36,0.35)] hover:border-amber-300'
              }`}
              title={hidePcKeyLabels ? 'Strike' : 'Strike [Left Click]'}
            >
              <Swords className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-amber-200 mb-0.5" />
              <span className="text-[8px] sm:text-[9px] font-cinzel font-bold text-amber-200 tracking-wider">
                STRIKE
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
