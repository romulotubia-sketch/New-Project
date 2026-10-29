/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/gameEngine';
import { GameRenderer } from '../game/renderer';
import { MiniMapRenderer } from '../game/miniMapRenderer';
import { WeaponRenderer } from '../game/weaponRenderer';
import { gameSettings } from '../game/settings';

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

    // Touch & Mouse Screen Dragging state for Looking Beyond (Virtual Look-Joystick)
    let activeDragTouchId: number | null = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let isDraggingTouch = false;

    let mouseDragButton: number | null = null;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let isMouseDragging = false;
    let rightClickPendingSkill = false;

    // Visual Look-Joystick indicator while dragging
    const lookStick = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    };

    const isModalBlocking = () =>
      engine.isPaused ||
      engine.isAwaitingRevive ||
      engine.isAwaitingPortalConfirm ||
      engine.isGameOver ||
      engine.isVictory;

    // Mouse listeners
    const handleMouseMove = (e: MouseEvent) => {
      engine.mousePos = toLogicalCoords(e.clientX, e.clientY);

      if (mouseDragButton !== null) {
        const pullX = e.clientX - mouseStartX;
        const pullY = e.clientY - mouseStartY;
        const totalMoved = Math.hypot(pullX, pullY);

        if (!isMouseDragging && totalMoved > 6) {
          isMouseDragging = true;
          rightClickPendingSkill = false;
          engine.isScreenDragging = true;
        }

        if (isMouseDragging) {
          const settings = gameSettings.get();
          if (settings.screenDragEnabled) {
            const sens = settings.screenDragSensitivity;
            const scale = scaleRef.current || 1;
            // Inverted to joystick direction: dragging right looks right (+X), dragging down looks down (+Y)
            const lookMultiplier = 2.2 * sens;
            engine.cameraPanOffset.x = (pullX / scale) * lookMultiplier;
            engine.cameraPanOffset.y = (pullY / scale) * lookMultiplier;

            lookStick.active = true;
            lookStick.startX = mouseStartX;
            lookStick.startY = mouseStartY;
            lookStick.currentX = e.clientX;
            lookStick.currentY = e.clientY;
          }
        }
      }
    };

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

      if (engine.isMapExpanded) {
        engine.toggleMap();
        return;
      }

      // Middle click (button 1) OR Shift/Alt + Left Click enables direct camera drag look-beyond
      if (e.button === 1 || (e.button === 0 && (e.shiftKey || e.altKey))) {
        e.preventDefault();
        mouseDragButton = e.button;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        isMouseDragging = false;
        rightClickPendingSkill = false;
        return;
      }

      if (e.button === 0) {
        engine.isMouseDown = true;
      } else if (e.button === 2) {
        // Right click: start drag candidate; if released without dragging, trigger Skill 0!
        e.preventDefault();
        mouseDragButton = 2;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        isMouseDragging = false;
        rightClickPendingSkill = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (mouseDragButton !== null && (e.button === mouseDragButton || e.button === 0)) {
        if (rightClickPendingSkill && e.button === 2) {
          // It was a quick right-click without drag -> trigger Skill 0!
          engine.triggerSkill(0);
        }
        mouseDragButton = null;
        isMouseDragging = false;
        rightClickPendingSkill = false;
        engine.isScreenDragging = false;
        lookStick.active = false;
      }
      if (e.button === 0) {
        engine.isMouseDown = false;
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      if (isModalBlocking()) return;
      e.preventDefault();
      engine.recenterCamera();
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
        // If camera is offset from looking beyond, [C] recenters it; otherwise toggles rest!
        if (Math.hypot(engine.cameraPanOffset.x, engine.cameraPanOffset.y) > 20) {
          engine.recenterCamera();
        } else {
          engine.toggleRest();
        }
      } else if (e.code === 'KeyY') {
        engine.recenterCamera();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
    };

    const handleWindowBlur = () => {
      engine.keys = {};
      engine.isMouseDown = false;
      activeDragTouchId = null;
      isDraggingTouch = false;
      mouseDragButton = null;
      isMouseDragging = false;
      engine.isScreenDragging = false;
      lookStick.active = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
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

        // Initialize drag candidate for looking beyond (virtual look-joystick)
        if (activeDragTouchId === null) {
          activeDragTouchId = touch.identifier;
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          isDraggingTouch = false;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (activeDragTouchId === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === activeDragTouchId) {
          const pullX = touch.clientX - touchStartX;
          const pullY = touch.clientY - touchStartY;
          const totalDist = Math.hypot(pullX, pullY);

          if (!isDraggingTouch && totalDist > 7) {
            isDraggingTouch = true;
            engine.isScreenDragging = true;
          }

          if (isDraggingTouch) {
            if (e.cancelable) e.preventDefault();
            const settings = gameSettings.get();
            if (settings.screenDragEnabled) {
              const sens = settings.screenDragSensitivity;
              const scale = scaleRef.current || 1;
              // Inverted to joystick direction: dragging right looks right (+X), dragging down looks down (+Y)
              const lookMultiplier = 2.2 * sens;
              engine.cameraPanOffset.x = (pullX / scale) * lookMultiplier;
              engine.cameraPanOffset.y = (pullY / scale) * lookMultiplier;

              lookStick.active = true;
              lookStick.startX = touchStartX;
              lookStick.startY = touchStartY;
              lookStick.currentX = touch.clientX;
              lookStick.currentY = touch.clientY;
            }
          }
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (activeDragTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeDragTouchId) {
          activeDragTouchId = null;
          isDraggingTouch = false;
          engine.isScreenDragging = false;
          lookStick.active = false;
          break;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

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

      // Render Virtual Look Joystick indicator when dragging screen to look beyond
      if (lookStick.active) {
        const scale = scaleRef.current || 1;
        const sx = lookStick.startX / scale;
        const sy = lookStick.startY / scale;
        const cx = lookStick.currentX / scale;
        const cy = lookStick.currentY / scale;

        ctx.save();
        // Base compass ring
        ctx.beginPath();
        ctx.arc(sx, sy, 38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 14, 9, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();

        // Direction connector stem
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Thumb knob
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 83, 9, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot on knob
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        ctx.restore();
      }

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
      canvas.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-crosshair block bg-[#0b0c10] pixel-art touch-none game-touch-lock"
    />
  );
};
