/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/gameEngine';
import { useGameSettings } from '../game/settings';
import { RefreshCw, Hand } from 'lucide-react';

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
        outerRingRef.current.setAttribute('stroke', engaged ? '#38bdf8' : '#334155');
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
          engaged ? 'rgba(14, 165, 233, 0.88)' : 'rgba(51, 65, 85, 0.85)'
        );
        knobCircleRef.current.setAttribute('stroke', engaged ? '#bae6fd' : '#94a3b8');
      }

      if (knobCoreRef.current) {
        knobCoreRef.current.setAttribute('cx', (60 + dispX).toFixed(2));
        knobCoreRef.current.setAttribute('cy', (60 + dispY).toFixed(2));
        knobCoreRef.current.setAttribute('fill', engaged ? '#e0f2fe' : '#cbd5e1');
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
        title={hidePcKeyLabels ? 'Drag Virtual Joystick to move and aim' : 'Drag Virtual Joystick or press WASD to move and aim'}
      >
        <div
          ref={svgWrapRef}
          className="w-28 h-28 lg:w-32 lg:h-32 pointer-events-none will-change-transform -translate-x-1.5 translate-y-1.5"
        >
          <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
            {/* Outer Base Ring */}
            <circle
              ref={outerRingRef}
              cx="60"
              cy="60"
              r="52"
              fill="rgba(15, 23, 42, 0.68)"
              stroke="#334155"
              strokeWidth="2.5"
            />
            {/* Inner Guide Crosshair */}
            <circle
              cx="60"
              cy="60"
              r="34"
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <line x1="60" y1="14" x2="60" y2="24" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1.5" />
            <line x1="60" y1="96" x2="60" y2="106" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1.5" />
            <line x1="14" y1="60" x2="24" y2="60" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1.5" />
            <line x1="96" y1="60" x2="106" y2="60" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1.5" />

            {/* Live Facing Direction Indicator Dot on Outer Bezel */}
            <circle
              ref={dirDotRef}
              cx="109"
              cy="60"
              r="4"
              fill="#38bdf8"
              stroke="#0f172a"
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
              stroke="rgba(56, 189, 248, 0.45)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Thumb Stick Knob */}
            <circle
              ref={knobCircleRef}
              cx="60"
              cy="60"
              r="21"
              fill="rgba(51, 65, 85, 0.85)"
              stroke="#94a3b8"
              strokeWidth="2.5"
            />
            <circle
              ref={knobCoreRef}
              cx="60"
              cy="60"
              r="7"
              fill="#cbd5e1"
            />
          </svg>
        </div>
      </div>

      {/* Compact Action Cluster for very narrow portrait (< sm; on sm+ landscape & desktop HUD renders full bottom bar) */}
      <div className="flex sm:hidden flex-col items-end gap-2.5 pointer-events-auto touch-none">
        {/* Hold-to-Inspect Skill Description Card on Narrow Mobile */}
        {heldSkill && heldSkillIndex !== null && (
          <div
            className={`w-64 rounded-xl border-2 p-2.5 shadow-2xl bg-slate-950/95 backdrop-blur-md pointer-events-none ${
              heldSkill.isUltimate ? 'border-amber-400' : 'border-sky-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{heldSkill.icon}</span>
                <span className="text-[10px] font-bold text-white truncate">{heldSkill.name}</span>
              </div>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300 shrink-0 whitespace-nowrap">
                {heldSkill.isUltimate
                  ? hidePcKeyLabels
                    ? 'ULT'
                    : 'ULT [R]'
                  : hidePcKeyLabels
                  ? `SKILL ${heldSkillIndex + 1}`
                  : `[${heldSkill.keyHint === 'SPACE' ? 'Space' : heldSkill.keyHint}]`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-vt tabular-nums mt-0.5">
              <span className="text-cyan-300 font-bold">{heldSkill.energyCost} MP</span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-300 font-bold">{heldSkill.cooldown}s CD</span>
            </div>
            {heldSkill.statBonusText && (
              <div className="mt-1 text-xs font-vt text-emerald-300">
                Passive: {heldSkill.statBonusText}
              </div>
            )}
            <p className="mt-1 text-xs font-vt text-slate-100 leading-snug">{heldSkill.description}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {engine.player.skills.map((skill, idx) => {
            const onCd = skill.currentCooldown > 0;
            const isUlt = Boolean(skill.isUltimate);
            const isHeld = heldSkillIndex === idx;
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
                className={`relative w-12 h-12 rounded-full border-2 text-lg flex items-center justify-center shadow-lg active:scale-90 touch-none ${
                  isHeld
                    ? 'ring-2 ring-white scale-105 bg-slate-900 border-white'
                    : onCd
                    ? 'bg-slate-900/90 border-slate-700 opacity-60'
                    : isUlt
                    ? 'bg-amber-950/85 border-amber-400'
                    : 'bg-sky-950/85 border-sky-500'
                }`}
              >
                <span>{skill.icon}</span>
                {onCd && (
                  <span className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center text-[8px] font-bold text-amber-300 tabular-nums">
                    {skill.currentCooldown.toFixed(0)}s
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engine.switchWeapon();
              setNarrowTick(t => t + 1);
            }}
            className="w-11 h-11 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 active:scale-90 touch-none"
            title="Switch Weapon"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {engine.interactPrompt && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine.interact();
                setNarrowTick(t => t + 1);
              }}
              className="w-12 h-12 rounded-full bg-amber-600 border-2 border-amber-300 flex items-center justify-center text-white shadow-lg active:scale-90 touch-none"
              title="Pick Up / Interact"
            >
              <Hand className="w-5 h-5" />
            </button>
          )}

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
            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-white text-xl font-bold shadow-2xl transition-transform touch-none ${
              engine.isMouseDown
                ? 'bg-red-500 border-red-300 scale-95'
                : 'bg-red-600/90 border-red-400'
            }`}
            title="Attack"
          >
            ⚔️
          </button>
        </div>
      </div>
    </div>
  );
};
