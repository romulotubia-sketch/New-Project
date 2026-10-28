/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHARACTERS, DIFFICULTY_CONFIGS, TILE_SIZE, WEAPON_REGISTRY } from './constants';
import { DungeonEventsManager } from './dungeonEvents';
import { DungeonGenerator } from './dungeonGenerator';
import { skillTreeManager } from './skillTree';
import { sounds } from './sound';
import {
  ActiveSkillEffects,
  Bullet,
  CharacterClass,
  DifficultyId,
  DropItem,
  DungeonFloor,
  DungeonRoom,
  EndOfRunRewardSummary,
  Enemy,
  FloatingText,
  Obstacle,
  Particle,
  PassiveBuffs,
  Player,
  Skill,
  Vector2D,
  Weapon,
} from './types';

export const PASSAGE_HALF_WIDTH = 30;

export class GameEngine {
  public player: Player;
  public floor: DungeonFloor;
  public difficulty: DifficultyId = 'medium';
  public bullets: Bullet[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public passiveBuffs: PassiveBuffs;
  public camera = { x: 0, y: 0 };
  public screenShake = 0;
  public isPaused = false;
  public isAwaitingRevive = false;
  public isAwaitingPortalConfirm = false;
  public revivesUsed = 0;
  public readonly maxRevives = 2;
  public readonly reviveCost = 100;
  public isGameOver = false;
  public isVictory = false;
  public isMapExpanded = false;
  public lastTimestamp = 0;

  public activeEffects: ActiveSkillEffects = {
    poisonPools: [],
    consecrationZones: [],
    sanctuaryDomes: [],
    turrets: [],
    clones: [],
    orbitalShields: [],
    mechaGolems: [],
    minions: [],
    lightningBolts: [],
    shockwaves: [],
    skyBeams: [],
    slashArcs: [],
    auras: {
      berserkTimer: 0,
      flameBarrierTimer: 0,
      blizzardTimer: 0,
      astralOverloadTimer: 0,
      stealthTimer: 0,
      archangelTimer: 0,
      wraithTimer: 0,
      lichTimer: 0,
      aegisAbsorbTimer: 0,
      undyingTimer: 0,
      bloodboilTimer: 0,
      killMomentumTimer: 0,
    },
  };

  // Ultimate, Skill & Exclusive Buff Active Timers / Counters
  public berserkTimer = 0;
  public flameBarrierTimer = 0;
  public blizzardTimer = 0;
  public astralOverloadTimer = 0;
  public stealthTimer = 0;
  public archangelTimer = 0;
  public wraithTimer = 0;
  public lichTimer = 0;
  public aegisAbsorbTimer = 0;
  public undyingTimer = 0;
  public bloodboilTimer = 0;
  public bloodboilHealsLeft = 0;
  public ragnarokTimer = 0;
  public overchargeSpeedTimer = 0;
  public killMomentumTimer = 0;
  public guaranteedCrit = false;
  public shotCounter = 0;
  public critHitCounter = 0;
  public killCounter = 0;
  public normalKills = 0;
  public eliteKills = 0;
  public bossKills = 0;
  public baseKillGems = 0;
  public rewardsClaimed = false;
  public claimedRewardSummary: EndOfRunRewardSummary | null = null;
  public overhealStacks = 0;

  // Input & Targeting states
  public keys: Record<string, boolean> = {};
  public joystick = { x: 0, y: 0, active: false };
  public keyboardStick = { x: 0, y: 0, active: false };
  public lastMoveAngle = 0;
  public mousePos = { x: 0, y: 0 };
  public worldMousePos = { x: 0, y: 0 };
  public isMouseDown = false;
  public shootTimer = 0;
  public interactPrompt: string | null = null;
  public nearbyInteractable: { type: 'chest' | 'weapon' | 'statue' | 'portal' | 'event'; action: () => void } | null = null;
  private lastInteractTimestamp = 0;
  private lastSwitchTimestamp = 0;

  // Automatic Enemy Targeting (Soul Knight style)
  public currentTarget: Enemy | null = null;
  public crosshairPos = { x: 0, y: 0 };

  // Dropped weapon inspection state
  public nearbyWeaponDrop: DropItem | null = null;

  constructor(
    characterId: CharacterClass = 'knight',
    selectedSkills?: Skill[],
    difficulty: DifficultyId = 'medium'
  ) {
    this.difficulty = DIFFICULTY_CONFIGS[difficulty] ? difficulty : 'medium';
    skillTreeManager.setActiveHero(characterId);
    this.passiveBuffs = skillTreeManager.calculatePassiveBuffs(characterId);
    const config = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
    const starterWeapon = WEAPON_REGISTRY[config.startingWeaponId] || WEAPON_REGISTRY['bad_pistol'];

    // Select skills: exactly 2 normal + 1 ultimate (3 usable skills in a run)
    let skills: Skill[];
    if (selectedSkills && selectedSkills.length === 3) {
      skills = JSON.parse(JSON.stringify(selectedSkills));
      skills[0].keyHint = 'SPACE';
      skills[0].currentCooldown = 0;
      skills[1].keyHint = 'E';
      skills[1].currentCooldown = 0;
      skills[2].keyHint = 'R';
      skills[2].currentCooldown = 0;
      skills[2].isUltimate = true;
    } else {
      skills = JSON.parse(JSON.stringify(config.skills));
    }

    // Increased stats from chosen Ultimate Skill + Hero's 2 Exclusive Buffs:
    const ultimateSkill = skills.find(s => s.isUltimate);
    const exclusiveHp = config.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusHp || 0), 0);
    const exclusiveShield = config.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusShield || 0), 0);
    const exclusiveEnergy = config.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusEnergy || 0), 0);
    const exclusiveSpeed = config.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusSpeed || 0), 0);
    const exclusiveCrit = config.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusCrit || 0), 0);

    const ultimateBonusHp = (ultimateSkill?.bonusHp || 0) + exclusiveHp;
    const ultimateBonusShield = (ultimateSkill?.bonusShield || 0) + exclusiveShield;
    const ultimateBonusEnergy = (ultimateSkill?.bonusEnergy || 0) + exclusiveEnergy;
    const ultimateBonusSpeed = (ultimateSkill?.bonusSpeed || 0) + exclusiveSpeed;
    const ultimateBonusCrit = (ultimateSkill?.bonusCrit || 0) + exclusiveCrit;

    const totalMaxHp = config.maxHp + this.passiveBuffs.bonusMaxHp + ultimateBonusHp;
    const totalMaxShield = config.maxShield + this.passiveBuffs.bonusMaxShield + ultimateBonusShield;
    const totalMaxEnergy = config.maxEnergy + this.passiveBuffs.bonusMaxEnergy + ultimateBonusEnergy;
    const totalSpeed = config.speed + ultimateBonusSpeed;

    this.player = {
      classId: config.id,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 14,
      rotation: 0,
      hp: totalMaxHp,
      maxHp: totalMaxHp,
      shield: totalMaxShield,
      maxShield: totalMaxShield,
      energy: totalMaxEnergy,
      maxEnergy: totalMaxEnergy,
      speed: totalSpeed,
      coins: 0,
      soulGems: skillTreeManager.getSoulGems(),
      weapons: [starterWeapon],
      currentWeaponIndex: 0,
      skills,
      exclusiveBuffs: config.exclusiveBuffs,
      shieldRegenTimer: 0,
      shieldDelayTimer: 0,
      invulnerableTimer: 0,
      dualWieldTimer: 0,
      fortressShieldTimer: 0,
      facingRight: true,
      walkCycle: 0,
      animState: 'idle',
      animFrame: 0,
      animTimer: 0,
      idleTimer: 0,
      manualRest: false,
      weaponRecoil: 0,
    };

    this.applyHeroInnatePassiveFlags(config.critBonus + ultimateBonusCrit);

    // Generate initial floor 1-1 scaled to selected difficulty
    this.floor = DungeonGenerator.generateFloor(1, this.difficulty);
    this.positionPlayerAtStart();
    if (this.hasExclusiveBuff('druid_pack_bond')) {
      this.spawnDruidPackWolf();
    }
    sounds.startChiptune();
  }

  public hasExclusiveBuff(buffId: string): boolean {
    return this.player.exclusiveBuffs.some(b => b.id === buffId);
  }

  public applyHeroInnatePassiveFlags(extraCritRate: number = 0) {
    this.passiveBuffs.critRateBonus += extraCritRate;
    if (this.hasExclusiveBuff('alchemist_corrosive_brew') || this.hasExclusiveBuff('druid_verdant_bloom')) {
      this.passiveBuffs.trapImmunity = true;
    }
    if (this.hasExclusiveBuff('paladin_radiant_nova')) {
      this.passiveBuffs.shieldDelayReduction += 0.8;
    }
  }

  private spawnDruidPackWolf() {
    const hasActiveWolf = this.activeEffects.minions.some(m => m.id === 'druid_loyal_wolf' && m.hp > 0);
    if (hasActiveWolf) return;
    this.activeEffects.minions.push({
      id: 'druid_loyal_wolf',
      kind: 'alpha_wolf',
      x: this.player.x + 28,
      y: this.player.y + 12,
      hp: 110,
      maxHp: 110,
      damage: 22,
      speed: 225,
      timer: 999,
      attackTimer: 0.25,
      facingRight: true,
    });
  }

  public setJoystick(x: number, y: number, active: boolean) {
    this.joystick.x = x;
    this.joystick.y = y;
    this.joystick.active = active;

    const mag = Math.hypot(x, y);
    if (active && mag > 0.06) {
      this.lastMoveAngle = Math.atan2(y, x);
      if (!this.isMouseDown || !this.currentTarget) {
        this.player.rotation = this.lastMoveAngle;
        const cosA = Math.cos(this.lastMoveAngle);
        if (Math.abs(cosA) > 0.05) {
          this.player.facingRight = cosA >= 0;
        }
      }
    }
  }

  public toggleMap() {
    this.isMapExpanded = !this.isMapExpanded;
  }

  public toggleRest() {
    if (this.player.animState === 'rest') {
      this.player.manualRest = false;
      this.player.idleTimer = 0;
      this.player.animState = 'idle';
      this.player.animFrame = 0;
      this.player.animTimer = 0;
    } else {
      this.player.manualRest = true;
      this.player.animState = 'rest';
      this.player.animFrame = 0;
      this.player.animTimer = 0;
    }
  }

  public positionPlayerAtStart() {
    const startRoom = this.floor.rooms.find(r => r.type === 'start') || this.floor.rooms[0];
    startRoom.isDiscovered = true;
    startRoom.doors.forEach(d => {
      const neighbor = this.floor.rooms[d.targetRoomIndex];
      if (neighbor) neighbor.isAdjacentDiscovered = true;
    });
    this.player.x = startRoom.pixelX + (startRoom.width * TILE_SIZE) / 2;
    this.player.y = startRoom.pixelY + (startRoom.height * TILE_SIZE) / 2 + 56;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  public update(dt: number, viewportWidth: number, viewportHeight: number) {
    if (
      this.isPaused ||
      this.isAwaitingRevive ||
      this.isAwaitingPortalConfirm ||
      this.isGameOver ||
      this.isVictory
    ) {
      return;
    }

    // Clamp dt
    dt = Math.min(dt, 0.05);

    // Calculate World Mouse Position
    this.worldMousePos = {
      x: this.mousePos.x - viewportWidth / 2 + this.camera.x,
      y: this.mousePos.y - viewportHeight / 2 + this.camera.y,
    };

    // 1. Update Player Movement & Timers
    this.updatePlayer(dt);

    // 2. Frame-rate independent smooth camera follow
    const camAlpha = 1 - Math.exp(-15 * dt);
    this.camera.x += (this.player.x - this.camera.x) * camAlpha;
    this.camera.y += (this.player.y - this.camera.y) * camAlpha;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 3.5);
    }

    // 3. Update Current Room logic (combat, wave triggering, doors)
    this.updateRoomLogic();

    // 4. Automatic Enemy Targeting & Crosshair Tracking (Soul Knight style)
    this.updateAutoTargeting(viewportWidth, viewportHeight);

    // 5. Update Weapons and Shooting
    this.updateShooting(dt);

    // 6. Update Skills cooldowns & active buff timers
    this.updateSkills(dt);

    // 7. Update Active Skill Effects (turrets, pools, clones, minions, VFX)
    this.updateSkillEffects(dt);

    // 8. Update Bullets
    this.updateBullets(dt);

    // 9. Update Enemies
    this.updateEnemies(dt);

    // 10. Update Drops (picking up coins, energy, gems)
    this.updateDrops(dt);

    // 11. Update Particles & Floating Text
    this.updateVFX(dt);

    // 12. Check Interactables
    this.checkInteractables();
  }

  private updatePlayer(dt: number) {
    let moveX = 0;
    let moveY = 0;

    const rawJoyMag = Math.hypot(this.joystick.x, this.joystick.y);
    const deadzone = 0.06;

    if (this.joystick.active && rawJoyMag > deadzone) {
      // Smooth 360-degree analog response curve (reaches 100% speed at 76% deflection for effortless thumb control)
      const normalizedMag = Math.min(1, (rawJoyMag - deadzone) / (0.76 - deadzone));
      const joyAngle = Math.atan2(this.joystick.y, this.joystick.x);
      moveX = Math.cos(joyAngle) * normalizedMag;
      moveY = Math.sin(joyAngle) * normalizedMag;
      this.keyboardStick.x = 0;
      this.keyboardStick.y = 0;
      this.keyboardStick.active = false;
    } else {
      let kx = 0;
      let ky = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) ky -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) ky += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;

      if (kx !== 0 && ky !== 0) {
        kx *= 0.70710678;
        ky *= 0.70710678;
      }
      moveX = kx;
      moveY = ky;
      this.keyboardStick.x = kx;
      this.keyboardStick.y = ky;
      this.keyboardStick.active = kx !== 0 || ky !== 0;
    }

    const inputMag = Math.hypot(moveX, moveY);
    if (inputMag > 0.04) {
      this.lastMoveAngle = Math.atan2(moveY, moveX);
    }

    // Dynamic movement speed multipliers from active skills & talents
    let speedMult = 1.0;
    if (this.berserkTimer > 0) speedMult *= 1.38;
    if (this.stealthTimer > 0) speedMult *= 1.35;
    if (this.wraithTimer > 0) speedMult *= 1.45;
    if (this.archangelTimer > 0) speedMult *= 1.35;
    if (this.bloodboilTimer > 0) speedMult *= 1.22;
    if (this.overchargeSpeedTimer > 0) speedMult *= 1.25;
    if (this.killMomentumTimer > 0) speedMult *= 1.35;

    // Mage Exclusive Buff: Leyline Conduit (+3 MP/sec passive regeneration)
    if (this.hasExclusiveBuff('mage_leyline_surge') && this.player.energy < this.player.maxEnergy) {
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 3.0 * dt);
    }

    const currentSpeed = this.player.speed * speedMult;
    const targetVx = moveX * currentSpeed;
    const targetVy = moveY * currentSpeed;

    // Ultra-responsive velocity smoothing eliminates touch digitizer micro-jitter with zero sluggishness
    const accelAlpha = 1 - Math.exp(-32 * dt);
    this.player.vx += (targetVx - this.player.vx) * accelAlpha;
    this.player.vy += (targetVy - this.player.vy) * accelAlpha;

    if (Math.hypot(this.player.vx, this.player.vy) < 1.5 && inputMag === 0) {
      this.player.vx = 0;
      this.player.vy = 0;
    }

    const stepX = this.player.vx * dt;
    const stepY = this.player.vy * dt;

    const isMoving = Math.hypot(stepX, stepY) > 0.05 || inputMag > 0.05;

    if (stepX !== 0 || stepY !== 0) {
      const moved = this.moveWithCollision(this.player.x, this.player.y, stepX, stepY, this.player.radius);
      this.player.x = moved.x;
      this.player.y = moved.y;
      this.player.walkCycle += dt * 12 * speedMult * Math.max(0.45, inputMag);
    } else {
      this.player.walkCycle = 0;
    }

    // 8-Frame Animation State Machine (Walking / Idle / Resting)
    if (isMoving) {
      this.player.manualRest = false;
      this.player.idleTimer = 0;
      if (this.player.animState !== 'walk') {
        this.player.animState = 'walk';
        this.player.animFrame = 0;
        this.player.animTimer = 0;
      }
      this.player.animTimer += dt * 11.5 * speedMult * Math.max(0.55, inputMag);
      while (this.player.animTimer >= 1) {
        this.player.animTimer -= 1;
        this.player.animFrame = (this.player.animFrame + 1) % 8;
      }
    } else if (this.isMouseDown) {
      this.player.manualRest = false;
      this.player.idleTimer = 0;
      if (this.player.animState !== 'idle') {
        this.player.animState = 'idle';
        this.player.animFrame = 0;
        this.player.animTimer = 0;
      }
      this.player.animTimer += dt * 6;
      while (this.player.animTimer >= 1) {
        this.player.animTimer -= 1;
        this.player.animFrame = (this.player.animFrame + 1) % 8;
      }
    } else {
      this.player.idleTimer += dt;
      const roomHere = this.getCurrentRoom();
      const inHostileCombat = Boolean(roomHere && roomHere.enemies.some(e => e.hp > 0));
      const shouldRest = Boolean(this.player.manualRest || (!inHostileCombat && this.player.idleTimer >= 2.2));

      if (shouldRest) {
        if (this.player.animState !== 'rest') {
          this.player.animState = 'rest';
          this.player.animFrame = 0;
          this.player.animTimer = 0;
        } else if (this.player.animFrame < 5) {
          // Smooth crouch/kneel transition frames 0 -> 1 -> 2 -> 3 -> 4 -> 5
          this.player.animTimer += dt * 8.5;
          while (this.player.animTimer >= 1 && this.player.animFrame < 5) {
            this.player.animTimer -= 1;
            this.player.animFrame += 1;
          }
        } else {
          // Seated camp rest loop across frames 5, 6, 7 (Sheet Frames 6, 7, 8) + gentle MP recovery
          this.player.animTimer += dt * 2.1;
          const restLoop = [5, 6, 7, 6];
          this.player.animFrame = restLoop[Math.floor(this.player.animTimer) % restLoop.length];
          if (this.player.energy < this.player.maxEnergy) {
            this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 2.5 * dt);
          }
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

    // Smoothly decay weapon firing recoil
    if (this.player.weaponRecoil && this.player.weaponRecoil > 0) {
      this.player.weaponRecoil = Math.max(0, this.player.weaponRecoil - dt * 28);
    }

    // Character & Weapon face the joystick direction whenever not actively firing at a locked target
    if (!this.isMouseDown || !this.currentTarget) {
      this.player.rotation = this.lastMoveAngle;
      const cosA = Math.cos(this.lastMoveAngle);
      if (Math.abs(cosA) > 0.05) {
        this.player.facingRight = cosA >= 0;
      }
    }

    // Invulnerability timer
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer = Math.max(0, this.player.invulnerableTimer - dt);
    }

    // Dual Wield timer
    if (this.player.dualWieldTimer > 0) {
      this.player.dualWieldTimer = Math.max(0, this.player.dualWieldTimer - dt);
    }

    // Fortress Shield timer
    if (this.player.fortressShieldTimer > 0) {
      this.player.fortressShieldTimer = Math.max(0, this.player.fortressShieldTimer - dt);
    }

    // Shield Regeneration (Soul Knight mechanic: auto-recovers after 3.2s without taking damage)
    const delayRequired = Math.max(1.2, 3.2 - this.passiveBuffs.shieldDelayReduction);
    if (this.player.shield < this.player.maxShield) {
      this.player.shieldDelayTimer += dt;
      if (this.player.shieldDelayTimer >= delayRequired) {
        this.player.shieldRegenTimer += dt;
        if (this.player.shieldRegenTimer >= 0.5) {
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
          this.player.shieldRegenTimer = 0;
          sounds.shieldRecharge();
        }
      }
    } else {
      this.player.shieldDelayTimer = 0;
      this.player.shieldRegenTimer = 0;
    }
  }

  /**
   * Returns true if a circle (x, y, radius) lies strictly inside the walkable union
   * of Room Interiors and Open Connecting Passages (and does not overlap solid obstacles).
   * Prevents escaping passage walls outside rooms as well as clipping through room walls.
   */
  public isCircleInWalkableSpace(x: number, y: number, radius: number, checkObstacles: boolean = true): boolean {
    let insideArchitecture = false;

    // 1. Check all Room Interiors
    for (const room of this.floor.rooms) {
      const rx = room.pixelX;
      const ry = room.pixelY;
      const rw = room.width * TILE_SIZE;
      const rh = room.height * TILE_SIZE;

      if (
        x - radius >= rx + 16 &&
        x + radius <= rx + rw - 16 &&
        y - radius >= ry + 16 &&
        y + radius <= ry + rh - 16
      ) {
        insideArchitecture = true;
        break;
      }
    }

    // 2. Check all Open Connecting Passages (including doorway thresholds overlapping 64px into each connected room)
    if (!insideArchitecture) {
      for (const room of this.floor.rooms) {
        const isRoomLocked = !room.isCleared && room.combatStarted;
        if (isRoomLocked) continue;

        for (const door of room.doors) {
          if (door.direction !== 'east' && door.direction !== 'south') continue;

          const targetRoom = this.floor.rooms[door.targetRoomIndex];
          if (!targetRoom) continue;

          const isTargetLocked = !targetRoom.isCleared && targetRoom.combatStarted;
          if (isTargetLocked || !door.isOpen) continue;

          if (door.direction === 'east' && targetRoom.gridX > room.gridX) {
            const minX = room.pixelX + room.width * TILE_SIZE - 64;
            const maxX = targetRoom.pixelX + 64;
            const minY = door.y - PASSAGE_HALF_WIDTH;
            const maxY = door.y + PASSAGE_HALF_WIDTH;

            if (
              x - radius >= minX &&
              x + radius <= maxX &&
              y - radius >= minY &&
              y + radius <= maxY
            ) {
              insideArchitecture = true;
              break;
            }
          } else if (door.direction === 'south' && targetRoom.gridY > room.gridY) {
            const minX = door.x - PASSAGE_HALF_WIDTH;
            const maxX = door.x + PASSAGE_HALF_WIDTH;
            const minY = room.pixelY + room.height * TILE_SIZE - 64;
            const maxY = targetRoom.pixelY + 64;

            if (
              x - radius >= minX &&
              x + radius <= maxX &&
              y - radius >= minY &&
              y + radius <= maxY
            ) {
              insideArchitecture = true;
              break;
            }
          }
        }

        if (insideArchitecture) break;
      }
    }

    if (!insideArchitecture) return false;

    // 3. Check solid room obstacles (pillars, crates, barrels)
    if (checkObstacles) {
      for (const room of this.floor.rooms) {
        const rx = room.pixelX;
        const ry = room.pixelY;
        const rw = room.width * TILE_SIZE;
        const rh = room.height * TILE_SIZE;

        if (x + radius < rx || x - radius > rx + rw || y + radius < ry || y - radius > ry + rh) {
          continue;
        }

        for (const obs of room.obstacles) {
          if (obs.type === 'pillar' || obs.type === 'brazier' || obs.type === 'crate' || obs.type === 'barrel') {
            if (
              x + radius > obs.x &&
              x - radius < obs.x + obs.width &&
              y + radius > obs.y &&
              y - radius < obs.y + obs.height
            ) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  private checkWallCollision(x: number, y: number, radius: number, checkObstacles: boolean = true): boolean {
    return !this.isCircleInWalkableSpace(x, y, radius, checkObstacles);
  }

  /**
   * Moves an entity safely along (dx, dy) in small sub-steps with independent X/Y wall sliding,
   * guaranteeing walks, dashes, blinks, and charges can never cross room or passage walls.
   */
  private moveWithCollision(
    startX: number,
    startY: number,
    dx: number,
    dy: number,
    radius: number,
    checkObstacles: boolean = true
  ): Vector2D {
    const totalDist = Math.hypot(dx, dy);
    if (totalDist === 0) return { x: startX, y: startY };

    const steps = Math.max(1, Math.ceil(totalDist / 6));
    const stepX = dx / steps;
    const stepY = dy / steps;

    let cx = startX;
    let cy = startY;

    for (let i = 0; i < steps; i++) {
      const tryX = cx + stepX;
      if (!this.checkWallCollision(tryX, cy, radius, checkObstacles)) {
        cx = tryX;
      } else if (Math.abs(stepX) > 0.01 && Math.abs(stepY) < Math.abs(stepX) * 0.45) {
        // Gentle corner-slide assist around doorway frames and pillars
        const nudge = Math.min(2.2, Math.abs(stepX));
        if (!this.checkWallCollision(tryX, cy + nudge, radius, checkObstacles)) {
          cx = tryX;
          cy += nudge;
        } else if (!this.checkWallCollision(tryX, cy - nudge, radius, checkObstacles)) {
          cx = tryX;
          cy -= nudge;
        }
      }

      const tryY = cy + stepY;
      if (!this.checkWallCollision(cx, tryY, radius, checkObstacles)) {
        cy = tryY;
      } else if (Math.abs(stepY) > 0.01 && Math.abs(stepX) < Math.abs(stepY) * 0.45) {
        const nudge = Math.min(2.2, Math.abs(stepY));
        if (!this.checkWallCollision(cx + nudge, tryY, radius, checkObstacles)) {
          cx += nudge;
          cy = tryY;
        } else if (!this.checkWallCollision(cx - nudge, tryY, radius, checkObstacles)) {
          cx -= nudge;
          cy = tryY;
        }
      }
    }

    return { x: cx, y: cy };
  }

  private clampEntityToRoom(entity: { x: number; y: number; radius?: number }, room: DungeonRoom) {
    const r = entity.radius || 16;
    const minX = room.pixelX + 16 + r;
    const maxX = room.pixelX + room.width * TILE_SIZE - 16 - r;
    const minY = room.pixelY + 16 + r;
    const maxY = room.pixelY + room.height * TILE_SIZE - 16 - r;
    entity.x = Math.max(minX, Math.min(maxX, entity.x));
    entity.y = Math.max(minY, Math.min(maxY, entity.y));
  }

  public getRoomAt(x: number, y: number, margin: number = 0): DungeonRoom | null {
    for (const room of this.floor.rooms) {
      const rx = room.pixelX;
      const ry = room.pixelY;
      const rw = room.width * TILE_SIZE;
      const rh = room.height * TILE_SIZE;
      if (
        x >= rx - margin &&
        x <= rx + rw + margin &&
        y >= ry - margin &&
        y <= ry + rh + margin
      ) {
        return room;
      }
    }
    return null;
  }

  public getCurrentRoom(): DungeonRoom | null {
    return this.getRoomAt(this.player.x, this.player.y, 4);
  }

  private updateAutoTargeting(viewportWidth: number, viewportHeight: number) {
    const currentRoom = this.getCurrentRoom();
    let candidates: Enemy[] = [];

    if (currentRoom && currentRoom.enemies.length > 0) {
      candidates = currentRoom.enemies.filter(e => e.hp > 0);
    } else {
      this.floor.rooms.forEach(r => {
        if (r.enemies.length > 0) {
          r.enemies.forEach(e => {
            if (e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 560) {
              candidates.push(e);
            }
          });
        }
      });
    }

    if (candidates.length > 0) {
      let bestEnemy: Enemy | null = null;
      let bestScore = Infinity;

      const joyDirX = Math.cos(this.lastMoveAngle);
      const joyDirY = Math.sin(this.lastMoveAngle);

      for (const enemy of candidates) {
        const edx = enemy.x - this.player.x;
        const edy = enemy.y - this.player.y;
        const dist = Math.hypot(edx, edy);

        const edirX = dist > 0 ? edx / dist : 0;
        const edirY = dist > 0 ? edy / dist : 0;
        const dot = joyDirX * edirX + joyDirY * edirY;

        let score = dist;
        if (dot > 0.25) {
          score -= 150 * dot;
        }
        if (enemy.isBoss) {
          score -= 80;
        }

        if (score < bestScore) {
          bestScore = score;
          bestEnemy = enemy;
        }
      }

      this.currentTarget = bestEnemy;

      if (bestEnemy) {
        // Crosshair automatically locks onto the targeted enemy
        this.crosshairPos = {
          x: bestEnemy.x - this.camera.x + viewportWidth / 2,
          y: bestEnemy.y - this.camera.y + viewportHeight / 2,
        };

        // When firing, snap aim to locked enemy; otherwise keep character & weapon facing joystick direction
        if (this.isMouseDown) {
          const targetAngle = Math.atan2(bestEnemy.y - this.player.y, bestEnemy.x - this.player.x);
          this.player.rotation = targetAngle;
          this.player.facingRight = bestEnemy.x >= this.player.x;
        } else {
          this.player.rotation = this.lastMoveAngle;
          const cosA = Math.cos(this.lastMoveAngle);
          if (Math.abs(cosA) > 0.05) {
            this.player.facingRight = cosA >= 0;
          }
        }
        return;
      }
    }

    // No target enemy: character, weapon, and directional reticle face the joystick direction
    this.currentTarget = null;
    this.player.rotation = this.lastMoveAngle;
    const cosA = Math.cos(this.lastMoveAngle);
    if (Math.abs(cosA) > 0.05) {
      this.player.facingRight = cosA >= 0;
    }

    this.crosshairPos = {
      x: this.player.x + Math.cos(this.player.rotation) * 68 - this.camera.x + viewportWidth / 2,
      y: this.player.y + Math.sin(this.player.rotation) * 68 - this.camera.y + viewportHeight / 2,
    };
  }

  private updateRoomLogic() {
    const room = this.getCurrentRoom();
    if (!room) return;

    // Discover room for mini-map
    room.isDiscovered = true;
    room.doors.forEach(d => {
      const neighbor = this.floor.rooms[d.targetRoomIndex];
      if (neighbor) neighbor.isAdjacentDiscovered = true;
    });

    // Check if entering uncleared combat/elite/boss room
    if (!room.isCleared && (room.type === 'combat' || room.type === 'elite' || room.type === 'boss')) {
      if (!room.combatStarted) {
        // Trigger battle only when player has stepped well inside the room interior
        const margin = 54;
        const rx = room.pixelX;
        const ry = room.pixelY;
        const rw = room.width * TILE_SIZE;
        const rh = room.height * TILE_SIZE;

        const isWellInside =
          this.player.x >= rx + margin &&
          this.player.x <= rx + rw - margin &&
          this.player.y >= ry + margin &&
          this.player.y <= ry + rh - margin;

        if (isWellInside) {
          room.combatStarted = true;

          // Ensure player is safely in the interior away from doors
          this.player.x = Math.max(rx + 60, Math.min(rx + rw - 60, this.player.x));
          this.player.y = Math.max(ry + 60, Math.min(ry + rh - 60, this.player.y));

          // Lock all doors of this room AND matching neighbor doors leading into this room
          room.doors.forEach(d => {
            d.isOpen = false;
            const neighbor = this.floor.rooms[d.targetRoomIndex];
            if (neighbor) {
              neighbor.doors.forEach(nd => {
                if (nd.targetRoomIndex === room.index) nd.isOpen = false;
              });
            }
          });

          // Spawn first wave safely away from player
          room.enemies = DungeonGenerator.spawnWave(
            room,
            this.floor.floorNumber,
            { x: this.player.x, y: this.player.y },
            this.difficulty
          );
          this.addFloatingText(this.player.x, this.player.y - 30, 'BATTLE START!', '#ef4444', 1.2);

          // Engineer Exclusive Buff: Overclocked Servos auto-deploys a combat turret!
          if (this.hasExclusiveBuff('engineer_overclocked_servos')) {
            this.activeEffects.turrets.push({
              x: this.player.x + (this.player.facingRight ? 28 : -28),
              y: this.player.y + 10,
              timer: 11,
              attackTimer: 0.15,
              isVulcan: false,
            });
            this.addShockwave(this.player.x, this.player.y, 64, '#38bdf8', 0.28);
            this.addFloatingText(this.player.x, this.player.y - 46, 'SERVO TURRET READY!', '#38bdf8', 0.95);
          }

          // Druid Exclusive Buff: Alpha Guardian ensures Spirit Wolf joins the fight!
          if (this.hasExclusiveBuff('druid_pack_bond')) {
            this.spawnDruidPackWolf();
          }
        }
      } else {
        // If all enemies currently dead
        if (room.enemies.length === 0) {
          if (room.wavesRemaining > 1) {
            room.wavesRemaining--;
            room.enemies = DungeonGenerator.spawnWave(
              room,
              this.floor.floorNumber,
              { x: this.player.x, y: this.player.y },
              this.difficulty
            );
            const waveBanner = room.wavesRemaining === 1 ? 'FINAL WAVE!' : 'REINFORCEMENTS!';
            this.addFloatingText(this.player.x, this.player.y - 30, waveBanner, '#f59e0b', 1.2);
          } else {
            // Room Cleared!
            room.isCleared = true;
            room.doors.forEach(d => {
              d.isOpen = true;
              const neighbor = this.floor.rooms[d.targetRoomIndex];
              if (neighbor) {
                neighbor.doors.forEach(nd => {
                  if (nd.targetRoomIndex === room.index && (!neighbor.combatStarted || neighbor.isCleared)) {
                    nd.isOpen = true;
                  }
                });
              }
            });
            sounds.levelUp();
            this.addFloatingText(this.player.x, this.player.y - 30, 'ROOM CLEARED!', '#22c55e', 1.3);

            // Druid Exclusive Buff: Verdant Thorns restores +1 HP and +25 Energy on room clear!
            if (this.hasExclusiveBuff('druid_verdant_bloom')) {
              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
              this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 25);
              this.addFloatingText(this.player.x, this.player.y - 48, 'VERDANT BLOOM +1 HP +25 MP!', '#4ade80', 1.0);
            }

            // Spawn reward chest in cleared combat/elite room
            const chestX = room.pixelX + (room.width * TILE_SIZE) / 2;
            const chestY = room.pixelY + (room.height * TILE_SIZE) / 2;
            room.obstacles.push({
              x: chestX - 24,
              y: chestY - 24,
              width: 48,
              height: 48,
              type: 'chest',
              opened: false,
              interactPrompt: 'Press F to open Reward Chest',
            });

            // If Boss Room cleared, spawn Portal to Next Floor / Victory!
            if (room.type === 'boss') {
              this.floor.clearedRoomCount++;
              room.obstacles.push({
                x: chestX - 30,
                y: chestY - 90,
                width: 60,
                height: 60,
                type: 'portal',
                interactPrompt: 'Press F to enter Magic Portal (Next Dungeon Floor)',
              });
              sounds.chestOpen();
            }
          }
        }
      }
    }
  }

  private fireWeaponBurst(weapon: Weapon, angleOverride?: number, forceFreeEnergy: boolean = false) {
    const baseAngle = angleOverride !== undefined ? angleOverride : this.player.rotation;
    const spreadAngle = weapon.spread;

    const freeCast = forceFreeEnergy || this.astralOverloadTimer > 0 || this.lichTimer > 0;
    if (!freeCast) {
      if (this.player.energy < weapon.energyCost) {
        this.addFloatingText(this.player.x, this.player.y - 20, 'NO ENERGY!', '#38bdf8', 0.9);
        return false;
      }
      this.player.energy -= weapon.energyCost;
    }

    // Play weapon sound
    if (weapon.isMelee) {
      sounds.meleeSlash();
    } else if (weapon.type === 'laser') {
      sounds.shoot('laser');
    } else if (weapon.type === 'shotgun') {
      sounds.shoot('shotgun');
    } else if (weapon.type === 'explosive') {
      sounds.shoot('explosive');
    } else if (weapon.type === 'staff') {
      sounds.shoot('staff');
    } else {
      sounds.shoot('pistol');
    }

    this.player.weaponRecoil = weapon.isMelee ? 2.5 : 5.0;

    const wasStealthCrit = this.guaranteedCrit;
    let isCrit = false;
    if (this.berserkTimer > 0 || this.bloodboilTimer > 0 || this.guaranteedCrit) {
      isCrit = true;
      this.guaranteedCrit = false;
    } else {
      isCrit = Math.random() < weapon.critChance + this.passiveBuffs.critRateBonus;
    }

    // Breaking stealth on attack
    if (this.stealthTimer > 0) {
      this.stealthTimer = 0;
    }

    this.shotCounter++;

    let damageMult = this.passiveBuffs.damageMultiplier;
    if (isCrit) {
      let critBonusMult = this.passiveBuffs.critDamageBonus;
      if (
        this.hasExclusiveBuff('mage_elemental_mastery') &&
        (weapon.type === 'staff' || weapon.type === 'laser' || weapon.freezeChance || weapon.burnChance)
      ) {
        critBonusMult += 0.35;
      }
      damageMult *= (wasStealthCrit ? 2.0 : 1.5) + critBonusMult;
    }
    if (this.berserkTimer > 0) damageMult *= 1.4;
    if (this.bloodboilTimer > 0) damageMult *= 1.35;
    if (this.undyingTimer > 0) damageMult *= 1.45;
    if (this.hasExclusiveBuff('paladin_sanctified_armor') && this.player.shield >= 1) {
      damageMult *= 1.22;
    }
    if (this.hasExclusiveBuff('berserker_fury_blood')) {
      const missingHp = Math.max(0, this.player.maxHp - this.player.hp);
      damageMult *= 1.08 + Math.min(0.32, missingHp * 0.05);
    }

    const damage = Math.max(1, Math.round(weapon.damage * damageMult));
    const count = (weapon.bulletCount || 1) * (this.player.dualWieldTimer > 0 ? 2 : 1);

    if (weapon.isMelee) {
      let meleeReachMult = this.undyingTimer > 0 ? 1.25 : 1.0;
      if (this.hasExclusiveBuff('assassin_phantom_edge')) meleeReachMult *= 1.25;
      if (this.hasExclusiveBuff('ronin_iaido_mastery')) meleeReachMult *= 1.28;

      this.bullets.push({
        id: `melee_${Math.random()}`,
        x: this.player.x + Math.cos(baseAngle) * 20,
        y: this.player.y + Math.sin(baseAngle) * 20,
        vx: Math.cos(baseAngle) * 50,
        vy: Math.sin(baseAngle) * 50,
        radius: (weapon.meleeRadius || 50) * meleeReachMult,
        damage,
        isCrit,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 0,
        color: weapon.bulletColor,
        lifetime: 0.18,
        isMelee: true,
        meleeSweepAngle: baseAngle,
        aoeRadius: weapon.aoeRadius,
        freezeChance: weapon.freezeChance,
        burnChance: this.hasExclusiveBuff('alchemist_volatile_catalysts')
          ? Math.min(1, (weapon.burnChance || 0) + 0.25)
          : weapon.burnChance,
      });

      // Moonlight Katana & Storm Odachi fire wind/lunar crescents
      if (weapon.id === 'moonlight_katana' || weapon.id === 'storm_wakizashi') {
        const isStorm = weapon.id === 'storm_wakizashi';
        this.bullets.push({
          id: `lunar_${Math.random()}`,
          x: this.player.x + Math.cos(baseAngle) * 22,
          y: this.player.y + Math.sin(baseAngle) * 22,
          vx: Math.cos(baseAngle) * (isStorm ? 560 : 480),
          vy: Math.sin(baseAngle) * (isStorm ? 560 : 480),
          radius: isStorm ? 8 : 9,
          damage: Math.round(damage * 0.85),
          isCrit,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 0,
          color: isStorm ? '#38bdf8' : '#60a5fa',
          lifetime: 1.4,
        });
      } else if (weapon.id === 'knight_sword_shield') {
        // Knight's Sword + Shield projects a golden heraldic shield-wave bolt!
        this.bullets.push({
          id: `shield_bolt_${Math.random()}`,
          x: this.player.x + Math.cos(baseAngle) * 22,
          y: this.player.y + Math.sin(baseAngle) * 22,
          vx: Math.cos(baseAngle) * 460,
          vy: Math.sin(baseAngle) * 460,
          radius: 8,
          damage: Math.max(4, Math.round(damage * 0.72)),
          isCrit,
          fromPlayer: true,
          piercing: false,
          bouncesLeft: this.passiveBuffs.bonusBounces,
          color: '#f4a636',
          glowColor: '#fbbf24',
          lifetime: 0.85,
          freezeChance: weapon.freezeChance,
          bulletShape: 'shield_bolt',
        });
      } else if (weapon.id === 'excalibur_prime') {
        // Mythic Excalibur unleashes a colossal piercing golden sword-beam!
        this.screenShake = Math.max(this.screenShake, 0.55);
        this.bullets.push({
          id: `excalibur_${Math.random()}`,
          x: this.player.x + Math.cos(baseAngle) * 26,
          y: this.player.y + Math.sin(baseAngle) * 26,
          vx: Math.cos(baseAngle) * 680,
          vy: Math.sin(baseAngle) * 680,
          radius: 16,
          damage: Math.round(damage * 0.9),
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 0,
          color: '#fde047',
          glowColor: '#f59e0b',
          lifetime: 1.5,
          aoeRadius: 55,
          bulletShape: 'excalibur_wave',
        });
      } else if (weapon.id === 'mjolnir_breaker') {
        // Stormbreaker Axe arcs chain lightning to up to 3 nearby enemies!
        const room = this.getCurrentRoom();
        if (room && room.enemies.length > 0) {
          const nearby = room.enemies
            .filter(e => e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 195)
            .slice(0, 3);
          let prevPt = { x: this.player.x + Math.cos(baseAngle) * 20, y: this.player.y + Math.sin(baseAngle) * 20 };
          nearby.forEach(target => {
            const shockDmg = Math.max(6, Math.round(damage * 0.65));
            target.hp -= shockDmg;
            target.frozenTimer = Math.max(target.frozenTimer, 0.9);
            this.activeEffects.lightningBolts.push({
              points: [prevPt, { x: target.x, y: target.y }],
              color: '#38bdf8',
              life: 0.25,
              maxLife: 0.25,
            });
            this.addFloatingText(target.x, target.y - 14, `⚡${shockDmg}`, '#38bdf8', 1.0);
            prevPt = { x: target.x, y: target.y };
          });
        }
      }
    } else {
      const prismPalette = ['#22d3ee', '#f472b6', '#facc15'];
      for (let i = 0; i < count; i++) {
        const angleOffset =
          count > 1
            ? (i - (count - 1) / 2) * (spreadAngle / Math.max(1, count - 1))
            : (Math.random() - 0.5) * spreadAngle;
        const finalAngle = baseAngle + angleOffset;
        const hasEagleEye = this.hasExclusiveBuff('ranger_eagle_eye');
        const speed = weapon.bulletSpeed * (hasEagleEye ? 1.25 : 1.0);
        const extraEngineerBounce = this.hasExclusiveBuff('engineer_plasma_munitions') ? 1 : 0;
        const volatileBurn = this.hasExclusiveBuff('alchemist_volatile_catalysts')
          ? Math.min(1, (weapon.burnChance || 0) + 0.25)
          : weapon.burnChance;

        let shape: Bullet['bulletShape'] = undefined;
        let color = weapon.bulletColor;
        let lifetime = 2.5;
        let pullRadius: number | undefined = undefined;
        let returnTimer: number | undefined = undefined;
        let leaveFirePool = false;

        if (weapon.id === 'boomerang_glaive') {
          shape = 'glaive';
          returnTimer = 0.42;
          lifetime = 2.6;
        } else if (weapon.id === 'sawblade_launcher') {
          shape = 'sawblade';
          lifetime = 3.2;
        } else if (weapon.id === 'venom_blowgun') {
          shape = 'needle';
        } else if (weapon.id === 'gravity_orb_staff') {
          shape = 'blackhole';
          pullRadius = 135;
          lifetime = 2.4;
        } else if (weapon.id === 'phoenix_crossbow') {
          shape = 'solar_bolt';
        } else if (weapon.id === 'dragon_breath') {
          leaveFirePool = true;
          lifetime = 1.1;
        } else if (weapon.id === 'prism_railgun') {
          color = prismPalette[i % prismPalette.length];
        }

        this.bullets.push({
          id: `bullet_${Math.random()}`,
          x: this.player.x + Math.cos(finalAngle) * 16,
          y: this.player.y + Math.sin(finalAngle) * 16,
          vx: Math.cos(finalAngle) * speed,
          vy: Math.sin(finalAngle) * speed,
          radius: weapon.bulletRadius * (this.undyingTimer > 0 ? 1.35 : 1),
          damage,
          isCrit,
          fromPlayer: true,
          piercing: weapon.piercing || (hasEagleEye && isCrit) || Math.random() < this.passiveBuffs.pierceChance,
          bouncesLeft: (weapon.bounces || 0) + this.passiveBuffs.bonusBounces + extraEngineerBounce,
          color,
          lifetime,
          freezeChance: weapon.freezeChance,
          burnChance: volatileBurn,
          aoeRadius: weapon.aoeRadius,
          bulletShape: shape,
          spinAngle: 0,
          returnTimer,
          isReturning: false,
          pullRadius,
          leaveFirePool,
        });
      }
    }

    // Hero Exclusive Attack Cadence Procs:
    // A. Knight Exclusive Buff (Vanguard Tempo): every 4th attack fires a golden Heraldic Shield Bolt!
    if (this.hasExclusiveBuff('knight_vanguard_tempo') && this.shotCounter % 4 === 0) {
      this.bullets.push({
        id: `vanguard_bolt_${Math.random()}`,
        x: this.player.x + Math.cos(baseAngle) * 20,
        y: this.player.y + Math.sin(baseAngle) * 20,
        vx: Math.cos(baseAngle) * 520,
        vy: Math.sin(baseAngle) * 520,
        radius: 9,
        damage: 18,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 1,
        color: '#fbbf24',
        glowColor: '#fde047',
        lifetime: 1.1,
        freezeChance: 0.35,
        bulletShape: 'shield_bolt',
      });
    }

    // B. Ranger Exclusive Buff (Zephyr Quiver): every 3rd ranged attack looses a piercing Emerald Spirit Arrow!
    if (!weapon.isMelee && this.hasExclusiveBuff('ranger_zephyr_quiver') && this.shotCounter % 3 === 0) {
      const spiritAim = this.currentTarget
        ? Math.atan2(this.currentTarget.y - this.player.y, this.currentTarget.x - this.player.x)
        : baseAngle;
      this.bullets.push({
        id: `zephyr_arrow_${Math.random()}`,
        x: this.player.x + Math.cos(spiritAim) * 18,
        y: this.player.y + Math.sin(spiritAim) * 18,
        vx: Math.cos(spiritAim) * 780,
        vy: Math.sin(spiritAim) * 780,
        radius: 6.5,
        damage: 20,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 1,
        color: '#34d399',
        glowColor: '#4ade80',
        lifetime: 1.5,
      });
    }

    // Bonus Ultimate Weapon Waves:
    // 1. Astral Overload (Mage) -> twin bouncing cosmos stars
    if (this.astralOverloadTimer > 0) {
      for (let s = -1; s <= 1; s += 2) {
        const starAngle = baseAngle + s * 0.35;
        this.bullets.push({
          id: `star_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(starAngle) * 620,
          vy: Math.sin(starAngle) * 620,
          radius: 6,
          damage: 18,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 2,
          color: '#c084fc',
          lifetime: 2.0,
        });
      }
    }

    // 2. Berserk Rampage (Knight) / Ragnarok (Berserker) -> piercing crimson blade wave
    if (this.ragnarokTimer > 0 || (this.player.classId === 'knight' && this.berserkTimer > 5.0)) {
      this.bullets.push({
        id: `rage_wave_${Math.random()}`,
        x: this.player.x + Math.cos(baseAngle) * 18,
        y: this.player.y + Math.sin(baseAngle) * 18,
        vx: Math.cos(baseAngle) * 560,
        vy: Math.sin(baseAngle) * 560,
        radius: 10,
        damage: 22,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 0,
        color: '#ef4444',
        lifetime: 1.2,
        burnChance: 0.5,
      });
    }

    // 3. Archangel Avatar (Paladin) -> golden solar wave
    if (this.archangelTimer > 0) {
      this.bullets.push({
        id: `solar_wave_${Math.random()}`,
        x: this.player.x + Math.cos(baseAngle) * 18,
        y: this.player.y + Math.sin(baseAngle) * 18,
        vx: Math.cos(baseAngle) * 580,
        vy: Math.sin(baseAngle) * 580,
        radius: 11,
        damage: 26,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 0,
        color: '#fbbf24',
        lifetime: 1.4,
      });
    }

    return true;
  }

  private updateShooting(dt: number) {
    this.shootTimer = Math.max(0, this.shootTimer - dt);

    const weapon = this.player.weapons[this.player.currentWeaponIndex];
    if (!weapon) return;

    if (this.isMouseDown && this.shootTimer <= 0) {
      let fireMult = 1.0;
      if (this.player.dualWieldTimer > 0) fireMult *= 1.6;
      if (this.berserkTimer > 0) fireMult *= 1.45;
      if (this.astralOverloadTimer > 0) fireMult *= 2.3;
      if (this.lichTimer > 0) fireMult *= 1.85;
      if (this.undyingTimer > 0) fireMult *= 1.4;
      if (this.hasExclusiveBuff('knight_vanguard_tempo')) fireMult *= 1.2;
      if (this.hasExclusiveBuff('berserker_fury_blood')) {
        const missingHp = Math.max(0, this.player.maxHp - this.player.hp);
        fireMult *= 1.12 + Math.min(0.38, missingHp * 0.06);
      }

      const fired = this.fireWeaponBurst(weapon);
      this.shootTimer = fired ? 1 / (weapon.fireRate * fireMult) : 0.3;
    }
  }

  private updateSkills(dt: number) {
    this.player.skills.forEach(skill => {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown = Math.max(0, skill.currentCooldown - dt);
      }
    });

    if (this.berserkTimer > 0) this.berserkTimer = Math.max(0, this.berserkTimer - dt);
    if (this.flameBarrierTimer > 0) this.flameBarrierTimer = Math.max(0, this.flameBarrierTimer - dt);
    if (this.blizzardTimer > 0) this.blizzardTimer = Math.max(0, this.blizzardTimer - dt);
    if (this.astralOverloadTimer > 0) this.astralOverloadTimer = Math.max(0, this.astralOverloadTimer - dt);
    if (this.stealthTimer > 0) this.stealthTimer = Math.max(0, this.stealthTimer - dt);
    if (this.archangelTimer > 0) this.archangelTimer = Math.max(0, this.archangelTimer - dt);
    if (this.wraithTimer > 0) this.wraithTimer = Math.max(0, this.wraithTimer - dt);
    if (this.lichTimer > 0) this.lichTimer = Math.max(0, this.lichTimer - dt);
    if (this.aegisAbsorbTimer > 0) this.aegisAbsorbTimer = Math.max(0, this.aegisAbsorbTimer - dt);
    if (this.undyingTimer > 0) this.undyingTimer = Math.max(0, this.undyingTimer - dt);
    if (this.bloodboilTimer > 0) this.bloodboilTimer = Math.max(0, this.bloodboilTimer - dt);
    if (this.ragnarokTimer > 0) this.ragnarokTimer = Math.max(0, this.ragnarokTimer - dt);
    if (this.overchargeSpeedTimer > 0) this.overchargeSpeedTimer = Math.max(0, this.overchargeSpeedTimer - dt);
    if (this.killMomentumTimer > 0) this.killMomentumTimer = Math.max(0, this.killMomentumTimer - dt);

    // Sync active aura timers for renderer & HUD
    this.activeEffects.auras = {
      berserkTimer: this.berserkTimer,
      flameBarrierTimer: this.flameBarrierTimer,
      blizzardTimer: this.blizzardTimer,
      astralOverloadTimer: this.astralOverloadTimer,
      stealthTimer: this.stealthTimer,
      archangelTimer: this.archangelTimer,
      wraithTimer: this.wraithTimer,
      lichTimer: this.lichTimer,
      aegisAbsorbTimer: this.aegisAbsorbTimer,
      undyingTimer: this.undyingTimer,
      bloodboilTimer: this.bloodboilTimer,
      killMomentumTimer: this.killMomentumTimer,
    };
  }

  private addShockwave(x: number, y: number, maxRadius: number, color: string, duration: number = 0.4) {
    this.activeEffects.shockwaves.push({
      x,
      y,
      currentRadius: 8,
      maxRadius,
      color,
      life: duration,
      maxLife: duration,
    });
  }

  private addSkyBeam(x: number, y: number, width: number, color: string, duration: number = 0.5) {
    this.activeEffects.skyBeams.push({
      x,
      y,
      width,
      color,
      life: duration,
      maxLife: duration,
    });
  }

  private addSlashArc(x: number, y: number, radius: number, angle: number, color: string, fullCircle: boolean = false, duration: number = 0.28) {
    this.activeEffects.slashArcs.push({
      x,
      y,
      radius,
      angle,
      color,
      life: duration,
      maxLife: duration,
      fullCircle,
    });
  }

  private spawnRadialParticles(x: number, y: number, count: number, speed: number, color: string, radius: number = 5, life: number = 0.45) {
    for (let i = 0; i < count; i++) {
      const rad = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const spd = speed * (0.75 + Math.random() * 0.4);
      this.particles.push({
        x,
        y,
        vx: Math.cos(rad) * spd,
        vy: Math.sin(rad) * spd,
        radius,
        color,
        alpha: 1,
        life,
        maxLife: life,
      });
    }
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public triggerSkill(index: number) {
    const skill = this.player.skills[index];
    if (!skill) return;

    if (skill.currentCooldown > 0) {
      this.addFloatingText(this.player.x, this.player.y - 25, 'COOLING DOWN!', '#94a3b8', 0.9);
      return;
    }

    const freeEnergy = this.astralOverloadTimer > 0 || this.lichTimer > 0;
    if (!freeEnergy && this.player.energy < skill.energyCost) {
      this.addFloatingText(this.player.x, this.player.y - 25, 'NEED ENERGY!', '#38bdf8', 0.9);
      return;
    }

    if (!freeEnergy) {
      this.player.energy -= skill.energyCost;
    }

    const cooldownReduction = this.passiveBuffs.cooldownReduction;
    skill.currentCooldown = skill.cooldown * (1 - cooldownReduction);

    this.player.manualRest = false;
    this.player.idleTimer = 0;
    if (this.player.animState === 'rest') {
      this.player.animState = 'idle';
      this.player.animFrame = 0;
    }

    sounds.skillCast(skill.id, skill.isUltimate);
    const badgeColor = skill.isUltimate ? '#f59e0b' : '#38bdf8';
    this.addFloatingText(
      this.player.x,
      this.player.y - 35,
      `${skill.name.toUpperCase()}!`,
      badgeColor,
      skill.isUltimate ? 1.45 : 1.15
    );

    // Adrenaline Surge talent bonus
    if (this.passiveBuffs.overchargeBoost) {
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 15);
      this.overchargeSpeedTimer = 2.5;
    }

    const currentRoom = this.getCurrentRoom();
    const dirX = Math.cos(this.player.rotation);
    const dirY = Math.sin(this.player.rotation);

    // ==========================================
    // 1. KNIGHT SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    if (skill.id === 'dual_wield') {
      this.player.dualWieldTimer = 5.0;
      this.addShockwave(this.player.x, this.player.y, 70, '#f59e0b', 0.3);
    } else if (skill.id === 'fortress_shield') {
      this.player.fortressShieldTimer = 3.8;
      this.addShockwave(this.player.x, this.player.y, 80, '#38bdf8', 0.35);
    } else if (skill.id === 'seismic_slam') {
      this.screenShake = 1.1;
      sounds.explosion();
      this.addShockwave(this.player.x, this.player.y, 170, '#f59e0b', 0.45);
      this.spawnRadialParticles(this.player.x, this.player.y, 24, 240, '#f59e0b', 5);
      if (currentRoom) {
        currentRoom.enemies.forEach(enemy => {
          if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < 170) {
            enemy.hp -= 35;
            enemy.frozenTimer = Math.max(enemy.frozenTimer, 2.0);
            this.addFloatingText(enemy.x, enemy.y, 'STUNNED 35', '#f59e0b', 1.1);
          }
        });
      }
    } else if (skill.id === 'war_cry') {
      this.berserkTimer = Math.max(this.berserkTimer, 5.0);
      this.screenShake = 0.8;
      sounds.explosion();
      this.addShockwave(this.player.x, this.player.y, 155, '#f97316', 0.4);
      if (currentRoom) {
        currentRoom.enemies.forEach(enemy => {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 155) {
            enemy.hp -= 22;
            if (dist > 0) {
              enemy.x += (dx / dist) * 65;
              enemy.y += (dy / dist) * 65;
              this.clampEntityToRoom(enemy, currentRoom);
            }
            this.addFloatingText(enemy.x, enemy.y, 'ROAR 22', '#f97316', 1.0);
          }
        });
      }
    } else if (skill.id === 'shield_charge') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 175, dirY * 175, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.5);
      this.addSlashArc(this.player.x, this.player.y, 65, this.player.rotation, '#eab308');
      this.addShockwave(this.player.x, this.player.y, 95, '#eab308', 0.3);
      sounds.meleeSlash();

      // Clear enemy bullets along charge path
      this.bullets = this.bullets.filter(b => b.fromPlayer || this.distanceToSegment(b.x, b.y, startX, startY, dest.x, dest.y) > 40);

      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55 || Math.hypot(e.x - dest.x, e.y - dest.y) < 90) {
            e.hp -= 40;
            e.frozenTimer = Math.max(e.frozenTimer, 1.6);
            this.addFloatingText(e.x, e.y, 'BASH 40!', '#eab308', 1.2);
          }
        });
      }
    } else if (skill.id === 'knight_berserk_rampage') {
      this.berserkTimer = 7.0;
      this.ragnarokTimer = 7.0;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.8);
      this.screenShake = 1.4;
      sounds.explosion();
      this.addShockwave(this.player.x, this.player.y, 190, '#ef4444', 0.5);
      this.spawnRadialParticles(this.player.x, this.player.y, 32, 280, '#ef4444', 6, 0.55);
    } else if (skill.id === 'knight_orbital_bastion') {
      this.activeEffects.orbitalShields = [
        { angle: 0, radius: 56, timer: 9.0 },
        { angle: Math.PI / 2, radius: 56, timer: 9.0 },
        { angle: Math.PI, radius: 56, timer: 9.0 },
        { angle: (Math.PI * 3) / 2, radius: 56, timer: 9.0 },
      ];
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 4);
      this.addShockwave(this.player.x, this.player.y, 120, '#38bdf8', 0.4);
      sounds.shieldRecharge();
      this.addFloatingText(this.player.x, this.player.y - 20, '+4 SHIELD', '#38bdf8', 1.2);
    } else if (skill.id === 'knight_judgement_smite') {
      this.screenShake = 2.0;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      const smiteX = this.currentTarget ? this.currentTarget.x : this.player.x;
      const smiteY = this.currentTarget ? this.currentTarget.y : this.player.y;
      this.addSkyBeam(smiteX, smiteY, 96, '#facc15', 0.65);
      this.addShockwave(smiteX, smiteY, 240, '#fbbf24', 0.55);
      this.spawnRadialParticles(smiteX, smiteY, 36, 320, '#fbbf24', 7, 0.65);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - smiteX, e.y - smiteY) < 240) {
            e.hp -= 140;
            e.frozenTimer = Math.max(e.frozenTimer, 3.0);
            this.addFloatingText(e.x, e.y, 'SMITE 140!', '#facc15', 1.5);
          }
        });
      }

    // ==========================================
    // 2. MAGE SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'chain_lightning') {
      if (currentRoom && currentRoom.enemies.length > 0) {
        let cur: Enemy | null = this.currentTarget || currentRoom.enemies[0];
        let chainedCount = 0;
        const hitEnemies = new Set<string>();
        const boltPoints: Vector2D[] = [{ x: this.player.x, y: this.player.y }];

        while (cur && chainedCount < 5) {
          hitEnemies.add(cur.id);
          boltPoints.push({ x: cur.x, y: cur.y });
          cur.hp -= 30;
          cur.frozenTimer = Math.max(cur.frozenTimer, 1.5);
          this.addFloatingText(cur.x, cur.y, 'SHOCK 30', '#a855f7', 1.1);
          this.spawnRadialParticles(cur.x, cur.y, 8, 150, '#c084fc', 3, 0.25);

          let nextTarget: Enemy | null = null;
          let minDist = 250;
          for (const other of currentRoom.enemies) {
            if (!hitEnemies.has(other.id) && other.hp > 0) {
              const d = Math.hypot(other.x - cur.x, other.y - cur.y);
              if (d < minDist) {
                minDist = d;
                nextTarget = other;
              }
            }
          }
          cur = nextTarget;
          chainedCount++;
        }

        this.activeEffects.lightningBolts.push({
          points: boltPoints,
          color: '#c084fc',
          life: 0.35,
          maxLife: 0.35,
        });
      } else {
        // Visual lightning arc forward even if room empty
        this.activeEffects.lightningBolts.push({
          points: [
            { x: this.player.x, y: this.player.y },
            { x: this.player.x + dirX * 180, y: this.player.y + dirY * 180 },
          ],
          color: '#c084fc',
          life: 0.3,
          maxLife: 0.3,
        });
      }
    } else if (skill.id === 'frost_nova') {
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addShockwave(this.player.x, this.player.y, 230, '#38bdf8', 0.45);
      this.spawnRadialParticles(this.player.x, this.player.y, 28, 250, '#38bdf8', 5, 0.5);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 250) {
            e.hp -= 22;
            e.frozenTimer = Math.max(e.frozenTimer, 3.5);
            this.addFloatingText(e.x, e.y, 'FROZEN 22!', '#38bdf8', 1.2);
          }
        });
      }
    } else if (skill.id === 'meteor_shower') {
      this.screenShake = 1.3;
      sounds.explosion();
      if (currentRoom && currentRoom.enemies.length > 0) {
        currentRoom.enemies.forEach((enemy, idx) => {
          enemy.hp -= 48;
          enemy.burnTimer = Math.max(enemy.burnTimer, 4.5);
          this.addFloatingText(enemy.x, enemy.y, 'METEOR 48!', '#ef4444', 1.3);
          if (idx < 5) {
            this.addSkyBeam(enemy.x, enemy.y, 56, '#f97316', 0.5);
            this.addShockwave(enemy.x, enemy.y, 85, '#ef4444', 0.4);
            this.activeEffects.poisonPools.push({
              x: enemy.x,
              y: enemy.y,
              radius: 46,
              duration: 4.0,
              color: '#ea580c',
            });
          }
        });
      } else {
        for (let m = 0; m < 3; m++) {
          const mx = this.player.x + dirX * (80 + m * 55) + (Math.random() - 0.5) * 60;
          const my = this.player.y + dirY * (80 + m * 55) + (Math.random() - 0.5) * 60;
          this.addSkyBeam(mx, my, 52, '#f97316', 0.5);
          this.addShockwave(mx, my, 80, '#ef4444', 0.4);
        }
      }
    } else if (skill.id === 'arcane_teleport') {
      this.addShockwave(this.player.x, this.player.y, 75, '#a855f7', 0.3);
      const blinkDest = this.moveWithCollision(this.player.x, this.player.y, dirX * 185, dirY * 185, this.player.radius);
      this.player.x = blinkDest.x;
      this.player.y = blinkDest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 0.7);
      this.addShockwave(this.player.x, this.player.y, 130, '#c084fc', 0.4);
      this.spawnRadialParticles(this.player.x, this.player.y, 18, 190, '#c084fc', 4, 0.35);
      sounds.shoot('laser');

      const destRoom = this.getCurrentRoom() || currentRoom;
      if (destRoom) {
        destRoom.enemies.forEach(e => {
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d < 135) {
            e.hp -= 32;
            e.x += (this.player.x - e.x) * 0.35;
            e.y += (this.player.y - e.y) * 0.35;
            this.clampEntityToRoom(e, destRoom);
            this.addFloatingText(e.x, e.y, 'VORTEX 32', '#c084fc', 1.1);
          }
        });
      }
    } else if (skill.id === 'flame_barrier') {
      this.flameBarrierTimer = 5.5;
      this.addShockwave(this.player.x, this.player.y, 90, '#f97316', 0.35);
      sounds.shoot('explosive');
    } else if (skill.id === 'mage_supernova') {
      this.screenShake = 2.2;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addShockwave(this.player.x, this.player.y, 320, '#e879f9', 0.65);
      this.addShockwave(this.player.x, this.player.y, 220, '#38bdf8', 0.45);
      this.spawnRadialParticles(this.player.x, this.player.y, 44, 360, '#e879f9', 7, 0.75);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          e.hp -= 150;
          e.frozenTimer = Math.max(e.frozenTimer, 4.0);
          this.addFloatingText(e.x, e.y, 'SUPERNOVA 150!', '#e879f9', 1.6);
        });
      }
    } else if (skill.id === 'mage_blizzard_domain') {
      this.blizzardTimer = 8.0;
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addShockwave(this.player.x, this.player.y, 260, '#38bdf8', 0.55);
      sounds.shoot('laser');
    } else if (skill.id === 'mage_astral_overload') {
      this.astralOverloadTimer = 7.0;
      this.player.energy = this.player.maxEnergy;
      this.addShockwave(this.player.x, this.player.y, 150, '#818cf8', 0.45);
      sounds.shoot('laser');

    // ==========================================
    // 3. ASSASSIN SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'shadow_slash') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 190, dirY * 190, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 0.9);
      this.addSlashArc(dest.x, dest.y, 75, this.player.rotation, '#10b981');
      sounds.meleeSlash();

      // Deflect bullets along dash
      this.bullets = this.bullets.filter(b => b.fromPlayer || this.distanceToSegment(b.x, b.y, startX, startY, dest.x, dest.y) > 45);

      let killedSomeone = false;
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          const onPath = this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55;
          const nearEnd = Math.hypot(e.x - dest.x, e.y - dest.y) < 95;
          if (onPath || nearEnd) {
            e.hp -= 36;
            this.addFloatingText(e.x, e.y, 'SLASH 36!', '#10b981', 1.2);
            if (e.hp <= 0) killedSomeone = true;
          }
        });
      }
      if (killedSomeone) {
        skill.currentCooldown = 0;
        this.addFloatingText(this.player.x, this.player.y - 48, 'CD RESET!', '#34d399', 1.25);
      }
    } else if (skill.id === 'shadow_clones') {
      const c1 = this.moveWithCollision(this.player.x, this.player.y, -28, -20, 12);
      const c2 = this.moveWithCollision(this.player.x, this.player.y, 28, 20, 12);
      this.activeEffects.clones.push(
        { x: c1.x, y: c1.y, timer: 8.5, attackTimer: 0 },
        { x: c2.x, y: c2.y, timer: 8.5, attackTimer: 0.2 }
      );
      this.spawnRadialParticles(this.player.x, this.player.y, 16, 140, '#10b981', 4, 0.35);
    } else if (skill.id === 'kunai_flurry') {
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        this.bullets.push({
          id: `kunai_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 540,
          vy: Math.sin(angle) * 540,
          radius: 4.5,
          damage: 18,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 1,
          color: '#10b981',
          lifetime: 1.8,
          burnChance: 0.6,
        });
      }
    } else if (skill.id === 'smoke_bomb') {
      this.stealthTimer = 3.8;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.0);
      this.guaranteedCrit = true;
      this.spawnRadialParticles(this.player.x, this.player.y, 22, 130, '#64748b', 6, 0.5);
      sounds.shoot('shotgun');
      this.addFloatingText(this.player.x, this.player.y - 20, 'STEALTH + 200% CRIT', '#34d399', 1.15);
    } else if (skill.id === 'blade_dance') {
      // Reflect nearby enemy bullets back at high speed!
      this.bullets.forEach(b => {
        if (!b.fromPlayer && Math.hypot(b.x - this.player.x, b.y - this.player.y) < 125) {
          b.fromPlayer = true;
          b.vx *= -1.3;
          b.vy *= -1.3;
          b.color = '#10b981';
          b.damage = Math.max(b.damage, 15);
        }
      });
      this.addSlashArc(this.player.x, this.player.y, 110, 0, '#10b981', true, 0.35);
      sounds.meleeSlash();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 120) {
            e.hp -= 42;
            this.addFloatingText(e.x, e.y, 'TEMPEST 42', '#10b981', 1.2);
          }
        });
      }
    } else if (skill.id === 'assassin_death_blossom') {
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 2.5);
      sounds.meleeSlash();
      this.screenShake = 1.5;
      if (currentRoom && currentRoom.enemies.length > 0) {
        const strikeCount = Math.min(7, Math.max(currentRoom.enemies.length, 5));
        for (let i = 0; i < strikeCount; i++) {
          const target = currentRoom.enemies[i % currentRoom.enemies.length];
          target.hp -= 65;
          this.addSlashArc(target.x, target.y, 68, (i * Math.PI) / 3, '#f43f5e', false, 0.4);
          this.addFloatingText(target.x, target.y - (i % 2) * 14, 'BLOSSOM 65!', '#f43f5e', 1.35);
          const safeSpot = this.moveWithCollision(
            this.player.x,
            this.player.y,
            target.x - this.player.x,
            target.y - this.player.y,
            this.player.radius,
            false
          );
          if (!this.checkWallCollision(safeSpot.x, safeSpot.y, this.player.radius)) {
            this.player.x = safeSpot.x;
            this.player.y = safeSpot.y;
          }
        }
      } else {
        this.addSlashArc(this.player.x, this.player.y, 130, 0, '#f43f5e', true, 0.45);
      }
    } else if (skill.id === 'assassin_phantom_army') {
      const offsets: Vector2D[] = [
        { x: -38, y: -28 },
        { x: 38, y: -28 },
        { x: -38, y: 28 },
        { x: 38, y: 28 },
      ];
      offsets.forEach((off, idx) => {
        const pos = this.moveWithCollision(this.player.x, this.player.y, off.x, off.y, 12);
        this.activeEffects.clones.push({
          x: pos.x,
          y: pos.y,
          timer: 10.0,
          attackTimer: idx * 0.12,
          isPhantom: true,
        });
      });
      this.addShockwave(this.player.x, this.player.y, 110, '#a855f7', 0.35);
    } else if (skill.id === 'assassin_void_execution') {
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 3.0);
      this.screenShake = 1.8;
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addSlashArc(this.player.x, this.player.y, 220, 0, '#dc2626', true, 0.5);
      sounds.meleeSlash();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          this.addSlashArc(e.x, e.y, 55, Math.PI / 4, '#ef4444', false, 0.45);
          if (e.isBoss) {
            e.hp -= 160;
            this.addFloatingText(e.x, e.y, 'VOID 160!', '#dc2626', 1.6);
          } else if (e.hp / e.maxHp <= 0.45) {
            e.hp = 0;
            this.addFloatingText(e.x, e.y, 'EXECUTED!', '#dc2626', 1.6);
          } else {
            e.hp -= 85;
            this.addFloatingText(e.x, e.y, 'VOID CUT 85', '#ef4444', 1.35);
          }
        });
      }

    // ==========================================
    // 4. ALCHEMIST SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'poison_flasks') {
      const center = this.currentTarget
        ? { x: this.currentTarget.x, y: this.currentTarget.y }
        : { x: this.player.x + dirX * 110, y: this.player.y + dirY * 110 };
      for (let i = -1; i <= 1; i++) {
        const px = center.x + i * 45 + (Math.random() - 0.5) * 20;
        const py = center.y + (Math.random() - 0.5) * 45;
        this.activeEffects.poisonPools.push({
          x: px,
          y: py,
          radius: 56,
          duration: 6.5,
          color: '#22c55e',
        });
        this.spawnRadialParticles(px, py, 10, 90, '#22c55e', 4, 0.35);
      }
    } else if (skill.id === 'gun_turret') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 26, dirY * 26, 12);
      this.activeEffects.turrets.push({
        x: pos.x,
        y: pos.y,
        timer: 10.5,
        attackTimer: 0,
      });
    } else if (skill.id === 'healing_drone') {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 30);
      this.addShockwave(this.player.x, this.player.y, 95, '#22c55e', 0.4);
      this.addFloatingText(this.player.x, this.player.y - 20, '+2 HP +3 SHIELD +30 MP', '#22c55e', 1.15);
      sounds.shieldRecharge();
    } else if (skill.id === 'cryo_grenade') {
      const cx = this.currentTarget ? this.currentTarget.x : this.player.x + dirX * 120;
      const cy = this.currentTarget ? this.currentTarget.y : this.player.y + dirY * 120;
      sounds.explosion();
      this.addShockwave(cx, cy, 145, '#06b6d4', 0.45);
      this.spawnRadialParticles(cx, cy, 24, 210, '#22d3ee', 5, 0.45);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - cx, e.y - cy) < 150) {
            e.hp -= 38;
            e.frozenTimer = Math.max(e.frozenTimer, 4.0);
            this.addFloatingText(e.x, e.y, 'CRYO 38!', '#06b6d4', 1.25);
          }
        });
      }
    } else if (skill.id === 'acid_spray') {
      sounds.shoot('laser');
      for (let i = -3; i <= 3; i++) {
        const a = this.player.rotation + i * 0.14;
        this.bullets.push({
          id: `acid_${Math.random()}`,
          x: this.player.x + Math.cos(a) * 16,
          y: this.player.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 480,
          vy: Math.sin(a) * 480,
          radius: 7,
          damage: 18,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 0,
          color: '#84cc16',
          lifetime: 0.65,
          burnChance: 1.0,
        });
      }
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 145) {
            e.hp -= 28;
            e.burnTimer = Math.max(e.burnTimer, 6.0);
            this.addFloatingText(e.x, e.y, 'CORRODE!', '#84cc16', 1.15);
          }
        });
      }
    } else if (skill.id === 'alchemist_biohazard_cataclysm') {
      this.screenShake = 1.6;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addShockwave(this.player.x, this.player.y, 280, '#22c55e', 0.6);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          e.hp -= 95;
          e.burnTimer = Math.max(e.burnTimer, 7.0);
          this.addFloatingText(e.x, e.y, 'BIOHAZARD 95!', '#10b981', 1.5);
        });
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const px = this.player.x + Math.cos(ang) * 95;
        const py = this.player.y + Math.sin(ang) * 95;
        this.activeEffects.poisonPools.push({
          x: px,
          y: py,
          radius: 72,
          duration: 7.5,
          color: '#10b981',
        });
      }
    } else if (skill.id === 'alchemist_mecha_golem') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 36, dirY * 36, 18);
      this.activeEffects.mechaGolems.push({
        x: pos.x,
        y: pos.y,
        hp: 350,
        maxHp: 350,
        timer: 14.0,
        attackTimer: 0,
        missileTimer: 1.2,
      });
      this.addShockwave(pos.x, pos.y, 110, '#f59e0b', 0.4);
      sounds.explosion();
    } else if (skill.id === 'alchemist_elixir_of_immortality') {
      this.player.hp = this.player.maxHp;
      this.player.shield = this.player.maxShield;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 6.5);
      this.berserkTimer = Math.max(this.berserkTimer, 6.5);
      this.addShockwave(this.player.x, this.player.y, 150, '#22c55e', 0.5);
      sounds.shieldRecharge();

    // ==========================================
    // 5. PALADIN SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'energy_sanctuary') {
      this.aegisAbsorbTimer = 4.2;
      this.addShockwave(this.player.x, this.player.y, 90, '#fbbf24', 0.35);
      sounds.shieldRecharge();
    } else if (skill.id === 'divine_consecration') {
      this.activeEffects.consecrationZones.push({
        x: this.player.x,
        y: this.player.y,
        radius: 135,
        duration: 6.0,
        healTick: 0.5,
      });
      this.addShockwave(this.player.x, this.player.y, 135, '#fbbf24', 0.4);
    } else if (skill.id === 'holy_hammer_throw') {
      sounds.meleeSlash();
      for (let i = 0; i < 4; i++) {
        const ang = this.player.rotation + (i - 1.5) * 0.28;
        this.bullets.push({
          id: `holy_hammer_${Math.random()}`,
          x: this.player.x + Math.cos(ang) * 18,
          y: this.player.y + Math.sin(ang) * 18,
          vx: Math.cos(ang) * 500,
          vy: Math.sin(ang) * 500,
          radius: 9,
          damage: 30,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 2,
          color: '#fbbf24',
          lifetime: 2.2,
          freezeChance: 0.45,
        });
      }
    } else if (skill.id === 'radiant_mend') {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) > 150);
      this.addShockwave(this.player.x, this.player.y, 150, '#fef08a', 0.4);
      sounds.shieldRecharge();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          const d = Math.hypot(dx, dy);
          if (d < 150) {
            e.hp -= 26;
            if (d > 0) {
              e.x += (dx / d) * 60;
              e.y += (dy / d) * 60;
              this.clampEntityToRoom(e, currentRoom);
            }
            this.addFloatingText(e.x, e.y, 'PURIFY 26', '#fbbf24', 1.1);
          }
        });
      }
    } else if (skill.id === 'crusader_dash') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 180, dirY * 180, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.4);
      this.activeEffects.consecrationZones.push({
        x: (startX + dest.x) / 2,
        y: (startY + dest.y) / 2,
        radius: 75,
        duration: 3.5,
        healTick: 1.0,
      });
      this.addShockwave(dest.x, dest.y, 100, '#fbbf24', 0.35);
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55 || Math.hypot(e.x - dest.x, e.y - dest.y) < 95) {
            e.hp -= 38;
            e.frozenTimer = Math.max(e.frozenTimer, 2.0);
            this.addFloatingText(e.x, e.y, 'TEMPLAR 38!', '#fbbf24', 1.2);
          }
        });
      }
    } else if (skill.id === 'paladin_archangel_avatar') {
      this.archangelTimer = 8.0;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 2.5);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 5);
      this.addShockwave(this.player.x, this.player.y, 180, '#fde047', 0.5);
      this.spawnRadialParticles(this.player.x, this.player.y, 30, 240, '#fde047', 6, 0.55);
      sounds.shieldRecharge();
    } else if (skill.id === 'paladin_heavens_wrath') {
      this.screenShake = 2.0;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      if (currentRoom && currentRoom.enemies.length > 0) {
        currentRoom.enemies.forEach(e => {
          this.addSkyBeam(e.x, e.y, 64, '#fde047', 0.6);
          this.addShockwave(e.x, e.y, 90, '#fbbf24', 0.45);
          e.hp -= 135;
          e.frozenTimer = Math.max(e.frozenTimer, 3.5);
          this.addFloatingText(e.x, e.y, 'WRATH 135!', '#fde047', 1.5);
        });
      } else {
        this.addSkyBeam(this.player.x, this.player.y, 90, '#fde047', 0.6);
      }
    } else if (skill.id === 'paladin_immortal_citadel') {
      this.activeEffects.sanctuaryDomes.push({
        x: this.player.x,
        y: this.player.y,
        radius: 175,
        duration: 9.0,
        zapTick: 0.2,
      });
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.addShockwave(this.player.x, this.player.y, 175, '#fbbf24', 0.5);

    // ==========================================
    // 6. RANGER SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'tumble_roll') {
      let rollX = 0;
      let rollY = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) rollY -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) rollY += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) rollX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) rollX += 1;
      const rollLen = Math.hypot(rollX, rollY);
      const rx = rollLen > 0 ? rollX / rollLen : dirX;
      const ry = rollLen > 0 ? rollY / rollLen : dirY;

      const dest = this.moveWithCollision(this.player.x, this.player.y, rx * 145, ry * 145, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.0);
      this.guaranteedCrit = true;

      for (let i = -1; i <= 1; i++) {
        const a = this.player.rotation + i * 0.14;
        this.bullets.push({
          id: `tumble_arrow_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(a) * 680,
          vy: Math.sin(a) * 680,
          radius: 5,
          damage: 22,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 1,
          color: '#34d399',
          lifetime: 1.8,
        });
      }
      sounds.shoot('pistol');
    } else if (skill.id === 'arrow_rain') {
      this.screenShake = 0.9;
      sounds.shoot('shotgun');
      if (currentRoom && currentRoom.enemies.length > 0) {
        currentRoom.enemies.forEach(e => {
          this.addSkyBeam(e.x, e.y, 44, '#34d399', 0.45);
          this.spawnRadialParticles(e.x, e.y, 12, 160, '#34d399', 4, 0.35);
          e.hp -= 42;
          e.frozenTimer = Math.max(e.frozenTimer, 1.6);
          this.addFloatingText(e.x, e.y, 'VOLLEY 42!', '#34d399', 1.2);
        });
      } else {
        const cx = this.player.x + dirX * 140;
        const cy = this.player.y + dirY * 140;
        this.addSkyBeam(cx, cy, 70, '#34d399', 0.45);
        this.addShockwave(cx, cy, 120, '#34d399', 0.4);
      }
    } else if (skill.id === 'spirit_wolf') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 28, dirY * 28, 12);
      this.activeEffects.minions.push({
        id: `wolf_${Math.random()}`,
        kind: 'wolf',
        x: pos.x,
        y: pos.y,
        hp: 120,
        maxHp: 120,
        damage: 20,
        speed: 235,
        timer: 12.0,
        attackTimer: 0,
        facingRight: this.player.facingRight,
      });
      this.spawnRadialParticles(pos.x, pos.y, 14, 120, '#34d399', 4, 0.35);
    } else if (skill.id === 'vine_snare') {
      this.addShockwave(this.player.x, this.player.y, 165, '#22c55e', 0.45);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 165) {
            e.hp -= 26;
            e.frozenTimer = Math.max(e.frozenTimer, 3.5);
            this.activeEffects.poisonPools.push({
              x: e.x,
              y: e.y,
              radius: 42,
              duration: 4.0,
              color: '#16a34a',
            });
            this.addFloatingText(e.x, e.y, 'ROOTED 26!', '#22c55e', 1.15);
          }
        });
      }
    } else if (skill.id === 'wind_piercer') {
      this.screenShake = 0.7;
      sounds.shoot('laser');
      this.bullets.push({
        id: `gale_piercer_${Math.random()}`,
        x: this.player.x + dirX * 18,
        y: this.player.y + dirY * 18,
        vx: dirX * 920,
        vy: dirY * 920,
        radius: 12,
        damage: 58,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 1,
        color: '#6ee7b7',
        glowColor: '#10b981',
        lifetime: 2.0,
      });
      this.addShockwave(this.player.x + dirX * 24, this.player.y + dirY * 24, 65, '#34d399', 0.28);
    } else if (skill.id === 'ranger_phantom_barrage') {
      this.berserkTimer = Math.max(this.berserkTimer, 6.5);
      this.screenShake = 1.3;
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2;
        this.bullets.push({
          id: `tempest_arrow_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 660,
          vy: Math.sin(angle) * 660,
          radius: 5.5,
          damage: 24,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 2,
          color: '#34d399',
          lifetime: 2.2,
        });
      }
      this.addShockwave(this.player.x, this.player.y, 170, '#34d399', 0.45);
    } else if (skill.id === 'ranger_alpha_pack') {
      for (let w = -1; w <= 1; w++) {
        const pos = this.moveWithCollision(this.player.x, this.player.y, w * 32, 24, 14);
        this.activeEffects.minions.push({
          id: `alpha_wolf_${Math.random()}`,
          kind: 'alpha_wolf',
          x: pos.x,
          y: pos.y,
          hp: 180,
          maxHp: 180,
          damage: 26,
          speed: 260,
          timer: 14.0,
          attackTimer: Math.abs(w) * 0.15,
          facingRight: this.player.facingRight,
        });
      }
      this.addShockwave(this.player.x, this.player.y, 130, '#10b981', 0.4);
    } else if (skill.id === 'ranger_world_tree_arrow') {
      this.screenShake = 1.9;
      sounds.explosion();
      const tx = this.currentTarget ? this.currentTarget.x : this.player.x + dirX * 150;
      const ty = this.currentTarget ? this.currentTarget.y : this.player.y + dirY * 150;
      this.addSkyBeam(tx, ty, 84, '#34d399', 0.6);
      this.addShockwave(tx, ty, 270, '#10b981', 0.6);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          e.hp -= 150;
          e.frozenTimer = Math.max(e.frozenTimer, 4.0);
          this.addFloatingText(e.x, e.y, 'YGGDRASIL 150!', '#34d399', 1.55);
        });
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.bullets.push({
          id: `ygg_${Math.random()}`,
          x: tx,
          y: ty,
          vx: Math.cos(a) * 520,
          vy: Math.sin(a) * 520,
          radius: 5,
          damage: 20,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 1,
          color: '#6ee7b7',
          lifetime: 1.6,
        });
      }

    // ==========================================
    // 7. NECROMANCER SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'soul_harvest') {
      let hitCount = 0;
      this.addShockwave(this.player.x, this.player.y, 160, '#d946ef', 0.4);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 160) {
            hitCount++;
            e.hp -= 30;
            this.activeEffects.lightningBolts.push({
              points: [
                { x: e.x, y: e.y },
                { x: this.player.x, y: this.player.y },
              ],
              color: '#f43f5e',
              life: 0.35,
              maxLife: 0.35,
            });
            this.addFloatingText(e.x, e.y, 'DRAIN 30', '#d946ef', 1.1);
          }
        });
      }
      if (hitCount > 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 2);
        this.addFloatingText(this.player.x, this.player.y - 22, '+1 HP +2 SHIELD', '#22c55e', 1.15);
      }
    } else if (skill.id === 'raise_skeletons') {
      for (let s = -1; s <= 1; s += 2) {
        const pos = this.moveWithCollision(this.player.x, this.player.y, s * 28, 16, 12);
        this.activeEffects.minions.push({
          id: `skel_${Math.random()}`,
          kind: 'skeleton',
          x: pos.x,
          y: pos.y,
          hp: 110,
          maxHp: 110,
          damage: 18,
          speed: 205,
          timer: 11.0,
          attackTimer: 0,
          facingRight: this.player.facingRight,
        });
      }
      this.spawnRadialParticles(this.player.x, this.player.y, 16, 130, '#d946ef', 4, 0.35);
    } else if (skill.id === 'corpse_explosion') {
      sounds.explosion();
      this.screenShake = 1.0;
      if (currentRoom && currentRoom.enemies.length > 0) {
        currentRoom.enemies.forEach((e, idx) => {
          e.hp -= 42;
          this.addFloatingText(e.x, e.y, 'MIASMA 42!', '#c084fc', 1.2);
          if (idx < 4) {
            this.addShockwave(e.x, e.y, 85, '#c084fc', 0.38);
            this.activeEffects.poisonPools.push({
              x: e.x,
              y: e.y,
              radius: 52,
              duration: 5.0,
              color: '#a855f7',
            });
          }
        });
      } else {
        this.addShockwave(this.player.x, this.player.y, 140, '#c084fc', 0.4);
      }
    } else if (skill.id === 'bone_prison') {
      this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) > 120);
      this.addShockwave(this.player.x, this.player.y, 175, '#e2e8f0', 0.4);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 180) {
            e.hp -= 28;
            e.frozenTimer = Math.max(e.frozenTimer, 3.0);
            this.spawnRadialParticles(e.x, e.y, 10, 120, '#e2e8f0', 4, 0.35);
            this.addFloatingText(e.x, e.y, 'IMPALED 28', '#e2e8f0', 1.15);
          }
        });
      }
    } else if (skill.id === 'ghost_shroud') {
      this.wraithTimer = 3.5;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 3.5);
      this.spawnRadialParticles(this.player.x, this.player.y, 20, 140, '#c084fc', 5, 0.45);
    } else if (skill.id === 'necro_army_of_dead') {
      for (let s = 0; s < 5; s++) {
        const ang = (s / 5) * Math.PI * 2;
        const pos = this.moveWithCollision(this.player.x, this.player.y, Math.cos(ang) * 38, Math.sin(ang) * 38, 13);
        this.activeEffects.minions.push({
          id: `dread_skel_${Math.random()}`,
          kind: 'dread_skeleton',
          x: pos.x,
          y: pos.y,
          hp: 165,
          maxHp: 165,
          damage: 24,
          speed: 230,
          timer: 14.0,
          attackTimer: s * 0.1,
          facingRight: true,
        });
      }
      this.addShockwave(this.player.x, this.player.y, 150, '#d946ef', 0.45);
    } else if (skill.id === 'necro_lich_ascension') {
      this.lichTimer = 7.5;
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.player.energy = this.player.maxEnergy;
      this.addShockwave(this.player.x, this.player.y, 175, '#a855f7', 0.5);
      sounds.shieldRecharge();
    } else if (skill.id === 'necro_reaper_scythe') {
      this.screenShake = 1.8;
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addSlashArc(this.player.x, this.player.y, 210, 0, '#d946ef', true, 0.55);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 30);
      sounds.meleeSlash();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (!e.isBoss && e.hp / e.maxHp <= 0.35) {
            e.hp = 0;
            this.addFloatingText(e.x, e.y, 'REAPED!', '#d946ef', 1.6);
          } else {
            e.hp -= 145;
            this.addFloatingText(e.x, e.y, 'REAPER 145!', '#d946ef', 1.5);
          }
        });
      }

    // ==========================================
    // 8. BERSERKER SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'savage_leap') {
      const leapDist = this.currentTarget
        ? Math.min(200, Math.hypot(this.currentTarget.x - this.player.x, this.currentTarget.y - this.player.y))
        : 175;
      const dest = this.moveWithCollision(this.player.x, this.player.y, dirX * leapDist, dirY * leapDist, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.2);
      this.screenShake = 1.2;
      sounds.explosion();
      this.addShockwave(dest.x, dest.y, 140, '#f97316', 0.42);
      this.spawnRadialParticles(dest.x, dest.y, 24, 230, '#f97316', 5, 0.45);
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - dest.x, e.y - dest.y) < 140) {
            e.hp -= 42;
            e.frozenTimer = Math.max(e.frozenTimer, 1.8);
            this.addFloatingText(e.x, e.y, 'SLAM 42!', '#f97316', 1.25);
          }
        });
      }
    } else if (skill.id === 'rage_flurry') {
      this.berserkTimer = Math.max(this.berserkTimer, 4.5);
      const equipped = this.player.weapons[this.player.currentWeaponIndex];
      if (equipped) {
        for (let b = -1; b <= 1; b++) {
          this.fireWeaponBurst(equipped, this.player.rotation + b * 0.09, true);
        }
      }
      this.addShockwave(this.player.x, this.player.y, 80, '#fb923c', 0.3);
    } else if (skill.id === 'bloodboil_roar') {
      this.bloodboilTimer = 6.0;
      this.bloodboilHealsLeft = 2;
      this.addShockwave(this.player.x, this.player.y, 130, '#ef4444', 0.4);
      this.addFloatingText(this.player.x, this.player.y - 20, '100% CRIT + LIFESTEAL!', '#ef4444', 1.15);
    } else if (skill.id === 'molten_cleave') {
      sounds.meleeSlash();
      this.addSlashArc(this.player.x, this.player.y, 85, this.player.rotation, '#f97316');
      for (let i = -2; i <= 2; i++) {
        const a = this.player.rotation + i * 0.16;
        this.bullets.push({
          id: `magma_${Math.random()}`,
          x: this.player.x + Math.cos(a) * 18,
          y: this.player.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 530,
          vy: Math.sin(a) * 530,
          radius: 8,
          damage: 26,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 0,
          color: '#f97316',
          lifetime: 1.4,
          burnChance: 1.0,
        });
      }
    } else if (skill.id === 'iron_skin') {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.player.fortressShieldTimer = Math.max(this.player.fortressShieldTimer, 3.5);
      this.addShockwave(this.player.x, this.player.y, 110, '#f59e0b', 0.35);
      sounds.shieldRecharge();
    } else if (skill.id === 'berserker_ragnarok') {
      this.berserkTimer = 8.0;
      this.bloodboilTimer = 8.0;
      this.ragnarokTimer = 8.0;
      this.bloodboilHealsLeft = 3;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 3.0);
      this.screenShake = 1.6;
      sounds.explosion();
      this.addShockwave(this.player.x, this.player.y, 200, '#ef4444', 0.55);
      this.spawnRadialParticles(this.player.x, this.player.y, 34, 300, '#f97316', 6, 0.6);
    } else if (skill.id === 'berserker_cataclysm_dunk') {
      const leapDist = this.currentTarget
        ? Math.min(210, Math.hypot(this.currentTarget.x - this.player.x, this.currentTarget.y - this.player.y))
        : 140;
      const dest = this.moveWithCollision(this.player.x, this.player.y, dirX * leapDist, dirY * leapDist, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 2.0);
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.screenShake = 2.2;
      sounds.explosion();
      this.addSkyBeam(dest.x, dest.y, 92, '#f97316', 0.6);
      this.addShockwave(dest.x, dest.y, 250, '#ef4444', 0.6);
      this.spawnRadialParticles(dest.x, dest.y, 40, 340, '#f97316', 7, 0.65);

      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2;
        this.activeEffects.poisonPools.push({
          x: dest.x + Math.cos(a) * 65,
          y: dest.y + Math.sin(a) * 65,
          radius: 56,
          duration: 5.5,
          color: '#ea580c',
        });
      }

      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - dest.x, e.y - dest.y) < 250) {
            e.hp -= 160;
            e.frozenTimer = Math.max(e.frozenTimer, 2.8);
            e.burnTimer = Math.max(e.burnTimer, 5.0);
            this.addFloatingText(e.x, e.y, 'CATACLYSM 160!', '#f97316', 1.6);
          }
        });
      }
    } else if (skill.id === 'berserker_undying_frenzy') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 4);
      this.undyingTimer = 7.0;
      this.berserkTimer = Math.max(this.berserkTimer, 7.0);
      // Reset both normal skill cooldowns!
      if (this.player.skills[0]) this.player.skills[0].currentCooldown = 0;
      if (this.player.skills[1]) this.player.skills[1].currentCooldown = 0;
      this.addShockwave(this.player.x, this.player.y, 165, '#dc2626', 0.5);
      sounds.levelUp();
      this.addFloatingText(this.player.x, this.player.y - 22, '+4 HP & SKILLS RESET!', '#ef4444', 1.3);

    // ==========================================
    // 9. ENGINEER SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'flame_turret') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 28, dirY * 28, 12);
      this.activeEffects.turrets.push({
        x: pos.x,
        y: pos.y,
        timer: 11.0,
        attackTimer: 0,
        isVulcan: true,
      });
      this.addShockwave(pos.x, pos.y, 75, '#f97316', 0.3);
    } else if (skill.id === 'emp_discharge') {
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 2);
      this.addShockwave(this.player.x, this.player.y, 200, '#38bdf8', 0.45);
      this.spawnRadialParticles(this.player.x, this.player.y, 24, 240, '#38bdf8', 4, 0.4);
      sounds.shieldRecharge();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 205) {
            e.hp -= 34;
            e.frozenTimer = Math.max(e.frozenTimer, 3.0);
            this.addFloatingText(e.x, e.y, 'EMP 34!', '#38bdf8', 1.2);
          }
        });
      }
    } else if (skill.id === 'homing_micro_missiles') {
      sounds.shoot('explosive');
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + this.player.rotation;
        this.bullets.push({
          id: `micro_missile_${Math.random()}`,
          x: this.player.x + Math.cos(ang) * 16,
          y: this.player.y + Math.sin(ang) * 16,
          vx: Math.cos(ang) * 480,
          vy: Math.sin(ang) * 480,
          radius: 6,
          damage: 24,
          isCrit: true,
          fromPlayer: true,
          piercing: false,
          bouncesLeft: 1,
          color: '#f59e0b',
          lifetime: 1.8,
          aoeRadius: 65,
        });
      }
    } else if (skill.id === 'tesla_coil_node') {
      this.activeEffects.consecrationZones.push({
        x: this.player.x,
        y: this.player.y,
        radius: 135,
        duration: 6.0,
        healTick: 0.4,
      });
      this.addShockwave(this.player.x, this.player.y, 135, '#38bdf8', 0.4);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 150) {
            e.hp -= 24;
            this.activeEffects.lightningBolts.push({
              points: [{ x: this.player.x, y: this.player.y }, { x: e.x, y: e.y }],
              color: '#38bdf8',
              life: 0.3,
              maxLife: 0.3,
            });
          }
        });
      }
    } else if (skill.id === 'jetpack_boost') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 180, dirY * 180, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.2);
      this.activeEffects.poisonPools.push({
        x: (startX + dest.x) / 2,
        y: (startY + dest.y) / 2,
        radius: 60,
        duration: 4.5,
        color: '#f97316',
      });
      this.addShockwave(dest.x, dest.y, 105, '#38bdf8', 0.35);
      sounds.shoot('explosive');
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55 || Math.hypot(e.x - dest.x, e.y - dest.y) < 95) {
            e.hp -= 36;
            e.burnTimer = Math.max(e.burnTimer, 3.5);
            this.addFloatingText(e.x, e.y, 'THRUST 36!', '#38bdf8', 1.2);
          }
        });
      }
    } else if (skill.id === 'engineer_omega_mech') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 36, dirY * 36, 18);
      this.activeEffects.mechaGolems.push({
        x: pos.x,
        y: pos.y,
        hp: 420,
        maxHp: 420,
        timer: 14.0,
        attackTimer: 0,
        missileTimer: 0.8,
      });
      this.berserkTimer = Math.max(this.berserkTimer, 8.0);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 4);
      this.addShockwave(this.player.x, this.player.y, 140, '#38bdf8', 0.45);
      sounds.explosion();
    } else if (skill.id === 'engineer_turret_matrix') {
      for (let t = 0; t < 3; t++) {
        const ang = (t / 3) * Math.PI * 2;
        const pos = this.moveWithCollision(this.player.x, this.player.y, Math.cos(ang) * 58, Math.sin(ang) * 58, 12);
        this.activeEffects.turrets.push({
          x: pos.x,
          y: pos.y,
          timer: 10.5,
          attackTimer: t * 0.08,
          isVulcan: true,
        });
      }
      this.activeEffects.sanctuaryDomes.push({
        x: this.player.x,
        y: this.player.y,
        radius: 170,
        duration: 10.0,
        zapTick: 0.2,
      });
      this.addShockwave(this.player.x, this.player.y, 175, '#38bdf8', 0.5);
    } else if (skill.id === 'engineer_orbital_laser') {
      this.screenShake = 2.1;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      const lx = this.currentTarget ? this.currentTarget.x : this.player.x + dirX * 120;
      const ly = this.currentTarget ? this.currentTarget.y : this.player.y + dirY * 120;
      this.addSkyBeam(lx, ly, 104, '#38bdf8', 0.65);
      this.addShockwave(lx, ly, 250, '#38bdf8', 0.55);
      this.activeEffects.poisonPools.push({ x: lx, y: ly, radius: 85, duration: 5.5, color: '#0284c7' });
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - lx, e.y - ly) < 255) {
            e.hp -= 155;
            e.frozenTimer = Math.max(e.frozenTimer, 3.0);
            this.addFloatingText(e.x, e.y, 'ION BEAM 155!', '#38bdf8', 1.55);
          }
        });
      }

    // ==========================================
    // 10. VAMPIRE SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'bat_swarm') {
      sounds.shoot('staff');
      for (let i = 0; i < 10; i++) {
        const ang = this.player.rotation + (i - 4.5) * 0.14;
        this.bullets.push({
          id: `bat_bolt_${Math.random()}`,
          x: this.player.x + Math.cos(ang) * 14,
          y: this.player.y + Math.sin(ang) * 14,
          vx: Math.cos(ang) * 580,
          vy: Math.sin(ang) * 580,
          radius: 5.5,
          damage: 19,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 1,
          color: '#f43f5e',
          lifetime: 1.8,
        });
      }
      if (currentRoom && currentRoom.enemies.length > 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 18);
        this.addFloatingText(this.player.x, this.player.y - 22, '+1 HP +18 MP', '#fb7185', 1.1);
      }
    } else if (skill.id === 'blood_mist') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 185, dirY * 185, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.8);
      this.bullets = this.bullets.filter(b => b.fromPlayer || this.distanceToSegment(b.x, b.y, startX, startY, dest.x, dest.y) > 48);
      this.spawnRadialParticles(startX, startY, 16, 150, '#e11d48', 5, 0.4);
      this.spawnRadialParticles(dest.x, dest.y, 16, 150, '#e11d48', 5, 0.4);
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55 || Math.hypot(e.x - dest.x, e.y - dest.y) < 95) {
            e.hp -= 36;
            this.addFloatingText(e.x, e.y, 'MIST 36!', '#f43f5e', 1.2);
          }
        });
      }
    } else if (skill.id === 'sanguine_pool') {
      const vx = this.currentTarget ? this.currentTarget.x : this.player.x + dirX * 115;
      const vy = this.currentTarget ? this.currentTarget.y : this.player.y + dirY * 115;
      this.activeEffects.poisonPools.push({
        x: vx,
        y: vy,
        radius: 85,
        duration: 5.5,
        color: '#e11d48',
      });
      this.addShockwave(vx, vy, 150, '#f43f5e', 0.45);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - vx, e.y - vy) < 155) {
            e.hp -= 32;
            e.x += (vx - e.x) * 0.4;
            e.y += (vy - e.y) * 0.4;
            this.clampEntityToRoom(e, currentRoom);
            this.addFloatingText(e.x, e.y, 'SIPHON 32', '#f43f5e', 1.15);
          }
        });
      }
    } else if (skill.id === 'night_thrall') {
      for (let b = -1; b <= 1; b += 2) {
        const pos = this.moveWithCollision(this.player.x, this.player.y, b * 26, -16, 10);
        this.activeEffects.minions.push({
          id: `bat_${Math.random()}`,
          kind: 'crimson_bat',
          x: pos.x,
          y: pos.y,
          hp: 95,
          maxHp: 95,
          damage: 18,
          speed: 270,
          timer: 11.0,
          attackTimer: 0,
          facingRight: this.player.facingRight,
        });
      }
      this.spawnRadialParticles(this.player.x, this.player.y, 14, 130, '#f43f5e', 4, 0.35);
    } else if (skill.id === 'crimson_pact') {
      this.bloodboilTimer = 6.0;
      this.bloodboilHealsLeft = 2;
      this.stealthTimer = Math.max(this.stealthTimer, 1.5);
      this.addShockwave(this.player.x, this.player.y, 125, '#e11d48', 0.4);
      this.addFloatingText(this.player.x, this.player.y - 22, 'SANGUINE THIRST!', '#fb7185', 1.15);
    } else if (skill.id === 'vampire_lord_ascension') {
      this.lichTimer = 7.5;
      this.wraithTimer = 7.5;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      this.player.energy = this.player.maxEnergy;
      this.addShockwave(this.player.x, this.player.y, 185, '#e11d48', 0.5);
      sounds.levelUp();
    } else if (skill.id === 'vampire_blood_moon') {
      this.screenShake = 2.0;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.addShockwave(this.player.x, this.player.y, 290, '#e11d48', 0.6);
      this.spawnRadialParticles(this.player.x, this.player.y, 38, 320, '#f43f5e', 6, 0.65);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          e.hp -= 145;
          this.addSkyBeam(e.x, e.y, 52, '#e11d48', 0.5);
          this.addFloatingText(e.x, e.y, 'BLOOD MOON 145!', '#fb7185', 1.55);
        });
      }
    } else if (skill.id === 'vampire_immortal_feast') {
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        this.bullets.push({
          id: `feast_bat_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(ang) * 620,
          vy: Math.sin(ang) * 620,
          radius: 5.5,
          damage: 22,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 2,
          color: '#f43f5e',
          lifetime: 2.0,
        });
      }
      for (let b = -1; b <= 1; b++) {
        const pos = this.moveWithCollision(this.player.x, this.player.y, b * 28, 18, 10);
        this.activeEffects.minions.push({
          id: `bat_ult_${Math.random()}`,
          kind: 'crimson_bat',
          x: pos.x,
          y: pos.y,
          hp: 130,
          maxHp: 130,
          damage: 22,
          speed: 285,
          timer: 13.0,
          attackTimer: 0,
          facingRight: true,
        });
      }
      if (this.player.skills[0]) this.player.skills[0].currentCooldown = 0;
      if (this.player.skills[1]) this.player.skills[1].currentCooldown = 0;
      this.addShockwave(this.player.x, this.player.y, 170, '#f43f5e', 0.45);

    // ==========================================
    // 11. DRUID SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'summon_grizzly') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 32, dirY * 32, 15);
      this.activeEffects.minions.push({
        id: `bear_${Math.random()}`,
        kind: 'grizzly_bear',
        x: pos.x,
        y: pos.y,
        hp: 220,
        maxHp: 220,
        damage: 26,
        speed: 205,
        timer: 13.0,
        attackTimer: 0,
        facingRight: this.player.facingRight,
      });
      this.addShockwave(pos.x, pos.y, 90, '#4ade80', 0.35);
    } else if (skill.id === 'entangling_grove') {
      this.addShockwave(this.player.x, this.player.y, 180, '#22c55e', 0.45);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 185) {
            e.hp -= 30;
            e.frozenTimer = Math.max(e.frozenTimer, 3.5);
            this.activeEffects.poisonPools.push({
              x: e.x,
              y: e.y,
              radius: 48,
              duration: 4.5,
              color: '#16a34a',
            });
            this.addFloatingText(e.x, e.y, 'BRIAR 30!', '#4ade80', 1.2);
          }
        });
      }
    } else if (skill.id === 'solar_wrath') {
      const sx = this.currentTarget ? this.currentTarget.x : this.player.x + dirX * 130;
      const sy = this.currentTarget ? this.currentTarget.y : this.player.y + dirY * 130;
      this.addSkyBeam(sx, sy, 68, '#fde047', 0.5);
      this.addShockwave(sx, sy, 125, '#4ade80', 0.4);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 2);
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 20);
      sounds.shieldRecharge();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - sx, e.y - sy) < 130) {
            e.hp -= 48;
            e.burnTimer = Math.max(e.burnTimer, 4.0);
            this.addFloatingText(e.x, e.y, 'SUNBEAM 48!', '#fde047', 1.3);
          }
        });
      }
    } else if (skill.id === 'barkskin_ward') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 2);
      this.player.fortressShieldTimer = Math.max(this.player.fortressShieldTimer, 4.0);
      this.addShockwave(this.player.x, this.player.y, 105, '#22c55e', 0.35);
      sounds.shieldRecharge();
    } else if (skill.id === 'feral_pounce') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 170, dirY * 170, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.2);
      this.addSlashArc(dest.x, dest.y, 82, this.player.rotation, '#4ade80');
      sounds.meleeSlash();
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 55 || Math.hypot(e.x - dest.x, e.y - dest.y) < 95) {
            e.hp -= 40;
            this.addFloatingText(e.x, e.y, 'POUNCE 40!', '#4ade80', 1.25);
          }
        });
      }
    } else if (skill.id === 'druid_world_guardian') {
      const pos = this.moveWithCollision(this.player.x, this.player.y, dirX * 36, dirY * 36, 18);
      this.activeEffects.mechaGolems.push({
        x: pos.x,
        y: pos.y,
        hp: 400,
        maxHp: 400,
        timer: 13.0,
        attackTimer: 0,
        missileTimer: 1.0,
      });
      this.activeEffects.consecrationZones.push({
        x: this.player.x,
        y: this.player.y,
        radius: 165,
        duration: 10.0,
        healTick: 0.3,
      });
      this.addShockwave(this.player.x, this.player.y, 175, '#4ade80', 0.5);
      sounds.levelUp();
    } else if (skill.id === 'druid_natures_fury') {
      this.screenShake = 2.0;
      sounds.explosion();
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addShockwave(this.player.x, this.player.y, 280, '#22c55e', 0.6);
      if (currentRoom && currentRoom.enemies.length > 0) {
        currentRoom.enemies.forEach(e => {
          this.addSkyBeam(e.x, e.y, 60, '#4ade80', 0.55);
          e.hp -= 145;
          e.frozenTimer = Math.max(e.frozenTimer, 3.5);
          this.addFloatingText(e.x, e.y, 'GAIA 145!', '#4ade80', 1.5);
        });
      }
    } else if (skill.id === 'druid_primal_avatar') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this.berserkTimer = Math.max(this.berserkTimer, 8.0);
      for (let g = -1; g <= 1; g += 2) {
        const pos = this.moveWithCollision(this.player.x, this.player.y, g * 32, 20, 15);
        this.activeEffects.minions.push({
          id: `avatar_bear_${Math.random()}`,
          kind: 'grizzly_bear',
          x: pos.x,
          y: pos.y,
          hp: 240,
          maxHp: 240,
          damage: 28,
          speed: 235,
          timer: 13.0,
          attackTimer: 0,
          facingRight: true,
        });
      }
      this.addShockwave(this.player.x, this.player.y, 165, '#4ade80', 0.45);
      sounds.levelUp();

    // ==========================================
    // 12. RONIN SKILLS (5 Normal + 3 Ultimate)
    // ==========================================
    } else if (skill.id === 'iaijutsu_dash') {
      const startX = this.player.x;
      const startY = this.player.y;
      const dest = this.moveWithCollision(startX, startY, dirX * 200, dirY * 200, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.0);
      this.bullets = this.bullets.filter(b => b.fromPlayer || this.distanceToSegment(b.x, b.y, startX, startY, dest.x, dest.y) > 48);
      this.addSlashArc(dest.x, dest.y, 84, this.player.rotation, '#38bdf8');
      this.activeEffects.lightningBolts.push({
        points: [{ x: startX, y: startY }, { x: dest.x, y: dest.y }],
        color: '#38bdf8',
        life: 0.28,
        maxLife: 0.28,
      });
      sounds.meleeSlash();
      let killed = false;
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (this.distanceToSegment(e.x, e.y, startX, startY, dest.x, dest.y) < 58 || Math.hypot(e.x - dest.x, e.y - dest.y) < 95) {
            e.hp -= 42;
            this.addFloatingText(e.x, e.y, 'FLASH 42!', '#38bdf8', 1.25);
            if (e.hp <= 0) killed = true;
          }
        });
      }
      if (killed) {
        skill.currentCooldown = 0;
        this.addFloatingText(this.player.x, this.player.y - 48, 'DRAW RESET!', '#38bdf8', 1.25);
      }
    } else if (skill.id === 'wind_wall') {
      this.player.fortressShieldTimer = Math.max(this.player.fortressShieldTimer, 4.0);
      this.overchargeSpeedTimer = Math.max(this.overchargeSpeedTimer, 4.0);
      this.addSlashArc(this.player.x, this.player.y, 115, 0, '#38bdf8', true, 0.35);
      sounds.meleeSlash();
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 120) {
            e.hp -= 34;
            this.addFloatingText(e.x, e.y, 'GALE 34', '#38bdf8', 1.15);
          }
        });
      }
    } else if (skill.id === 'crescent_wave') {
      sounds.meleeSlash();
      this.addSlashArc(this.player.x, this.player.y, 90, this.player.rotation, '#38bdf8');
      for (let i = -1; i <= 1; i++) {
        const a = this.player.rotation + i * 0.16;
        this.bullets.push({
          id: `getsuga_${Math.random()}`,
          x: this.player.x + Math.cos(a) * 20,
          y: this.player.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 660,
          vy: Math.sin(a) * 660,
          radius: 11,
          damage: 32,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 1,
          color: '#38bdf8',
          lifetime: 1.6,
        });
      }
    } else if (skill.id === 'zen_focus') {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3);
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 35);
      this.guaranteedCrit = true;
      this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) > 135);
      this.addShockwave(this.player.x, this.player.y, 130, '#bae6fd', 0.4);
      sounds.shieldRecharge();
      this.addFloatingText(this.player.x, this.player.y - 22, 'ZEN FOCUS: 200% CRIT!', '#38bdf8', 1.15);
    } else if (skill.id === 'thunder_step') {
      const stepDist = this.currentTarget
        ? Math.min(200, Math.hypot(this.currentTarget.x - this.player.x, this.currentTarget.y - this.player.y))
        : 165;
      const dest = this.moveWithCollision(this.player.x, this.player.y, dirX * stepDist, dirY * stepDist, this.player.radius);
      this.player.x = dest.x;
      this.player.y = dest.y;
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 1.2);
      this.addSkyBeam(dest.x, dest.y, 52, '#38bdf8', 0.45);
      this.addSlashArc(dest.x, dest.y, 95, 0, '#38bdf8', true, 0.35);
      sounds.explosion();
      const hitRoom = this.getCurrentRoom() || currentRoom;
      if (hitRoom) {
        hitRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - dest.x, e.y - dest.y) < 125) {
            e.hp -= 46;
            e.frozenTimer = Math.max(e.frozenTimer, 2.0);
            this.addFloatingText(e.x, e.y, 'RAIJIN 46!', '#38bdf8', 1.3);
          }
        });
      }
    } else if (skill.id === 'ronin_thousand_cuts') {
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, 3.0);
      this.screenShake = 2.0;
      this.bullets = this.bullets.filter(b => b.fromPlayer);
      this.addSlashArc(this.player.x, this.player.y, 240, 0, '#38bdf8', true, 0.55);
      sounds.meleeSlash();
      if (currentRoom) {
        currentRoom.enemies.forEach((e, idx) => {
          this.addSlashArc(e.x, e.y, 64, (idx * Math.PI) / 3, '#38bdf8', false, 0.45);
          this.addSlashArc(e.x, e.y, 64, (idx * Math.PI) / 3 + Math.PI / 2, '#e0f2fe', false, 0.45);
          e.hp -= 155;
          e.frozenTimer = Math.max(e.frozenTimer, 2.5);
          this.addFloatingText(e.x, e.y, 'JUDGEMENT 155!', '#38bdf8', 1.55);
        });
      }
    } else if (skill.id === 'ronin_raijin_avatar') {
      this.berserkTimer = 8.0;
      this.archangelTimer = 8.0;
      this.activeEffects.orbitalShields = [
        { angle: 0, radius: 60, timer: 8.0 },
        { angle: Math.PI / 2, radius: 60, timer: 8.0 },
        { angle: Math.PI, radius: 60, timer: 8.0 },
        { angle: (Math.PI * 3) / 2, radius: 60, timer: 8.0 },
      ];
      this.addShockwave(this.player.x, this.player.y, 180, '#38bdf8', 0.5);
      sounds.explosion();
    } else if (skill.id === 'ronin_mirage_tempest') {
      const offsets: Vector2D[] = [
        { x: -36, y: -26 },
        { x: 36, y: -26 },
        { x: -36, y: 26 },
        { x: 36, y: 26 },
      ];
      offsets.forEach((off, idx) => {
        const pos = this.moveWithCollision(this.player.x, this.player.y, off.x, off.y, 12);
        this.activeEffects.clones.push({
          x: pos.x,
          y: pos.y,
          timer: 10.0,
          attackTimer: idx * 0.1,
          isPhantom: true,
        });
      });
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        this.bullets.push({
          id: `mirage_blade_${Math.random()}`,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(ang) * 640,
          vy: Math.sin(ang) * 640,
          radius: 6,
          damage: 22,
          isCrit: true,
          fromPlayer: true,
          piercing: true,
          bouncesLeft: 2,
          color: '#38bdf8',
          lifetime: 2.0,
        });
      }
      this.addShockwave(this.player.x, this.player.y, 165, '#38bdf8', 0.45);
    }
  }

  private updateSkillEffects(dt: number) {
    const currentRoom = this.getCurrentRoom();
    const elemMult = 1 + this.passiveBuffs.elementalBonus;

    // 1. Poison / Magma / Plague pools
    const hasCorrosiveBrew = this.hasExclusiveBuff('alchemist_corrosive_brew');
    const poolRadiusMult = hasCorrosiveBrew ? 1.3 : 1.0;
    const poolDmgMult = hasCorrosiveBrew ? 1.4 : 1.0;
    this.activeEffects.poisonPools = this.activeEffects.poisonPools.filter(pool => {
      pool.duration -= dt;
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          const d = Math.hypot(e.x - pool.x, e.y - pool.y);
          if (d < pool.radius * poolRadiusMult + e.radius * 0.5) {
            e.hp -= 16 * elemMult * poolDmgMult * dt;
            e.burnTimer = Math.max(e.burnTimer, 0.8);
            if (hasCorrosiveBrew && d > 6 && !e.isBoss) {
              e.x += ((pool.x - e.x) / d) * 28 * dt;
              e.y += ((pool.y - e.y) / d) * 28 * dt;
              this.clampEntityToRoom(e, currentRoom);
            }
          }
        });
      }
      return pool.duration > 0;
    });

    // 2. Paladin Consecration Zones
    this.activeEffects.consecrationZones = this.activeEffects.consecrationZones.filter(zone => {
      zone.duration -= dt;
      zone.healTick -= dt;

      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - zone.x, e.y - zone.y) < zone.radius) {
            e.hp -= 18 * elemMult * dt;
            e.burnTimer = Math.max(e.burnTimer, 0.6);
          }
        });
      }

      if (zone.healTick <= 0) {
        zone.healTick = 1.8;
        if (Math.hypot(this.player.x - zone.x, this.player.y - zone.y) < zone.radius) {
          if (this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
            sounds.shieldRecharge();
          }
        }
      }

      return zone.duration > 0;
    });

    // 3. Paladin Sanctuary Domes
    this.activeEffects.sanctuaryDomes = this.activeEffects.sanctuaryDomes.filter(dome => {
      dome.duration -= dt;
      dome.zapTick -= dt;

      // Vaporize enemy bullets touching or inside the dome
      this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - dome.x, b.y - dome.y) > dome.radius);

      if (dome.zapTick <= 0) {
        dome.zapTick = 0.6;
        if (Math.hypot(this.player.x - dome.x, this.player.y - dome.y) < dome.radius && this.player.shield < this.player.maxShield) {
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
        }
        if (currentRoom) {
          currentRoom.enemies.forEach(e => {
            if (Math.hypot(e.x - dome.x, e.y - dome.y) < dome.radius) {
              e.hp -= 15;
              this.activeEffects.lightningBolts.push({
                points: [
                  { x: dome.x, y: dome.y - 20 },
                  { x: e.x, y: e.y },
                ],
                color: '#fde047',
                life: 0.2,
                maxLife: 0.2,
              });
            }
          });
        }
      }

      return dome.duration > 0;
    });

    // 4. Orbital Shields (Knight Ultimate)
    if (this.activeEffects.orbitalShields.length > 0) {
      this.activeEffects.orbitalShields = this.activeEffects.orbitalShields.filter(shield => {
        shield.timer -= dt;
        shield.angle += dt * 4.0;

        const sx = this.player.x + Math.cos(shield.angle) * shield.radius;
        const sy = this.player.y + Math.sin(shield.angle) * shield.radius;

        this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - sx, b.y - sy) >= 24);

        if (currentRoom) {
          currentRoom.enemies.forEach(e => {
            if (Math.hypot(e.x - sx, e.y - sy) < 26 + e.radius * 0.5) {
              e.hp -= 38 * dt;
            }
          });
        }

        return shield.timer > 0;
      });
    }

    // 5. Flame Barrier (Mage)
    if (this.flameBarrierTimer > 0) {
      this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) >= 48);
      if (currentRoom) {
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 62) {
            e.hp -= 18 * elemMult * dt;
            e.burnTimer = Math.max(e.burnTimer, 1.0);
          }
        });
      }
    }

    // 6. Wraith Shroud & Lich Death Aura (Necromancer)
    if (this.wraithTimer > 0 && currentRoom) {
      currentRoom.enemies.forEach(e => {
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 95) {
          e.hp -= 22 * dt;
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 12 * dt);
        }
      });
    }
    if (this.lichTimer > 0 && currentRoom) {
      currentRoom.enemies.forEach(e => {
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 170) {
          e.hp -= 25 * dt;
        }
      });
    }

    // 7. Blizzard Domain (Mage Ultimate)
    if (this.blizzardTimer > 0 && currentRoom) {
      currentRoom.enemies.forEach(e => {
        e.frozenTimer = Math.max(e.frozenTimer, 0.5);
        e.hp -= 18 * elemMult * dt;
      });
    }

    // 8. Auto & Vulcan Turrets
    const hasOverclockedServos = this.hasExclusiveBuff('engineer_overclocked_servos');
    this.activeEffects.turrets = this.activeEffects.turrets.filter(turret => {
      turret.timer -= dt * (hasOverclockedServos ? 0.75 : 1.0);
      turret.attackTimer -= dt * (hasOverclockedServos ? 1.3 : 1.0);

      if (turret.attackTimer <= 0 && currentRoom && currentRoom.enemies.length > 0) {
        let closest = currentRoom.enemies[0];
        let bestD = Infinity;
        for (const e of currentRoom.enemies) {
          const d = Math.hypot(e.x - turret.x, e.y - turret.y);
          if (d < bestD) {
            bestD = d;
            closest = e;
          }
        }
        const angle = Math.atan2(closest.y - turret.y, closest.x - turret.x);
        turret.attackTimer = turret.isVulcan ? 0.15 : 0.22;

        this.bullets.push({
          id: `turret_bullet_${Math.random()}`,
          x: turret.x,
          y: turret.y,
          vx: Math.cos(angle) * (turret.isVulcan ? 620 : 560),
          vy: Math.sin(angle) * (turret.isVulcan ? 620 : 560),
          radius: turret.isVulcan ? 4.5 : 4,
          damage: turret.isVulcan ? 12 : 9,
          isCrit: Boolean(turret.isVulcan),
          fromPlayer: true,
          piercing: false,
          bouncesLeft: hasOverclockedServos ? 1 : 0,
          color: turret.isVulcan ? '#f97316' : '#06b6d4',
          lifetime: 1.5,
          burnChance: turret.isVulcan ? 0.5 : undefined,
        });
        sounds.shoot('pistol');
      }

      return turret.timer > 0;
    });

    // 9. Clones & Phantoms (Assassin & Ronin)
    this.activeEffects.clones = this.activeEffects.clones.filter(clone => {
      clone.timer -= dt;
      clone.attackTimer -= dt;

      if (clone.attackTimer <= 0 && currentRoom && currentRoom.enemies.length > 0) {
        const target = currentRoom.enemies[0];
        const angle = Math.atan2(target.y - clone.y, target.x - clone.x);
        clone.attackTimer = clone.isPhantom ? 0.28 : 0.36;

        this.bullets.push({
          id: `clone_bullet_${Math.random()}`,
          x: clone.x,
          y: clone.y,
          vx: Math.cos(angle) * 540,
          vy: Math.sin(angle) * 540,
          radius: 4.5,
          damage: clone.isPhantom ? 15 : 9,
          isCrit: Boolean(clone.isPhantom),
          fromPlayer: true,
          piercing: Boolean(clone.isPhantom),
          bouncesLeft: 0,
          color: clone.isPhantom ? '#a855f7' : '#10b981',
          lifetime: 1.5,
        });
      }

      if (clone.timer <= 0 && clone.isPhantom && currentRoom) {
        this.addShockwave(clone.x, clone.y, 90, '#a855f7', 0.35);
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - clone.x, e.y - clone.y) < 95) {
            e.hp -= 50;
            this.addFloatingText(e.x, e.y, 'PHANTOM 50!', '#a855f7', 1.2);
          }
        });
      }

      return clone.timer > 0;
    });

    // 10. Summoned Minions (Wolves, Skeletons, Crimson Bats & Grizzly Bears)
    this.activeEffects.minions = this.activeEffects.minions.filter(minion => {
      minion.timer -= dt;
      minion.attackTimer = Math.max(0, minion.attackTimer - dt);

      if (currentRoom && currentRoom.enemies.length > 0) {
        let target = currentRoom.enemies[0];
        let minDist = Infinity;
        for (const e of currentRoom.enemies) {
          const d = Math.hypot(e.x - minion.x, e.y - minion.y);
          if (d < minDist) {
            minDist = d;
            target = e;
          }
        }

        const dx = target.x - minion.x;
        const dy = target.y - minion.y;
        const dist = Math.hypot(dx, dy);
        minion.facingRight = dx >= 0;

        if (dist > 22) {
          const step = this.moveWithCollision(minion.x, minion.y, (dx / dist) * minion.speed * dt, (dy / dist) * minion.speed * dt, 10);
          minion.x = step.x;
          minion.y = step.y;
        }

        if (dist < target.radius + 28 && minion.attackTimer <= 0) {
          minion.attackTimer =
            minion.kind === 'alpha_wolf' || minion.kind === 'dread_skeleton' || minion.kind === 'crimson_bat'
              ? 0.45
              : 0.6;
          let minionDmgMult = 1.0;
          if (this.hasExclusiveBuff('necromancer_dread_command') && minion.kind.includes('skeleton')) {
            minionDmgMult *= 1.3;
          }
          if (this.hasExclusiveBuff('druid_pack_bond') && (minion.kind.includes('wolf') || minion.kind === 'grizzly_bear')) {
            minionDmgMult *= 1.35;
          }
          const finalMinionDmg = Math.round(minion.damage * minionDmgMult);
          target.hp -= finalMinionDmg;
          const isEliteMinion =
            minion.kind === 'alpha_wolf' || minion.kind === 'dread_skeleton' || minion.kind === 'grizzly_bear';
          const hitColor =
            minion.kind === 'crimson_bat'
              ? '#fb7185'
              : minion.kind === 'grizzly_bear'
              ? '#4ade80'
              : minion.kind.includes('wolf')
              ? '#34d399'
              : '#d946ef';
          this.addSlashArc(target.x, target.y, 28, Math.atan2(dy, dx), hitColor, false, 0.18);
          this.addFloatingText(target.x, target.y - 8, `${finalMinionDmg}`, hitColor, isEliteMinion ? 1.1 : 0.95);
          sounds.hitEnemy(isEliteMinion);

          if (minion.kind === 'alpha_wolf' || minion.kind === 'crimson_bat') {
            this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 4);
          }
        }
      } else {
        // Follow player loosely when idle
        const dx = this.player.x - minion.x;
        const dy = this.player.y - minion.y;
        const d = Math.hypot(dx, dy);
        if (d > 56) {
          const step = this.moveWithCollision(minion.x, minion.y, (dx / d) * 165 * dt, (dy / d) * 165 * dt, 10);
          minion.x = step.x;
          minion.y = step.y;
          minion.facingRight = dx >= 0;
        }
      }

      if (minion.timer <= 0 && minion.kind === 'dread_skeleton' && currentRoom) {
        this.addShockwave(minion.x, minion.y, 80, '#d946ef', 0.35);
        currentRoom.enemies.forEach(e => {
          if (Math.hypot(e.x - minion.x, e.y - minion.y) < 85) {
            e.hp -= 40;
          }
        });
      }

      return minion.timer > 0 && minion.hp > 0;
    });

    // 11. Mecha-Golem Titan (Alchemist & Engineer Ultimate)
    this.activeEffects.mechaGolems = this.activeEffects.mechaGolems.filter(golem => {
      golem.timer -= dt * (hasOverclockedServos ? 0.75 : 1.0);
      golem.attackTimer -= dt * (hasOverclockedServos ? 1.3 : 1.0);
      golem.missileTimer -= dt * (hasOverclockedServos ? 1.25 : 1.0);

      if (currentRoom && currentRoom.enemies.length > 0) {
        const target = currentRoom.enemies[0];
        const dx = target.x - golem.x;
        const dy = target.y - golem.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 64) {
          const step = this.moveWithCollision(golem.x, golem.y, (dx / dist) * 115 * dt, (dy / dist) * 115 * dt, 16);
          golem.x = step.x;
          golem.y = step.y;
        }

        if (golem.attackTimer <= 0) {
          golem.attackTimer = 0.18;
          const angle = Math.atan2(dy, dx);
          this.bullets.push({
            id: `golem_bullet_${Math.random()}`,
            x: golem.x,
            y: golem.y,
            vx: Math.cos(angle) * 600,
            vy: Math.sin(angle) * 600,
            radius: 5,
            damage: 15,
            isCrit: true,
            fromPlayer: true,
            piercing: true,
            bouncesLeft: 0,
            color: '#f59e0b',
            lifetime: 1.5,
          });
          sounds.shoot('pistol');
        }

        if (golem.missileTimer <= 0) {
          golem.missileTimer = 2.0;
          sounds.shoot('explosive');
          const angle = Math.atan2(dy, dx);
          this.bullets.push({
            id: `golem_missile_${Math.random()}`,
            x: golem.x,
            y: golem.y,
            vx: Math.cos(angle) * 460,
            vy: Math.sin(angle) * 460,
            radius: 8,
            damage: 45,
            isCrit: true,
            fromPlayer: true,
            piercing: false,
            bouncesLeft: 0,
            color: '#ef4444',
            lifetime: 2.0,
            aoeRadius: 80,
          });
        }
      }

      return golem.timer > 0 && golem.hp > 0;
    });

    // 12.Transient Skill Visuals (Lightning Bolts, Shockwaves, Sky Beams, Slash Arcs)
    this.activeEffects.lightningBolts = this.activeEffects.lightningBolts.filter(b => {
      b.life -= dt;
      return b.life > 0;
    });
    this.activeEffects.shockwaves = this.activeEffects.shockwaves.filter(sw => {
      sw.life -= dt;
      const progress = 1 - sw.life / sw.maxLife;
      sw.currentRadius = 8 + (sw.maxRadius - 8) * progress;
      return sw.life > 0;
    });
    this.activeEffects.skyBeams = this.activeEffects.skyBeams.filter(beam => {
      beam.life -= dt;
      return beam.life > 0;
    });
    this.activeEffects.slashArcs = this.activeEffects.slashArcs.filter(arc => {
      arc.life -= dt;
      return arc.life > 0;
    });
  }

  private updateBullets(dt: number) {
    // Active player melee sweeps destroy enemy bullets!
    const playerMeleeSweeps = this.bullets.filter(b => b.fromPlayer && b.isMelee);

    this.bullets = this.bullets.filter(bullet => {
      bullet.lifetime -= dt;
      if (bullet.lifetime <= 0) {
        if (bullet.bulletShape === 'blackhole' && bullet.aoeRadius) {
          this.addShockwave(bullet.x, bullet.y, bullet.aoeRadius, '#a855f7', 0.35);
          const endRoom = this.getRoomAt(bullet.x, bullet.y, 12);
          if (endRoom) {
            endRoom.enemies.forEach(e => {
              if (Math.hypot(e.x - bullet.x, e.y - bullet.y) < bullet.aoeRadius!) {
                e.hp -= bullet.damage;
              }
            });
          }
        }
        return false;
      }

      if (bullet.spinAngle !== undefined) {
        bullet.spinAngle += dt * (bullet.bulletShape === 'sawblade' ? 28 : 20);
      }

      // Boomerang Glaive return curve
      if (bullet.bulletShape === 'glaive') {
        if (!bullet.isReturning) {
          bullet.returnTimer = (bullet.returnTimer ?? 0.42) - dt;
          if (bullet.returnTimer <= 0) {
            bullet.isReturning = true;
          }
        } else {
          const toPlayerX = this.player.x - bullet.x;
          const toPlayerY = this.player.y - bullet.y;
          const d = Math.hypot(toPlayerX, toPlayerY);
          if (d < 24) {
            return false; // Caught cleanly on return!
          }
          const desiredVx = (toPlayerX / d) * 580;
          const desiredVy = (toPlayerY / d) * 580;
          const turnAlpha = 1 - Math.exp(-9 * dt);
          bullet.vx += (desiredVx - bullet.vx) * turnAlpha;
          bullet.vy += (desiredVy - bullet.vy) * turnAlpha;
        }
      }

      const prevX = bullet.x;
      const prevY = bullet.y;
      const nextX = bullet.x + bullet.vx * dt;
      const nextY = bullet.y + bullet.vy * dt;

      // Melee arcs stay anchored/short-lived without wall bouncing
      if (!bullet.isMelee) {
        const wallR = Math.min(4, bullet.radius);
        const hitWallX = !this.isCircleInWalkableSpace(nextX, prevY, wallR, false);
        const hitWallY = !this.isCircleInWalkableSpace(hitWallX ? prevX : nextX, nextY, wallR, false);

        if (hitWallX || hitWallY) {
          if (bullet.isReturning && bullet.bulletShape === 'glaive') {
            bullet.x = nextX;
            bullet.y = nextY;
          } else if (bullet.bouncesLeft > 0) {
            bullet.bouncesLeft--;
            if (hitWallX) bullet.vx *= -1;
            if (hitWallY) bullet.vy *= -1;
            bullet.x = prevX + bullet.vx * dt;
            bullet.y = prevY + bullet.vy * dt;
            if (bullet.bulletShape === 'sawblade') {
              this.spawnRadialParticles(prevX, prevY, 4, 130, '#fbbf24', 2.5, 0.16);
            }
          } else {
            if (bullet.leaveFirePool) {
              this.activeEffects.poisonPools.push({
                x: prevX,
                y: prevY,
                radius: 26,
                duration: 2.2,
                color: '#f97316',
              });
            }
            this.spawnRadialParticles(prevX, prevY, 3, 90, bullet.color, 2.5, 0.18);
            return false;
          }
        } else {
          bullet.x = nextX;
          bullet.y = nextY;
        }
      } else {
        bullet.x = nextX;
        bullet.y = nextY;
      }

      const bulletRoom = this.getRoomAt(bullet.x, bullet.y, 12);

      // Singularity Black Hole gravitational pull on nearby monsters
      if (bullet.fromPlayer && bullet.pullRadius && bulletRoom) {
        bulletRoom.enemies.forEach(enemy => {
          const gx = bullet.x - enemy.x;
          const gy = bullet.y - enemy.y;
          const gd = Math.hypot(gx, gy);
          if (gd > 8 && gd < bullet.pullRadius!) {
            enemy.x += (gx / gd) * 95 * dt;
            enemy.y += (gy / gd) * 95 * dt;
            this.clampEntityToRoom(enemy, bulletRoom);
          }
        });
      }

      // Check bullet against room obstacles (pillars block non-melee bullets; crates & barrels take damage)
      if (bulletRoom && !bullet.isMelee) {
        for (const obs of bulletRoom.obstacles) {
          if (obs.type === 'pillar' || obs.type === 'brazier' || obs.type === 'crate' || obs.type === 'barrel') {
            if (
              bullet.x + bullet.radius > obs.x &&
              bullet.x - bullet.radius < obs.x + obs.width &&
              bullet.y + bullet.radius > obs.y &&
              bullet.y - bullet.radius < obs.y + obs.height
            ) {
              if ((obs.type === 'crate' || obs.type === 'barrel') && obs.hp !== undefined) {
                obs.hp -= bullet.damage;
                sounds.hitEnemy(false);
                if (obs.hp <= 0) {
                  this.destroyObstacle(obs, bulletRoom);
                }
                if (!bullet.piercing) return false;
              } else if (obs.type === 'pillar' || obs.type === 'brazier') {
                if (bullet.bouncesLeft > 0) {
                  bullet.bouncesLeft--;
                  bullet.vx *= -1;
                  bullet.vy *= -1;
                } else if (!(bullet.isReturning && bullet.bulletShape === 'glaive')) {
                  return false;
                }
              }
            }
          }
        }
      }

      // Player Bullets -> Hit Enemies
      if (bullet.fromPlayer && bulletRoom) {
        for (let i = bulletRoom.enemies.length - 1; i >= 0; i--) {
          const enemy = bulletRoom.enemies[i];
          const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

          if (dist < enemy.radius + bullet.radius) {
            let hitDamage = bullet.damage;
            const hpRatioBefore = enemy.hp / enemy.maxHp;
            if (this.hasExclusiveBuff('assassin_phantom_edge') && (hpRatioBefore > 0.85 || hpRatioBefore < 0.45)) {
              hitDamage = Math.round(hitDamage * 1.35);
            }

            enemy.hp -= hitDamage;
            sounds.hitEnemy(bullet.isCrit);
            this.addFloatingText(
              enemy.x,
              enemy.y - 10,
              `${bullet.isCrit ? 'CRIT ' : ''}${hitDamage}`,
              bullet.isCrit ? '#fbbf24' : '#f8fafc',
              bullet.isCrit ? 1.2 : 1.0
            );

            // Ronin Exclusive Buff (Tempest Poise): every 3rd Critical Hit unleashes an Azure Wind Crescent!
            if (bullet.isCrit && !bullet.id.startsWith('tempest_poise_') && this.hasExclusiveBuff('ronin_tempest_rhythm')) {
              this.critHitCounter++;
              if (this.critHitCounter % 3 === 0) {
                const waveAng = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
                this.bullets.push({
                  id: `tempest_poise_${Math.random()}`,
                  x: this.player.x + Math.cos(waveAng) * 20,
                  y: this.player.y + Math.sin(waveAng) * 20,
                  vx: Math.cos(waveAng) * 640,
                  vy: Math.sin(waveAng) * 640,
                  radius: 11,
                  damage: 26,
                  isCrit: true,
                  fromPlayer: true,
                  piercing: true,
                  bouncesLeft: 0,
                  color: '#38bdf8',
                  glowColor: '#7dd3fc',
                  lifetime: 1.25,
                });
              }
            }

            // Engineer Exclusive Buff (Arc Welder Rounds): 22% chance to arc chain lightning on ranged hit!
            if (!bullet.isMelee && this.hasExclusiveBuff('engineer_plasma_munitions') && Math.random() < 0.22) {
              const chainTarget = bulletRoom.enemies.find(
                other => other.id !== enemy.id && other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 175
              );
              if (chainTarget) {
                chainTarget.hp -= 18;
                this.activeEffects.lightningBolts.push({
                  points: [
                    { x: enemy.x, y: enemy.y },
                    { x: chainTarget.x, y: chainTarget.y },
                  ],
                  color: '#38bdf8',
                  life: 0.22,
                  maxLife: 0.22,
                });
                this.addFloatingText(chainTarget.x, chainTarget.y - 12, '⚡18', '#38bdf8', 0.95);
              }
            }

            const statusDurMult = this.hasExclusiveBuff('mage_elemental_mastery') ? 1.4 : 1.0;
            if (bullet.freezeChance && Math.random() < bullet.freezeChance) {
              const freezeDur = (enemy.isBoss ? 0.45 : 2.5) * statusDurMult;
              enemy.frozenTimer = Math.max(enemy.frozenTimer, freezeDur);
              this.addFloatingText(enemy.x, enemy.y - 25, enemy.isBoss ? 'CHILLED' : 'FROZEN', '#38bdf8', 1.0);
            }
            if (bullet.burnChance && Math.random() < bullet.burnChance) {
              enemy.burnTimer = Math.max(enemy.burnTimer, 3.0 * statusDurMult);
            }
            if (bullet.leaveFirePool) {
              this.activeEffects.poisonPools.push({
                x: bullet.x,
                y: bullet.y,
                radius: 26,
                duration: 2.2,
                color: '#f97316',
              });
            }

            if (bullet.aoeRadius) {
              sounds.explosion();
              this.screenShake = Math.max(this.screenShake, 0.45);
              this.addShockwave(bullet.x, bullet.y, bullet.aoeRadius, bullet.color, 0.3);
              bulletRoom.enemies.forEach(other => {
                if (other.id !== enemy.id && Math.hypot(other.x - bullet.x, other.y - bullet.y) < bullet.aoeRadius!) {
                  other.hp -= Math.round(hitDamage * 0.7);
                }
              });
            }

            this.spawnRadialParticles(bullet.x, bullet.y, 4, 140, bullet.color, 3, 0.22);

            if (!bullet.piercing) return false;
          }
        }
      }

      // Enemy Bullets -> Check Player Defenses, Summons, & Player Hit
      if (!bullet.fromPlayer) {
        // 1. Sliced out of the air by active player Melee Weapon Sweep!
        for (const sweep of playerMeleeSweeps) {
          if (Math.hypot(bullet.x - sweep.x, bullet.y - sweep.y) < sweep.radius + bullet.radius) {
            if (this.hasExclusiveBuff('ronin_iaido_mastery')) {
              bullet.fromPlayer = true;
              bullet.vx *= -1.45;
              bullet.vy *= -1.45;
              bullet.isCrit = true;
              bullet.damage = Math.max(16, Math.round(bullet.damage * 2.5));
              bullet.color = '#38bdf8';
              bullet.lifetime = Math.max(bullet.lifetime, 1.5);
              this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 4);
              this.spawnRadialParticles(bullet.x, bullet.y, 5, 140, '#38bdf8', 3, 0.22);
              return true;
            }
            this.spawnRadialParticles(bullet.x, bullet.y, 4, 120, '#38bdf8', 2.5, 0.2);
            return false;
          }
        }

        // 2. Paladin Holy Aegis absorbs enemy bullets into Energy + Shield!
        if (this.aegisAbsorbTimer > 0 && Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y) < 46) {
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 8);
          if (this.player.shield < this.player.maxShield && Math.random() < 0.5) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
          }
          this.addFloatingText(this.player.x, this.player.y - 24, '+8 MP', '#fbbf24', 0.85);
          sounds.shieldRecharge();
          return false;
        }

        // 3. Fortress Shield / Iron Skin reflects bullets back!
        if (this.player.fortressShieldTimer > 0 && Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y) < 44) {
          bullet.fromPlayer = true;
          bullet.vx *= -1.25;
          bullet.vy *= -1.25;
          bullet.color = '#38bdf8';
          bullet.damage = Math.max(12, bullet.damage * 2);
          sounds.meleeSlash();
          return true;
        }

        // 4. Mecha-Golems & Skeletal Minions intercept enemy bullets!
        for (const golem of this.activeEffects.mechaGolems) {
          if (Math.hypot(bullet.x - golem.x, bullet.y - golem.y) < 24 + bullet.radius) {
            golem.hp -= bullet.damage;
            return false;
          }
        }
        for (const minion of this.activeEffects.minions) {
          if (
            (minion.kind.includes('skeleton') || minion.kind === 'grizzly_bear') &&
            Math.hypot(bullet.x - minion.x, bullet.y - minion.y) < (minion.kind === 'grizzly_bear' ? 20 : 15) + bullet.radius
          ) {
            minion.hp -= bullet.damage;
            return false;
          }
        }

        // 5. Direct Player Hit
        const dist = Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y);
        if (dist < this.player.radius + bullet.radius) {
          this.damagePlayer(bullet.damage);
          return false;
        }
      }

      return true;
    });
  }

  private destroyObstacle(obs: Obstacle, room: DungeonRoom) {
    room.obstacles = room.obstacles.filter(o => o !== obs);
    sounds.explosion();
    this.screenShake = Math.max(this.screenShake, 0.4);

    if (obs.isExplosive) {
      this.addShockwave(obs.x + 16, obs.y + 16, 95, '#ef4444', 0.35);
      room.enemies.forEach(e => {
        if (Math.hypot(e.x - (obs.x + 16), e.y - (obs.y + 16)) < 95) {
          e.hp -= 40;
          this.addFloatingText(e.x, e.y, 'TNT 40!', '#ef4444', 1.2);
        }
      });
      if (!this.passiveBuffs.trapImmunity && Math.hypot(this.player.x - (obs.x + 16), this.player.y - (obs.y + 16)) < 90) {
        this.damagePlayer(4);
      }
    } else if (Math.random() < 0.6) {
      room.drops.push({
        id: `drop_${Math.random()}`,
        type: Math.random() < 0.5 ? 'coin' : 'energy',
        x: obs.x + 16,
        y: obs.y + 16,
        value: 1,
        bobPhase: Math.random() * Math.PI,
      });
    }
  }

  private updateEnemies(dt: number) {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return;

    const elemMult = 1 + this.passiveBuffs.elementalBonus;

    for (let i = currentRoom.enemies.length - 1; i >= 0; i--) {
      const enemy = currentRoom.enemies[i];

      if (enemy.burnTimer > 0) {
        enemy.burnTimer -= dt;
        enemy.hp -= 7 * elemMult * dt;
      }

      if (enemy.hp <= 0) {
        this.handleEnemyDeath(enemy, currentRoom);
        currentRoom.enemies.splice(i, 1);
        continue;
      }

      // Bosses resist crowd-control lockouts (max 0.45s chill)
      if (enemy.isBoss && enemy.frozenTimer > 0.45) {
        enemy.frozenTimer = 0.45;
      }

      if (enemy.frozenTimer > 0) {
        enemy.frozenTimer -= dt;
        continue;
      }

      // Boss Phase Transitions (<65% HP -> Phase 2 Enraged, <30% HP -> Phase 3 Berserk Overdrive)
      if (enemy.isBoss) {
        const hpRatio = enemy.hp / enemy.maxHp;
        const curPhase = enemy.bossPhase || 1;
        if (hpRatio <= 0.65 && curPhase < 2) {
          enemy.bossPhase = 2;
          enemy.attackTimer = 0.25;
          this.screenShake = Math.max(this.screenShake, 1.35);
          sounds.explosion();
          this.addShockwave(enemy.x, enemy.y, 220, '#f97316', 0.55);
          this.addFloatingText(enemy.x, enemy.y - 46, 'PHASE II: ENRAGED!', '#f97316', 1.35);
          this.spawnBossMinions(enemy, currentRoom, 2);
        } else if (hpRatio <= 0.3 && curPhase < 3) {
          enemy.bossPhase = 3;
          enemy.attackTimer = 0.15;
          this.screenShake = Math.max(this.screenShake, 1.85);
          sounds.explosion();
          this.addShockwave(enemy.x, enemy.y, 280, '#ef4444', 0.65);
          this.addFloatingText(enemy.x, enemy.y - 52, 'PHASE III: BERSERK!', '#ef4444', 1.45);
          this.spawnBossMinions(enemy, currentRoom, 2);
          // Immediate 20-orb Berserk Supernova
          for (let b = 0; b < 20; b++) {
            const ang = (b / 20) * Math.PI * 2;
            this.bullets.push({
              id: `boss_rage_${Math.random()}`,
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(ang) * 320,
              vy: Math.sin(ang) * 320,
              radius: 7,
              damage: 7 + this.floor.floorNumber,
              isCrit: false,
              fromPlayer: false,
              piercing: false,
              bouncesLeft: b % 2 === 0 ? 1 : 0,
              color: '#ef4444',
              lifetime: 4.0,
            });
          }
        }
      }

      // Determine AI target: Summoned Golems / Clones / Skeletons taunt nearby enemies, and Stealth hides the player!
      let targetX = this.player.x;
      let targetY = this.player.y;
      let hasValidTarget = this.stealthTimer <= 0;

      // Check taunt decoys
      let bestDecoyDist = 240;
      for (const golem of this.activeEffects.mechaGolems) {
        const d = Math.hypot(golem.x - enemy.x, golem.y - enemy.y);
        if (d < bestDecoyDist) {
          bestDecoyDist = d;
          targetX = golem.x;
          targetY = golem.y;
          hasValidTarget = true;
        }
      }
      for (const clone of this.activeEffects.clones) {
        const d = Math.hypot(clone.x - enemy.x, clone.y - enemy.y);
        if (d < bestDecoyDist) {
          bestDecoyDist = d;
          targetX = clone.x;
          targetY = clone.y;
          hasValidTarget = true;
        }
      }
      for (const minion of this.activeEffects.minions) {
        if (minion.kind.includes('skeleton') || minion.kind === 'grizzly_bear') {
          const d = Math.hypot(minion.x - enemy.x, minion.y - enemy.y);
          if (d < bestDecoyDist) {
            bestDecoyDist = d;
            targetX = minion.x;
            targetY = minion.y;
            hasValidTarget = true;
          }
        }
      }

      if (!hasValidTarget && !enemy.isBoss) {
        // Player is invisible in Smoke Vanish -> regular enemies wander aimlessly
        enemy.walkCycle += dt * 4;
        const wanderAngle = Number(enemy.id.slice(-4)) * 100 + this.lastTimestamp * 0.001;
        enemy.x += Math.cos(wanderAngle) * enemy.speed * 0.35 * dt;
        enemy.y += Math.sin(wanderAngle) * enemy.speed * 0.35 * dt;
        this.clampEntityToRoom(enemy, currentRoom);
        continue;
      }

      const dx = targetX - enemy.x;
      const dy = targetY - enemy.y;
      const dist = Math.hypot(dx, dy);

      enemy.facingRight = dx >= 0;
      const phaseMult = enemy.isBoss ? (enemy.bossPhase === 3 ? 1.42 : enemy.bossPhase === 2 ? 1.22 : 1.0) : 1.0;
      enemy.walkCycle += dt * 8.5 * phaseMult;

      // Active Boss Dash Surge!
      if (enemy.isBoss && enemy.bossDashTimer && enemy.bossDashTimer > 0) {
        enemy.bossDashTimer -= dt;
        enemy.x += (enemy.bossDashVx || 0) * dt;
        enemy.y += (enemy.bossDashVy || 0) * dt;
        this.clampEntityToRoom(enemy, currentRoom);

        // Leave menacing dash trail particles & occasional trail bullets
        if (Math.random() < 0.45) {
          this.spawnRadialParticles(enemy.x, enemy.y, 2, 70, enemy.color, 4, 0.25);
        }
        if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 6) {
          this.damagePlayer(9 + this.floor.floorNumber * 2);
        }
      } else {
        const isRanged = enemy.type === 'goblin_archer' || enemy.type === 'skeleton_mage';
        const desiredDist = enemy.isBoss ? 115 : isRanged ? 175 : 18;
        const moveSpd = enemy.speed * phaseMult;

        if (dist > desiredDist && dist > 0) {
          enemy.x += (dx / dist) * moveSpd * dt;
          enemy.y += (dy / dist) * moveSpd * dt;
        } else if (dist < desiredDist - 30 && isRanged && dist > 0) {
          enemy.x -= (dx / dist) * moveSpd * dt;
          enemy.y -= (dy / dist) * moveSpd * dt;
        } else if (enemy.isBoss && dist > 0) {
          // Boss strafes menacingly around the player at close-mid range
          const perpX = -dy / dist;
          const perpY = dx / dist;
          enemy.x += perpX * moveSpd * 0.65 * dt;
          enemy.y += perpY * moveSpd * 0.65 * dt;
        }

        this.clampEntityToRoom(enemy, currentRoom);
      }

      // Boss Phase 2 & 3 Continuous Secondary Spiral Stream!
      if (enemy.isBoss && (enemy.bossPhase || 1) >= 2) {
        enemy.bossSecondaryTimer = (enemy.bossSecondaryTimer ?? 0.4) - dt;
        if (enemy.bossSecondaryTimer <= 0) {
          enemy.bossSecondaryTimer = enemy.bossPhase === 3 ? 0.24 : 0.42;
          enemy.bossSpiralAngle = (enemy.bossSpiralAngle ?? 0) + 0.52;
          const streamArms = enemy.bossPhase === 3 ? 3 : 2;
          for (let arm = 0; arm < streamArms; arm++) {
            const sAng = enemy.bossSpiralAngle + (arm * Math.PI * 2) / streamArms;
            this.bullets.push({
              id: `boss_spiral_${Math.random()}`,
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(sAng) * (enemy.bossPhase === 3 ? 295 : 255),
              vy: Math.sin(sAng) * (enemy.bossPhase === 3 ? 295 : 255),
              radius: 5.5,
              damage: 5 + this.floor.floorNumber,
              isCrit: false,
              fromPlayer: false,
              piercing: false,
              bouncesLeft: 0,
              color: enemy.type === 'boss_skeleton_king' ? '#d946ef' : enemy.type === 'boss_infernal_dragon' ? '#fb923c' : '#f43f5e',
              lifetime: 3.8,
            });
          }
        }
      }

      // Primary Attack Cadence
      enemy.attackTimer -= dt * phaseMult;
      if (enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.attackCooldown;

        if (enemy.isBoss) {
          this.executeBossAttack(enemy, currentRoom, targetX, targetY);
        } else {
          this.executeRegularEnemyAttack(enemy, dx, dy, dist);
        }
      }

      // Direct contact melee pressure if hugging any hostile monster
      if (
        !enemy.isBoss &&
        Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 4 &&
        this.player.invulnerableTimer <= 0
      ) {
        this.damagePlayer(Math.max(4, Math.round(enemy.damage * 0.6)));
      }
    }
  }

  private spawnBossMinions(boss: Enemy, room: DungeonRoom, count: number) {
    if (room.enemies.length >= 9) return;
    const rx = room.pixelX;
    const ry = room.pixelY;
    const rw = room.width * TILE_SIZE;
    const rh = room.height * TILE_SIZE;
    const f = this.floor.floorNumber;

    const summonPool: Array<Enemy['type']> =
      boss.type === 'boss_infernal_dragon'
        ? ['lava_hound', 'dark_knight']
        : boss.type === 'boss_skeleton_king'
        ? ['skeleton_warrior', 'skeleton_mage']
        : ['dark_knight', 'shadow_assassin'];

    for (let s = 0; s < count; s++) {
      if (room.enemies.length >= 9) break;
      const sType = summonPool[s % summonPool.length];
      const ang = Math.random() * Math.PI * 2;
      const sx = Math.max(rx + 56, Math.min(rx + rw - 56, boss.x + Math.cos(ang) * 95));
      const sy = Math.max(ry + 56, Math.min(ry + rh - 56, boss.y + Math.sin(ang) * 95));
      const shp = 95 + f * 35;

      this.addShockwave(sx, sy, 48, boss.color, 0.3);
      room.enemies.push({
        id: `boss_summon_${Math.random()}`,
        type: sType,
        name: sType === 'dark_knight' ? 'Void Vanguard' : sType === 'lava_hound' ? 'Magma Fiend' : 'Royal Undead',
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        radius: 18,
        rotation: 0,
        hp: shp,
        maxHp: shp,
        speed: sType === 'shadow_assassin' || sType === 'lava_hound' ? 155 : 108,
        damage: 12 + f * 3,
        color: boss.color,
        size: 18,
        isBoss: false,
        isElite: true,
        attackCooldown: 1.15,
        attackTimer: 0.65,
        frozenTimer: 0,
        burnTimer: 0,
        burnTicks: 0,
        aiState: 'chase',
        facingRight: true,
        walkCycle: 0,
        xpValue: 20,
        gemValue: 2,
      });
    }
  }

  private executeBossAttack(boss: Enemy, room: DungeonRoom, targetX: number, targetY: number) {
    const f = this.floor.floorNumber;
    const phase = boss.bossPhase || 1;
    const pattern = (boss.bossPatternIndex ?? 0) % 4;
    boss.bossPatternIndex = pattern + 1;

    const aimAngle = Math.atan2(targetY - boss.y, targetX - boss.x);
    const baseOrbDmg = 6 + f * 2 + (phase === 3 ? 2 : 0);

    if (boss.type === 'boss_grand_knight') {
      if (pattern === 0) {
        // 1. Twin Counter-Rotating Void Rings
        sounds.shoot('shotgun');
        const outerCount = 14 + phase * 2;
        for (let b = 0; b < outerCount; b++) {
          const ang = (b / outerCount) * Math.PI * 2 + aimAngle;
          this.bullets.push({
            id: `gk_ring_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(ang) * 305,
            vy: Math.sin(ang) * 305,
            radius: 6.5,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#dc2626',
            lifetime: 3.8,
          });
        }
        const innerCount = 10 + phase * 2;
        for (let b = 0; b < innerCount; b++) {
          const ang = (b / innerCount) * Math.PI * 2 - aimAngle + 0.2;
          this.bullets.push({
            id: `gk_inner_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(ang) * 215,
            vy: Math.sin(ang) * 215,
            radius: 6,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#a855f7',
            lifetime: 4.2,
          });
        }
      } else if (pattern === 1) {
        // 2. High-Speed Abyssal Dash Slash + 7-Blade Fan!
        sounds.meleeSlash();
        this.screenShake = Math.max(this.screenShake, 0.65);
        boss.bossDashTimer = 0.52;
        const dashSpd = 430 + phase * 35;
        boss.bossDashVx = Math.cos(aimAngle) * dashSpd;
        boss.bossDashVy = Math.sin(aimAngle) * dashSpd;
        this.addSlashArc(boss.x, boss.y, 78, aimAngle, '#ef4444', false, 0.35);

        const fanCount = 7 + (phase === 3 ? 2 : 0);
        for (let s = 0; s < fanCount; s++) {
          const offset = (s - (fanCount - 1) / 2) * 0.16;
          const a = aimAngle + offset;
          this.bullets.push({
            id: `gk_fan_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * 380,
            vy: Math.sin(a) * 380,
            radius: 7,
            damage: baseOrbDmg + 2,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#fbbf24',
            lifetime: 3.2,
          });
        }
      } else if (pattern === 2) {
        // 3. 8-Directional Laser Cross + Aimed Execution Bolts
        sounds.shoot('laser');
        for (let dir = 0; dir < 8; dir++) {
          const a = (dir / 8) * Math.PI * 2 + (phase === 3 ? 0.2 : 0);
          for (let tier = 0; tier < 3; tier++) {
            const spd = 250 + tier * 55;
            this.bullets.push({
              id: `gk_cross_${Math.random()}`,
              x: boss.x,
              y: boss.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              radius: 5.5,
              damage: baseOrbDmg,
              isCrit: false,
              fromPlayer: false,
              piercing: false,
              bouncesLeft: 0,
              color: '#ef4444',
              lifetime: 3.5,
            });
          }
        }
      } else {
        // 4. Ricocheting Void Storm + Vanguard Call
        sounds.explosion();
        this.addShockwave(boss.x, boss.y, 140, '#dc2626', 0.4);
        const bounceCount = 10 + phase * 2;
        for (let b = 0; b < bounceCount; b++) {
          const a = aimAngle + (b / bounceCount) * Math.PI * 2;
          this.bullets.push({
            id: `gk_ricochet_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * 290,
            vy: Math.sin(a) * 290,
            radius: 6.5,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 1,
            color: '#f43f5e',
            lifetime: 4.5,
          });
        }
        if (room.enemies.length < 5) {
          this.spawnBossMinions(boss, room, 1);
        }
      }
      return;
    }

    if (boss.type === 'boss_skeleton_king') {
      if (pattern === 0) {
        // 1. Cursed Ricochet Bone-Shard Nova
        sounds.shoot('staff');
        const count = 16 + phase * 2;
        for (let b = 0; b < count; b++) {
          const a = (b / count) * Math.PI * 2 + Date.now() * 0.002;
          const ricochet = b % 2 === 0 ? 1 : 0;
          this.bullets.push({
            id: `sk_nova_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * (ricochet ? 315 : 240),
            vy: Math.sin(a) * (ricochet ? 315 : 240),
            radius: 6.5,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: ricochet,
            color: ricochet ? '#e2e8f0' : '#a855f7',
            lifetime: 4.2,
          });
        }
      } else if (pattern === 1) {
        // 2. Shadow Blink Teleport + Aimed 7-Skull Volley!
        sounds.explosion();
        this.addShockwave(boss.x, boss.y, 110, '#9333ea', 0.35);
        const rx = room.pixelX;
        const ry = room.pixelY;
        const rw = room.width * TILE_SIZE;
        const rh = room.height * TILE_SIZE;
        const teleAngle = Math.random() * Math.PI * 2;
        boss.x = Math.max(rx + 72, Math.min(rx + rw - 72, targetX + Math.cos(teleAngle) * 185));
        boss.y = Math.max(ry + 72, Math.min(ry + rh - 72, targetY + Math.sin(teleAngle) * 155));
        this.addShockwave(boss.x, boss.y, 130, '#d946ef', 0.4);

        const newAim = Math.atan2(targetY - boss.y, targetX - boss.x);
        for (let s = -3; s <= 3; s++) {
          const a = newAim + s * 0.14;
          this.bullets.push({
            id: `sk_skull_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * 365,
            vy: Math.sin(a) * 365,
            radius: 7,
            damage: baseOrbDmg + 2,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#f0abfc',
            lifetime: 3.4,
          });
        }
      } else if (pattern === 2) {
        // 3. Legion of the Damned Summon + Necrotic Soul Siphon
        sounds.levelUp();
        this.spawnBossMinions(boss, room, phase >= 2 ? 2 : 1);
        this.addFloatingText(boss.x, boss.y - 36, 'ARISE, MY LEGION!', '#d946ef', 1.15);
        for (let s = 0; s < 12; s++) {
          const a = aimAngle + (s / 12) * Math.PI * 2;
          this.bullets.push({
            id: `sk_legion_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * 280,
            vy: Math.sin(a) * 280,
            radius: 6,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#38bdf8',
            lifetime: 3.6,
          });
        }
      } else {
        // 4. Cursed Soul Pillars + Aimed Lance Stream
        sounds.shoot('laser');
        for (let p = 0; p < 2 + phase; p++) {
          const px = targetX + (Math.random() - 0.5) * 140;
          const py = targetY + (Math.random() - 0.5) * 140;
          this.addSkyBeam(px, py, 44, '#c084fc', 0.45);
          for (let r = 0; r < 6; r++) {
            const ra = (r / 6) * Math.PI * 2;
            this.bullets.push({
              id: `sk_pillar_${Math.random()}`,
              x: px,
              y: py,
              vx: Math.cos(ra) * 210,
              vy: Math.sin(ra) * 210,
              radius: 5.5,
              damage: baseOrbDmg,
              isCrit: false,
              fromPlayer: false,
              piercing: false,
              bouncesLeft: 0,
              color: '#c084fc',
              lifetime: 2.8,
            });
          }
        }
      }
      return;
    }

    // 3rd Boss: Ignis, Infernal Wyrm (boss_infernal_dragon)
    if (pattern === 0) {
      // 1. Cataclysmic Meteor Sky-Strikes + 18-Fireball Ring
      sounds.explosion();
      this.screenShake = Math.max(this.screenShake, 0.9);
      const count = 16 + phase * 3;
      for (let b = 0; b < count; b++) {
        const a = (b / count) * Math.PI * 2 + aimAngle;
        this.bullets.push({
          id: `ig_ring_${Math.random()}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 325,
          vy: Math.sin(a) * 325,
          radius: 7,
          damage: baseOrbDmg + 1,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: b % 3 === 0 ? 1 : 0,
          color: '#f97316',
          lifetime: 4.0,
        });
      }
      for (let m = 0; m < 2 + phase; m++) {
        const mx = targetX + (Math.random() - 0.5) * 150;
        const my = targetY + (Math.random() - 0.5) * 150;
        this.addSkyBeam(mx, my, 52, '#ef4444', 0.48);
        this.addShockwave(mx, my, 85, '#f97316', 0.35);
      }
    } else if (pattern === 1) {
      // 2. Blazing Draconic Wing Charge + 9-Shot Breath Cone
      sounds.shoot('explosive');
      boss.bossDashTimer = 0.56;
      const spd = 460 + phase * 35;
      boss.bossDashVx = Math.cos(aimAngle) * spd;
      boss.bossDashVy = Math.sin(aimAngle) * spd;

      for (let s = -4; s <= 4; s++) {
        const a = aimAngle + s * 0.13;
        this.bullets.push({
          id: `ig_breath_${Math.random()}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 395,
          vy: Math.sin(a) * 395,
          radius: 7.5,
          damage: baseOrbDmg + 2,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: 0,
          color: s % 2 === 0 ? '#ef4444' : '#facc15',
          lifetime: 3.2,
        });
      }
    } else if (pattern === 2) {
      // 3. Twin Concentric Magma Waves
      sounds.shoot('shotgun');
      for (let wave = 0; wave < 2; wave++) {
        const n = 14 + phase * 2;
        const spd = wave === 0 ? 340 : 235;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + wave * 0.22;
          this.bullets.push({
            id: `ig_wave_${Math.random()}`,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: 6.5,
            damage: baseOrbDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: wave === 0 ? '#ea580c' : '#fde047',
            lifetime: 4.0,
          });
        }
      }
    } else {
      // 4. Hellhound Pack Call + Aimed Solar Lance Burst
      sounds.explosion();
      if (room.enemies.length < 6) {
        this.spawnBossMinions(boss, room, 2);
      }
      for (let k = -2; k <= 2; k++) {
        const a = aimAngle + k * 0.1;
        this.bullets.push({
          id: `ig_lance_${Math.random()}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 430,
          vy: Math.sin(a) * 430,
          radius: 8,
          damage: baseOrbDmg + 3,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: 1,
          color: '#fbbf24',
          lifetime: 3.5,
        });
      }
    }
  }

  private executeRegularEnemyAttack(enemy: Enemy, dx: number, dy: number, dist: number) {
    const angle = Math.atan2(dy, dx);
    const hitDmg = Math.max(4, Math.round(enemy.damage * 0.62));
    const isElite = Boolean(enemy.isElite) || this.floor.floorNumber >= 2;

    if (enemy.type === 'goblin_archer' && dist < 390) {
      sounds.shoot('pistol');
      const shots = isElite ? [-0.18, 0, 0.18] : [0];
      shots.forEach(off => {
        const a = angle + off;
        this.bullets.push({
          id: `archer_${Math.random()}`,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * 315,
          vy: Math.sin(a) * 315,
          radius: 5,
          damage: hitDmg,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: 0,
          color: '#10b981',
          lifetime: 3.0,
        });
      });
    } else if (enemy.type === 'skeleton_mage' && dist < 410) {
      sounds.shoot('staff');
      const shots = [-0.22, 0, 0.22];
      shots.forEach(off => {
        const a = angle + off;
        this.bullets.push({
          id: `mage_orb_${Math.random()}`,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * 285,
          vy: Math.sin(a) * 285,
          radius: 5.5,
          damage: hitDmg,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: enemy.isElite ? 1 : 0,
          color: '#a855f7',
          lifetime: 3.2,
        });
      });
    } else if (enemy.type === 'dark_knight') {
      if (dist < 320) {
        sounds.shoot('shotgun');
        for (let k = -1; k <= 1; k++) {
          const a = angle + k * 0.2;
          this.bullets.push({
            id: `dk_bolt_${Math.random()}`,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(a) * 290,
            vy: Math.sin(a) * 290,
            radius: 6,
            damage: hitDmg + 1,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#ef4444',
            lifetime: 2.8,
          });
        }
      }
      if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 12) {
        this.damagePlayer(hitDmg + 2);
      }
    } else if (enemy.type === 'shadow_assassin') {
      // Quick shadow lunge + twin kunai throw
      if (dist > 36 && dist < 260) {
        enemy.x += (dx / dist) * 44;
        enemy.y += (dy / dist) * 44;
        const curRoom = this.getCurrentRoom();
        if (curRoom) this.clampEntityToRoom(enemy, curRoom);
        for (const off of [-0.1, 0.1]) {
          const a = angle + off;
          this.bullets.push({
            id: `kunai_${Math.random()}`,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(a) * 355,
            vy: Math.sin(a) * 355,
            radius: 4.5,
            damage: hitDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#38bdf8',
            lifetime: 2.2,
          });
        }
      } else if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 10) {
        this.damagePlayer(hitDmg + 1);
      }
    } else if (enemy.type === 'lava_hound') {
      if (dist < 260) {
        for (const off of [-0.16, 0, 0.16]) {
          const a = angle + off;
          this.bullets.push({
            id: `hound_fire_${Math.random()}`,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(a) * 305,
            vy: Math.sin(a) * 305,
            radius: 5.5,
            damage: hitDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#f97316',
            lifetime: 2.2,
          });
        }
      }
      if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 10) {
        this.damagePlayer(hitDmg);
      }
    } else if (enemy.type === 'toxic_slime') {
      if (dist < 280) {
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2 + angle;
          this.bullets.push({
            id: `slime_glob_${Math.random()}`,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(a) * 225,
            vy: Math.sin(a) * 225,
            radius: 5.5,
            damage: hitDmg,
            isCrit: false,
            fromPlayer: false,
            piercing: false,
            bouncesLeft: 0,
            color: '#22c55e',
            lifetime: 2.4,
          });
        }
      }
    } else if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < enemy.radius + this.player.radius + 10) {
      this.damagePlayer(hitDmg);
    }
  }

  private handleEnemyDeath(enemy: Enemy, room: DungeonRoom) {
    sounds.hitEnemy(true);

    // Venom Juggernaut bursts into 6 toxic globules on death!
    if (enemy.type === 'toxic_slime') {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        this.bullets.push({
          id: `slime_death_${Math.random()}`,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * 205,
          vy: Math.sin(a) * 205,
          radius: 5,
          damage: 5,
          isCrit: false,
          fromPlayer: false,
          piercing: false,
          bouncesLeft: 0,
          color: '#4ade80',
          lifetime: 1.8,
        });
      }
    }

    // Berserker Bloodlust lifesteal on kill
    if (this.bloodboilTimer > 0 && this.bloodboilHealsLeft > 0 && this.player.hp < this.player.maxHp) {
      this.bloodboilHealsLeft--;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.addFloatingText(this.player.x, this.player.y - 24, '+1 HP BLOODLUST!', '#22c55e', 1.1);
    }

    // Hero Exclusive Kill Triggers & Post-Game Gem Tally:
    this.killCounter++;
    if (enemy.isBoss) {
      this.bossKills++;
    } else if (enemy.isElite) {
      this.eliteKills++;
    } else {
      this.normalKills++;
    }
    this.baseKillGems += enemy.gemValue;

    // 1. Assassin Exclusive Buff (Shadow Momentum): +35% Speed for 3s, +6 MP & -1.0s skill cooldowns!
    if (this.hasExclusiveBuff('assassin_kill_momentum')) {
      this.killMomentumTimer = 3.0;
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 6);
      this.player.skills.forEach(s => {
        s.currentCooldown = Math.max(0, s.currentCooldown - 1.0);
      });
    }

    // 2. Alchemist Exclusive Buff (Volatile Catalysts): slain foes erupt into a caustic toxic pool (25 splash dmg)!
    if (this.hasExclusiveBuff('alchemist_volatile_catalysts')) {
      this.activeEffects.poisonPools.push({
        x: enemy.x,
        y: enemy.y,
        radius: 40,
        duration: 3.4,
        color: '#22c55e',
      });
      this.addShockwave(enemy.x, enemy.y, 64, '#22c55e', 0.26);
      room.enemies.forEach(other => {
        if (other.id !== enemy.id && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 68) {
          other.hp -= 25;
        }
      });
    }

    // 3. Necromancer Exclusive Buffs (Graveyard Pact & Undying Command)
    if (this.hasExclusiveBuff('necromancer_risen_legion')) {
      const skelCount = this.activeEffects.minions.filter(m => m.kind.includes('skeleton')).length;
      if (skelCount < 5 && (enemy.isBoss || Math.random() < 0.35)) {
        this.activeEffects.minions.push({
          id: `pact_skel_${Math.random()}`,
          kind: 'skeleton',
          x: enemy.x,
          y: enemy.y,
          hp: 55,
          maxHp: 55,
          damage: 20,
          speed: 158,
          timer: 9.0,
          attackTimer: 0.2,
          facingRight: true,
        });
        this.addShockwave(enemy.x, enemy.y, 44, '#d946ef', 0.28);
        this.addFloatingText(enemy.x, enemy.y - 20, 'RISEN!', '#d946ef', 0.95);
      }
    }
    if (this.hasExclusiveBuff('necromancer_dread_command') && this.killCounter % 4 === 0) {
      if (this.player.shield < this.player.maxShield) {
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
        sounds.shieldRecharge();
        this.addFloatingText(this.player.x, this.player.y - 22, '+1 SOUL SHIELD', '#d946ef', 0.95);
      }
    }

    // 4. Berserker Exclusive Buff (Carnage Feast): every 5th kill heals +1 HP & +12 MP!
    if (this.hasExclusiveBuff('berserker_carnage_feast') && this.killCounter % 5 === 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 12);
      this.addFloatingText(this.player.x, this.player.y - 28, 'CARNAGE FEAST +1 HP!', '#fb923c', 1.05);
    }

    // 5. Vampire Exclusive Buff (Immortal Leech): 22% chance (100% on Boss) to siphon +1 HP or +1 Shield/+12 MP!
    if (this.hasExclusiveBuff('vampire_sanguine_siphon') && (enemy.isBoss || Math.random() < 0.22)) {
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.addFloatingText(this.player.x, this.player.y - 24, 'LEECH +1 HP', '#fb7185', 1.0);
      } else {
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 12);
        this.addFloatingText(this.player.x, this.player.y - 24, 'SIPHON +1 SHIELD +12 MP', '#fb7185', 0.95);
      }
    }

    const diffCfg = DIFFICULTY_CONFIGS[this.difficulty] || DIFFICULTY_CONFIGS.medium;
    const coinCount = Math.max(
      1,
      Math.round((enemy.isBoss ? 22 : enemy.isElite ? 4 : 2) * this.passiveBuffs.goldMultiplier * diffCfg.goldMult)
    );
    const maxCoinOrbs = Math.min(coinCount, 6);
    const baseCoinPerOrb = Math.floor(coinCount / maxCoinOrbs);
    const remainderCoins = coinCount % maxCoinOrbs;
    for (let c = 0; c < maxCoinOrbs; c++) {
      room.drops.push({
        id: `coin_${Math.random()}`,
        type: 'coin',
        x: enemy.x + (Math.random() - 0.5) * 34,
        y: enemy.y + (Math.random() - 0.5) * 34,
        value: baseCoinPerOrb + (c < remainderCoins ? 1 : 0),
        bobPhase: Math.random() * Math.PI,
      });
    }

    const dropEnergy = Math.random() < 0.48 + this.passiveBuffs.energyDropChanceBonus;
    if (dropEnergy) {
      room.drops.push({
        id: `energy_${Math.random()}`,
        type: 'energy',
        x: enemy.x,
        y: enemy.y,
        value: enemy.isElite ? 22 : 16,
        bobPhase: Math.random() * Math.PI,
      });
    }

    // Soul Gems no longer drop on the dungeon floor (eliminating mass-pickup lag);
    // instead, all kills are tallied and rewarded at the end of the run based on difficulty!

    if (enemy.isBoss) {
      sounds.levelUp();
      this.screenShake = 1.8;
    }
  }

  public damagePlayer(amount: number) {
    if (this.player.invulnerableTimer > 0 || this.wraithTimer > 0) return;

    if (this.aegisAbsorbTimer > 0) {
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 10);
      this.addFloatingText(this.player.x, this.player.y - 20, 'AEGIS ABSORBED!', '#fbbf24', 1.0);
      return;
    }

    this.player.invulnerableTimer = 0.65;
    this.player.shieldDelayTimer = 0;
    this.screenShake = Math.max(this.screenShake, 0.55);
    sounds.playerHit();

    if (this.player.shield > 0) {
      // Paladin Exclusive Buff (Radiant Retribution): taking Shield damage emits a 32 DMG Holy Nova!
      if (this.hasExclusiveBuff('paladin_radiant_nova')) {
        this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) > 135);
        this.addShockwave(this.player.x, this.player.y, 155, '#fde047', 0.35);
        const curRoom = this.getCurrentRoom();
        if (curRoom) {
          curRoom.enemies.forEach(e => {
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 155) {
              e.hp -= 32;
              this.addFloatingText(e.x, e.y - 12, 'HOLY NOVA 32!', '#fde047', 1.0);
            }
          });
        }
      }

      if (this.player.shield >= amount) {
        this.player.shield -= amount;
        this.addFloatingText(this.player.x, this.player.y - 15, `-${amount} SHIELD`, '#38bdf8', 1.0);
      } else {
        const hasIronBulwark = this.hasExclusiveBuff('knight_iron_bulwark');
        const remaining = hasIronBulwark ? 0 : amount - this.player.shield;
        this.player.shield = 0;
        sounds.shieldBreak();

        if (hasIronBulwark) {
          // Knight Exclusive Buff (Aegis Bulwark): ZERO overflow HP damage + 45 DMG golden shockwave!
          this.bullets = this.bullets.filter(b => b.fromPlayer || Math.hypot(b.x - this.player.x, b.y - this.player.y) > 185);
          this.addShockwave(this.player.x, this.player.y, 180, '#fbbf24', 0.45);
          this.addFloatingText(this.player.x, this.player.y - 24, 'AEGIS BULWARK! 0 HP DMG', '#fbbf24', 1.15);
          const curRoom = this.getCurrentRoom();
          if (curRoom) {
            curRoom.enemies.forEach(e => {
              if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 180) {
                e.hp -= 45;
                e.frozenTimer = Math.max(e.frozenTimer, 1.2);
              }
            });
          }
        } else {
          this.player.hp = Math.max(this.undyingTimer > 0 ? 1 : 0, this.player.hp - remaining);
          this.addFloatingText(this.player.x, this.player.y - 15, `SHIELD BROKEN! -${remaining} HP`, '#ef4444', 1.1);
        }

        if (this.passiveBuffs.emergencyShieldWave) {
          this.bullets = this.bullets.filter(b => b.fromPlayer);
          this.addShockwave(this.player.x, this.player.y, 180, '#38bdf8', 0.45);
          this.addFloatingText(this.player.x, this.player.y - 30, 'AEGIS SHOCKWAVE!', '#38bdf8', 1.2);
        }
      }
    } else {
      this.player.hp = Math.max(this.undyingTimer > 0 ? 1 : 0, this.player.hp - amount);
      if (this.undyingTimer > 0 && this.player.hp === 1) {
        this.addFloatingText(this.player.x, this.player.y - 18, 'UNDYING RAGE!', '#f97316', 1.15);
      } else {
        this.addFloatingText(this.player.x, this.player.y - 15, `-${amount} HP`, '#ef4444', 1.1);
      }
    }

    if (this.player.hp <= 0) {
      this.isMouseDown = false;
      this.keys = {};
      sounds.explosion();
      if (this.revivesUsed < this.maxRevives) {
        this.isAwaitingRevive = true;
      } else {
        this.isGameOver = true;
        this.claimEndOfRunRewards(false);
      }
    }
  }

  public getKillRewardPreview(includeVictoryBonus: boolean = false): EndOfRunRewardSummary {
    const diffCfg = DIFFICULTY_CONFIGS[this.difficulty] || DIFFICULTY_CONFIGS.medium;
    const killGems = Math.round(this.baseKillGems * diffCfg.gemMult);
    const victoryBonusGems = includeVictoryBonus ? diffCfg.victoryGemBonus : 0;
    return {
      totalKills: this.killCounter,
      normalKills: this.normalKills,
      eliteKills: this.eliteKills,
      bossKills: this.bossKills,
      baseKillGems: this.baseKillGems,
      gemMultiplier: diffCfg.gemMult,
      killGems,
      victoryBonusGems,
      totalGemsEarned: killGems + victoryBonusGems,
    };
  }

  public claimEndOfRunRewards(includeVictoryBonus: boolean = false): EndOfRunRewardSummary {
    if (this.rewardsClaimed && this.claimedRewardSummary) {
      return this.claimedRewardSummary;
    }
    const summary = this.getKillRewardPreview(includeVictoryBonus);
    this.rewardsClaimed = true;
    this.claimedRewardSummary = summary;
    if (summary.totalGemsEarned > 0) {
      skillTreeManager.addSoulGems(summary.totalGemsEarned);
      this.player.soulGems = skillTreeManager.getSoulGems();
    }
    return summary;
  }

  public revivePlayer(): boolean {
    if (this.revivesUsed >= this.maxRevives) return false;
    if (!skillTreeManager.spendSoulGems(this.reviveCost)) return false;

    this.revivesUsed += 1;
    this.isAwaitingRevive = false;
    this.isGameOver = false;
    this.player.soulGems = skillTreeManager.getSoulGems();
    this.player.hp = this.player.maxHp;
    this.player.shield = this.player.maxShield;
    this.player.energy = this.player.maxEnergy;
    this.player.invulnerableTimer = 3.0;
    this.isMouseDown = false;
    this.keys = {};

    // Clear all hostile projectiles and emit a divine resurrection shockwave!
    this.bullets = this.bullets.filter(b => b.fromPlayer);
    this.addShockwave(this.player.x, this.player.y, 240, '#fde047', 0.55);
    const curRoom = this.getCurrentRoom();
    if (curRoom) {
      curRoom.enemies.forEach(e => {
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 220) {
          e.frozenTimer = Math.max(e.frozenTimer, 1.8);
        }
      });
    }
    sounds.levelUp();
    this.addFloatingText(
      this.player.x,
      this.player.y - 32,
      `REVIVED! (${this.maxRevives - this.revivesUsed} LEFT)`,
      '#fde047',
      1.25
    );
    return true;
  }

  private updateDrops(dt: number) {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return;

    for (let i = currentRoom.drops.length - 1; i >= 0; i--) {
      const drop = currentRoom.drops[i];
      drop.bobPhase += dt * 4;

      if (drop.price !== undefined || drop.type === 'weapon') continue;

      const dist = Math.hypot(drop.x - this.player.x, drop.y - this.player.y);

      if (dist < 85) {
        drop.x += (this.player.x - drop.x) * 0.16;
        drop.y += (this.player.y - drop.y) * 0.16;
      }

      if (dist < this.player.radius + 12) {
        if (drop.type === 'coin') {
          this.player.coins += drop.value;
          sounds.coin();
          this.addFloatingText(this.player.x, this.player.y - 15, `+${drop.value} GOLD`, '#fbbf24', 0.9);
        } else if (drop.type === 'energy') {
          const wasFullMp = this.player.energy >= this.player.maxEnergy;
          const extraLeyline = this.hasExclusiveBuff('mage_leyline_surge') ? 8 : 0;
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + drop.value + extraLeyline);
          this.addFloatingText(this.player.x, this.player.y - 15, `+${drop.value + extraLeyline} MP`, '#38bdf8', 0.9);

          if (this.hasExclusiveBuff('mage_leyline_surge')) {
            this.player.skills.forEach(s => {
              s.currentCooldown = Math.max(0, s.currentCooldown - 0.8);
            });
          }

          if (wasFullMp && this.hasExclusiveBuff('vampire_nightstalker')) {
            this.triggerVampireOverhealProc();
          }
        } else if (drop.type === 'soul_gem') {
          this.player.soulGems += drop.value;
          skillTreeManager.addSoulGems(drop.value);
          sounds.soulGem();
          this.addFloatingText(this.player.x, this.player.y - 15, `+${drop.value} SOUL GEM`, '#c084fc', 1.1);
        } else if (drop.type === 'health') {
          const wasFullHp = this.player.hp >= this.player.maxHp;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + drop.value);
          this.addFloatingText(this.player.x, this.player.y - 15, `+${drop.value} HP`, '#22c55e', 1.0);
          if (wasFullHp && this.hasExclusiveBuff('vampire_nightstalker')) {
            this.triggerVampireOverhealProc();
          }
        }

        currentRoom.drops.splice(i, 1);
      }
    }
  }

  private triggerVampireOverhealProc() {
    if (this.overhealStacks < 3) {
      this.overhealStacks++;
      this.player.maxHp += 1;
      this.player.hp += 1;
      this.addFloatingText(this.player.x, this.player.y - 30, 'CRIMSON OVERHEAL +1 MAX HP!', '#f43f5e', 1.05);
    }
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + this.player.rotation;
      this.bullets.push({
        id: `overheal_bat_${Math.random()}`,
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(ang) * 540,
        vy: Math.sin(ang) * 540,
        radius: 5.5,
        damage: 18,
        isCrit: true,
        fromPlayer: true,
        piercing: true,
        bouncesLeft: 0,
        color: '#f43f5e',
        lifetime: 1.3,
      });
    }
  }

  private checkInteractables() {
    const currentRoom = this.getCurrentRoom();
    this.interactPrompt = null;
    this.nearbyInteractable = null;
    this.nearbyWeaponDrop = null;

    if (!currentRoom) return;

    const WEAPON_PICKUP_RADIUS = 78;
    let closestWeaponDrop: DropItem | null = null;
    let closestWeaponDist = WEAPON_PICKUP_RADIUS;

    for (const drop of currentRoom.drops) {
      if (drop.type === 'weapon' && drop.weaponData) {
        const d = Math.hypot(this.player.x - drop.x, this.player.y - drop.y);
        if (d < closestWeaponDist) {
          closestWeaponDist = d;
          closestWeaponDrop = drop;
        }
      }
    }
    this.nearbyWeaponDrop = closestWeaponDrop;

    let bestCandidate: {
      dist: number;
      prompt: string;
      type: 'chest' | 'weapon' | 'statue' | 'portal' | 'event';
      action: () => void;
    } | null = null;

    for (const obs of currentRoom.obstacles) {
      if (obs.opened) continue;
      const centerX = obs.x + obs.width / 2;
      const centerY = obs.y + obs.height / 2;
      const dist = Math.hypot(this.player.x - centerX, this.player.y - centerY);

      if (obs.type === 'chest' && dist < 68) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: 'TAP OR [F] TO OPEN CHEST',
            type: 'chest',
            action: () => this.openChest(obs, currentRoom),
          };
        }
      } else if (obs.type === 'statue' && dist < 68) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: obs.interactPrompt || 'TAP OR [F] TO PRAY AT SHRINE',
            type: 'statue',
            action: () => this.prayToStatue(obs),
          };
        }
      } else if (obs.type === 'portal' && dist < 74) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: 'TAP OR [F] TO ENTER PORTAL',
            type: 'portal',
            action: () => this.requestPortalConfirmation(),
          };
        }
      } else if (obs.type === 'wishing_well' && dist < 72) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          const cost = obs.data?.cost || 15;
          const remaining = (obs.data?.maxUses || 3) - (obs.data?.uses || 0);
          bestCandidate = {
            dist,
            prompt: `TAP OR [F] TO MAKE A WISH (${cost} G) [${remaining} LEFT]`,
            type: 'event',
            action: () => DungeonEventsManager.handleWishingWell(this, obs, currentRoom),
          };
        }
      } else if (obs.type === 'blood_altar' && dist < 72) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: 'TAP OR [F] SACRIFICE 1 HP (BLOOD PACT)',
            type: 'event',
            action: () => DungeonEventsManager.handleBloodAltar(this, obs, currentRoom),
          };
        }
      } else if (obs.type === 'fortune_wheel' && dist < 72) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          const cost = obs.data?.cost || 20;
          const prompt = obs.data?.spinning
            ? 'SPINNING WHEEL...'
            : `TAP OR [F] SPIN WHEEL OF FORTUNE (${cost} G)`;
          bestCandidate = {
            dist,
            prompt,
            type: 'event',
            action: () => DungeonEventsManager.handleFortuneWheel(this, obs, currentRoom),
          };
        }
      } else if (obs.type === 'blacksmith_forge' && dist < 72) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          const cost = obs.data?.cost || 25;
          bestCandidate = {
            dist,
            prompt: `TAP OR [F] REFORGE HELD WEAPON (${cost} G)`,
            type: 'event',
            action: () => DungeonEventsManager.handleBlacksmithForge(this, obs),
          };
        }
      } else if (obs.type === 'cursed_monolith' && dist < 72) {
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: 'TAP OR [F] TO TOUCH CURSED MONOLITH',
            type: 'event',
            action: () => DungeonEventsManager.handleCursedMonolith(this, obs, currentRoom),
          };
        }
      }
    }

    for (const drop of currentRoom.drops) {
      const dist = Math.hypot(this.player.x - drop.x, this.player.y - drop.y);
      if (drop.price !== undefined && dist < WEAPON_PICKUP_RADIUS) {
        const discount = this.passiveBuffs.shopDiscount;
        const finalPrice = Math.round(drop.price * (1 - discount));
        const itemLabel = drop.weaponData ? drop.weaponData.name : 'Potion';
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: `TAP OR [F] TO BUY ${itemLabel.toUpperCase()} (${finalPrice} G)`,
            type: 'weapon',
            action: () => this.buyShopItem(drop, finalPrice, currentRoom),
          };
        }
      } else if (drop.type === 'weapon' && drop.weaponData && dist < WEAPON_PICKUP_RADIUS) {
        const weaponName = drop.weaponData.name;
        const maxSlots = this.passiveBuffs.extraWeaponSlot ? 3 : 2;
        const verb = this.player.weapons.length < maxSlots ? 'PICK UP' : 'SWAP FOR';
        if (!bestCandidate || dist < bestCandidate.dist) {
          bestCandidate = {
            dist,
            prompt: `TAP OR [F] TO ${verb} ${weaponName.toUpperCase()}`,
            type: 'weapon',
            action: () => this.swapWeapon(drop, currentRoom),
          };
        }
      }
    }

    if (bestCandidate) {
      this.interactPrompt = bestCandidate.prompt;
      this.nearbyInteractable = {
        type: bestCandidate.type,
        action: bestCandidate.action,
      };
    }
  }

  public interact() {
    const now = performance.now();
    if (now - this.lastInteractTimestamp < 200) return;
    // Re-evaluate right before acting so stationary taps are always 100% fresh
    this.checkInteractables();
    if (this.nearbyInteractable) {
      this.lastInteractTimestamp = now;
      this.nearbyInteractable.action();
      this.checkInteractables();
    }
  }

  private openChest(obs: Obstacle, room: DungeonRoom) {
    obs.opened = true;
    sounds.chestOpen();
    this.addFloatingText(obs.x + 24, obs.y - 10, 'CHEST OPENED!', '#fbbf24', 1.2);

    let pool = Object.values(WEAPON_REGISTRY).filter(w => w.id !== 'bad_pistol');
    if (this.passiveBuffs.luckyChestTier > 0) {
      const highTier = pool.filter(w => w.rarity === 'epic' || w.rarity === 'legendary' || w.rarity === 'mythic');
      if (highTier.length > 0) pool = highTier;
    }
    const rolledWeapon = pool[Math.floor(Math.random() * pool.length)] || WEAPON_REGISTRY['pixel_blaster'];

    const diffCfg = DIFFICULTY_CONFIGS[this.difficulty] || DIFFICULTY_CONFIGS.medium;
    const chestCoins = Math.max(5, Math.round((12 + this.passiveBuffs.luckyChestTier * 8) * diffCfg.goldMult));

    room.drops.push(
      {
        id: `chest_weapon_${Math.random()}`,
        type: 'weapon',
        x: obs.x + 24,
        y: obs.y + 60,
        value: 0,
        weaponData: rolledWeapon,
        bobPhase: 0,
      },
      {
        id: `chest_coin_${Math.random()}`,
        type: 'coin',
        x: obs.x + 48,
        y: obs.y + 50,
        value: chestCoins,
        bobPhase: 2,
      }
    );
  }

  private prayToStatue(obs: Obstacle) {
    obs.opened = true;
    sounds.levelUp();
    this.player.maxShield += 2;
    this.player.shield = this.player.maxShield;
    this.player.hp = this.player.maxHp;
    this.addShockwave(this.player.x, this.player.y, 120, '#38bdf8', 0.45);
    this.addFloatingText(this.player.x, this.player.y - 30, 'STATUE BLESSING! +2 SHIELD', '#38bdf8', 1.2);
  }

  private buyShopItem(drop: DropItem, price: number, room: DungeonRoom) {
    if (this.player.coins < price) {
      this.addFloatingText(this.player.x, this.player.y - 20, 'NOT ENOUGH GOLD!', '#ef4444', 1.0);
      return;
    }

    this.player.coins -= price;
    sounds.coin();

    if (drop.type === 'weapon' && drop.weaponData) {
      this.swapWeapon(drop, room);
    } else if (drop.type === 'health') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + drop.value);
      this.addFloatingText(this.player.x, this.player.y - 20, `+${drop.value} HP`, '#22c55e', 1.1);
      room.drops = room.drops.filter(d => d !== drop);
    }
  }

  private swapWeapon(drop: DropItem, room: DungeonRoom) {
    if (!drop.weaponData) return;

    const maxSlots = this.passiveBuffs.extraWeaponSlot ? 3 : 2;

    if (this.player.weapons.length < maxSlots) {
      this.player.weapons.push(drop.weaponData);
      this.player.currentWeaponIndex = this.player.weapons.length - 1;
      room.drops = room.drops.filter(d => d !== drop);
      sounds.coin();
    } else {
      const oldWeapon = this.player.weapons[this.player.currentWeaponIndex];
      this.player.weapons[this.player.currentWeaponIndex] = drop.weaponData;
      drop.weaponData = oldWeapon;
      drop.price = undefined;
      sounds.coin();
    }

    this.addFloatingText(
      this.player.x,
      this.player.y - 20,
      `EQUIPPED ${this.player.weapons[this.player.currentWeaponIndex].name}!`,
      '#fbbf24',
      1.0
    );
  }

  public switchWeapon() {
    const now = performance.now();
    if (now - this.lastSwitchTimestamp < 180) return;
    if (this.player.weapons.length <= 1) return;
    this.lastSwitchTimestamp = now;
    this.player.currentWeaponIndex = (this.player.currentWeaponIndex + 1) % this.player.weapons.length;
    sounds.shoot('pistol');
  }

  public requestPortalConfirmation() {
    this.isMouseDown = false;
    this.keys = {};
    this.isAwaitingPortalConfirm = true;
    sounds.shoot('pistol');
  }

  public cancelEnterPortal() {
    this.isAwaitingPortalConfirm = false;
    this.isMouseDown = false;
    this.keys = {};
  }

  public confirmEnterPortal() {
    this.isAwaitingPortalConfirm = false;
    this.enterPortal();
  }

  private enterPortal() {
    sounds.chestOpen();
    if (this.floor.floorNumber >= 3) {
      this.isVictory = true;
      this.claimEndOfRunRewards(true);
    } else {
      this.floor = DungeonGenerator.generateFloor(this.floor.floorNumber + 1, this.difficulty);
      this.bullets = [];
      this.activeEffects.poisonPools = [];
      this.activeEffects.consecrationZones = [];
      this.activeEffects.sanctuaryDomes = [];
      this.activeEffects.turrets = [];
      this.activeEffects.clones = [];
      this.activeEffects.mechaGolems = [];
      this.activeEffects.minions = [];
      this.positionPlayerAtStart();
      if (this.hasExclusiveBuff('druid_pack_bond')) {
        this.spawnDruidPackWolf();
      }
      this.addFloatingText(
        this.player.x,
        this.player.y - 30,
        `FLOOR ${this.floor.floorNumber} - ${this.floor.biome.toUpperCase()}!`,
        '#38bdf8',
        1.3
      );
    }
  }

  private updateVFX(dt: number) {
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });

    this.floatingTexts = this.floatingTexts.filter(ft => {
      ft.alpha -= dt * 1.5;
      ft.y += ft.vy * dt;
      return ft.alpha > 0;
    });
  }

  public addFloatingText(x: number, y: number, text: string, color: string, scale: number = 1.0) {
    this.floatingTexts.push({
      id: `ft_${Math.random()}`,
      x,
      y,
      vy: -35,
      text,
      color,
      alpha: 1.0,
      scale,
    });
  }
}
