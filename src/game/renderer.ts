/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TILE_SIZE } from './constants';
import { PASSAGE_HALF_WIDTH } from './gameEngine';
import { KnightSpriteRenderer } from './knightSprite';
import { MageSpriteRenderer } from './mageSprite';
import { HeroSpriteRenderer, HERO_PALETTES } from './heroSprites';
import { DungeonEventsManager } from './dungeonEvents';
import { MiniMapRenderer } from './miniMapRenderer';
import {
  ActiveSkillEffects,
  Bullet,
  DropItem,
  DungeonFloor,
  DungeonRoom,
  Enemy,
  FloatingText,
  Obstacle,
  Particle,
  Player,
  RoomDecoration,
} from './types';
import { WeaponRenderer } from './weaponRenderer';

export class GameRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: { x: number; y: number },
    screenShake: number,
    floor: DungeonFloor,
    player: Player,
    bullets: Bullet[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    mousePos: { x: number; y: number },
    activeSkillEffects: ActiveSkillEffects,
    isMapExpanded: boolean = false,
    currentTarget: Enemy | null = null,
    crosshairPos?: { x: number; y: number },
    nearbyWeaponDrop: DropItem | null = null
  ) {
    // Clear screen
    ctx.fillStyle = '#090a10';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Apply screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (screenShake > 0) {
      shakeX = (Math.random() - 0.5) * screenShake * 10;
      shakeY = (Math.random() - 0.5) * screenShake * 10;
    }

    // Center camera on player
    ctx.translate(width / 2 - camera.x + shakeX, height / 2 - camera.y + shakeY);

    // 1. Draw Rooms
    floor.rooms.forEach(room => {
      this.drawRoom(ctx, room, floor.biome);
    });

    // 2. Draw Walled Corridors connecting doors (carves doorway apertures cleanly)
    this.drawCorridors(ctx, floor);

    // 3. Draw Room Doors (archways & combat lock lasers)
    floor.rooms.forEach(room => {
      this.drawDoors(ctx, room);
    });

    // 4. Draw Ground Skill Zones (pools, consecration, domes, blizzard)
    this.drawGroundSkillEffects(ctx, activeSkillEffects, player);

    // 5. Draw Obstacles (Crates, Barrels, Braziers, Statues, Chests, Peddler, Portals)
    floor.rooms.forEach(room => {
      room.obstacles.forEach(obs => {
        this.drawObstacle(ctx, obs, floor.biome, player);
      });
    });

    // 6. Draw Dropped Items (Coins, Energy, Gems, Weapons)
    floor.rooms.forEach(room => {
      room.drops.forEach(drop => {
        this.drawDropItem(ctx, drop);
      });
    });

    // 7. Ethereal Guiding Arcane Tether to locked enemy
    if (currentTarget && currentTarget.hp > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(currentTarget.x, currentTarget.y);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Draw Enemies
    floor.rooms.forEach(room => {
      room.enemies.forEach(enemy => {
        const isTargeted = currentTarget?.id === enemy.id;
        this.drawEnemy(ctx, enemy, isTargeted);
      });
    });

    // 9. Draw Summoned Entities (Turrets, Clones, Minions, Mecha-Golems)
    this.drawSummonedEntities(ctx, activeSkillEffects);

    // 10. Draw Player & Active Character Auras
    this.drawPlayer(ctx, player, activeSkillEffects);

    // 11. Draw Orbital Shields & Foreground Skill VFX (Lightning, Beams, Slashes, Shockwaves)
    this.drawForegroundSkillVFX(ctx, activeSkillEffects, player);

    // 12. Draw Bullets & Projectiles
    bullets.forEach(bullet => {
      this.drawBullet(ctx, bullet);
    });

    // 13. Draw Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    });

    // 14. Draw Floating Combat Text
    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `bold ${Math.round(11 * ft.scale)}px 'Press Start 2P', monospace`;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();

    // 15. Procedurally Generated Mini-Map Overlay
    MiniMapRenderer.render(ctx, width, height, floor, player, isMapExpanded);

    // 16. Automatic Target / Joystick Directional Reticle
    const activeCrosshairPos = crosshairPos || mousePos;
    const isLocked = Boolean(currentTarget && currentTarget.hp > 0);
    this.drawCrosshair(ctx, activeCrosshairPos, isLocked, player.rotation);

    // 17. Soul Knight Dropped Weapon Inspection Tooltip Card
    if (nearbyWeaponDrop && nearbyWeaponDrop.weaponData) {
      const currentEquipped = player.weapons[player.currentWeaponIndex] || null;
      WeaponRenderer.renderWeaponInspectionCard(
        ctx,
        nearbyWeaponDrop,
        currentEquipped,
        camera,
        width,
        height,
        player.coins
      );
    } else {
      WeaponRenderer.lastInspectionCardBounds = null;
    }
  }

  private static getBiomePalette(biome: 'ruins' | 'crypt' | 'volcano') {
    if (biome === 'crypt') {
      return {
        floorBase: '#161924',
        floorAlt: '#1c2130',
        pathway: '#252c40',
        wallColor: '#313952',
        wallTop: '#4e5b80',
        wallMortar: '#1b2030',
        borderColor: '#0b0d14',
        torchOuter: 'rgba(56, 189, 248, 0.22)',
        torchFlameA: '#38bdf8',
        torchFlameB: '#e0f2fe',
      };
    }
    if (biome === 'volcano') {
      return {
        floorBase: '#241619',
        floorAlt: '#2f1c20',
        pathway: '#3d2429',
        wallColor: '#4a2428',
        wallTop: '#6e353b',
        wallMortar: '#261114',
        borderColor: '#12090b',
        torchOuter: 'rgba(249, 115, 22, 0.25)',
        torchFlameA: '#f97316',
        torchFlameB: '#fef08a',
      };
    }
    return {
      floorBase: '#191c2a',
      floorAlt: '#1f2437',
      pathway: '#293048',
      wallColor: '#2e354f',
      wallTop: '#465075',
      wallMortar: '#181c2b',
      borderColor: '#0f111a',
      torchOuter: 'rgba(245, 158, 11, 0.22)',
      torchFlameA: '#f59e0b',
      torchFlameB: '#fef08a',
    };
  }

  private static tileHash(roomIdx: number, tx: number, ty: number): number {
    let h = (roomIdx * 374761393) ^ (tx * 668265263) ^ (ty * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    return Math.abs(h ^ (h >>> 16));
  }

  private static drawTorchFlame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    biome: 'ruins' | 'crypt' | 'volcano',
    seed: number = 0,
    scale: number = 1.0
  ) {
    const pal = this.getBiomePalette(biome);
    const t = Date.now() * 0.009 + seed * 1.7;
    const flicker = Math.sin(t) * 1.8 + Math.cos(t * 1.9) * 1.1;
    const glowR = (38 + flicker * 3) * scale;

    ctx.save();
    // Soft floor/wall radial glow
    const grad = ctx.createRadialGradient(x, y, 2, x, y, glowR);
    grad.addColorStop(0, pal.torchOuter);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Iron sconce / burner cup
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 3 * scale, y + 1 * scale, 6 * scale, 4 * scale);

    // Outer flickering flame
    ctx.fillStyle = pal.torchFlameA;
    ctx.beginPath();
    ctx.arc(x, y - 1 * scale, (4.5 + Math.max(-1, flicker * 0.45)) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2 * scale, y - (7 + flicker * 0.6) * scale, 4 * scale, 5 * scale);

    // Inner white-gold core
    ctx.fillStyle = pal.torchFlameB;
    ctx.fillRect(x - 1.5 * scale, y - (4 + flicker * 0.3) * scale, 3 * scale, 3.5 * scale);
    ctx.restore();
  }

  private static drawRoom(ctx: CanvasRenderingContext2D, room: DungeonRoom, biome: 'ruins' | 'crypt' | 'volcano') {
    const rx = room.pixelX;
    const ry = room.pixelY;
    const rw = room.width * TILE_SIZE;
    const rh = room.height * TILE_SIZE;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const pal = this.getBiomePalette(biome);
    const floorAlt = room.type === 'boss' ? '#2a1728' : pal.floorAlt;

    // 1. Outer Room Border / Shadow
    ctx.fillStyle = pal.borderColor;
    ctx.fillRect(rx - 8, ry - 8, rw + 16, rh + 16);

    // 2. Textured Masonry Floor Tiles (deterministic stone bevels & micro-wear)
    for (let ty = 0; ty < room.height; ty++) {
      for (let tx = 0; tx < room.width; tx++) {
        const px = rx + tx * TILE_SIZE;
        const py = ry + ty * TILE_SIZE;
        const isAlt = (tx + ty) % 2 === 0;
        const h = this.tileHash(room.index, tx, ty);

        ctx.fillStyle = isAlt ? pal.floorBase : floorAlt;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Chiseled top-left stone bevel highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
        ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, 2);
        ctx.fillRect(px + 1, py + 3, 2, TILE_SIZE - 4);

        // Recessed tile mortar seam
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

        // Deterministic stone speckles / chipped corner on ~25% of interior tiles
        if (tx > 0 && tx < room.width - 1 && ty > 0 && ty < room.height - 1) {
          if (h % 5 === 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.fillRect(px + 6 + (h % 14), py + 8 + ((h >> 4) % 14), 3, 2);
          } else if (h % 7 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.fillRect(px + 10 + (h % 12), py + 6 + ((h >> 3) % 16), 4, 2);
          }
        }
      }
    }

    // 3. Paved Stone Pathways from Doorways into the Room
    const connectFullPath = room.type === 'start' || room.type === 'chest' || room.type === 'shop' || room.type === 'statue' || room.type === 'boss';
    room.doors.forEach(door => {
      ctx.fillStyle = pal.pathway;
      const pathLen = connectFullPath ? (door.direction === 'north' || door.direction === 'south' ? rh / 2 - 16 : rw / 2 - 16) : 92;
      if (door.direction === 'north') {
        ctx.fillRect(door.x - 22, ry + 16, 44, pathLen);
      } else if (door.direction === 'south') {
        ctx.fillRect(door.x - 22, ry + rh - 16 - pathLen, 44, pathLen);
      } else if (door.direction === 'west') {
        ctx.fillRect(rx + 16, door.y - 22, pathLen, 44);
      } else if (door.direction === 'east') {
        ctx.fillRect(rx + rw - 16 - pathLen, door.y - 22, pathLen, 44);
      }
      // Subtle pathway border trim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      if (door.direction === 'north') {
        ctx.strokeRect(door.x - 22, ry + 16, 44, pathLen);
      } else if (door.direction === 'south') {
        ctx.strokeRect(door.x - 22, ry + rh - 16 - pathLen, 44, pathLen);
      } else if (door.direction === 'west') {
        ctx.strokeRect(rx + 16, door.y - 22, pathLen, 44);
      } else if (door.direction === 'east') {
        ctx.strokeRect(rx + rw - 16 - pathLen, door.y - 22, pathLen, 44);
      }
    });

    // 4. Room-Type Signature Floor Centerpieces (Carpets, Mosaics, Ritual Circles)
    this.drawRoomCenterpiece(ctx, room, cx, cy);

    // 5. Biome Floor Micro-Details (Moss, Cracks, Bones, Lava Fissures, Grates, Candles)
    if (room.decorations) {
      room.decorations.forEach((dec, idx) => {
        if (dec.kind !== 'wall_torch' && dec.kind !== 'wall_banner') {
          this.drawFloorDecoration(ctx, dec, biome, idx);
        }
      });
    }

    // 6. Chiseled Masonry Perimeter Walls (16px thick)
    ctx.fillStyle = pal.wallColor;
    ctx.fillRect(rx, ry, rw, 16);
    ctx.fillRect(rx, ry + rh - 16, rw, 16);
    ctx.fillRect(rx, ry, 16, rh);
    ctx.fillRect(rx + rw - 16, ry, 16, rh);

    // Brick mortar joints along horizontal & vertical walls
    ctx.fillStyle = pal.wallMortar;
    for (let bx = rx + 20; bx < rx + rw - 20; bx += 28) {
      ctx.fillRect(bx, ry + 5, 2, 11);
      ctx.fillRect(bx + 14, ry + rh - 12, 2, 12);
    }
    for (let by = ry + 20; by < ry + rh - 20; by += 28) {
      ctx.fillRect(rx + 5, by, 11, 2);
      ctx.fillRect(rx + rw - 12, by + 14, 12, 2);
    }

    // Wall 3D top highlights
    ctx.fillStyle = pal.wallTop;
    ctx.fillRect(rx, ry, rw, 5);
    ctx.fillRect(rx, ry, 5, rh);
    ctx.fillRect(rx, ry + rh - 16, rw, 4);
    ctx.fillRect(rx + rw - 16, ry, 4, rh);

    // Biome wall trim (creeping moss on ruins walls / ember cracks on volcano walls)
    if (biome === 'ruins') {
      ctx.fillStyle = '#15803d';
      for (let mx = rx + 44; mx < rx + rw - 60; mx += 96) {
        if (Math.abs(mx - cx) > 44) {
          ctx.fillRect(mx, ry + 12, 10, 6);
          ctx.fillRect(mx + 3, ry + 16, 5, 3);
        }
      }
    } else if (biome === 'volcano') {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
      for (let vx = rx + 52; vx < rx + rw - 60; vx += 110) {
        if (Math.abs(vx - cx) > 44) {
          ctx.fillRect(vx, ry + 13, 8, 2);
        }
      }
    }

    // 7. Wall Banners & Flickering Wall Torches
    if (room.decorations) {
      room.decorations.forEach((dec, idx) => {
        if (dec.kind === 'wall_banner') {
          this.drawWallBanner(ctx, dec);
        } else if (dec.kind === 'wall_torch') {
          this.drawTorchFlame(ctx, dec.x, dec.y, biome, room.index * 11 + idx, 0.95);
        }
      });
    }
  }

  private static drawRoomCenterpiece(ctx: CanvasRenderingContext2D, room: DungeonRoom, cx: number, cy: number) {
    ctx.save();
    const t = Date.now() * 0.0025;

    if (room.type === 'start') {
      // Royal Sanctuary Carpet + Glowing Spawn Compass Medallion
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(cx - 56, cy - 58, 112, 148);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 52, cy - 54, 104, 140);

      // Spawn Compass Medallion at (cx, cy + 56)
      const sy = cy + 56;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, sy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(14, 116, 144, 0.25)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.beginPath();
      ctx.moveTo(cx - 18, sy);
      ctx.lineTo(cx + 18, sy);
      ctx.moveTo(cx, sy - 18);
      ctx.lineTo(cx, sy + 18);
      ctx.stroke();

      // Trial weapon showcase mat
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx + 60, cy + 14, 44, 36);
      ctx.strokeRect(cx + 60, cy + 14, 44, 36);
    } else if (room.type === 'chest') {
      // Ornate Royal Velvet & Gold Treasure Vault Rug
      ctx.fillStyle = '#881337';
      ctx.fillRect(cx - 64, cy - 48, 128, 96);
      ctx.fillStyle = '#9f1239';
      ctx.fillRect(cx - 56, cy - 40, 112, 80);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 58, cy - 42, 116, 84);
      // Golden corner tassels
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - 68, cy - 50, 6, 4);
      ctx.fillRect(cx + 62, cy - 50, 6, 4);
      ctx.fillRect(cx - 68, cy + 46, 6, 4);
      ctx.fillRect(cx + 62, cy + 46, 6, 4);
    } else if (room.type === 'shop') {
      // Woven Mystic Violet & Gold Persian Merchant Rug
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(cx - 118, cy - 42, 236, 122);
      ctx.fillStyle = '#581c87';
      ctx.fillRect(cx - 110, cy - 34, 220, 106);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 112, cy - 36, 224, 110);

      // Geometric gold diamond motif in rug center
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx + 26, cy + 12);
      ctx.lineTo(cx, cy + 42);
      ctx.lineTo(cx - 26, cy + 12);
      ctx.closePath();
      ctx.stroke();

      // Illuminated arcane display pads beneath items for sale
      room.drops.forEach(d => {
        if (d.price !== undefined) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y + 8, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    } else if (room.type === 'statue') {
      // Celestial Marble Mosaic & Blessing Ring
      ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
      ctx.beginPath();
      ctx.arc(cx, cy, 64, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 64, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.stroke();
    } else if (room.type === 'event') {
      // Mystical Violet & Stellar Celestial Runed Sanctuary Carpet
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(cx - 96, cy - 64, 192, 128);
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(cx - 88, cy - 56, 176, 112);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 90, cy - 58, 180, 116);

      // Arcane rotating star circle
      const rot = t * 0.8;
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 54, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = rot + (a * Math.PI) / 3;
        const px1 = cx + Math.cos(ang) * 54;
        const py1 = cy + Math.sin(ang) * 54;
        const px2 = cx + Math.cos(ang + Math.PI * (2 / 3)) * 54;
        const py2 = cy + Math.sin(ang + Math.PI * (2 / 3)) * 54;
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    } else if (room.type === 'combat') {
      // Weathered Gladiator Inner Stone Ring
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 170, cy - 110, 340, 220);
      ctx.beginPath();
      ctx.arc(cx, cy, 48, 0, Math.PI * 2);
      ctx.stroke();
    } else if (room.type === 'elite') {
      // Crimson & Violet Champion Trial Inlay
      ctx.fillStyle = 'rgba(168, 85, 247, 0.09)';
      ctx.beginPath();
      ctx.arc(cx, cy, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.38)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
      ctx.strokeRect(cx - 52, cy - 52, 104, 104);
    } else if (room.type === 'boss') {
      // Grand Pulsing Runic Summoning Circle
      const pulse = 0.28 + Math.sin(t * 2) * 0.1;
      ctx.fillStyle = `rgba(220, 38, 38, ${pulse * 0.32})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 118, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse + 0.18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 118, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.stroke();

      // Inscribed ritual star spokes
      for (let i = 0; i < 6; i++) {
        const a1 = (i / 6) * Math.PI * 2 + t * 0.15;
        const a2 = ((i + 2) / 6) * Math.PI * 2 + t * 0.15;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * 86, cy + Math.sin(a1) * 86);
        ctx.lineTo(cx + Math.cos(a2) * 86, cy + Math.sin(a2) * 86);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private static drawWallBanner(ctx: CanvasRenderingContext2D, dec: RoomDecoration) {
    ctx.save();
    const x = dec.x;
    const y = dec.y;
    const colors = [
      { cloth: '#991b1b', trim: '#fbbf24' }, // Royal Crimson
      { cloth: '#0369a1', trim: '#bae6fd' }, // Azure Templar
      { cloth: '#450a0a', trim: '#ef4444' }, // Boss Skull
      { cloth: '#581c87', trim: '#f59e0b' }, // Shop Tapestry
    ];
    const pal = colors[dec.variant % colors.length];

    // Gold crossbar rod
    ctx.fillStyle = '#eab308';
    ctx.fillRect(x - 11, y, 22, 3);
    // Swallowtail banner cloth
    ctx.fillStyle = pal.cloth;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 3);
    ctx.lineTo(x + 8, y + 3);
    ctx.lineTo(x + 8, y + 22);
    ctx.lineTo(x, y + 17);
    ctx.lineTo(x - 8, y + 22);
    ctx.closePath();
    ctx.fill();
    // Center emblem
    ctx.fillStyle = pal.trim;
    ctx.fillRect(x - 2, y + 7, 4, 8);
    ctx.fillRect(x - 4, y + 9, 8, 3);
    ctx.restore();
  }

  private static drawFloorDecoration(
    ctx: CanvasRenderingContext2D,
    dec: RoomDecoration,
    biome: 'ruins' | 'crypt' | 'volcano',
    seed: number
  ) {
    ctx.save();
    const { x, y, kind, variant } = dec;

    if (kind === 'moss_patch') {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(x - 7, y - 4, 12, 7);
      ctx.fillRect(x - 3, y + 2, 9, 5);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x - 5, y - 2, 6, 4);
      ctx.fillRect(x + 1, y + 2, 4, 3);
    } else if (kind === 'floor_crack') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 5);
      ctx.lineTo(x - 1, y);
      ctx.lineTo(x + 7, y + 4);
      ctx.moveTo(x - 1, y);
      ctx.lineTo(x + 3, y - 6);
      ctx.stroke();
    } else if (kind === 'pebbles') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(x - 5, y - 2, 4, 3);
      ctx.fillRect(x + 2, y + 1, 3, 3);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x - 1, y - 5, 3, 2);
    } else if (kind === 'mushroom') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x - 1, y, 2, 4);
      ctx.fillRect(x + 4, y + 1, 2, 3);
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(x - 3, y - 3, 6, 3);
      ctx.fillRect(x + 3, y - 1, 4, 2);
    } else if (kind === 'bone_pile') {
      // Crossed femur bones + pixel skull
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 4);
      ctx.lineTo(x + 7, y + 4);
      ctx.moveTo(x + 7, y - 4);
      ctx.lineTo(x - 7, y + 4);
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x - 4, y - 6, 8, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 3, y - 4, 2, 2);
      ctx.fillRect(x + 1, y - 4, 2, 2);
    } else if (kind === 'iron_grate') {
      ctx.fillStyle = biome === 'volcano' ? '#7c2d12' : '#090d16';
      ctx.fillRect(x - 10, y - 10, 20, 20);
      if (biome === 'volcano') {
        const glow = 0.4 + Math.sin(Date.now() * 0.004 + seed) * 0.2;
        ctx.fillStyle = `rgba(249, 115, 22, ${glow})`;
        ctx.fillRect(x - 8, y - 8, 16, 16);
      }
      ctx.fillStyle = '#334155';
      for (let gx = -8; gx <= 6; gx += 4) {
        ctx.fillRect(x + gx, y - 10, 2, 20);
      }
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 10, y - 10, 20, 20);
    } else if (kind === 'lava_fissure') {
      const pulse = 0.65 + Math.sin(Date.now() * 0.005 + seed) * 0.3;
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 4);
      ctx.lineTo(x - 2, y + 2);
      ctx.lineTo(x + 10, y - 3);
      ctx.stroke();

      ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (kind === 'cobweb') {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 1;
      const sx = variant % 2 === 0 ? 1 : -1;
      const sy = variant < 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx * 22, y + sy * 6);
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx * 6, y + sy * 22);
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx * 16, y + sy * 16);
      ctx.moveTo(x + sx * 12, y + sy * 3);
      ctx.lineTo(x + sx * 3, y + sy * 12);
      ctx.stroke();
    } else if (kind === 'skull_candle') {
      const flicker = Math.sin(Date.now() * 0.01 + seed) * 1.2;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y - 2, 16, 0, Math.PI * 2);
      ctx.fill();
      // Wax candle stick
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x - 2, y - 5, 4, 7);
      // Flame
      ctx.fillStyle = biome === 'crypt' ? '#38bdf8' : '#f59e0b';
      ctx.fillRect(x - 2, y - 9 - flicker * 0.4, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 7, 2, 2);
    }

    ctx.restore();
  }

  private static drawCorridors(ctx: CanvasRenderingContext2D, floor: DungeonFloor) {
    const pal = this.getBiomePalette(floor.biome);
    const halfW = PASSAGE_HALF_WIDTH; // 30px walkable half-width (60px total interior)
    const wallThick = 14;

    floor.rooms.forEach(room => {
      room.doors.forEach(door => {
        const targetRoom = floor.rooms[door.targetRoomIndex];
        if (!targetRoom) return;

        if (door.direction === 'east' && targetRoom.gridX > room.gridX) {
          const startX = door.x;
          const endX = targetRoom.pixelX;
          const length = endX - startX;
          const cy = door.y;

          // Outer dark border
          ctx.fillStyle = pal.borderColor;
          ctx.fillRect(startX, cy - halfW - wallThick - 4, length, (halfW + wallThick + 4) * 2);

          // Top & Bottom solid stone passage walls
          ctx.fillStyle = pal.wallColor;
          ctx.fillRect(startX - 16, cy - halfW - wallThick, length + 32, wallThick);
          ctx.fillRect(startX - 16, cy + halfW, length + 32, wallThick);

          // Brick mortar lines along passage walls
          ctx.fillStyle = pal.wallMortar;
          for (let bx = startX; bx < endX; bx += 28) {
            ctx.fillRect(bx, cy - halfW - wallThick + 4, 2, wallThick - 4);
            ctx.fillRect(bx + 14, cy + halfW + 4, 2, wallThick - 4);
          }

          // 3D Stone Wall Top Highlights
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(startX - 16, cy - halfW - wallThick, length + 32, 4);
          ctx.fillRect(startX - 16, cy + halfW, length + 32, 4);

          // Walkable Stone Tile Passage Floor (extends 16px through both doorways)
          const floorStart = startX - 16;
          const floorLen = length + 32;
          ctx.fillStyle = pal.floorBase;
          ctx.fillRect(floorStart, cy - halfW, floorLen, halfW * 2);

          // Stone tile seams & center runner along passage
          ctx.fillStyle = pal.floorAlt;
          for (let px = floorStart; px < floorStart + floorLen - 18; px += 36) {
            ctx.fillRect(px, cy - halfW, 18, halfW);
            ctx.fillRect(px + 18, cy, 18, halfW);
          }
          ctx.fillStyle = pal.pathway;
          ctx.fillRect(floorStart, cy - 10, floorLen, 20);

          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(floorStart, cy - halfW, floorLen, halfW * 2);

          // Mid-passage wall sconces
          const midX = startX + length / 2;
          this.drawTorchFlame(ctx, midX, cy - halfW - 4, floor.biome, room.index + 1, 0.85);
          this.drawTorchFlame(ctx, midX, cy + halfW + 4, floor.biome, room.index + 5, 0.85);
        } else if (door.direction === 'south' && targetRoom.gridY > room.gridY) {
          const startY = door.y;
          const endY = targetRoom.pixelY;
          const length = endY - startY;
          const cx = door.x;

          // Outer dark border
          ctx.fillStyle = pal.borderColor;
          ctx.fillRect(cx - halfW - wallThick - 4, startY, (halfW + wallThick + 4) * 2, length);

          // Left & Right solid stone passage walls
          ctx.fillStyle = pal.wallColor;
          ctx.fillRect(cx - halfW - wallThick, startY - 16, wallThick, length + 32);
          ctx.fillRect(cx + halfW, startY - 16, wallThick, length + 32);

          // Brick mortar lines along vertical passage walls
          ctx.fillStyle = pal.wallMortar;
          for (let by = startY; by < endY; by += 28) {
            ctx.fillRect(cx - halfW - wallThick + 4, by, wallThick - 4, 2);
            ctx.fillRect(cx + halfW + 4, by + 14, wallThick - 4, 2);
          }

          // 3D Stone Wall Highlights
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(cx - halfW - wallThick, startY - 16, 4, length + 32);
          ctx.fillRect(cx + halfW, startY - 16, 4, length + 32);

          // Walkable Stone Tile Passage Floor
          const floorStart = startY - 16;
          const floorLen = length + 32;
          ctx.fillStyle = pal.floorBase;
          ctx.fillRect(cx - halfW, floorStart, halfW * 2, floorLen);

          ctx.fillStyle = pal.floorAlt;
          for (let py = floorStart; py < floorStart + floorLen - 18; py += 36) {
            ctx.fillRect(cx - halfW, py, halfW, 18);
            ctx.fillRect(cx, py + 18, halfW, 18);
          }
          ctx.fillStyle = pal.pathway;
          ctx.fillRect(cx - 10, floorStart, 20, floorLen);

          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - halfW, floorStart, halfW * 2, floorLen);

          // Mid-passage wall sconces
          const midY = startY + length / 2;
          this.drawTorchFlame(ctx, cx - halfW - 4, midY, floor.biome, room.index + 3, 0.85);
          this.drawTorchFlame(ctx, cx + halfW + 4, midY, floor.biome, room.index + 7, 0.85);
        }
      });
    });
  }

  private static drawDoors(ctx: CanvasRenderingContext2D, room: DungeonRoom) {
    const halfW = PASSAGE_HALF_WIDTH;
    const t = Date.now() * 0.004;

    room.doors.forEach(door => {
      const isLocked = !room.isCleared && room.combatStarted;
      ctx.save();

      if (isLocked) {
        // Ancient Runic Iron Portcullis sealing the doorway during combat
        const isHoriz = door.direction === 'north' || door.direction === 'south';

        // Outer heavy iron frame
        ctx.fillStyle = '#1e2330';
        if (isHoriz) {
          ctx.fillRect(door.x - halfW - 2, door.y - 7, halfW * 2 + 4, 14);
          ctx.fillStyle = '#334155';
          ctx.fillRect(door.x - halfW, door.y - 6, halfW * 2, 2);
          ctx.fillRect(door.x - halfW, door.y + 4, halfW * 2, 2);

          // Forged vertical iron bars with spiked tips
          for (let bx = door.x - halfW + 6; bx < door.x + halfW - 4; bx += 8) {
            ctx.fillStyle = '#475569';
            ctx.fillRect(bx, door.y - 7, 3, 14);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(bx + 1, door.y - 7, 1, 14);
          }
        } else {
          ctx.fillRect(door.x - 7, door.y - halfW - 2, 14, halfW * 2 + 4);
          ctx.fillStyle = '#334155';
          ctx.fillRect(door.x - 6, door.y - halfW, 2, halfW * 2);
          ctx.fillRect(door.x + 4, door.y - halfW, 2, halfW * 2);

          // Forged horizontal iron bars
          for (let by = door.y - halfW + 6; by < door.y + halfW - 4; by += 8) {
            ctx.fillStyle = '#475569';
            ctx.fillRect(door.x - 7, by, 14, 3);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(door.x - 7, by + 1, 14, 1);
          }
        }

        // Glowing Ancient Arcane Ward Sigil binding the gate shut
        const pulse = 0.55 + Math.sin(t * 3) * 0.25;
        ctx.strokeStyle = `rgba(245, 158, 11, ${pulse})`;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(door.x, door.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(door.x - 2, door.y - 2, 4, 4);
      } else {
        // Carved stone door jambs with ancient glowing rune threshold
        ctx.fillStyle = '#475569';
        if (door.direction === 'north' || door.direction === 'south') {
          ctx.fillRect(door.x - halfW - 4, door.y - 8, 6, 16);
          ctx.fillRect(door.x + halfW - 2, door.y - 8, 6, 16);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(door.x - halfW - 3, door.y - 7, 4, 14);
          ctx.fillRect(door.x + halfW - 1, door.y - 7, 4, 14);

          // Amber-gold rune threshold inlay
          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.fillRect(door.x - halfW + 4, door.y - 2, halfW * 2 - 8, 4);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
          for (let rx = door.x - halfW + 8; rx < door.x + halfW - 8; rx += 12) {
            ctx.fillRect(rx, door.y - 1, 3, 2);
          }
        } else {
          ctx.fillRect(door.x - 8, door.y - halfW - 4, 16, 6);
          ctx.fillRect(door.x - 8, door.y + halfW - 2, 16, 6);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(door.x - 7, door.y - halfW - 3, 14, 4);
          ctx.fillRect(door.x - 7, door.y + halfW - 1, 14, 4);

          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.fillRect(door.x - 2, door.y - halfW + 4, 4, halfW * 2 - 8);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
          for (let ry = door.y - halfW + 8; ry < door.y + halfW - 8; ry += 12) {
            ctx.fillRect(door.x - 1, ry, 2, 3);
          }
        }
      }
      ctx.restore();
    });
  }

  private static drawObstacle(
    ctx: CanvasRenderingContext2D,
    obs: Obstacle,
    biome: 'ruins' | 'crypt' | 'volcano' = 'ruins',
    player?: Player
  ) {
    ctx.save();

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height - 1, obs.width * 0.52, obs.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    if (obs.type === 'pillar') {
      // Carved Fluted Dungeon Column
      const pal = this.getBiomePalette(biome);
      // Plinth base
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(obs.x - 1, obs.y + obs.height - 6, obs.width + 2, 6);
      // Column shaft
      ctx.fillStyle = pal.wallColor;
      ctx.fillRect(obs.x + 2, obs.y + 5, obs.width - 4, obs.height - 11);
      // Vertical stone fluting grooves
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(obs.x + 8, obs.y + 8, 2, obs.height - 16);
      ctx.fillRect(obs.x + obs.width - 10, obs.y + 8, 2, obs.height - 16);
      // Carved capital top
      ctx.fillStyle = pal.wallTop;
      ctx.fillRect(obs.x - 1, obs.y, obs.width + 2, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(obs.x + 1, obs.y + 1, obs.width - 2, 2);
    } else if (obs.type === 'brazier') {
      const bx = obs.x + obs.width / 2;
      const by = obs.y + obs.height / 2;
      // Iron tripod base & stone pedestal
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(obs.x + 5, obs.y + obs.height - 8, obs.width - 10, 7);
      ctx.fillStyle = '#334155';
      ctx.fillRect(obs.x + 3, obs.y + 8, obs.width - 6, obs.height - 14);
      // Iron rim & glowing coal bed
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(obs.x + 2, obs.y + 6, obs.width - 4, 6);
      ctx.fillStyle = biome === 'crypt' ? '#0284c7' : '#dc2626';
      ctx.fillRect(obs.x + 5, obs.y + 7, obs.width - 10, 4);
      // Multi-layered flickering fire + radial floor illumination
      this.drawTorchFlame(ctx, bx, by - 4, biome, Math.round(obs.x + obs.y), 1.35);
    } else if (obs.type === 'crate') {
      ctx.fillStyle = '#713f12';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(obs.x + 2, obs.y + 2, obs.width - 4, obs.height - 4);
      // Horizontal plank lines
      ctx.fillStyle = '#78350f';
      ctx.fillRect(obs.x + 2, obs.y + Math.floor(obs.height / 2), obs.width - 4, 2);
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x + 2, obs.y + 2, obs.width - 4, obs.height - 4);
      ctx.beginPath();
      ctx.moveTo(obs.x + 3, obs.y + 3);
      ctx.lineTo(obs.x + obs.width - 3, obs.y + obs.height - 3);
      ctx.moveTo(obs.x + obs.width - 3, obs.y + 3);
      ctx.lineTo(obs.x + 3, obs.y + obs.height - 3);
      ctx.stroke();
      // Iron corner studs
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(obs.x + 3, obs.y + 3, 2, 2);
      ctx.fillRect(obs.x + obs.width - 5, obs.y + 3, 2, 2);
      ctx.fillRect(obs.x + 3, obs.y + obs.height - 5, 2, 2);
      ctx.fillRect(obs.x + obs.width - 5, obs.y + obs.height - 5, 2, 2);
    } else if (obs.type === 'barrel') {
      ctx.fillStyle = obs.isExplosive ? '#991b1b' : '#78350f';
      ctx.fillRect(obs.x + 2, obs.y, obs.width - 4, obs.height);
      ctx.fillStyle = obs.isExplosive ? '#ef4444' : '#92400e';
      ctx.fillRect(obs.x + 4, obs.y + 3, obs.width - 8, obs.height - 6);
      // Iron barrel hoops
      ctx.fillStyle = '#334155';
      ctx.fillRect(obs.x + 1, obs.y + 5, obs.width - 2, 3);
      ctx.fillRect(obs.x + 1, obs.y + obs.height - 8, obs.width - 2, 3);
      if (obs.isExplosive) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(obs.x + 4, obs.y + obs.height / 2 - 4, obs.width - 8, 8);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('TNT', obs.x + 7, obs.y + obs.height / 2 + 3);
      }
    } else if (obs.type === 'chest') {
      const opened = obs.opened;
      // Oak & gold banded chest
      ctx.fillStyle = '#713f12';
      ctx.fillRect(obs.x, obs.y + 8, obs.width, obs.height - 8);
      ctx.fillStyle = opened ? '#451a03' : '#ca8a04';
      ctx.fillRect(obs.x + 3, obs.y + 11, obs.width - 6, obs.height - 14);
      if (opened) {
        // Glittering gold interior
        ctx.fillStyle = '#facc15';
        ctx.fillRect(obs.x + 6, obs.y + 12, obs.width - 12, 8);
      }
      // Gold trim straps
      ctx.fillStyle = '#eab308';
      ctx.fillRect(obs.x + 6, obs.y + 8, 4, obs.height - 8);
      ctx.fillRect(obs.x + obs.width - 10, obs.y + 8, 4, obs.height - 8);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(obs.x, obs.y + 18, obs.width, 4);
      ctx.fillStyle = opened ? '#64748b' : '#38bdf8';
      ctx.fillRect(obs.x + obs.width / 2 - 4, obs.y + 16, 8, 8);
    } else if (obs.type === 'statue') {
      const sx = obs.x + obs.width / 2;
      // Stepped stone plinth
      ctx.fillStyle = '#334155';
      ctx.fillRect(obs.x + 2, obs.y + obs.height - 10, obs.width - 4, 10);
      ctx.fillStyle = '#475569';
      ctx.fillRect(obs.x + 6, obs.y + obs.height - 16, obs.width - 12, 7);
      // Stone angel/guardian wings
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(sx, obs.y + 14);
      ctx.lineTo(obs.x + 2, obs.y + 2);
      ctx.lineTo(obs.x + 6, obs.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, obs.y + 14);
      ctx.lineTo(obs.x + obs.width - 2, obs.y + 2);
      ctx.lineTo(obs.x + obs.width - 6, obs.y + 22);
      ctx.closePath();
      ctx.fill();
      // Guardian body & helm
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(sx - 7, obs.y + 8, 14, obs.height - 22);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(sx - 5, obs.y, 10, 10);
      // Glowing cyan rune eyes & sword
      ctx.fillStyle = obs.opened ? '#64748b' : '#38bdf8';
      ctx.fillRect(sx - 3, obs.y + 4, 6, 2);
      ctx.fillRect(sx - 1.5, obs.y + 12, 3, 16);
    } else if (obs.type === 'shop_table') {
      const peddlerX = obs.x + obs.width / 2;
      const peddlerY = obs.y - 8 + Math.sin(Date.now() * 0.004) * 1.5;
      const lookDir = player && player.x < peddlerX ? -1 : 1;

      // Mysterious Hooded Dungeon Peddler NPC standing behind the table!
      // Backpack rucksack
      ctx.fillStyle = '#78350f';
      ctx.fillRect(peddlerX - lookDir * 11 - 4, peddlerY - 12, 8, 14);
      // Mystic robe & hood
      ctx.fillStyle = '#312e81';
      ctx.fillRect(peddlerX - 10, peddlerY - 10, 20, 18);
      ctx.fillStyle = '#4338ca';
      ctx.fillRect(peddlerX - 9, peddlerY - 22, 18, 13);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(peddlerX - 6, peddlerY - 18, 12, 8);
      // Glowing golden merchant eyes tracking player
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(peddlerX + lookDir * 2 - 4, peddlerY - 15, 3, 3);
      ctx.fillRect(peddlerX + lookDir * 2 + 1, peddlerY - 15, 3, 3);

      // Oak counter + royal purple velvet runner
      ctx.fillStyle = '#451a03';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(obs.x + 2, obs.y + 2, obs.width - 4, obs.height - 6);
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(obs.x + 8, obs.y + 2, obs.width - 16, obs.height - 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(obs.x + 8, obs.y + obs.height - 5, obs.width - 16, 2);

      // Potion vials & gold coins on table
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(obs.x + 12, obs.y + 8, 5, 7);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(obs.x + 20, obs.y + 9, 5, 6);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(obs.x + obs.width - 18, obs.y + 11, 6, 5);
    } else if (obs.type === 'portal') {
      // Swirling Dimensional Dungeon Portal!
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      const t = Date.now() * 0.004;
      ctx.strokeStyle = '#a855f7';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139, 92, 246, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, t, t + Math.PI * 1.4);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (
      obs.type === 'wishing_well' ||
      obs.type === 'blood_altar' ||
      obs.type === 'fortune_wheel' ||
      obs.type === 'blacksmith_forge' ||
      obs.type === 'cursed_monolith'
    ) {
      const animTime = Date.now() * 0.003;
      DungeonEventsManager.renderObstacle(ctx, obs, animTime, player || null);
    }

    ctx.restore();
  }

  private static drawDropItem(ctx: CanvasRenderingContext2D, drop: DropItem) {
    ctx.save();
    const bobY = Math.sin(drop.bobPhase) * 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const py = drop.y + bobY;

    if (drop.type === 'coin') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(drop.x, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(drop.x - 1, py - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (drop.type === 'energy') {
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(drop.x, py - 9);
      ctx.lineTo(drop.x + 7, py);
      ctx.lineTo(drop.x, py + 9);
      ctx.lineTo(drop.x - 7, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.arc(drop.x, py, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (drop.type === 'health') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(drop.x - 8, py - 4, 16, 8);
      ctx.fillRect(drop.x - 4, py - 8, 8, 16);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(drop.x - 2, py - 2, 4, 4);
    } else if (drop.type === 'soul_gem') {
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(drop.x, py - 10);
      ctx.lineTo(drop.x + 8, py - 2);
      ctx.lineTo(drop.x + 5, py + 10);
      ctx.lineTo(drop.x - 5, py + 10);
      ctx.lineTo(drop.x - 8, py - 2);
      ctx.closePath();
      ctx.fill();
    } else if (drop.type === 'weapon' && drop.weaponData) {
      WeaponRenderer.drawDroppedWeapon(ctx, drop);
      ctx.restore();
      return;
    }

    if (drop.price !== undefined) {
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText(`${drop.price} G`, drop.x, drop.y + 28);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  private static drawPlayer(ctx: CanvasRenderingContext2D, player: Player, effects: ActiveSkillEffects) {
    ctx.save();
    const auras = effects?.auras;
    const t = Date.now() * 0.005;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 14, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Astral Overload / Lich Sovereign Rotating Sigil under feet
    if (auras && (auras.astralOverloadTimer > 0 || auras.lichTimer > 0)) {
      ctx.save();
      ctx.translate(player.x, player.y + 6);
      ctx.rotate(t);
      const sigilColor = auras.lichTimer > 0 ? '#d946ef' : '#818cf8';
      ctx.strokeStyle = sigilColor;
      ctx.shadowColor = sigilColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -22, 44, 44);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-22, -22, 44, 44);
      ctx.restore();
    }

    // Berserk / Bloodlust / Undying Crimson Battle Aura
    if (auras && (auras.berserkTimer > 0 || auras.bloodboilTimer > 0 || auras.undyingTimer > 0)) {
      ctx.save();
      const pulse = Math.sin(t * 3) * 3;
      ctx.strokeStyle = auras.undyingTimer > 0 ? '#f97316' : '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Fortress Shield Sphere
    if (player.fortressShieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // Paladin Holy Aegis Golden Barrier
    if (auras && auras.aegisAbsorbTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.fill();
      ctx.restore();
    }

    // Dual Wield Aura
    if (player.dualWieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stealth / Wraith / Invulnerability Alpha
    if (auras && auras.stealthTimer > 0) {
      ctx.globalAlpha = 0.35;
    } else if (auras && auras.wraithTimer > 0) {
      ctx.globalAlpha = 0.5;
    } else if (player.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    // Ground directional facing arc aligned with Joystick / Aim Angle
    ctx.save();
    ctx.translate(player.x, player.y + 12);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 19, player.rotation - 0.42, player.rotation + 0.42);
    ctx.stroke();
    ctx.restore();

    const hasCustomSprite = player.classId === 'knight' || player.classId === 'mage';
    const isResting = player.animState === 'rest';
    const restSink = !hasCustomSprite && isResting ? Math.min(6, player.animFrame) : 0;
    const walkBob = hasCustomSprite || isResting ? 0 : Math.sin(player.walkCycle) * 2.5;
    const bodyY = player.y + walkBob + restSink;

    // Paladin Archangel Wings (drawn behind character body!)
    if (auras && auras.archangelTimer > 0) {
      ctx.save();
      const wingFlap = Math.sin(t * 2.5) * 4;
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(player.x - 8, bodyY - 6);
      ctx.lineTo(player.x - 34, bodyY - 22 + wingFlap);
      ctx.lineTo(player.x - 28, bodyY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(player.x + 8, bodyY - 6);
      ctx.lineTo(player.x + 34, bodyY - 22 + wingFlap);
      ctx.lineTo(player.x + 28, bodyY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    this.drawHeroCharacter(ctx, {
      classId: player.classId,
      x: player.x,
      y: player.y,
      facingRight: player.facingRight,
      rotation: player.rotation,
      walkCycle: player.walkCycle,
      animState: player.animState || 'idle',
      animFrame: player.animFrame || 0,
      weapon: player.weapons[player.currentWeaponIndex] || null,
      weaponRecoil: player.weaponRecoil || 0,
      dualWield: player.dualWieldTimer > 0,
    });

    ctx.restore();
  }

  public static drawHeroCharacter(
    ctx: CanvasRenderingContext2D,
    opts: {
      classId: Player['classId'];
      x: number;
      y: number;
      facingRight: boolean;
      rotation: number;
      walkCycle: number;
      animState: 'walk' | 'idle' | 'rest';
      animFrame: number;
      weapon?: Player['weapons'][number] | null;
      weaponRecoil?: number;
      dualWield?: boolean;
      showBuiltInWeapon?: boolean;
    }
  ) {
    const cid = opts.classId;
    const isKnight = cid === 'knight';
    const isMage = cid === 'mage';
    const isHeroSheet = HeroSpriteRenderer.isSupportedClass(cid);
    const hasCustomSprite = isKnight || isMage || isHeroSheet;
    const isResting = opts.animState === 'rest';
    const restSink = !hasCustomSprite && isResting ? Math.min(6, opts.animFrame) : 0;
    const restBreath = !hasCustomSprite && isResting && opts.animFrame >= 5 ? (opts.animFrame === 6 ? -1 : 0) : 0;
    const walkBob = hasCustomSprite || isResting ? 0 : Math.sin(opts.walkCycle) * 2.5;
    const stride = !hasCustomSprite && !isResting && opts.walkCycle > 0 ? Math.sin(opts.walkCycle) * 4 : 0;
    const bodyY = opts.y + walkBob + restSink + restBreath;
    const facingMult = opts.facingRight ? 1 : -1;
    const gazeY = isResting ? 1 : Math.round(Math.sin(opts.rotation) * 1.4);

    if (cid === 'knight') {
      KnightSpriteRenderer.draw(ctx, {
        x: opts.x,
        y: opts.y,
        facingRight: opts.facingRight,
        state: opts.animState || 'idle',
        frame: opts.animFrame || 0,
        pixelSize: 2,
        gazeY: Math.round(Math.sin(opts.rotation)),
        showBuiltInSword: Boolean(opts.showBuiltInWeapon),
        showOffhandShield: true,
      });
    } else if (cid === 'mage') {
      MageSpriteRenderer.draw(ctx, {
        x: opts.x,
        y: opts.y,
        facingRight: opts.facingRight,
        state: opts.animState || 'idle',
        frame: opts.animFrame || 0,
        pixelSize: 2,
        gazeY: Math.round(Math.sin(opts.rotation)),
        showBuiltInStaff: Boolean(opts.showBuiltInWeapon),
      });
    } else if (isHeroSheet) {
      HeroSpriteRenderer.draw(ctx, {
        classId: cid,
        x: opts.x,
        y: opts.y,
        facingRight: opts.facingRight,
        state: opts.animState || 'idle',
        frame: opts.animFrame || 0,
        pixelSize: 2,
        gazeY: Math.round(Math.sin(opts.rotation)),
        showBuiltInWeapon: Boolean(opts.showBuiltInWeapon),
      });
    } else {
      ctx.save();
      ctx.translate(opts.x, bodyY);
      ctx.scale(facingMult, 1);

      // Animated Striding or Seated Resting Pixel Boots
      ctx.fillStyle = '#0f172a';
      if (isResting && restSink >= 4) {
        // Seated tucked boots ahead on floor
        ctx.fillRect(-2, 10 - restSink, 6, 4);
        ctx.fillRect(5, 10 - restSink, 6, 4);
      } else {
        ctx.fillRect(-7 + stride, 10 - restSink, 5, 4);
        ctx.fillRect(2 - stride, 10 - restSink, 6, 4);
      }

      if (cid === 'assassin') {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-18, -10, 10, 4);
        ctx.fillRect(-15, -6, 6, 3);
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(-11, -10, 22, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-6, -6, 15, 15 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-10, -10, 20, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(2, -18 + gazeY, 7, 3);
      } else if (cid === 'alchemist') {
        ctx.fillStyle = '#15803d';
        ctx.fillRect(-16, -13, 7, 15);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(-14, -10, 3, 9);
        ctx.fillStyle = '#164e63';
        ctx.fillRect(-11, -10, 22, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-6, -6, 15, 16 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#bef264';
        ctx.fillRect(0, -19 + gazeY, 4, 4);
        ctx.fillRect(6, -19 + gazeY, 4, 4);
      } else if (cid === 'paladin') {
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(-15, -10, 14, 22 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-9, -8, 19, 18 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, -5, 4, 13 - Math.floor(restSink * 0.3));
        ctx.fillRect(-4, -1, 12, 3);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-10, -25, 20, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-10, -25, 20, 3);
        ctx.fillRect(3, -21 + gazeY, 3, 10);
        ctx.fillRect(0, -18 + gazeY, 9, 3);
      } else if (cid === 'ranger') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-15, -16, 6, 15);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-16, -20, 4, 4);
        ctx.fillStyle = '#14532d';
        ctx.fillRect(-11, -10, 22, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-6, -6, 15, 15 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-9, -23, 18, 14);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(-11, -26, 22, 5);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-12, -32, 5, 7);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(2, -18 + gazeY, 6, 4);
      } else if (cid === 'necromancer') {
        ctx.fillStyle = '#4a044e';
        ctx.fillRect(-14, -10, 25, 22 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#a21caf';
        ctx.fillRect(-6, -7, 15, 17 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-12, -29, 5, 6);
        ctx.fillRect(6, -29, 5, 6);
        ctx.fillStyle = '#f0abfc';
        ctx.fillRect(2, -18 + gazeY, 6, 4);
      } else if (cid === 'engineer') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-16, -13, 7, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-14, -10, 3, 9);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-11, -10, 22, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-6, -6, 15, 16 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-1, -19 + gazeY, 11, 5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(2, -18 + gazeY, 7, 3);
      } else if (cid === 'vampire') {
        ctx.fillStyle = '#4c0519';
        ctx.fillRect(-15, -14, 15, 26 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(-9, -9, 19, 19 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(-4, -6, 12, 14 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-9, -23, 18, 14);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(-10, -26, 20, 6);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(2, -18 + gazeY, 6, 3);
      } else if (cid === 'druid') {
        ctx.fillStyle = '#3f6212';
        ctx.fillRect(-14, -10, 24, 22 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(-6, -7, 15, 17 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#713f12';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(-12, -31, 4, 8);
        ctx.fillRect(-15, -29, 3, 3);
        ctx.fillRect(7, -31, 4, 8);
        ctx.fillRect(11, -29, 3, 3);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(2, -18 + gazeY, 6, 4);
      } else if (cid === 'ronin') {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-13, -10, 24, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-6, -7, 15, 16 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-9, 2, 18, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-9, -22, 18, 13);
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(-18, -21);
        ctx.lineTo(0, -31);
        ctx.lineTo(18, -21);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-16, -22, 32, 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(2, -17 + gazeY, 6, 3);
      } else {
        // Berserker
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-14, -10, 26, 21 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(-8, -7, 19, 17 - Math.floor(restSink * 0.4));
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-17, -21, 7, 4);
        ctx.fillStyle = '#292524';
        ctx.fillRect(-10, -24, 20, 15);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-11, -21, 22, 4);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(-13, -27, 4, 7);
        ctx.fillRect(9, -27, 4, 7);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(2, -17 + gazeY, 7, 4);
      }

      ctx.restore();
    }

    // Equipped Weapon Sprite + Weapon Hand (stowed neatly while hero is seated in Resting camp posture!)
    const currentWeapon = opts.weapon;
    if (currentWeapon && !isResting) {
      const aimAngle = opts.rotation;
      const isFacingLeft = !opts.facingRight;
      const recoil = opts.weaponRecoil || 0;
      const reach = Math.max(8, 14 - recoil);

      ctx.save();
      ctx.translate(opts.x, bodyY + 1);
      ctx.rotate(aimAngle);

      WeaponRenderer.drawWeaponSprite(ctx, currentWeapon, reach, 0, 1.0, 0, isFacingLeft);

      ctx.fillStyle = isKnight ? '#f0b589' : isMage ? '#f2b88c' : (HERO_PALETTES[cid]?.skin || '#f0b589');
      ctx.strokeStyle = '#0b0d12';
      ctx.lineWidth = 1;
      ctx.fillRect(reach - 4, isFacingLeft ? -2 : -1, 5, 4);
      ctx.strokeRect(reach - 4, isFacingLeft ? -2 : -1, 5, 4);

      if (opts.dualWield) {
        WeaponRenderer.drawWeaponSprite(ctx, currentWeapon, reach - 2, isFacingLeft ? -10 : 10, 0.85, 0, isFacingLeft);
      }

      ctx.restore();
    }
  }

  private static drawGroundSkillEffects(ctx: CanvasRenderingContext2D, effects: ActiveSkillEffects, player: Player) {
    if (!effects) return;
    const t = Date.now() * 0.004;

    // 1. Poison / Magma / Plague Pools
    effects.poisonPools.forEach(pool => {
      ctx.save();
      const baseColor = pool.color || '#22c55e';
      ctx.globalAlpha = Math.min(0.42, pool.duration * 0.25);
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(0.85, pool.duration * 0.4);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // 2. Paladin Consecration Golden Rune Circles
    effects.consecrationZones.forEach(zone => {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner rotating holy cross
      ctx.translate(zone.x, zone.y);
      ctx.rotate(t * 0.4);
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
      ctx.beginPath();
      ctx.moveTo(-zone.radius * 0.7, 0);
      ctx.lineTo(zone.radius * 0.7, 0);
      ctx.moveTo(0, -zone.radius * 0.7);
      ctx.lineTo(0, zone.radius * 0.7);
      ctx.stroke();
      ctx.restore();
    });

    // 3. Paladin Citadel Sanctuary Domes
    effects.sanctuaryDomes.forEach(dome => {
      ctx.save();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
      ctx.beginPath();
      ctx.arc(dome.x, dome.y, dome.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    });

    // 4. Mage Blizzard Domain
    if (effects.auras && effects.auras.blizzardTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.11)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 260, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  private static drawSummonedEntities(ctx: CanvasRenderingContext2D, effects: ActiveSkillEffects) {
    if (!effects) return;

    // 1. Deployable Dwarven Clockwork Ballistas & Rune Pylons
    effects.turrets.forEach(turret => {
      ctx.save();
      const t = Date.now() * 0.005;
      // Carved stone & timber foundation pedestal
      ctx.fillStyle = turret.isVulcan ? '#451a03' : '#1e293b';
      ctx.fillRect(turret.x - 12, turret.y - 10, 24, 22);
      ctx.fillStyle = turret.isVulcan ? '#78350f' : '#334155';
      ctx.fillRect(turret.x - 10, turret.y - 8, 20, 18);

      // Bronze / Iron gear trim
      ctx.strokeStyle = turret.isVulcan ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(turret.x - 12, turret.y - 10, 24, 22);

      // Clockwork Arbalest bow arms & glowing spell crystal core
      if (turret.isVulcan) {
        // Twin fire-arbalest arms
        ctx.fillStyle = '#b45309';
        ctx.fillRect(turret.x - 14, turret.y - 14, 28, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(turret.x - 7, turret.y - 18, 4, 8);
        ctx.fillRect(turret.x + 3, turret.y - 18, 4, 8);
        // Fire mana core
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(turret.x, turret.y - 1, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Levitating mana crystal pylon
        const lev = Math.sin(t * 3) * 2;
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(turret.x - 8, turret.y - 14, 16, 4);
        // Azure arcane crystal
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(turret.x, turret.y - 20 + lev);
        ctx.lineTo(turret.x + 5, turret.y - 14 + lev);
        ctx.lineTo(turret.x, turret.y - 8 + lev);
        ctx.lineTo(turret.x - 5, turret.y - 14 + lev);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // 2. Assassin & Ronin Clones / Phantoms
    effects.clones.forEach(clone => {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = clone.isPhantom ? '#7e22ce' : '#065f46';
      ctx.fillRect(clone.x - 10, clone.y - 8, 20, 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(clone.x - 9, clone.y - 20, 18, 12);
      ctx.fillStyle = clone.isPhantom ? '#e879f9' : '#34d399';
      ctx.fillRect(clone.x - 3, clone.y - 15, 6, 3);
      ctx.restore();
    });

    // 3. Spirit Wolves, Skeletal Knights, Crimson Bats & Spirit Bears
    effects.minions.forEach(minion => {
      ctx.save();
      const bob = Math.sin(Date.now() * 0.015 + minion.x) * 2.5;
      const my = minion.y + bob;
      const dir = minion.facingRight ? 1 : -1;

      if (minion.kind === 'wolf' || minion.kind === 'alpha_wolf') {
        const isAlpha = minion.kind === 'alpha_wolf';
        ctx.fillStyle = isAlpha ? '#10b981' : '#34d399';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = isAlpha ? 10 : 5;
        // Wolf body & head
        ctx.fillRect(minion.x - 11, my - 6, 22, 12);
        ctx.fillRect(minion.x + dir * 6 - 5, my - 13, 11, 10);
        // Pointed ears
        ctx.fillRect(minion.x + dir * 5 - 3, my - 17, 3, 4);
        ctx.fillRect(minion.x + dir * 5 + 2, my - 17, 3, 4);
        // Glowing eyes
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(minion.x + dir * 8, my - 10, 3, 3);
      } else if (minion.kind === 'crimson_bat') {
        const flap = Math.sin(Date.now() * 0.03 + minion.x) * 5;
        ctx.fillStyle = '#881337';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 8;
        // Bat wings
        ctx.beginPath();
        ctx.moveTo(minion.x, my - 4);
        ctx.lineTo(minion.x - 16, my - 12 + flap);
        ctx.lineTo(minion.x - 10, my + 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(minion.x, my - 4);
        ctx.lineTo(minion.x + 16, my - 12 + flap);
        ctx.lineTo(minion.x + 10, my + 2);
        ctx.closePath();
        ctx.fill();
        // Bat body & glowing ruby eyes
        ctx.fillStyle = '#4c0519';
        ctx.fillRect(minion.x - 6, my - 9, 12, 10);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(minion.x - 4, my - 6, 3, 3);
        ctx.fillRect(minion.x + 1, my - 6, 3, 3);
      } else if (minion.kind === 'grizzly_bear') {
        // Armored Primal Grizzly Bear
        ctx.fillStyle = '#713f12';
        ctx.fillRect(minion.x - 15, my - 10, 30, 20);
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(minion.x + dir * 8 - 8, my - 16, 16, 14);
        // Round bear ears
        ctx.fillStyle = '#451a03';
        ctx.fillRect(minion.x + dir * 8 - 6, my - 20, 4, 4);
        ctx.fillRect(minion.x + dir * 8 + 2, my - 20, 4, 4);
        // Glowing emerald nature armor runes & eyes
        ctx.fillStyle = '#4ade80';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fillRect(minion.x - 6, my - 6, 12, 4);
        ctx.fillRect(minion.x + dir * 10, my - 12, 3, 3);
      } else {
        const isDread = minion.kind === 'dread_skeleton';
        // Skeletal Knight
        ctx.fillStyle = isDread ? '#9333ea' : '#475569';
        ctx.fillRect(minion.x - 9, my - 6, 18, 16);
        ctx.fillStyle = '#e2e8f0'; // Skull
        ctx.fillRect(minion.x - 8, my - 18, 16, 12);
        ctx.fillStyle = isDread ? '#f43f5e' : '#d946ef'; // Glowing undead eyes
        ctx.fillRect(minion.x + dir * 2, my - 14, 4, 3);
        // Mini blade
        ctx.fillStyle = isDread ? '#f43f5e' : '#cbd5e1';
        ctx.fillRect(minion.x + dir * 10, my - 12, 4, 16);
      }
      ctx.restore();
    });

    // 4. Ancient Runic Stone Colossus (Alchemist Golem Titan)
    effects.mechaGolems.forEach(golem => {
      ctx.save();
      // Chiseled Granite Torso
      ctx.fillStyle = '#334155';
      ctx.fillRect(golem.x - 22, golem.y - 20, 44, 38);
      ctx.fillStyle = '#475569';
      ctx.fillRect(golem.x - 16, golem.y - 14, 32, 26);

      // Etched glowing elemental runes on stone chest
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillRect(golem.x - 3, golem.y - 8, 6, 14);
      ctx.fillRect(golem.x - 10, golem.y - 4, 20, 5);

      // Stone head & glowing eyes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(golem.x - 10, golem.y - 28, 20, 10);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(golem.x - 6, golem.y - 24, 4, 3);
      ctx.fillRect(golem.x + 2, golem.y - 24, 4, 3);

      // Massive stone fists
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(golem.x - 28, golem.y - 6, 8, 18);
      ctx.fillRect(golem.x + 20, golem.y - 6, 8, 18);

      // HP Bar
      const hpRatio = Math.max(0, golem.hp / golem.maxHp);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(golem.x - 20, golem.y - 36, 40, 4);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(golem.x - 20, golem.y - 36, 40 * hpRatio, 4);
      ctx.restore();
    });
  }

  private static drawForegroundSkillVFX(ctx: CanvasRenderingContext2D, effects: ActiveSkillEffects, player: Player) {
    if (!effects) return;
    const t = Date.now() * 0.008;

    // 1. Mage Flame Barrier Orbiting Fireballs
    if (effects.auras && effects.auras.flameBarrierTimer > 0) {
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const ang = t + (i / 6) * Math.PI * 2;
        const fx = player.x + Math.cos(ang) * 48;
        const fy = player.y + Math.sin(ang) * 48;
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(fx, fy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Knight Orbital Bastion Shields
    effects.orbitalShields.forEach(shield => {
      const sx = player.x + Math.cos(shield.angle) * shield.radius;
      const sy = player.y + Math.sin(shield.angle) * shield.radius;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shield.angle + Math.PI / 2);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.restore();
    });

    // 3. Sky Beams (Judgement Smite, Meteors, Heaven's Pillar, Starfall)
    effects.skyBeams.forEach(beam => {
      const alpha = Math.max(0, beam.life / beam.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = beam.color;
      ctx.shadowColor = beam.color;
      ctx.shadowBlur = 20;
      const curW = beam.width * alpha;
      ctx.fillRect(beam.x - curW / 2, beam.y - 460, curW, 470);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(beam.x - curW * 0.22, beam.y - 460, curW * 0.44, 470);
      ctx.restore();
    });

    // 4. Expanding Shockwaves
    effects.shockwaves.forEach(sw => {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = sw.color;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4 * alpha + 1.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Slash Arcs (Shadow Slash, Blade Dance, Death Blossom, Grim Harvest)
    effects.slashArcs.forEach(arc => {
      const alpha = Math.max(0, arc.life / arc.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = arc.color;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 7 * alpha + 2;
      ctx.beginPath();
      if (arc.fullCircle) {
        ctx.arc(arc.x, arc.y, arc.radius, 0, Math.PI * 2);
      } else {
        ctx.arc(arc.x, arc.y, arc.radius, arc.angle - 1.05, arc.angle + 1.05);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 6. Jagged Lightning & Soul Drain Bolts
    effects.lightningBolts.forEach(bolt => {
      if (bolt.points.length < 2) return;
      const alpha = Math.max(0, bolt.life / bolt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = bolt.color;
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
      for (let i = 1; i < bolt.points.length; i++) {
        const prev = bolt.points[i - 1];
        const curr = bolt.points[i];
        const midX = (prev.x + curr.x) / 2 + (Math.random() - 0.5) * 18;
        const midY = (prev.y + curr.y) / 2 + (Math.random() - 0.5) * 18;
        ctx.lineTo(midX, midY);
        ctx.lineTo(curr.x, curr.y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  private static drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, isTargeted: boolean = false) {
    ctx.save();
    const t = Date.now() * 0.006;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + enemy.radius - 1, enemy.radius * 1.05, enemy.radius * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Elite Champion Aura Ring
    if (enemy.isElite && !enemy.isBoss) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 4, enemy.radius + 5 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Multi-Phase Boss Rage Aura Ring
    if (enemy.isBoss && (enemy.bossPhase || 1) >= 2) {
      ctx.save();
      const isBerserk = enemy.bossPhase === 3;
      const auraColor = isBerserk ? '#ef4444' : '#f97316';
      ctx.strokeStyle = auraColor;
      ctx.fillStyle = isBerserk ? 'rgba(239, 68, 68, 0.18)' : 'rgba(249, 115, 22, 0.12)';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = isBerserk ? 18 : 12;
      ctx.lineWidth = isBerserk ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 4, enemy.size + 12 + Math.sin(t * 3) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const walkBob = Math.sin(enemy.walkCycle) * 3;
    const ey = enemy.y + walkBob;
    const dir = enemy.facingRight ? 1 : -1;

    const baseFill =
      enemy.frozenTimer > 0
        ? '#38bdf8'
        : enemy.burnTimer > 0
        ? '#f97316'
        : enemy.color;

    if (enemy.isBoss) {
      const sz = enemy.size;
      if (enemy.type === 'boss_infernal_dragon') {
        // Sweeping Volcanic Dragon Wings behind body
        const flap = Math.sin(t * 2.4) * 8;
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(enemy.x - 10, ey);
        ctx.lineTo(enemy.x - sz - 26, ey - 28 + flap);
        ctx.lineTo(enemy.x - sz - 12, ey + 18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(enemy.x + 10, ey);
        ctx.lineTo(enemy.x + sz + 26, ey - 28 + flap);
        ctx.lineTo(enemy.x + sz + 12, ey + 18);
        ctx.closePath();
        ctx.fill();

        // Armored Magma Dragon Chassis & Horns
        ctx.fillStyle = '#431407';
        ctx.fillRect(enemy.x - sz, ey - sz, sz * 2, sz * 2);
        ctx.fillStyle = baseFill;
        ctx.fillRect(enemy.x - sz + 4, ey - sz + 4, sz * 2 - 8, sz * 2 - 8);
        // Molten chest core
        ctx.fillStyle = '#facc15';
        ctx.fillRect(enemy.x - 14, ey + 2, 28, 18);
        // Twin Curved Dragon Horns
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(enemy.x - sz + 4, ey - sz - 14, 10, 14);
        ctx.fillRect(enemy.x + sz - 14, ey - sz - 14, 10, 14);
        // Blazing Slit Eyes
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(enemy.x - 18, ey - 12, 12, 6);
        ctx.fillRect(enemy.x + 6, ey - 12, 12, 6);
      } else if (enemy.type === 'boss_skeleton_king') {
        // Royal Necrotic Mantle & Ribcage Armor
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(enemy.x - sz - 4, ey - sz + 8, sz * 2 + 8, sz * 2 - 4);
        ctx.fillStyle = '#e2e8f0'; // Giant Skull Head & Ribcage
        ctx.fillRect(enemy.x - sz + 6, ey - sz, sz * 2 - 12, sz + 8);
        ctx.fillStyle = baseFill;
        ctx.fillRect(enemy.x - sz + 8, ey + 4, sz * 2 - 16, sz - 8);
        // Jagged Imperial Gold Crown
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(enemy.x - sz + 8, ey - sz - 12, sz * 2 - 16, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(enemy.x - 4, ey - sz - 18, 8, 6);
        // Hollow Dark Sockets + Glowing Fuchsia Lich Eyes
        ctx.fillStyle = '#090d16';
        ctx.fillRect(enemy.x - 18, ey - 14, 12, 10);
        ctx.fillRect(enemy.x + 6, ey - 14, 12, 10);
        ctx.fillStyle = '#f0abfc';
        ctx.fillRect(enemy.x - 14, ey - 11, 5, 5);
        ctx.fillRect(enemy.x + 9, ey - 11, 5, 5);
      } else {
        // Grand Knight of Void: Colossal Dread Plate, Crimson Plume & Horned Greathelm
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(enemy.x - sz - 6, ey - sz + 10, sz * 2 + 12, sz * 2 - 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(enemy.x - sz, ey - sz, sz * 2, sz * 2);
        ctx.fillStyle = baseFill;
        ctx.fillRect(enemy.x - sz + 6, ey - 4, sz * 2 - 12, sz);
        // Golden Void Cross Visor & Horns
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(enemy.x - 20, ey - 14, 40, 5);
        ctx.fillRect(enemy.x - 4, ey - 24, 8, 24);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(enemy.x - sz - 2, ey - sz - 10, 9, 14);
        ctx.fillRect(enemy.x + sz - 7, ey - sz - 10, 9, 14);
        // Glowing Crimson Eyes
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(enemy.x - 16, ey - 8, 8, 5);
        ctx.fillRect(enemy.x + 8, ey - 8, 8, 5);
      }
    } else {
      const r = enemy.radius;
      // Distinct silhouette details per dungeon monster archetype
      ctx.fillStyle = '#090d16';
      ctx.fillRect(enemy.x - r - 1, ey - r - 1, r * 2 + 2, r * 2 + 2);
      ctx.fillStyle = baseFill;
      ctx.fillRect(enemy.x - r, ey - r, r * 2, r * 2);

      if (enemy.type === 'dark_knight') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(enemy.x - r, ey - r, r * 2, r);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(enemy.x + dir * 2 - 5, ey - 5, 10, 3);
      } else if (enemy.type === 'skeleton_warrior' || enemy.type === 'skeleton_mage') {
        ctx.fillStyle = enemy.type === 'skeleton_mage' ? '#581c87' : '#334155';
        ctx.fillRect(enemy.x - r, ey + 1, r * 2, r - 1);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(enemy.x - r + 2, ey - r + 2, r * 2 - 4, r);
        ctx.fillStyle = enemy.type === 'skeleton_mage' ? '#f0abfc' : '#ef4444';
        ctx.fillRect(enemy.x + dir * 3 - 4, ey - 5, 3, 3);
        ctx.fillRect(enemy.x + dir * 3 + 1, ey - 5, 3, 3);
      } else if (enemy.type === 'toxic_slime') {
        ctx.fillStyle = '#86efac';
        ctx.fillRect(enemy.x - r + 3, ey - r + 3, 6, 4);
        ctx.fillStyle = '#052e16';
        ctx.fillRect(enemy.x + dir * 3 - 5, ey - 2, 4, 4);
        ctx.fillRect(enemy.x + dir * 3 + 2, ey - 2, 4, 4);
      } else if (enemy.type === 'lava_hound') {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(enemy.x - r, ey - r - 4, 5, 5);
        ctx.fillRect(enemy.x + r - 5, ey - r - 4, 5, 5);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(enemy.x + dir * 4 - 2, ey - 4, 5, 4);
      } else {
        // Goblin / Assassin headband & fierce eyes
        ctx.fillStyle = enemy.type === 'goblin_archer' ? '#065f46' : '#7f1d1d';
        ctx.fillRect(enemy.x - r, ey - r + 2, r * 2, 4);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(enemy.x + dir * 3 - 1, ey - 4, 5, 4);
      }

      if (enemy.isElite) {
        // Golden Elite Champion Crest above head
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(enemy.x - 6, ey - r - 6, 12, 3);
        ctx.fillRect(enemy.x - 6, ey - r - 9, 3, 3);
        ctx.fillRect(enemy.x - 1.5, ey - r - 10, 3, 4);
        ctx.fillRect(enemy.x + 3, ey - r - 9, 3, 3);
      }
    }

    if (enemy.hp < enemy.maxHp && !enemy.isBoss) {
      const barW = enemy.radius * 2 + 10;
      const barH = 4;
      const barX = enemy.x - barW / 2;
      const barY = enemy.y - enemy.radius - (enemy.isElite ? 16 : 12);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = enemy.isElite ? '#f59e0b' : hpRatio > 0.5 ? '#22c55e' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    if (isTargeted) {
      const boundSize = enemy.isBoss ? enemy.size + 14 : enemy.radius + 9;
      const bracketLen = 6;
      const pulse = Math.sin(Date.now() * 0.012) * 2;
      const bx = enemy.x - boundSize - pulse;
      const by = ey - boundSize - pulse;
      const bw = (boundSize + pulse) * 2;
      const bh = (boundSize + pulse) * 2;

      // Arcane Gold/Crimson Runic Target Flourishes
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(bx, by + bracketLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + bracketLen, by);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + bw - bracketLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bracketLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, by + bh - bracketLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + bracketLen, by + bh);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + bw - bracketLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - bracketLen);
      ctx.stroke();

      // Cardinal Runic Diamond Marks
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(enemy.x, ey - boundSize - pulse - 3);
      ctx.lineTo(enemy.x + 3, ey - boundSize - pulse);
      ctx.lineTo(enemy.x, ey - boundSize - pulse + 3);
      ctx.lineTo(enemy.x - 3, ey - boundSize - pulse);
      ctx.closePath();
      ctx.fill();

      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText('AIM', enemy.x, by - 6);
    }

    ctx.restore();
  }

  private static drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
    ctx.save();
    if (bullet.isMelee) {
      ctx.strokeStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 6;
      ctx.beginPath();
      const sweep = bullet.meleeSweepAngle || 0;
      ctx.arc(bullet.x, bullet.y, bullet.radius, sweep - 0.75, sweep + 0.75);
      ctx.stroke();
    } else if (bullet.bulletShape === 'glaive') {
      // Spinning Tri-Blade Cyclone Glaive
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(bullet.spinAngle || 0);
      ctx.strokeStyle = '#2dd4bf';
      ctx.shadowColor = '#14b8a6';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, -5, 11, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-2.5, -2.5, 5, 5);
    } else if (bullet.bulletShape === 'sawblade') {
      // Spinning Serrated Steel Buzzsaw Disc
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(bullet.spinAngle || 0);
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowColor = '#94a3b8';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      // Serrated teeth
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(bullet.radius - 1, -2, 3.5, 4);
      }
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (bullet.bulletShape === 'blackhole') {
      // Swirling Void Singularity Orb
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(bullet.spinAngle || 0);
      ctx.strokeStyle = '#c084fc';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius + 3, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090a10';
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
    } else if (bullet.bulletShape === 'needle' || bullet.bulletShape === 'solar_bolt') {
      const ang = Math.atan2(bullet.vy, bullet.vx);
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(ang);
      const isSolar = bullet.bulletShape === 'solar_bolt';
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = isSolar ? '#f97316' : '#84cc16';
      ctx.shadowBlur = isSolar ? 10 : 6;
      ctx.fillRect(isSolar ? -10 : -7, -2, isSolar ? 20 : 14, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -1, isSolar ? 8 : 5, 2);
    } else if (bullet.bulletShape === 'excalibur_wave' || bullet.bulletShape === 'shield_bolt') {
      const ang = Math.atan2(bullet.vy, bullet.vx);
      const isExcal = bullet.bulletShape === 'excalibur_wave';
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(ang);
      ctx.strokeStyle = bullet.color;
      ctx.shadowColor = bullet.glowColor || bullet.color;
      ctx.shadowBlur = isExcal ? 16 : 10;
      ctx.lineWidth = isExcal ? 6 : 4;
      ctx.beginPath();
      ctx.arc(-4, 0, isExcal ? 20 : 11, -0.85, 0.85);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = bullet.glowColor || bullet.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private static drawCrosshair(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    isLocked: boolean = false,
    aimAngle: number = 0
  ) {
    ctx.save();
    const mx = pos.x;
    const my = pos.y;

    if (isLocked) {
      // Rotating Arcane Runic Spell Focus Reticle
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;

      const size = 11;
      const gap = 3;

      // Cardinal Runic Rays
      ctx.beginPath();
      ctx.moveTo(mx, my - gap);
      ctx.lineTo(mx, my - gap - size);
      ctx.moveTo(mx, my + gap);
      ctx.lineTo(mx, my + gap + size);
      ctx.moveTo(mx - gap, my);
      ctx.lineTo(mx - gap - size, my);
      ctx.moveTo(mx + gap, my);
      ctx.lineTo(mx + gap + size, my);
      ctx.stroke();

      // Rotating Inscribed Diamond Runic Ring
      const angle = Date.now() * 0.003;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Ruby Focus Jewel in Center
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('LOCK', mx, my + size + 11);
    } else {
      // Enchanted Arcane Aiming Arrowhead Wisp
      ctx.translate(mx, my);
      ctx.rotate(aimAngle);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(-6, 6);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-1, -1, 3, 2);
    }

    ctx.restore();
  }
}
