/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHARACTERS, WEAPON_REGISTRY } from './constants';
import { GameRenderer } from './renderer';
import { skillTreeManager } from './skillTree';
import { sounds } from './sound';
import { CharacterClass, FloatingText, Particle, Vector2D, Weapon } from './types';
import { WeaponRenderer } from './weaponRenderer';

export interface HouseCollider {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface RestingHeroSpot {
  classId: CharacterClass;
  x: number;
  y: number;
  facingRight: boolean;
  zoneLabel: string;
}

export interface HouseInteractable {
  kind: 'hero' | 'portal' | 'shrine' | 'codex' | 'dummy';
  label: string;
  heroId?: CharacterClass;
  x: number;
  y: number;
}

export const HOUSE_WIDTH = 1040;
export const HOUSE_HEIGHT = 640;

export const HERO_SPOTS: RestingHeroSpot[] = [
  { classId: 'knight', x: 400, y: 295, facingRight: true, zoneLabel: 'Hearth Lounge' },
  { classId: 'paladin', x: 640, y: 295, facingRight: false, zoneLabel: 'Hearth Lounge' },
  { classId: 'ranger', x: 520, y: 412, facingRight: true, zoneLabel: 'Hearth Table' },
  { classId: 'mage', x: 175, y: 262, facingRight: true, zoneLabel: 'Arcane Study' },
  { classId: 'necromancer', x: 148, y: 378, facingRight: true, zoneLabel: 'Cryptic Alcove' },
  { classId: 'vampire', x: 278, y: 352, facingRight: false, zoneLabel: 'Crimson Parlor' },
  { classId: 'druid', x: 172, y: 506, facingRight: true, zoneLabel: 'Indoor Grove' },
  { classId: 'ronin', x: 308, y: 516, facingRight: true, zoneLabel: 'Tatami Mat' },
  { classId: 'assassin', x: 432, y: 522, facingRight: false, zoneLabel: 'Shadow Corner' },
  { classId: 'alchemist', x: 830, y: 264, facingRight: false, zoneLabel: 'Alchemy Bench' },
  { classId: 'engineer', x: 878, y: 378, facingRight: false, zoneLabel: 'Artificer Forge' },
  { classId: 'berserker', x: 715, y: 508, facingRight: false, zoneLabel: 'Mead & Trophy Rug' },
];

export const PORTAL_POS = { x: 520, y: 86 };
export const SHRINE_POS = { x: 350, y: 204 };
export const CODEX_POS = { x: 185, y: 188 };
export const DUMMY_POS = { x: 874, y: 510 };

export class HouseLobbyEngine {
  public pickedClass: CharacterClass | null = null;
  public hoveredHero: CharacterClass | null = null;

  public player = {
    x: 400,
    y: 295,
    vx: 0,
    vy: 0,
    radius: 14,
    speed: 225,
    rotation: 0,
    facingRight: true,
    walkCycle: 0,
    animState: 'idle' as 'walk' | 'idle' | 'rest',
    animFrame: 0,
    animTimer: 0,
    idleTimer: 0,
    manualRest: false,
    weaponRecoil: 0,
  };

  public camera = { x: HOUSE_WIDTH / 2, y: HOUSE_HEIGHT / 2 - 14, scale: 1 };
  public keys: Record<string, boolean> = {};
  public joystick = { x: 0, y: 0, active: false };
  public walkTarget: Vector2D | null = null;
  public walkWaypoints: Vector2D[] = [];

  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public dummyHitWobble = 0;
  public portalOverlapTimer = 0;
  public portalTriggered = false;

  public nearbyInteractable: HouseInteractable | null = null;

  // Solid interior furniture colliders
  private colliders: HouseCollider[] = [
    // Hearth fireplace jutting from north wall
    { x: 272, y: 158, w: 72, h: 28 },
    // Arcane Bookshelves (north-west)
    { x: 96, y: 158, w: 156, h: 30 },
    // Alchemy Table (north-east)
    { x: 776, y: 158, w: 148, h: 32 },
    // Artificer Anvil & Workbench (east wall)
    { x: 924, y: 332, w: 42, h: 86 },
    // Central Coffee Table
    { x: 476, y: 324, w: 88, h: 44 },
    // Left Crimson Sofa
    { x: 338, y: 274, w: 32, h: 82 },
    // Right Crimson Sofa
    { x: 670, y: 274, w: 32, h: 82 },
    // Soul Gem Shrine Pedestal
    { x: 334, y: 186, w: 32, h: 32 },
    // Mead Barrels (south-east)
    { x: 768, y: 526, w: 58, h: 34 },
    // Training Dummy Post
    { x: 862, y: 498, w: 24, h: 24 },
    // Potted Grove Planters (south-west)
    { x: 86, y: 468, w: 34, h: 72 },
  ];

  public pickHero(classId: CharacterClass) {
    const spot = HERO_SPOTS.find(s => s.classId === classId) || HERO_SPOTS[0];
    const cfg = CHARACTERS.find(c => c.id === classId) || CHARACTERS[0];
    const wasAlreadyPicked = this.pickedClass === classId;

    this.pickedClass = classId;
    this.player.speed = Math.max(210, cfg.speed);
    this.portalOverlapTimer = 0;
    this.portalTriggered = false;
    this.walkTarget = null;
    this.walkWaypoints = [];

    if (!wasAlreadyPicked) {
      this.player.x = spot.x;
      this.player.y = spot.y + 4;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.facingRight = spot.facingRight;
      this.player.rotation = spot.facingRight ? 0 : Math.PI;
      this.player.animState = 'idle';
      this.player.animFrame = 0;
      this.player.animTimer = 0;
      this.player.idleTimer = 0;
      this.player.manualRest = false;

      this.addFloatingText(spot.x, spot.y - 30, `${cfg.name.toUpperCase()} READY!`, '#fbbf24', 1.05);
      this.spawnBurst(spot.x, spot.y, cfg.spriteColor, 12);
    }
  }

  public cancelPortalEntry() {
    this.portalTriggered = false;
    this.portalOverlapTimer = 0;
    this.walkTarget = null;
    this.walkWaypoints = [];
    this.keys = {};
    this.setJoystick(0, 0, false);

    // Step player safely south of the < 46px portal overlap threshold so confirmation won't re-trigger immediately
    const dist = Math.hypot(this.player.x - PORTAL_POS.x, this.player.y - PORTAL_POS.y);
    if (this.pickedClass && dist < 58) {
      this.player.x = Math.max(460, Math.min(580, this.player.x));
      this.player.y = Math.max(this.player.y, PORTAL_POS.y + 62);
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.animState = 'idle';
    }
  }

  public setJoystick(x: number, y: number, active: boolean) {
    this.joystick.x = x;
    this.joystick.y = y;
    this.joystick.active = active;
    if (active && Math.hypot(x, y) > 0.06) {
      this.walkTarget = null;
      this.walkWaypoints = [];
    }
  }

  public setWalkDestination(tx: number, ty: number) {
    const r = this.player.radius;
    let destX = tx;
    let destY = ty;

    // If clicking near the portal / northern alcove, snap cleanly into the walkable alcove
    if (ty < 178 && tx >= 400 && tx <= 640) {
      destX = Math.max(444, Math.min(596, tx));
      destY = Math.max(54, ty);
    } else if (!this.isWalkable(destX, destY, r)) {
      // Search nearby ring for closest valid floor tile so clicks near walls/tables still move smoothly
      let found = false;
      for (let dist = 8; dist <= 48 && !found; dist += 8) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const cx = tx + Math.cos(a) * dist;
          const cy = ty + Math.sin(a) * dist;
          if (this.isWalkable(cx, cy, r)) {
            destX = cx;
            destY = cy;
            found = true;
            break;
          }
        }
      }
      if (!found) return;
    }

    const waypoints: Vector2D[] = [];
    // Route smoothly around the Central Coffee Table (x: 476..564, y: 324..368) when crossing north/south
    const crossesTableY =
      (this.player.y > 356 && destY < 336) || (this.player.y < 336 && destY > 356);
    const nearTableX =
      Math.min(this.player.x, destX) < 576 && Math.max(this.player.x, destX) > 464;

    if (crossesTableY && nearTableX) {
      const goLeft = (this.player.x + destX) / 2 <= 520;
      waypoints.push({ x: goLeft ? 436 : 604, y: 346 });
    }

    // If heading into the Northern Portal Sanctuary from wide left/right wings, align with the central runner first
    if (destY < 168 && (this.player.x < 440 || this.player.x > 600)) {
      waypoints.push({ x: 520, y: 218 });
    }

    waypoints.push({ x: destX, y: destY });
    this.walkWaypoints = waypoints;
    this.walkTarget = waypoints[0];
  }

  public toggleRest() {
    if (!this.pickedClass) return;
    if (this.player.animState === 'rest') {
      this.player.manualRest = false;
      this.player.idleTimer = 0;
      this.player.animState = 'idle';
      this.player.animFrame = 0;
    } else {
      this.player.manualRest = true;
      this.player.animState = 'rest';
      this.player.animFrame = 0;
      this.player.animTimer = 0;
    }
  }

  public strikeTrainingDummy() {
    if (!this.pickedClass) return;
    const cfg = CHARACTERS.find(c => c.id === this.pickedClass) || CHARACTERS[0];
    const weapon: Weapon = WEAPON_REGISTRY[cfg.startingWeaponId] || WEAPON_REGISTRY['bad_pistol'];
    this.dummyHitWobble = 1.0;
    this.player.weaponRecoil = 5;
    this.player.manualRest = false;
    this.player.idleTimer = 0;
    const angleToDummy = Math.atan2(DUMMY_POS.y - this.player.y, DUMMY_POS.x - this.player.x);
    this.player.rotation = angleToDummy;
    this.player.facingRight = DUMMY_POS.x >= this.player.x;
    const isCrit = Math.random() < 0.35;
    const dmg = isCrit ? Math.round(weapon.damage * 1.6) : weapon.damage;
    sounds.hitEnemy(isCrit);
    this.spawnBurst(DUMMY_POS.x, DUMMY_POS.y - 8, isCrit ? '#fbbf24' : '#cbd5e1', 8);
    this.addFloatingText(
      DUMMY_POS.x + (Math.random() - 0.5) * 16,
      DUMMY_POS.y - 26,
      `${isCrit ? 'CRIT ' : ''}${dmg}`,
      isCrit ? '#fbbf24' : '#f8fafc',
      isCrit ? 1.15 : 0.95
    );
  }

  public screenToWorld(screenX: number, screenY: number, vw: number, vh: number): Vector2D {
    const s = this.camera.scale || 1;
    return {
      x: (screenX - vw / 2) / s + this.camera.x,
      y: (screenY - vh / 2) / s + this.camera.y,
    };
  }

  public getHeroAtWorld(wx: number, wy: number): CharacterClass | null {
    let closest: CharacterClass | null = null;
    let bestDist = 36;
    for (const spot of HERO_SPOTS) {
      if (spot.classId === this.pickedClass) continue; // Active hero is controlled by player
      const d = Math.hypot(wx - spot.x, wy - (spot.y - 4));
      if (d < bestDist) {
        bestDist = d;
        closest = spot.classId;
      }
    }
    // Also allow clicking directly on the active player hero to re-open their own Stats/Skills/Skill Tree!
    if (!closest && this.pickedClass) {
      const dp = Math.hypot(wx - this.player.x, wy - (this.player.y - 4));
      if (dp < 30) {
        return this.pickedClass;
      }
    }
    return closest;
  }

  public isWalkable(x: number, y: number, radius: number): boolean {
    // 1. Inside main Living Room floor OR inside Northern Portal Sanctuary Hall (with generous 70px overlap across the doorway!)
    const inMainHall =
      x - radius >= 72 &&
      x + radius <= HOUSE_WIDTH - 72 &&
      y - radius >= 162 &&
      y + radius <= HOUSE_HEIGHT - 50;

    const inPortalAlcove =
      x - radius >= 428 &&
      x + radius <= 612 &&
      y - radius >= 36 &&
      y + radius <= 260;

    if (!inMainHall && !inPortalAlcove) return false;

    // 2. Furniture collisions
    for (const c of this.colliders) {
      if (x + radius > c.x && x - radius < c.x + c.w && y + radius > c.y && y - radius < c.y + c.h) {
        return false;
      }
    }

    return true;
  }

  private movePlayerSafely(dx: number, dy: number) {
    const total = Math.hypot(dx, dy);
    if (total === 0) return;
    const steps = Math.max(1, Math.ceil(total / 5));
    const sx = dx / steps;
    const sy = dy / steps;
    const r = this.player.radius;

    for (let i = 0; i < steps; i++) {
      if (this.isWalkable(this.player.x + sx, this.player.y, r)) {
        this.player.x += sx;
      }
      if (this.isWalkable(this.player.x, this.player.y + sy, r)) {
        this.player.y += sy;
      } else if (sy < -0.05 && this.player.y <= 184) {
        // Gentle doorway bevel: funnel hero smoothly into the Northern Portal Sanctuary opening if slightly touching side pillars
        if (this.player.x >= 384 && this.player.x < 444 && this.isWalkable(this.player.x + Math.abs(sy) * 0.9, this.player.y, r)) {
          this.player.x += Math.abs(sy) * 0.9;
        } else if (this.player.x > 596 && this.player.x <= 656 && this.isWalkable(this.player.x - Math.abs(sy) * 0.9, this.player.y, r)) {
          this.player.x -= Math.abs(sy) * 0.9;
        }
      }
    }
  }

  public update(dt: number, vw: number, vh: number, onEnterPortal: () => void) {
    dt = Math.min(dt, 0.05);

    // Ambient fireplace & portal particles
    if (Math.random() < 0.35) {
      this.particles.push({
        x: PORTAL_POS.x + (Math.random() - 0.5) * 44,
        y: PORTAL_POS.y + (Math.random() - 0.5) * 44,
        vx: (Math.random() - 0.5) * 18,
        vy: -18 - Math.random() * 24,
        radius: 2,
        color: Math.random() < 0.5 ? '#c084fc' : '#38bdf8',
        alpha: 0.9,
        life: 0.75,
        maxLife: 0.75,
      });
    }

    if (this.dummyHitWobble > 0) {
      this.dummyHitWobble = Math.max(0, this.dummyHitWobble - dt * 3.5);
    }

    if (!this.pickedClass) {
      // Overview Camera: Fit the entire cozy Guild House cleanly below the top header with clear bottom margin
      const targetScale = Math.max(0.5, Math.min(1.08, Math.min((vw - 24) / HOUSE_WIDTH, (vh - 96) / HOUSE_HEIGHT)));
      const camAlpha = 1 - Math.exp(-10 * dt);
      this.camera.x += (HOUSE_WIDTH / 2 - this.camera.x) * camAlpha;
      this.camera.y += (HOUSE_HEIGHT / 2 - 14 - this.camera.y) * camAlpha;
      this.camera.scale += (targetScale - this.camera.scale) * camAlpha;
      this.nearbyInteractable = null;
      this.updateVFX(dt);
      return;
    }

    // Active Hero Walking Mode!
    let mx = 0;
    let my = 0;

    const joyMag = Math.hypot(this.joystick.x, this.joystick.y);
    if (this.joystick.active && joyMag > 0.06) {
      const norm = Math.min(1, (joyMag - 0.06) / 0.7);
      const ang = Math.atan2(this.joystick.y, this.joystick.x);
      mx = Math.cos(ang) * norm;
      my = Math.sin(ang) * norm;
      this.walkTarget = null;
      this.walkWaypoints = [];
    } else {
      let kx = 0;
      let ky = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) ky -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) ky += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;

      if (kx !== 0 || ky !== 0) {
        if (kx !== 0 && ky !== 0) {
          kx *= 0.70710678;
          ky *= 0.70710678;
        }
        mx = kx;
        my = ky;
        this.walkTarget = null;
        this.walkWaypoints = [];
      } else if (this.walkTarget) {
        const dx = this.walkTarget.x - this.player.x;
        const dy = this.walkTarget.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (d > 9) {
          mx = dx / d;
          my = dy / d;
        } else {
          this.walkWaypoints.shift();
          this.walkTarget = this.walkWaypoints[0] || null;
        }
      }
    }

    const inputMag = Math.hypot(mx, my);
    const targetVx = mx * this.player.speed;
    const targetVy = my * this.player.speed;
    const accel = 1 - Math.exp(-28 * dt);
    this.player.vx += (targetVx - this.player.vx) * accel;
    this.player.vy += (targetVy - this.player.vy) * accel;

    if (Math.hypot(this.player.vx, this.player.vy) < 2 && inputMag === 0) {
      this.player.vx = 0;
      this.player.vy = 0;
    }

    const prevX = this.player.x;
    const prevY = this.player.y;
    this.movePlayerSafely(this.player.vx * dt, this.player.vy * dt);
    const movedDist = Math.hypot(this.player.x - prevX, this.player.y - prevY);

    if (inputMag > 0.04 && movedDist < 0.08 && this.walkTarget) {
      this.walkWaypoints.shift();
      this.walkTarget = this.walkWaypoints[0] || null;
    }

    const isMoving = inputMag > 0.05 && movedDist > 0.04;

    if (inputMag > 0.04) {
      this.player.rotation = Math.atan2(my, mx);
      if (Math.abs(mx) > 0.05) {
        this.player.facingRight = mx >= 0;
      }
    }

    if (this.player.weaponRecoil > 0) {
      this.player.weaponRecoil = Math.max(0, this.player.weaponRecoil - dt * 26);
    }

    // 8-frame Walk / Idle / Rest state machine
    if (isMoving) {
      this.player.manualRest = false;
      this.player.idleTimer = 0;
      this.player.walkCycle += dt * 12 * Math.max(0.5, inputMag);
      if (this.player.animState !== 'walk') {
        this.player.animState = 'walk';
        this.player.animFrame = 0;
        this.player.animTimer = 0;
      }
      this.player.animTimer += dt * 11.5 * Math.max(0.55, inputMag);
      while (this.player.animTimer >= 1) {
        this.player.animTimer -= 1;
        this.player.animFrame = (this.player.animFrame + 1) % 8;
      }
    } else {
      this.player.walkCycle = 0;
      this.player.idleTimer += dt;
      const shouldRest = this.player.manualRest || this.player.idleTimer >= 2.6;
      if (shouldRest) {
        if (this.player.animState !== 'rest') {
          this.player.animState = 'rest';
          this.player.animFrame = 0;
          this.player.animTimer = 0;
        } else if (this.player.animFrame < 5) {
          this.player.animTimer += dt * 8.5;
          while (this.player.animTimer >= 1 && this.player.animFrame < 5) {
            this.player.animTimer -= 1;
            this.player.animFrame += 1;
          }
        } else {
          this.player.animTimer += dt * 2.1;
          const restLoop = [5, 6, 7, 6];
          this.player.animFrame = restLoop[Math.floor(this.player.animTimer) % restLoop.length];
        }
      } else {
        if (this.player.animState !== 'idle') {
          this.player.animState = 'idle';
          this.player.animFrame = 0;
          this.player.animTimer = 0;
        }
        this.player.animTimer += dt * 5.5;
        while (this.player.animTimer >= 1) {
          this.player.animTimer -= 1;
          this.player.animFrame = (this.player.animFrame + 1) % 8;
        }
      }
    }

    // Smooth camera tracking around the player hero
    const targetScale = vh < 520 ? Math.max(0.74, vh / 520) : 1.0;
    const camAlpha = 1 - Math.exp(-12 * dt);
    this.camera.scale += (targetScale - this.camera.scale) * camAlpha;

    const halfVisW = vw / (2 * this.camera.scale);
    const halfVisH = vh / (2 * this.camera.scale);
    const clampedTargetX =
      halfVisW >= HOUSE_WIDTH / 2
        ? HOUSE_WIDTH / 2
        : Math.max(halfVisW - 24, Math.min(HOUSE_WIDTH - halfVisW + 24, this.player.x));
    const clampedTargetY =
      halfVisH >= HOUSE_HEIGHT / 2
        ? HOUSE_HEIGHT / 2
        : Math.max(halfVisH - 24, Math.min(HOUSE_HEIGHT - halfVisH + 24, this.player.y));

    this.camera.x += (clampedTargetX - this.camera.x) * camAlpha;
    this.camera.y += (clampedTargetY - this.camera.y) * camAlpha;

    // Check Portal entry & nearby house interactables!
    const portalDist = Math.hypot(this.player.x - PORTAL_POS.x, this.player.y - PORTAL_POS.y);
    if (portalDist < 46 && !this.portalTriggered) {
      this.portalOverlapTimer += dt;
      if (this.portalOverlapTimer >= 0.04) {
        this.portalTriggered = true;
        onEnterPortal();
        return;
      }
    } else {
      this.portalOverlapTimer = 0;
    }

    this.evaluateInteractables(portalDist);
    this.updateVFX(dt);
  }

  private evaluateInteractables(portalDist: number) {
    if (portalDist < 126) {
      this.nearbyInteractable = {
        kind: 'portal',
        label: 'ENTER DUNGEON PORTAL',
        x: PORTAL_POS.x,
        y: PORTAL_POS.y,
      };
      return;
    }

    const shrineDist = Math.hypot(this.player.x - SHRINE_POS.x, this.player.y - SHRINE_POS.y);
    if (shrineDist < 58) {
      this.nearbyInteractable = {
        kind: 'shrine',
        label: 'OPEN SOUL GEM SKILL TREE',
        x: SHRINE_POS.x,
        y: SHRINE_POS.y,
      };
      return;
    }

    const codexDist = Math.hypot(this.player.x - CODEX_POS.x, this.player.y - CODEX_POS.y);
    if (codexDist < 56) {
      this.nearbyInteractable = {
        kind: 'codex',
        label: 'READ WEAPON CODEX',
        x: CODEX_POS.x,
        y: CODEX_POS.y,
      };
      return;
    }

    const dummyDist = Math.hypot(this.player.x - DUMMY_POS.x, this.player.y - DUMMY_POS.y);
    if (dummyDist < 62) {
      this.nearbyInteractable = {
        kind: 'dummy',
        label: 'STRIKE TRAINING DUMMY',
        x: DUMMY_POS.x,
        y: DUMMY_POS.y,
      };
      return;
    }

    let bestHero: RestingHeroSpot | null = null;
    let bestHeroDist = 54;
    for (const spot of HERO_SPOTS) {
      if (spot.classId === this.pickedClass) continue;
      const d = Math.hypot(this.player.x - spot.x, this.player.y - spot.y);
      if (d < bestHeroDist) {
        bestHeroDist = d;
        bestHero = spot;
      }
    }

    if (bestHero) {
      const cfg = CHARACTERS.find(c => c.id === bestHero!.classId);
      this.nearbyInteractable = {
        kind: 'hero',
        heroId: bestHero.classId,
        label: `INSPECT ${cfg ? cfg.name.toUpperCase() : bestHero.classId.toUpperCase()}`,
        x: bestHero.x,
        y: bestHero.y,
      };
      return;
    }

    this.nearbyInteractable = null;
  }

  private spawnBurst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 40 + Math.random() * 85;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 2.5,
        color,
        alpha: 1,
        life: 0.4,
        maxLife: 0.4,
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, scale: number = 1) {
    this.floatingTexts.push({
      id: `hft_${Math.random()}`,
      x,
      y,
      vy: -28,
      text,
      color,
      alpha: 1,
      scale,
    });
  }

  private updateVFX(dt: number) {
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      return p.life > 0;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => {
      ft.alpha -= dt * 1.4;
      ft.y += ft.vy * dt;
      return ft.alpha > 0;
    });
  }

  public render(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(this.camera.scale, this.camera.scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    const t = Date.now() * 0.005;

    // 1. Draw Guild House Floor, Stone Walls & Northern Portal Sanctuary
    this.drawHouseArchitecture(ctx, t);

    // 2. Draw Carpets, Rugs & Floor Details
    this.drawRugsAndFloorDecor(ctx, t);

    // 3. Draw Solid Furniture, Hearth, Bookshelves, Alchemy Lab, Shrine, Dummy & Dungeon Portal
    this.drawHouseFurniture(ctx, t);
    this.drawDungeonPortal(ctx, t);

    // 4. Depth-Sorted Entities (11 or 12 Resting Heroes + Active Walking Player Hero)
    const drawList: Array<{ y: number; draw: () => void }> = [];

    const restCycle = [5, 6, 7, 6];
    for (let idx = 0; idx < HERO_SPOTS.length; idx++) {
      const spot = HERO_SPOTS[idx];
      if (spot.classId === this.pickedClass) continue; // Active hero is walking around!

      drawList.push({
        y: spot.y,
        draw: () => this.drawRestingHeroAtSpot(ctx, spot, idx, restCycle, t),
      });
    }

    if (this.pickedClass) {
      drawList.push({
        y: this.player.y,
        draw: () => this.drawActivePlayerHero(ctx),
      });
    }

    drawList.sort((a, b) => a.y - b.y);
    drawList.forEach(item => item.draw());

    // 5. Walk-To-Point Indicator Ring
    if (this.walkTarget && this.pickedClass) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.walkTarget.x, this.walkTarget.y, 9 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Particles & Floating Damage/Status Text
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    });

    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `bold ${Math.round(10 * ft.scale)}px "Press Start 2P", monospace`;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawHouseArchitecture(ctx: CanvasRenderingContext2D, t: number) {
    // Exterior shadow frame
    ctx.fillStyle = '#040509';
    ctx.fillRect(36, 8, HOUSE_WIDTH - 72, HOUSE_HEIGHT - 24);

    // Northern Portal Sanctuary Stone Floor (416..624, 24..168)
    ctx.fillStyle = '#1e2436';
    ctx.fillRect(416, 24, 208, 148);
    for (let py = 28; py < 168; py += 28) {
      for (let px = 420; px < 620; px += 32) {
        ctx.fillStyle = ((px + py) / 4) % 2 === 0 ? '#232a3f' : '#1b2030';
        ctx.fillRect(px, py, 30, 26);
      }
    }

    // Warm Honey-Oak Plank Flooring in Main Guild Hall (56..984, 152..604)
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(56, 152, HOUSE_WIDTH - 112, HOUSE_HEIGHT - 196);

    const plankH = 22;
    const plankW = 68;
    for (let row = 0; row * plankH < HOUSE_HEIGHT - 196; row++) {
      const py = 152 + row * plankH;
      const stagger = (row % 2) * 34;
      for (let col = -1; col * plankW < HOUSE_WIDTH - 112; col++) {
        const px = Math.max(56, 56 + col * plankW + stagger);
        const endX = Math.min(HOUSE_WIDTH - 56, 56 + (col + 1) * plankW + stagger);
        const w = endX - px;
        if (w <= 0) continue;

        ctx.fillStyle = (row + col) % 3 === 0 ? '#6b4427' : (row + col) % 2 === 0 ? '#613d23' : '#56351e';
        ctx.fillRect(px, py, w, plankH - 1);

        // Subtle top plank highlight & nail studs
        ctx.fillStyle = 'rgba(255, 235, 200, 0.05)';
        ctx.fillRect(px, py, w, 2);
        ctx.fillStyle = 'rgba(20, 10, 4, 0.45)';
        ctx.fillRect(px, py + plankH - 1, w, 1);
        ctx.fillRect(endX - 1, py, 1, plankH);
      }
    }

    // Chiseled Stone & Timber Perimeter Walls
    const wallDark = '#293042';
    const wallTop = '#475569';
    const timber = '#451a03';

    // North Wall (split around the Portal Alcove 416..624)
    ctx.fillStyle = wallDark;
    ctx.fillRect(52, 134, 368, 26);
    ctx.fillRect(620, 134, HOUSE_WIDTH - 672, 26);
    ctx.fillStyle = wallTop;
    ctx.fillRect(52, 134, 368, 7);
    ctx.fillRect(620, 134, HOUSE_WIDTH - 672, 7);

    // Portal Alcove Walls (North, Left, Right)
    ctx.fillStyle = wallDark;
    ctx.fillRect(408, 16, 224, 18);
    ctx.fillRect(408, 16, 16, 144);
    ctx.fillRect(616, 16, 16, 144);
    ctx.fillStyle = wallTop;
    ctx.fillRect(408, 16, 224, 6);
    ctx.fillRect(408, 16, 5, 144);
    ctx.fillRect(616, 16, 5, 144);

    // West, East, and South Perimeter Walls
    ctx.fillStyle = wallDark;
    ctx.fillRect(52, 134, 18, HOUSE_HEIGHT - 176);
    ctx.fillRect(HOUSE_WIDTH - 70, 134, 18, HOUSE_HEIGHT - 176);
    ctx.fillRect(52, HOUSE_HEIGHT - 46, HOUSE_WIDTH - 104, 18);

    ctx.fillStyle = wallTop;
    ctx.fillRect(52, 134, 5, HOUSE_HEIGHT - 176);
    ctx.fillRect(HOUSE_WIDTH - 70, 134, 5, HOUSE_HEIGHT - 176);
    ctx.fillRect(52, HOUSE_HEIGHT - 46, HOUSE_WIDTH - 104, 5);

    // Warm Timber Corner Pillars
    ctx.fillStyle = timber;
    ctx.fillRect(50, 132, 22, 26);
    ctx.fillRect(HOUSE_WIDTH - 72, 132, 22, 26);
    ctx.fillRect(406, 132, 20, 28);
    ctx.fillRect(614, 132, 20, 28);

    // Moonlit Windows on West & East Walls casting soft blue light beams
    for (const wy of [255, 425]) {
      // West window
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(56, wy, 10, 38);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.beginPath();
      ctx.moveTo(70, wy);
      ctx.lineTo(132, wy + 12);
      ctx.lineTo(132, wy + 54);
      ctx.lineTo(70, wy + 38);
      ctx.closePath();
      ctx.fill();

      // East window
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(HOUSE_WIDTH - 66, wy, 10, 38);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.beginPath();
      ctx.moveTo(HOUSE_WIDTH - 70, wy);
      ctx.lineTo(HOUSE_WIDTH - 132, wy + 12);
      ctx.lineTo(HOUSE_WIDTH - 132, wy + 54);
      ctx.lineTo(HOUSE_WIDTH - 70, wy + 38);
      ctx.closePath();
      ctx.fill();
    }

    // Flickering Warm Wall Torches
    const torchSpots = [
      { x: 255, y: 152 },
      { x: 392, y: 152 },
      { x: 648, y: 152 },
      { x: 756, y: 152 },
      { x: 432, y: 42 },
      { x: 608, y: 42 },
    ];
    torchSpots.forEach((ts, i) => {
      const flick = Math.sin(t * 2.2 + i * 1.4) * 2;
      const grad = ctx.createRadialGradient(ts.x, ts.y, 2, ts.x, ts.y, 48 + flick);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, 48 + flick, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ts.x - 3, ts.y, 6, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(ts.x - 3, ts.y - 6, 6, 6);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ts.x - 1.5, ts.y - 4, 3, 4);
    });
  }

  private drawRugsAndFloorDecor(ctx: CanvasRenderingContext2D, t: number) {
    // 1. Royal Runner Carpet leading from Central Lounge straight north into the Dungeon Portal!
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(492, 108, 56, 152);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.strokeRect(496, 110, 48, 148);

    // Animated directional chevrons on portal runner guiding players to the Portal
    const pulse = 0.35 + Math.sin(t * 1.8) * 0.2;
    ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
    ctx.lineWidth = 2;
    for (let cy = 225; cy >= 135; cy -= 28) {
      ctx.beginPath();
      ctx.moveTo(510, cy + 6);
      ctx.lineTo(520, cy);
      ctx.lineTo(530, cy + 6);
      ctx.stroke();
    }

    // 2. Grand Central Crimson & Gold Living Room Carpet
    ctx.fillStyle = '#881337';
    ctx.fillRect(374, 254, 292, 186);
    ctx.fillStyle = '#9f1239';
    ctx.fillRect(384, 264, 272, 166);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(382, 262, 276, 170);

    // 3. Arcane Study Starry Rug (West Wing)
    ctx.fillStyle = '#312e81';
    ctx.fillRect(116, 224, 188, 176);
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(122, 230, 176, 164);
    ctx.strokeStyle = 'rgba(199, 210, 254, 0.25)';
    ctx.beginPath();
    ctx.arc(210, 312, 46, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Tatami & Woodland Mat (South-West)
    ctx.fillStyle = '#365314';
    ctx.fillRect(136, 468, 326, 86);
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(140, 472, 318, 78);

    // 5. Alchemy & Forge Slate Mat (East Wing)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(768, 224, 164, 194);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(772, 228, 156, 186);

    // 6. Bearskin Trophy Rug (South-East)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(664, 474, 102, 72);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(670, 480, 90, 60);
  }

  private drawHouseFurniture(ctx: CanvasRenderingContext2D, t: number) {
    // 1. Roaring Stone Hearth Fireplace (x: 272..344, y: 150..186)
    ctx.fillStyle = '#334155';
    ctx.fillRect(270, 146, 76, 40);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(284, 156, 48, 28);
    // Warm hearth floor glow
    const fireGlow = ctx.createRadialGradient(308, 188, 6, 308, 210, 115);
    fireGlow.addColorStop(0, 'rgba(249, 115, 22, 0.32)');
    fireGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(308, 200, 115, 0, Math.PI * 2);
    ctx.fill();
    // Crackling pixel logs & flames
    ctx.fillStyle = '#78350f';
    ctx.fillRect(290, 174, 36, 6);
    const fH = 12 + Math.sin(t * 3.2) * 3;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(292, 176 - fH, 32, fH);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(298, 176 - fH * 0.7, 20, fH * 0.7);

    // 2. Arcane Bookshelves & Weapon Codex (x: 96..252, y: 148..188)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(96, 146, 156, 42);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(100, 150, 148, 34);
    const bookColors = ['#ef4444', '#38bdf8', '#a855f7', '#22c55e', '#fbbf24', '#f472b6'];
    for (let bx = 104; bx < 242; bx += 8) {
      ctx.fillStyle = bookColors[(bx / 8) % bookColors.length];
      ctx.fillRect(bx, 154, 6, 12);
      ctx.fillStyle = bookColors[(bx / 8 + 2) % bookColors.length];
      ctx.fillRect(bx, 170, 6, 12);
    }
    // Floating Codex Icon hint
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#fcd34d';
    ctx.textAlign = 'center';
    ctx.fillText('CODEX', CODEX_POS.x, 142);

    // 3. Soul Gem Talent Shrine (x: 334..366, y: 186..218)
    ctx.fillStyle = '#334155';
    ctx.fillRect(334, 194, 32, 24);
    ctx.fillStyle = '#475569';
    ctx.fillRect(338, 188, 24, 10);
    // Floating pulsing Soul Gem crystal
    const gemBob = Math.sin(t * 1.8) * 3;
    ctx.save();
    ctx.fillStyle = '#a855f7';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(350, 166 + gemBob);
    ctx.lineTo(360, 178 + gemBob);
    ctx.lineTo(350, 190 + gemBob);
    ctx.lineTo(340, 178 + gemBob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#d8b4fe';
    ctx.textAlign = 'center';
    ctx.fillText('TALENTS', 350, 160);

    // 4. Alchemy Lab Bench (x: 776..924, y: 150..190)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(776, 154, 148, 36);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(780, 158, 140, 26);
    // Bubbling flasks
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(796, 162, 10, 14);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(822, 164, 12, 12);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(854, 161, 9, 15);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(884, 164, 18, 12);

    // 5. Artificer Workbench & Anvil (x: 924..966, y: 332..418)
    ctx.fillStyle = '#334155';
    ctx.fillRect(924, 332, 42, 86);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(930, 342, 30, 42); // Blueprint schematic
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(932, 394, 26, 16);

    // 6. Central Plush Sofas & Oak Coffee Table
    // Left crimson sofa
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(338, 274, 32, 82);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(344, 280, 24, 70);
    // Right crimson sofa
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(670, 274, 32, 82);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(672, 280, 24, 70);
    // Coffee Table
    ctx.fillStyle = '#451a03';
    ctx.fillRect(476, 324, 88, 44);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(480, 328, 80, 36);
    //Dungeon map & golden mugs on coffee table
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(496, 334, 32, 22);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(540, 336, 8, 9);
    ctx.fillRect(540, 350, 8, 9);

    // 7. Indoor Potted Grove Planters (South-West) & Mead Barrels (South-East)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(86, 468, 34, 72);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(103, 484, 18, 0, Math.PI * 2);
    ctx.arc(103, 520, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(97, 478, 10, 8);
    ctx.fillRect(98, 514, 10, 8);

    // Mead Barrels
    ctx.fillStyle = '#78350f';
    ctx.fillRect(768, 526, 26, 32);
    ctx.fillRect(798, 526, 26, 32);
    ctx.fillStyle = '#334155';
    ctx.fillRect(768, 534, 26, 4);
    ctx.fillRect(798, 534, 26, 4);

    // 8. Guild Training Dummy (x: 874, y: 510)
    ctx.save();
    ctx.translate(DUMMY_POS.x, DUMMY_POS.y);
    if (this.dummyHitWobble > 0) {
      ctx.rotate(Math.sin(t * 14) * 0.25 * this.dummyHitWobble);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-3, -6, 6, 20); // Wooden post
    ctx.fillRect(-16, -8, 32, 5); // Crossbar arms
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-9, -14, 18, 18); // Straw torso
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-7, -25, 14, 11); // Straw head
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-4, -8, 8, 8); // Bullseye target painted on chest
    ctx.restore();

    ctx.textAlign = 'left';
  }

  private drawDungeonPortal(ctx: CanvasRenderingContext2D, t: number) {
    const px = PORTAL_POS.x;
    const py = PORTAL_POS.y;

    ctx.save();
    // Carved Rune Pillars flanking the Portal Gate
    ctx.fillStyle = '#334155';
    ctx.fillRect(px - 56, py - 26, 18, 52);
    ctx.fillRect(px + 38, py - 26, 18, 52);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px - 50, py - 14, 6, 26);
    ctx.fillRect(px + 44, py - 14, 6, 26);

    // Ambient Radial Portal Floor Illumination
    const grad = ctx.createRadialGradient(px, py, 6, px, py, 74);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
    grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 74, 0, Math.PI * 2);
    ctx.fill();

    // Outer Swirling Violet Ring
    ctx.strokeStyle = '#a855f7';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(px, py, 32, 0, Math.PI * 2);
    ctx.stroke();

    // Dimensional Vortex Fill
    ctx.fillStyle = 'rgba(126, 34, 206, 0.55)';
    ctx.beginPath();
    ctx.arc(px, py, 28, 0, Math.PI * 2);
    ctx.fill();

    // Counter-Rotating Cyan Arcane Arcs
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 19, t * 1.4, t * 1.4 + Math.PI * 1.35);
    ctx.stroke();

    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 11, -t * 2, -t * 2 + Math.PI * 1.3);
    ctx.stroke();

    // Bright Singularity Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 5 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Portal Banner Label
    ctx.shadowBlur = 0;
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#090d16';
    ctx.fillRect(px - 62, py - 50, 124, 14);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 62, py - 50, 124, 14);
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText('DUNGEON PORTAL', px, py - 40);
    ctx.restore();
  }

  private drawRestingHeroAtSpot(
    ctx: CanvasRenderingContext2D,
    spot: RestingHeroSpot,
    idx: number,
    restCycle: number[],
    t: number
  ) {
    const cfg = CHARACTERS.find(c => c.id === spot.classId) || CHARACTERS[0];
    const starterWeapon = WEAPON_REGISTRY[cfg.startingWeaponId];
    const frame = restCycle[Math.floor(t * 0.45 + idx * 0.7) % restCycle.length];
    const isHovered = this.hoveredHero === spot.classId;
    const isNearby = this.nearbyInteractable?.heroId === spot.classId;

    ctx.save();

    // Cozy shadow / highlight ring under resting hero
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y + 13, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isHovered || isNearby || !this.pickedClass) {
      ctx.strokeStyle = isHovered || isNearby ? '#fbbf24' : 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = isHovered || isNearby ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y + 11, 20, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Propped starter weapon resting neatly beside the hero (Knight & Mage render their iconic resting gear natively!)
    if (starterWeapon && spot.classId !== 'knight' && spot.classId !== 'mage') {
      const side = spot.facingRight ? 16 : -16;
      ctx.save();
      ctx.translate(spot.x + side, spot.y + 8);
      ctx.rotate(spot.facingRight ? -0.45 : -2.65);
      WeaponRenderer.drawWeaponSprite(ctx, starterWeapon, 0, 0, 0.85, 0, false);
      ctx.restore();
    }

    // Render Hero in Seated Resting Camp Animation
    GameRenderer.drawHeroCharacter(ctx, {
      classId: spot.classId,
      x: spot.x,
      y: spot.y,
      facingRight: spot.facingRight,
      rotation: spot.facingRight ? 0 : Math.PI,
      walkCycle: 0,
      animState: 'rest',
      animFrame: frame,
      weapon: null,
    });

    // Clean Hero Nameplate above head when in Selection Mode, Hovered, or Nearby!
    if (!this.pickedClass || isHovered || isNearby) {
      const isUnlocked = skillTreeManager.isHeroUnlocked(spot.classId);
      const label = isUnlocked
        ? cfg.name
        : isHovered || isNearby
        ? `🔒 ${cfg.name} (${cfg.unlockCost}G)`
        : `🔒 ${cfg.name}`;
      ctx.font = 'bold 7px "Press Start 2P", monospace';
      const tw = ctx.measureText(label).width;
      const bw = tw + 10;
      const bx = spot.x - bw / 2;
      const by = spot.y - 38;

      ctx.fillStyle = isHovered || isNearby ? 'rgba(15, 23, 42, 0.96)' : 'rgba(9, 13, 22, 0.82)';
      ctx.fillRect(bx, by, bw, 13);
      ctx.strokeStyle = isHovered || isNearby ? '#fbbf24' : isUnlocked ? cfg.spriteColor : '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 13);

      ctx.fillStyle = isHovered || isNearby ? '#fde047' : isUnlocked ? '#f1f5f9' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(label, spot.x, by + 9.5);
    }

    ctx.restore();
  }

  private drawActivePlayerHero(ctx: CanvasRenderingContext2D) {
    if (!this.pickedClass) return;
    const cfg = CHARACTERS.find(c => c.id === this.pickedClass) || CHARACTERS[0];
    const starterWeapon = WEAPON_REGISTRY[cfg.startingWeaponId] || WEAPON_REGISTRY['bad_pistol'];

    ctx.save();
    // Active Player Ring & Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.player.x, this.player.y + 14, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y + 12, 18, this.player.rotation - 0.5, this.player.rotation + 0.5);
    ctx.stroke();

    GameRenderer.drawHeroCharacter(ctx, {
      classId: this.pickedClass,
      x: this.player.x,
      y: this.player.y,
      facingRight: this.player.facingRight,
      rotation: this.player.rotation,
      walkCycle: this.player.walkCycle,
      animState: this.player.animState,
      animFrame: this.player.animFrame,
      weapon: starterWeapon,
      weaponRecoil: this.player.weaponRecoil,
    });

    // Subtle "YOU" badge above active hero
    ctx.font = 'bold 7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeText(`▼ ${cfg.name.toUpperCase()}`, this.player.x, this.player.y - 34);
    ctx.fillText(`▼ ${cfg.name.toUpperCase()}`, this.player.x, this.player.y - 34);
    ctx.restore();
  }
}
