/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TILE_SIZE } from './constants';
import { gameSettings } from './settings';
import { DungeonFloor, DungeonRoom, Player } from './types';

export interface MiniMapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MiniMapRenderer {
  public static lastBounds: MiniMapBounds = { x: 0, y: 0, width: 0, height: 0 };

  public static render(
    ctx: CanvasRenderingContext2D,
    screenWidth: number,
    screenHeight: number,
    floor: DungeonFloor,
    player: Player,
    isExpanded: boolean = false
  ): MiniMapBounds {
    ctx.save();

    // 1. Determine bounding dimensions of the minimap overlay
    let panelX: number;
    let panelY: number;
    let panelW: number;
    let panelH: number;

    if (isExpanded) {
      panelW = Math.min(screenWidth - 48, 540);
      panelH = Math.min(screenHeight - 72, 440);
      panelX = (screenWidth - panelW) / 2;
      panelY = (screenHeight - panelH) / 2;

      // Dark translucent backdrop behind tactical map
      ctx.fillStyle = 'rgba(5, 7, 13, 0.78)';
      ctx.fillRect(0, 0, screenWidth, screenHeight);
    } else {
      const isCompactLandscape = screenHeight <= 600;
      panelW = screenWidth < 640 ? 138 : isCompactLandscape ? 156 : 170;
      panelH = screenWidth < 640 ? 120 : isCompactLandscape ? 128 : 144;
      panelX = screenWidth - panelW - 16;
      panelY = isCompactLandscape ? 60 : 48;
    }

    this.lastBounds = { x: panelX, y: panelY, width: panelW, height: panelH };

    // 2. Draw Frame & Background
    ctx.fillStyle = 'rgba(11, 14, 23, 0.92)';
    ctx.strokeStyle = isExpanded ? '#6366f1' : '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Subtle neon border glow
    if (isExpanded) {
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.strokeRect(panelX - 1, panelY - 1, panelW + 2, panelH + 2);
      ctx.shadowBlur = 0;
    }

    // Corner retro pixel brackets
    const bracketSize = isExpanded ? 8 : 5;
    ctx.fillStyle = isExpanded ? '#818cf8' : '#38bdf8';
    // Top-left
    ctx.fillRect(panelX - 2, panelY - 2, bracketSize, 3);
    ctx.fillRect(panelX - 2, panelY - 2, 3, bracketSize);
    // Top-right
    ctx.fillRect(panelX + panelW - bracketSize - 1, panelY - 2, bracketSize + 3, 3);
    ctx.fillRect(panelX + panelW - 1, panelY - 2, 3, bracketSize);
    // Bottom-left
    ctx.fillRect(panelX - 2, panelY + panelH - 1, bracketSize, 3);
    ctx.fillRect(panelX - 2, panelY + panelH - bracketSize - 1, 3, bracketSize);
    // Bottom-right
    ctx.fillRect(panelX + panelW - bracketSize - 1, panelY + panelH - 1, bracketSize + 3, 3);
    ctx.fillRect(panelX + panelW - 1, panelY + panelH - bracketSize - 1, 3, bracketSize);

    // 3. Mini-Map Header Title
    const headerH = isExpanded ? 28 : 20;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(panelX, panelY, panelW, headerH);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + headerH);
    ctx.lineTo(panelX + panelW, panelY + headerH);
    ctx.stroke();

    ctx.font = isExpanded ? 'bold 11px "Press Start 2P", monospace' : '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(isExpanded ? `TACTICAL RADAR - ${floor.biome.toUpperCase()}` : 'MINI-MAP', panelX + 8, panelY + (isExpanded ? 18 : 14));

    // Exploration percentage / counter
    const discoveredCount = floor.rooms.filter(r => r.isDiscovered).length;
    const totalRooms = floor.rooms.length;
    const progressText = `${discoveredCount}/${totalRooms}`;

    ctx.font = isExpanded ? '9px "Press Start 2P", monospace' : '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#94a3b8';
    const textW = ctx.measureText(progressText).width;
    ctx.fillText(progressText, panelX + panelW - textW - 8, panelY + (isExpanded ? 18 : 14));

    // 4. Calculate Procedural Dungeon Bounds for centering & scaling
    let minGridX = Infinity;
    let maxGridX = -Infinity;
    let minGridY = Infinity;
    let maxGridY = -Infinity;

    floor.rooms.forEach(r => {
      minGridX = Math.min(minGridX, r.gridX);
      maxGridX = Math.max(maxGridX, r.gridX);
      minGridY = Math.min(minGridY, r.gridY);
      maxGridY = Math.max(maxGridY, r.gridY);
    });

    const gridSpanX = Math.max(1, maxGridX - minGridX + 1);
    const gridSpanY = Math.max(1, maxGridY - minGridY + 1);

    const mapAreaY = panelY + headerH + 6;
    const mapAreaH = panelH - headerH - (isExpanded ? 50 : 12);
    const mapAreaW = panelW - 16;
    const mapAreaX = panelX + 8;

    // Grid cell size in minimap pixels
    const cellW = mapAreaW / (gridSpanX + 0.3);
    const cellH = mapAreaH / (gridSpanY + 0.3);
    const cellSize = Math.min(cellW, cellH);

    // Padding inside each cell for the room box
    const roomMiniW = Math.round(cellSize * 0.72);
    const roomMiniH = Math.round(cellSize * 0.62);

    // Offsets to center the dungeon inside the radar
    const totalDungeonW = gridSpanX * cellSize;
    const totalDungeonH = gridSpanY * cellSize;
    const offsetX = mapAreaX + (mapAreaW - totalDungeonW) / 2;
    const offsetY = mapAreaY + (mapAreaH - totalDungeonH) / 2;

    const getRoomScreenPos = (room: DungeonRoom) => {
      const rx = offsetX + (room.gridX - minGridX) * cellSize + (cellSize - roomMiniW) / 2;
      const ry = offsetY + (room.gridY - minGridY) * cellSize + (cellSize - roomMiniH) / 2;
      return { x: rx, y: ry, w: roomMiniW, h: roomMiniH };
    };

    // 5. Draw Corridors between connected rooms
    ctx.lineWidth = isExpanded ? 3 : 2;
    floor.rooms.forEach(room => {
      if (!room.isDiscovered && !room.isAdjacentDiscovered) return;

      const posA = getRoomScreenPos(room);
      const centerA = { x: posA.x + posA.w / 2, y: posA.y + posA.h / 2 };

      room.doors.forEach(door => {
        const target = floor.rooms[door.targetRoomIndex];
        if (!target) return;

        // Draw once per pair
        if (target.gridX > room.gridX || target.gridY > room.gridY) {
          const isTargetKnown = target.isDiscovered || target.isAdjacentDiscovered;
          if (!isTargetKnown) return;

          const posB = getRoomScreenPos(target);
          const centerB = { x: posB.x + posB.w / 2, y: posB.y + posB.h / 2 };

          ctx.beginPath();
          ctx.strokeStyle = room.isDiscovered && target.isDiscovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)';
          ctx.moveTo(centerA.x, centerA.y);
          ctx.lineTo(centerB.x, centerB.y);
          ctx.stroke();
        }
      });
    });

    // Current room lookup
    let currentRoom: DungeonRoom | null = null;
    for (const r of floor.rooms) {
      const px = r.pixelX;
      const py = r.pixelY;
      const pw = r.width * TILE_SIZE;
      const ph = r.height * TILE_SIZE;
      if (player.x >= px && player.x <= px + pw && player.y >= py && player.y <= py + ph) {
        currentRoom = r;
        break;
      }
    }

    // 6. Draw Room Boxes
    floor.rooms.forEach(room => {
      const pos = getRoomScreenPos(room);
      const isCurrent = currentRoom?.index === room.index;

      if (room.isDiscovered) {
        // Discovered Room Body
        let fillColor = '#1e293b';
        let strokeColor = '#475569';

        if (room.type === 'boss') {
          fillColor = '#450a0a';
          strokeColor = '#ef4444';
        } else if (room.type === 'shop') {
          fillColor = '#422006';
          strokeColor = '#eab308';
        } else if (room.type === 'chest') {
          fillColor = '#3b2506';
          strokeColor = '#f59e0b';
        } else if (room.type === 'statue') {
          fillColor = '#082f49';
          strokeColor = '#38bdf8';
        } else if (room.type === 'elite') {
          fillColor = '#2e1065';
          strokeColor = '#a855f7';
        }

        if (isCurrent) {
          strokeColor = '#10b981';
        } else if (!room.isCleared && room.combatStarted) {
          strokeColor = '#ef4444';
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(pos.x, pos.y, pos.w, pos.h);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);

        // Active combat pulsing outline
        if (!room.isCleared && room.combatStarted) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + Math.sin(Date.now() * 0.008) * 0.4})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(pos.x - 2, pos.y - 2, pos.w + 4, pos.h + 4);
        }

        // Room icon marker in center
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconSize = isExpanded ? 14 : 9;
        ctx.font = `${iconSize}px "Press Start 2P", sans-serif`;

        const centerX = pos.x + pos.w / 2;
        const centerY = pos.y + pos.h / 2;

        if (room.type === 'boss') {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('☠', centerX, centerY);
        } else if (room.type === 'chest') {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('🎁', centerX, centerY);
        } else if (room.type === 'shop') {
          ctx.fillStyle = '#facc15';
          ctx.fillText('🪙', centerX, centerY);
        } else if (room.type === 'statue') {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('✦', centerX, centerY);
        } else if (room.type === 'start') {
          ctx.fillStyle = '#34d399';
          ctx.fillText('🌀', centerX, centerY);
        } else if (room.type === 'elite') {
          ctx.fillStyle = '#c084fc';
          ctx.fillText('⚡', centerX, centerY);
        } else if (room.isCleared) {
          // Subtle cleared checkmark in small font
          ctx.fillStyle = '#64748b';
          ctx.font = `${isExpanded ? 10 : 7}px sans-serif`;
          ctx.fillText('✓', centerX, centerY);
        }

        // 7. Live Enemy & Drop Radar Blips inside discovered rooms
        if (room.enemies.length > 0) {
          room.enemies.forEach(enemy => {
            const relX = (enemy.x - room.pixelX) / (room.width * TILE_SIZE);
            const relY = (enemy.y - room.pixelY) / (room.height * TILE_SIZE);
            const blipX = pos.x + Math.max(2, Math.min(pos.w - 2, relX * pos.w));
            const blipY = pos.y + Math.max(2, Math.min(pos.h - 2, relY * pos.h));

            ctx.fillStyle = enemy.isBoss ? '#ef4444' : '#f87171';
            const blipRadius = enemy.isBoss ? (isExpanded ? 4 : 3) : (isExpanded ? 2.5 : 1.5);
            ctx.beginPath();
            ctx.arc(blipX, blipY, blipRadius, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Dropped weapon / chest items blips
        if (room.drops.length > 0) {
          room.drops.forEach(drop => {
            const relX = (drop.x - room.pixelX) / (room.width * TILE_SIZE);
            const relY = (drop.y - room.pixelY) / (room.height * TILE_SIZE);
            const blipX = pos.x + Math.max(2, Math.min(pos.w - 2, relX * pos.w));
            const blipY = pos.y + Math.max(2, Math.min(pos.h - 2, relY * pos.h));

            ctx.fillStyle = drop.type === 'weapon' ? '#c084fc' : '#fbbf24';
            ctx.fillRect(blipX - 1, blipY - 1, 2, 2);
          });
        }
      } else if (room.isAdjacentDiscovered) {
        // Fog of War: Adjacent undiscovered room silhouette
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.fillRect(pos.x, pos.y, pos.w, pos.h);

        ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);
        ctx.setLineDash([]);

        // Mystery question mark
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.font = `${isExpanded ? 11 : 7}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', pos.x + pos.w / 2, pos.y + pos.h / 2);
      }
    });

    // 8. Draw Real-time Player Beacon with Sub-Room & Passage Tracking
    let playerMapX: number | null = null;
    let playerMapY: number | null = null;

    if (currentRoom) {
      const pos = getRoomScreenPos(currentRoom);
      const roomPixelW = currentRoom.width * TILE_SIZE;
      const roomPixelH = currentRoom.height * TILE_SIZE;

      const relX = (player.x - currentRoom.pixelX) / roomPixelW;
      const relY = (player.y - currentRoom.pixelY) / roomPixelH;

      playerMapX = pos.x + Math.max(3, Math.min(pos.w - 3, relX * pos.w));
      playerMapY = pos.y + Math.max(3, Math.min(pos.h - 3, relY * pos.h));
    } else {
      // Interpolate beacon along passage between connected rooms
      for (const room of floor.rooms) {
        for (const door of room.doors) {
          const target = floor.rooms[door.targetRoomIndex];
          if (!target) continue;
          if (door.direction === 'east' && target.gridX > room.gridX) {
            if (player.x >= door.x - 16 && player.x <= target.pixelX + 16 && Math.abs(player.y - door.y) <= 45) {
              const t = Math.max(0, Math.min(1, (player.x - door.x) / Math.max(1, target.pixelX - door.x)));
              const posA = getRoomScreenPos(room);
              const posB = getRoomScreenPos(target);
              playerMapX = posA.x + posA.w + t * (posB.x - (posA.x + posA.w));
              playerMapY = posA.y + posA.h / 2;
              break;
            }
          } else if (door.direction === 'south' && target.gridY > room.gridY) {
            if (player.y >= door.y - 16 && player.y <= target.pixelY + 16 && Math.abs(player.x - door.x) <= 45) {
              const t = Math.max(0, Math.min(1, (player.y - door.y) / Math.max(1, target.pixelY - door.y)));
              const posA = getRoomScreenPos(room);
              const posB = getRoomScreenPos(target);
              playerMapX = posA.x + posA.w / 2;
              playerMapY = posA.y + posA.h + t * (posB.y - (posA.y + posA.h));
              break;
            }
          }
        }
        if (playerMapX !== null) break;
      }
    }

    if (playerMapX !== null && playerMapY !== null) {
      const pulsePhase = (Date.now() % 1200) / 1200;
      const pulseRadius = (isExpanded ? 6 : 4) + pulsePhase * (isExpanded ? 12 : 7);
      ctx.strokeStyle = `rgba(16, 185, 129, ${1 - pulsePhase})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(playerMapX, playerMapY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.translate(playerMapX, playerMapY);
      ctx.rotate(player.rotation);

      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 6;

      const arrowSize = isExpanded ? 5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(arrowSize * 1.5, 0);
      ctx.lineTo(-arrowSize, -arrowSize);
      ctx.lineTo(-arrowSize * 0.4, 0);
      ctx.lineTo(-arrowSize, arrowSize);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 9. Expanded Mode Legend & Hints
    if (isExpanded) {
      const legendY = panelY + panelH - 34;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(panelX, legendY, panelW, 34);
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(panelX, legendY);
      ctx.lineTo(panelX + panelW, legendY);
      ctx.stroke();

      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const items = [
        { label: 'YOU', icon: '▲', color: '#10b981' },
        { label: 'HOSTILE', icon: '●', color: '#ef4444' },
        { label: 'BOSS', icon: '☠', color: '#ef4444' },
        { label: 'CHEST', icon: '🎁', color: '#fbbf24' },
        { label: 'SHOP', icon: '🪙', color: '#facc15' },
        { label: 'SHRINE', icon: '✦', color: '#38bdf8' },
      ];

      const itemSpacing = panelW / items.length;
      items.forEach((item, idx) => {
        const ix = panelX + idx * itemSpacing + 8;
        ctx.fillStyle = item.color;
        ctx.fillText(item.icon, ix, legendY + 17);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(item.label, ix + 14, legendY + 17);
      });

      // Bottom toggle hint
      const hideKeys = gameSettings.get().hidePcKeyLabels;
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(
        hideKeys ? 'TAP TO CLOSE' : '[M / TAB / CLICK TO CLOSE]',
        panelX + panelW - 10,
        panelY + headerH + 14
      );
    } else {
      // Compact hint on bottom of minimap
      const hideKeys = gameSettings.get().hidePcKeyLabels;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(hideKeys ? 'TAP EXPAND' : '[M] EXPAND', panelX + panelW / 2, panelY + panelH - 3);
    }

    ctx.restore();
    return this.lastBounds;
  }
}
