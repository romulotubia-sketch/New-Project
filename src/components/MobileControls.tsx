/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/gameEngine';
import { useGameSettings } from '../game/settings';

interface MobileControlsProps {
  engine: GameEngine;
}

const MAX_STICK_RADIUS = 42;

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

  // Cached anchor & stick deflection in refs (zero React re-renders on move!)
  const anchorClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const anchorOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    return vw < 390 || vh < 380;
  });

  useEffect(() => {
    const syncViewport = () => {
      const vw = window.visualViewport?.width || window.innerWidth;
      const vh = window.visualViewport?.height || window.innerHeight;
      const compact = vw < 390 || vh < 380;
      setIsCompactViewport(prev => (prev === compact ? prev : compact));
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, []);

  // Native non-passive touch & mouse listeners + 60/120Hz direct SVG DOM sync
  useEffect(() => {
    const zone = joystickZoneRef.current;
    if (!zone) return;

    const beginAtPoint = (clientX: number, clientY: number) => {
      const rect = zone.getBoundingClientRect();
      const restX = rect.left + rect.width * 0.5;
      const restY = rect.top + rect.height * 0.5;

      const dxFromRest = clientX - restX;
      const dyFromRest = clientY - restY;
      const distFromRest = Math.hypot(dxFromRest, dyFromRest);

      // If thumb lands on the visible ring, preserve ring center for immediate directional tilt;
      // if thumb lands further out inside the catch zone, slide anchor smoothly within safe bounds
      let anchorX = restX;
      let anchorY = restY;
      const edgePad = Math.min(48, rect.width * 0.35);
      if (distFromRest > 42 && rect.width > edgePad * 2) {
        const shift = distFromRest - 22;
        const angle = Math.atan2(dyFromRest, dxFromRest);
        anchorX = Math.max(rect.left + edgePad, Math.min(rect.right - edgePad, restX + Math.cos(angle) * shift));
        anchorY = Math.max(rect.top + edgePad, Math.min(rect.bottom - edgePad, restY + Math.sin(angle) * shift));
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

  return (
    <div className="absolute inset-0 safe-hud pointer-events-none select-none z-20 game-touch-lock">
      <div className="relative w-full h-full pointer-events-none">
        {/* Bottom-Left Pinned 360° Virtual Joystick (Isolated from right-side skill controls) */}
        <div
          ref={joystickZoneRef}
          className={`absolute bottom-0 left-0 pointer-events-auto touch-none cursor-grab active:cursor-grabbing flex items-center justify-center game-touch-lock ${
            isCompactViewport ? 'w-32 h-32' : 'w-36 h-36 sm:w-40 sm:h-40 lg:w-44 lg:h-44'
          }`}
          title={
            hidePcKeyLabels
              ? 'Drag Celestial Compass to move and cast'
              : 'Drag Celestial Compass or press WASD to move and cast'
          }
        >
          <div
            ref={svgWrapRef}
            className={`pointer-events-none will-change-transform ${
              isCompactViewport ? 'w-24 h-24' : 'w-28 h-28 lg:w-32 lg:h-32'
            }`}
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
      </div>
    </div>
  );
};
