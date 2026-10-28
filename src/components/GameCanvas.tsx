/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/gameEngine';
import { GameRenderer } from '../game/renderer';
import { MiniMapRenderer } from '../game/miniMapRenderer';
import { WeaponRenderer } from '../game/weaponRenderer';

interface GameCanvasProps {
  engine: GameEngine;
  onOpenSkillTree: () => void;
  onPause: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engine, onOpenSkillTree, onPause }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef<number>(1);
  const onOpenSkillTreeRef = useRef(onOpenSkillTree);
  const onPauseRef = useRef(onPause);

  useEffect(() => {
    onOpenSkillTreeRef.current = onOpenSkillTree;
    onPauseRef.current = onPause;
  }, [onOpenSkillTree, onPause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Enable crisp pixel rendering
    ctx.imageSmoothingEnabled = false;

    let animationFrameId: number;
    let lastTime = performance.now();

    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Preserve full Soul Knight dungeon room vertical FOV on short mobile landscape screens (< 560px tall)
      const scale = vh < 560 ? Math.max(0.55, vh / 560) : 1;
      scaleRef.current = scale;
      const nextW = Math.round(vw / scale);
      const nextH = Math.round(vh / scale);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
        ctx.imageSmoothingEnabled = false;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const toLogicalCoords = (clientX: number, clientY: number) => ({
      x: clientX / scaleRef.current,
      y: clientY / scaleRef.current,
    });

    const isInsideBounds = (
      pos: { x: number; y: number },
      bounds: { x: number; y: number; width: number; height: number } | null
    ) =>
      Boolean(
        bounds &&
          pos.x >= bounds.x &&
          pos.x <= bounds.x + bounds.width &&
          pos.y >= bounds.y &&
          pos.y <= bounds.y + bounds.height
      );

    // Mouse listeners
    const handleMouseMove = (e: MouseEvent) => {
      engine.mousePos = toLogicalCoords(e.clientX, e.clientY);
    };

    const isModalBlocking = () =>
      engine.isPaused ||
      engine.isAwaitingRevive ||
      engine.isAwaitingPortalConfirm ||
      engine.isGameOver ||
      engine.isVictory;

    const handleMouseDown = (e: MouseEvent) => {
      if (isModalBlocking()) return;
      const pos = toLogicalCoords(e.clientX, e.clientY);

      // Check if clicking inside minimap overlay bounds
      if (isInsideBounds(pos, MiniMapRenderer.lastBounds)) {
        engine.toggleMap();
        return;
      }

      // Check if clicking directly on the floating Weapon Inspection Card to equip/buy
      if (
        e.button === 0 &&
        engine.nearbyInteractable &&
        isInsideBounds(pos, WeaponRenderer.lastInspectionCardBounds)
      ) {
        engine.interact();
        return;
      }

      if (e.button === 0) {
        // If map is expanded, clicking anywhere on backdrop closes it!
        if (engine.isMapExpanded) {
          engine.toggleMap();
          return;
        }
        engine.isMouseDown = true;
      } else if (e.button === 2) {
        // Right click triggers Skill 1!
        e.preventDefault();
        engine.triggerSkill(0);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        engine.isMouseDown = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalBlocking()) {
        if (e.code === 'Escape' && engine.isAwaitingPortalConfirm) {
          engine.cancelEnterPortal();
        }
        return;
      }

      engine.keys[e.code] = true;

      if (e.repeat) return;

      if (e.code === 'KeyQ') {
        engine.switchWeapon();
      } else if (e.code === 'KeyF') {
        engine.interact();
      } else if (e.code === 'Space') {
        e.preventDefault();
        engine.triggerSkill(0);
      } else if (e.code === 'KeyE') {
        engine.triggerSkill(1);
      } else if (e.code === 'KeyR') {
        engine.triggerSkill(2);
      } else if (e.code === 'KeyM' || e.code === 'Tab') {
        e.preventDefault();
        engine.toggleMap();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (engine.isMapExpanded) {
          engine.isMapExpanded = false;
        } else {
          onPauseRef.current();
        }
      } else if (e.code === 'KeyT') {
        onOpenSkillTreeRef.current();
      } else if (e.code === 'KeyC') {
        engine.toggleRest();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
    };

    const handleWindowBlur = () => {
      engine.keys = {};
      engine.isMouseDown = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Inspect newly added touches (changedTouches) so tapping while holding the joystick works cleanly
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const pos = toLogicalCoords(touch.clientX, touch.clientY);

        if (isInsideBounds(pos, MiniMapRenderer.lastBounds)) {
          e.preventDefault();
          engine.toggleMap();
          return;
        }

        if (
          engine.nearbyInteractable &&
          isInsideBounds(pos, WeaponRenderer.lastInspectionCardBounds)
        ) {
          e.preventDefault();
          engine.interact();
          return;
        }

        if (engine.isMapExpanded) {
          e.preventDefault();
          engine.toggleMap();
          return;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    // Main animation loop — uninterrupted for the entire dungeon run
    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      engine.update(dt, canvas.width, canvas.height);

      GameRenderer.render(
        ctx,
        canvas.width,
        canvas.height,
        engine.camera,
        engine.screenShake,
        engine.floor,
        engine.player,
        engine.bullets,
        engine.particles,
        engine.floatingTexts,
        engine.mousePos,
        engine.activeEffects,
        engine.isMapExpanded,
        engine.currentTarget,
        engine.crosshairPos,
        engine.nearbyWeaponDrop
      );

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      canvas.removeEventListener('touchstart', handleTouchStart);
    };
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-crosshair block bg-[#0b0c10] pixel-art touch-none game-touch-lock"
    />
  );
};
