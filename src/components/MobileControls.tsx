/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/gameEngine';
import { useGameSettings } from '../game/settings';
import { RefreshCw, Hand, Swords } from 'lucide-react';

interface MobileControlsProps {
  engine: GameEngine;
}

const MAX_STICK_RADIUS = 42;
const HOLD_INSPECT_MS = 240;

export const MobileControls: React.FC<MobileControlsProps> = ({ engine }) => {
  const { hidePcKeyLabels } = useGameSettings();
  const joystickZoneRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const outerRingRef = useRef<SVGCircleElement>(null);
  const dirDotRef = useRef<SVGCircleElement>(null);
  const stemLineRef = useRef<SVGLineElement>(null);
  const knobCircleRef = useRef<SVGCircleElement>(null);
  const knobCoreRef = useRef<SVGCircleElement>(null);

  const activeTouchIdRef = useRef<number | null>(null);
  const isMouseDraggingRef = useRef<boolean>(false);
  const attackPointerIdRef = useRef<number | null>(null);
  const skillPressRef = useRef<{
    pointerId: number;
    skillIndex: number;
    didLongPress: boolean;
    timerId: number;
  } | null>(null);

  const [heldSkillIndex, setHeldSkillIndex] = useState<number | null>(null);

  // Cached anchor & stick deflection in refs (zero React re-renders on move!)
  const anchorClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const anchorOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // Lightweight refresh ONLY for narrow portrait (<640px) action cluster cooldowns/prompts
  const [, setNarrowTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.innerWidth < 640) {
        setNarrowTick(t => t + 1);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Native non-passive touch & mouse listeners + 60/120Hz direct SVG DOM sync
  useEffect(() => {
    const zone = joystickZoneRef.current;
    if (!zone) return;

    const beginAtPoint = (clientX: number, clientY: number) => {
      const rect = zone.getBoundingClientRect();
      // Default resting center sits comfortably in bottom-left of the generous touch zone
      const restX = rect.left + rect.width * 0.45;
      const restY = rect.top + rect.height * 0.55;

      const dxFromRest = clientX - restX;
      const dyFromRest = clientY - restY;
      const distFromRest = Math.hypot(dxFromRest, dyFromRest);

      // If thumb lands on the visible ring, preserve ring center for immediate directional tilt;
      // if thumb lands further out inside the forgiving catch zone, slide anchor smoothly toward thumb!
      let anchorX = restX;
      let anchorY = restY;
      if (distFromRest > 48) {
        const shift = distFromRest - 24;
        const angle = Math.atan2(dyFromRest, dxFromRest);
        anchorX = Math.max(rect.left + 54, Math.min(rect.right - 54, restX + Math.cos(angle) * shift));
        anchorY = Math.max(rect.top + 54, Math.min(rect.bottom - 54, restY + Math.sin(angle) * shift));
      }

      anchorClientRef.current = { x: anchorX, y: anchorY };
      anchorOffsetRef.current = { x: anchorX - restX, y: anchorY - restY };
      updateFromPoint(clientX, clientY);
    };

    const updateFromPoint = (clientX: number, clientY: number) => {
      const dx = clientX - anchorClientRef.current.x;
      const dy = clientY - anchorClientRef.current.y;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, MAX_STICK_RADIUS);
      const angle = dist > 0.0001 ? Math.atan2(dy, dx) : 0;

      const sx = dist > 0.0001 ? Math.cos(angle) * clampedDist : 0;
      const sy = dist > 0.0001 ? Math.sin(angle) * clampedDist : 0;

      stickRef.current = { x: sx, y: sy, active: true };
      engine.setJoystick(sx / MAX_STICK_RADIUS, sy / MAX_STICK_RADIUS, true);
    };

    const resetStick = () => {
      activeTouchIdRef.current = null;
      isMouseDraggingRef.current = false;
      anchorOffsetRef.current = { x: 0, y: 0 };
      stickRef.current = { x: 0, y: 0, active: false };
      engine.setJoystick(0, 0, false);
    };

    const onZoneTouchStart = (e: TouchEvent) => {
      // Prevent browser pan/scroll gesture recognizer buffering!
      e.preventDefault();
      e.stopPropagation();
      if (activeTouchIdRef.current === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        activeTouchIdRef.current = touch.identifier;
        beginAtPoint(touch.clientX, touch.clientY);
      }
    };

    const onWindowTouchMove = (e: TouchEvent) => {
      const activeId = activeTouchIdRef.current;
      if (activeId === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === activeId) {
          if (e.cancelable) e.preventDefault();
          updateFromPoint(t.clientX, t.clientY);
          break;
        }
      }
    };

    const onWindowTouchEnd = (e: TouchEvent) => {
      const activeId = activeTouchIdRef.current;
      if (activeId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          resetStick();
          break;
        }
      }
    };

    const onZoneMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isMouseDraggingRef.current = true;
      beginAtPoint(e.clientX, e.clientY);
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!isMouseDraggingRef.current) return;
      updateFromPoint(e.clientX, e.clientY);
    };

    const onWindowMouseUp = () => {
      if (!isMouseDraggingRef.current) return;
      resetStick();
    };

    const onVisibilityOrBlur = () => {
      resetStick();
      if (attackPointerIdRef.current !== null) {
        attackPointerIdRef.current = null;
        engine.isMouseDown = false;
      }
      if (skillPressRef.current) {
        window.clearTimeout(skillPressRef.current.timerId);
        skillPressRef.current = null;
      }
      setHeldSkillIndex(null);
    };

    zone.addEventListener('touchstart', onZoneTouchStart, { passive: false });
    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onWindowTouchEnd, { passive: false });
    zone.addEventListener('mousedown', onZoneMouseDown);
    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('blur', onVisibilityOrBlur);
    document.addEventListener('visibilitychange', onVisibilityOrBlur);

    // Zero-allocation rAF loop syncing SVG joystick visuals with touch stick OR WASD keyboard stick
    let rafId = 0;
    const syncVisuals = () => {
      const localStick = stickRef.current;
      const kbStick = engine.keyboardStick;
      const engaged = localStick.active || kbStick.active;

      const dispX = localStick.active
        ? localStick.x
        : kbStick.active
        ? kbStick.x * MAX_STICK_RADIUS * 0.85
        : 0;
      const dispY = localStick.active
        ? localStick.y
        : kbStick.active
        ? kbStick.y * MAX_STICK_RADIUS * 0.85
        : 0;

      if (svgWrapRef.current) {
        const ox = anchorOffsetRef.current.x;
        const oy = anchorOffsetRef.current.y;
        svgWrapRef.current.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;
      }

      if (outerRingRef.current) {
        outerRingRef.current.setAttribute('stroke', engaged ? '#f59e0b' : '#78593a');
      }

      if (dirDotRef.current) {
        const aimAngle = engine.player.rotation;
        const dirX = 60 + Math.cos(aimAngle) * 49;
        const dirY = 60 + Math.sin(aimAngle) * 49;
        dirDotRef.current.setAttribute('cx', dirX.toFixed(2));
        dirDotRef.current.setAttribute('cy', dirY.toFixed(2));
      }

      if (stemLineRef.current) {
        stemLineRef.current.setAttribute('x2', (60 + dispX).toFixed(2));
        stemLineRef.current.setAttribute('y2', (60 + dispY).toFixed(2));
        stemLineRef.current.setAttribute('opacity', engaged ? '1' : '0');
      }

      if (knobCircleRef.current) {
        knobCircleRef.current.setAttribute('cx', (60 + dispX).toFixed(2));
        knobCircleRef.current.setAttribute('cy', (60 + dispY).toFixed(2));
        knobCircleRef.current.setAttribute(
          'fill',
          engaged ? 'rgba(180, 83, 9, 0.92)' : 'rgba(42, 27, 18, 0.88)'
        );
        knobCircleRef.current.setAttribute('stroke', engaged ? '#fef08a' : '#b45309');
      }

      if (knobCoreRef.current) {
        knobCoreRef.current.setAttribute('cx', (60 + dispX).toFixed(2));
        knobCoreRef.current.setAttribute('cy', (60 + dispY).toFixed(2));
        knobCoreRef.current.setAttribute('fill', engaged ? '#fbbf24' : '#d97706');
      }

      rafId = requestAnimationFrame(syncVisuals);
    };

    rafId = requestAnimationFrame(syncVisuals);

    return () => {
      cancelAnimationFrame(rafId);
      if (skillPressRef.current) {
        window.clearTimeout(skillPressRef.current.timerId);
      }
      zone.removeEventListener('touchstart', onZoneTouchStart);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
      zone.removeEventListener('mousedown', onZoneMouseDown);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('blur', onVisibilityOrBlur);
      document.removeEventListener('visibilitychange', onVisibilityOrBlur);
    };
  }, [engine]);

  const heldSkill = heldSkillIndex !== null ? engine.player.skills[heldSkillIndex] || null : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between items-end safe-hud lg:p-3.5 game-touch-lock">
      {/* Generous Forgiving 360° Virtual Joystick Zone (Bottom-Left) */}
      <div
        ref={joystickZoneRef}
        className="w-40 h-40 sm:w-44 sm:h-44 -ml-2 -mb-2 pointer-events-auto touch-none cursor-grab active:cursor-grabbing relative flex items-center justify-center game-touch-lock"
        title={hidePcKeyLabels ? 'Drag Celestial Compass to move and cast' : 'Drag Celestial Compass or press WASD to move and cast'}
      >
        <div
          ref={svgWrapRef}
          className="w-28 h-28 lg:w-32 lg:h-32 pointer-events-none will-change-transform -translate-x-1.5 translate-y-1.5"
        >
          <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
            {/* Outer Base Ring - Antique Runic Astrolabe */}
            <circle
              ref={outerRingRef}
              cx="60"
              cy="60"
              r="52"
              fill="rgba(24, 16, 12, 0.75)"
              stroke="#78593a"
              strokeWidth="2.5"
            />
            {/* Inner Celestial Crosshair */}
            <circle
              cx="60"
              cy="60"
              r="34"
              fill="none"
              stroke="rgba(217, 119, 6, 0.28)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <line x1="60" y1="14" x2="60" y2="24" stroke="rgba(251, 191, 36, 0.4)" strokeWidth="1.5" />
            <line x1="60" y1="96" x2="60" y2="106" stroke="rgba(251, 191, 36, 0.4)" strokeWidth="1.5" />
            <line x1="14" y1="60" x2="24" y2="60" stroke="rgba(251, 191, 36, 0.4)" strokeWidth="1.5" />
            <line x1="96" y1="60" x2="106" y2="60" stroke="rgba(251, 191, 36, 0.4)" strokeWidth="1.5" />

            {/* Live Facing Direction Indicator Gem on Outer Rim */}
            <circle
              ref={dirDotRef}
              cx="109"
              cy="60"
              r="4"
              fill="#fbbf24"
              stroke="#451a03"
              strokeWidth="1.5"
            />

            {/* Stem from Center to Thumb Knob */}
            <line
              ref={stemLineRef}
              x1="60"
              y1="60"
              x2="60"
              y2="60"
              opacity="0"
              stroke="rgba(245, 158, 11, 0.65)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Thumb Stick Knob - Enchanted Stone with Gold Rim */}
            <circle
              ref={knobCircleRef}
              cx="60"
              cy="60"
              r="21"
              fill="rgba(42, 27, 18, 0.88)"
              stroke="#b45309"
              strokeWidth="2.5"
            />
            <circle
              ref={knobCoreRef}
              cx="60"
              cy="60"
              r="7"
              fill="#d97706"
            />
          </svg>
        </div>
      </div>

      {/* Compact Action Cluster for very narrow portrait (< sm; on sm+ landscape & desktop HUD renders full bottom bar) */}
      <div className="flex sm:hidden flex-col items-end gap-2.5 pointer-events-auto touch-none">
        {/* Hold-to-Inspect Skill Description Card on Narrow Mobile */}
        {heldSkill && heldSkillIndex !== null && (
          <div
            className={`w-64 rounded-xl border-2 p-2.5 shadow-2xl bg-[#140e09]/95 border-[#b45309] backdrop-blur-md pointer-events-none ${
              heldSkill.isUltimate ? 'ring-2 ring-amber-400/50' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-cinzel">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{heldSkill.icon}</span>
                <span className="text-[10px] font-bold text-amber-200 truncate tracking-wide">{heldSkill.name}</span>
              </div>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-[#2a170d] border border-[#b45309] text-amber-300 shrink-0 whitespace-nowrap">
                {heldSkill.isUltimate
                  ? hidePcKeyLabels
                    ? 'ULT SPELL'
                    : 'ULT [R]'
                  : hidePcKeyLabels
                  ? `SPELL ${heldSkillIndex + 1}`
                  : `[${heldSkill.keyHint === 'SPACE' ? 'Space' : heldSkill.keyHint}]`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-vt tabular-nums mt-0.5">
              <span className="text-indigo-300 font-bold">{heldSkill.energyCost} Mana</span>
              <span className="text-amber-700">·</span>
              <span className="text-amber-400 font-bold">{heldSkill.cooldown}s CD</span>
            </div>
            {heldSkill.statBonusText && (
              <div className="mt-1 text-xs font-vt text-emerald-400">
                Passive: {heldSkill.statBonusText}
              </div>
            )}
            <p className="mt-1 text-xs font-vt text-amber-100/90 leading-snug">{heldSkill.description}</p>
          </div>
        )}

        {/* MOBA-Style Circular Skill Wheel: Central Strike Button Surrounded by 3 Skills in an Arc */}
        <div className="relative w-[190px] h-[190px] select-none pointer-events-auto touch-none">
          {/* Switch Weapon Button (Outer Left) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engine.switchWeapon();
              setNarrowTick(t => t + 1);
            }}
            className="absolute bottom-2 right-[136px] w-[38px] h-[38px] rounded-full bg-[#241710] border border-[#78593a] flex items-center justify-center text-amber-200 active:scale-90 touch-none shadow-md z-10"
            title="Switch Weapon"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
          </button>

          {/* Interact Button (Outer Top-Left) */}
          {engine.interactPrompt && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine.interact();
                setNarrowTick(t => t + 1);
              }}
              className="absolute bottom-[114px] right-[62px] w-[40px] h-[40px] rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-300 flex flex-col items-center justify-center text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)] active:scale-90 touch-none animate-pulse z-10"
              title="Pick Up / Interact"
            >
              <Hand className="w-4 h-4 text-amber-200" />
              <span className="text-[6px] font-bold text-amber-100 leading-none">PICK</span>
            </button>
          )}

          {/* 3 Circular Skills Surrounding the Strike Hub */}
          {engine.player.skills.slice(0, 3).map((skill, idx) => {
            const onCd = skill.currentCooldown > 0;
            const isUlt = Boolean(skill.isUltimate);
            const isHeld = heldSkillIndex === idx;

            // Positioning surrounding the Strike button:
            // idx 0 (Skill 1): to the Left of Strike (9 o'clock)
            // idx 1 (Skill 2): to the Top-Left of Strike (10:30 o'clock / 135° diagonal)
            // idx 2 (Ultimate): directly Above Strike (12 o'clock / 90° top)
            const positionClass =
              idx === 0
                ? 'bottom-2 right-[82px] w-[46px] h-[46px]'
                : idx === 1
                ? 'bottom-[62px] right-[62px] w-[46px] h-[46px]'
                : 'bottom-[82px] right-2 w-[50px] h-[50px]';

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
                      setHeldSkillIndex(idx);
                    }
                  }, HOLD_INSPECT_MS);

                  skillPressRef.current = {
                    pointerId: pid,
                    skillIndex: idx,
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
                    engine.triggerSkill(idx);
                    setNarrowTick(t => t + 1);
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
                className={`absolute ${positionClass} rounded-full border-2 flex flex-col items-center justify-center shadow-lg active:scale-90 touch-none transition-all ${
                  isHeld
                    ? 'ring-2 ring-white scale-105 bg-[#3d2314] border-white z-20'
                    : onCd
                    ? 'bg-[#1a120c]/90 border-[#573922] opacity-60'
                    : isUlt
                    ? 'bg-gradient-to-br from-amber-950 to-red-950 border-amber-400 shadow-amber-900/40 ring-1 ring-amber-400/40'
                    : 'bg-gradient-to-br from-[#1e1b4b] to-[#171226] border-[#818cf8]'
                }`}
              >
                <span className={`${isUlt ? 'text-lg' : 'text-base'} leading-none`}>{skill.icon}</span>
                <span className="text-[8px] text-amber-200/90 font-vt leading-tight mt-0.5">
                  {skill.energyCost} MP
                </span>
                {onCd && (
                  <span className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center text-[8px] font-bold text-amber-300 tabular-nums">
                    {skill.currentCooldown.toFixed(0)}s
                  </span>
                )}
              </button>
            );
          })}

          {/* Central Strike Button (Large Circle Hub) */}
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
              setNarrowTick(t => t + 1);
            }}
            onPointerUp={(e) => {
              if (attackPointerIdRef.current === e.pointerId || attackPointerIdRef.current === null) {
                attackPointerIdRef.current = null;
                engine.isMouseDown = false;
                setNarrowTick(t => t + 1);
              }
            }}
            onPointerCancel={() => {
              attackPointerIdRef.current = null;
              engine.isMouseDown = false;
              setNarrowTick(t => t + 1);
            }}
            onLostPointerCapture={() => {
              attackPointerIdRef.current = null;
              engine.isMouseDown = false;
              setNarrowTick(t => t + 1);
            }}
            className={`absolute bottom-1 right-1 w-[68px] h-[68px] rounded-full border-4 flex flex-col items-center justify-center text-white font-bold shadow-2xl transition-transform touch-none ${
              engine.isMouseDown
                ? 'bg-gradient-to-br from-red-600 to-amber-700 border-amber-200 scale-95 shadow-red-900/50'
                : 'bg-gradient-to-br from-red-700 to-amber-900 border-[#fbbf24] shadow-amber-950/70'
            }`}
            title="Strike"
          >
            <Swords className="w-6 h-6 text-amber-200 mb-0.5" />
            <span className="text-[8px] font-cinzel font-bold text-amber-200 tracking-wider">
              STRIKE
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
