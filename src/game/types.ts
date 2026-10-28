/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CharacterClass =
  | 'knight'
  | 'mage'
  | 'assassin'
  | 'alchemist'
  | 'paladin'
  | 'ranger'
  | 'necromancer'
  | 'berserker'
  | 'engineer'
  | 'vampire'
  | 'druid'
  | 'ronin';

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type WeaponType = 'handgun' | 'rifle' | 'shotgun' | 'laser' | 'bow' | 'staff' | 'melee' | 'explosive';

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  rarity: WeaponRarity;
  damage: number;
  energyCost: number;
  fireRate: number; // shots per second
  bulletSpeed: number;
  spread: number; // radians
  bulletCount?: number;
  piercing?: boolean;
  bounces?: number;
  bulletColor: string;
  bulletRadius: number;
  isMelee?: boolean;
  meleeRadius?: number;
  aoeRadius?: number;
  freezeChance?: number;
  burnChance?: number;
  critChance: number;
  description: string;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  keyHint: string;
  cooldown: number; // in seconds
  energyCost: number;
  currentCooldown: number; // remaining seconds
  charges: number;
  maxCharges: number;
  description: string;
  isUltimate?: boolean;
  statBonusText?: string;
  bonusHp?: number;
  bonusShield?: number;
  bonusEnergy?: number;
  bonusSpeed?: number;
  bonusCrit?: number;
}

export interface HeroExclusiveBuff {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  bonusHp?: number;
  bonusShield?: number;
  bonusEnergy?: number;
  bonusSpeed?: number;
  bonusCrit?: number;
}

export type DifficultyId = 'easy' | 'medium' | 'hard' | 'nightmare' | 'hell';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  tagline: string;
  badgeColor: string;
  enemyHpMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  enemyCountMult: number;
  extraCombatWave: number;
  extraEliteWave: number;
  goldMult: number;
  gemMult: number;
  chestBaseGems: number;
  victoryGemBonus: number;
}

export interface CharacterConfig {
  id: CharacterClass;
  name: string;
  title: string;
  unlockCost: number;
  maxHp: number;
  maxShield: number;
  maxEnergy: number;
  speed: number;
  critBonus: number;
  startingWeaponId: string;
  spriteColor: string;
  cloakColor: string;
  description: string;
  exclusiveBuffs: [HeroExclusiveBuff, HeroExclusiveBuff];
  normalSkills: Skill[];
  ultimateSkills: Skill[];
  skills: Skill[];
}

export interface SkillTreeNode {
  id: string;
  branch: 'offensive' | 'defensive' | 'utility' | 'fortune';
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number[]; // cost per level in soul gems
  icon: string;
  prerequisites?: string[]; // IDs of required nodes
  statKey: string;
  statValuePerLevel: number;
}

export interface PassiveBuffs {
  pierceChance: number;
  bonusBounces: number;
  critRateBonus: number;
  critDamageBonus: number;
  damageMultiplier: number;
  elementalBonus: number;
  bonusMaxHp: number;
  bonusMaxShield: number;
  bonusMaxEnergy: number;
  shieldDelayReduction: number;
  emergencyShieldWave: boolean;
  trapImmunity: boolean;
  cooldownReduction: number;
  energyDropChanceBonus: number;
  overchargeBoost: boolean;
  goldMultiplier: number;
  shopDiscount: number;
  luckyChestTier: number;
  extraWeaponSlot: boolean;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
}

export interface Player extends Entity {
  classId: CharacterClass;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  speed: number;
  coins: number;
  soulGems: number;
  weapons: Weapon[];
  currentWeaponIndex: number;
  skills: Skill[];
  exclusiveBuffs: HeroExclusiveBuff[];
  shieldRegenTimer: number;
  shieldDelayTimer: number;
  invulnerableTimer: number;
  dualWieldTimer: number;
  fortressShieldTimer: number;
  facingRight: boolean;
  walkCycle: number;
  animState: 'walk' | 'idle' | 'rest';
  animFrame: number;
  animTimer: number;
  idleTimer: number;
  manualRest?: boolean;
  weaponRecoil?: number;
  statueBlessing?: string;
  statueTimer?: number;
}

export type EnemyType = 
  | 'goblin_grunt' 
  | 'goblin_archer' 
  | 'skeleton_warrior' 
  | 'skeleton_mage' 
  | 'toxic_slime' 
  | 'shadow_assassin'
  | 'dark_knight'
  | 'lava_hound'
  | 'boss_grand_knight'
  | 'boss_skeleton_king'
  | 'boss_infernal_dragon';

export interface Enemy extends Entity {
  id: string;
  type: EnemyType;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: string;
  size: number;
  isBoss: boolean;
  isElite?: boolean;
  attackCooldown: number;
  attackTimer: number;
  frozenTimer: number;
  burnTimer: number;
  burnTicks: number;
  aiState: 'patrol' | 'chase' | 'attack' | 'charge' | 'casting';
  chargeTarget?: Vector2D;
  facingRight: boolean;
  walkCycle: number;
  xpValue: number;
  gemValue: number;
  bossPhase?: 1 | 2 | 3;
  bossPatternIndex?: number;
  bossDashTimer?: number;
  bossDashVx?: number;
  bossDashVy?: number;
  bossSpiralAngle?: number;
  bossSecondaryTimer?: number;
}

export type BulletShape =
  | 'orb'
  | 'glaive'
  | 'sawblade'
  | 'needle'
  | 'blackhole'
  | 'solar_bolt'
  | 'excalibur_wave'
  | 'shield_bolt';

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  fromPlayer: boolean;
  piercing: boolean;
  bouncesLeft: number;
  color: string;
  glowColor?: string;
  lifetime: number;
  isMelee?: boolean;
  meleeSweepAngle?: number;
  aoeRadius?: number;
  freezeChance?: number;
  burnChance?: number;
  bulletShape?: BulletShape;
  spinAngle?: number;
  isReturning?: boolean;
  returnTimer?: number;
  pullRadius?: number;
  leaveFirePool?: boolean;
}

export type DropType = 'coin' | 'energy' | 'health' | 'soul_gem' | 'weapon';

export interface DropItem {
  id: string;
  type: DropType;
  x: number;
  y: number;
  value: number;
  weaponData?: Weapon;
  bobPhase: number;
  price?: number; // for shop items
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type:
    | 'crate'
    | 'barrel'
    | 'pillar'
    | 'brazier'
    | 'chest'
    | 'statue'
    | 'portal'
    | 'shop_table'
    | 'wishing_well'
    | 'blood_altar'
    | 'fortune_wheel'
    | 'blacksmith_forge'
    | 'cursed_monolith';
  hp?: number;
  maxHp?: number;
  isExplosive?: boolean;
  opened?: boolean;
  interactPrompt?: string;
  data?: any;
}

export type RoomDecorationKind =
  | 'wall_torch'
  | 'wall_banner'
  | 'floor_crack'
  | 'moss_patch'
  | 'bone_pile'
  | 'lava_fissure'
  | 'iron_grate'
  | 'cobweb'
  | 'pebbles'
  | 'mushroom'
  | 'skull_candle';

export interface RoomDecoration {
  x: number;
  y: number;
  kind: RoomDecorationKind;
  variant: number;
  wallSide?: 'north' | 'south' | 'east' | 'west';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity?: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

export type RoomType = 'start' | 'combat' | 'elite' | 'chest' | 'shop' | 'statue' | 'boss' | 'event';

export interface RoomDoor {
  x: number;
  y: number;
  targetRoomIndex: number;
  direction: 'north' | 'south' | 'east' | 'west';
  isOpen: boolean;
}

export interface DungeonRoom {
  index: number;
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
  width: number; // in tiles
  height: number; // in tiles
  type: RoomType;
  isCleared: boolean;
  isDiscovered: boolean;
  isAdjacentDiscovered?: boolean;
  doors: RoomDoor[];
  enemies: Enemy[];
  obstacles: Obstacle[];
  decorations: RoomDecoration[];
  drops: DropItem[];
  wavesRemaining: number;
  combatStarted: boolean;
}

export interface DungeonFloor {
  floorNumber: number; // 1-1, 1-2, 1-3 etc.
  biome: 'ruins' | 'crypt' | 'volcano';
  rooms: DungeonRoom[];
  currentRoomIndex: number;
  clearedRoomCount: number;
  totalCombatRooms: number;
}

export interface ActiveSkillEffects {
  poisonPools: Array<{ x: number; y: number; radius: number; duration: number; color?: string }>;
  consecrationZones: Array<{ x: number; y: number; radius: number; duration: number; healTick: number }>;
  sanctuaryDomes: Array<{ x: number; y: number; radius: number; duration: number; zapTick: number }>;
  turrets: Array<{ x: number; y: number; timer: number; attackTimer: number; isVulcan?: boolean }>;
  clones: Array<{ x: number; y: number; timer: number; attackTimer: number; isPhantom?: boolean }>;
  orbitalShields: Array<{ angle: number; radius: number; timer: number }>;
  mechaGolems: Array<{ x: number; y: number; hp: number; maxHp: number; timer: number; attackTimer: number; missileTimer: number }>;
  minions: Array<{
    id: string;
    kind: 'wolf' | 'alpha_wolf' | 'skeleton' | 'dread_skeleton' | 'crimson_bat' | 'grizzly_bear';
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    damage: number;
    speed: number;
    timer: number;
    attackTimer: number;
    facingRight: boolean;
  }>;
  lightningBolts: Array<{ points: Vector2D[]; color: string; life: number; maxLife: number }>;
  shockwaves: Array<{ x: number; y: number; currentRadius: number; maxRadius: number; color: string; life: number; maxLife: number }>;
  skyBeams: Array<{ x: number; y: number; width: number; color: string; life: number; maxLife: number }>;
  slashArcs: Array<{ x: number; y: number; radius: number; angle: number; color: string; life: number; maxLife: number; fullCircle?: boolean }>;
  auras: {
    berserkTimer: number;
    flameBarrierTimer: number;
    blizzardTimer: number;
    astralOverloadTimer: number;
    stealthTimer: number;
    archangelTimer: number;
    wraithTimer: number;
    lichTimer: number;
    aegisAbsorbTimer: number;
    undyingTimer: number;
    bloodboilTimer: number;
    killMomentumTimer: number;
  };
}

export interface EndOfRunRewardSummary {
  totalKills: number;
  normalKills: number;
  eliteKills: number;
  bossKills: number;
  baseKillGems: number;
  gemMultiplier: number;
  killGems: number;
  victoryBonusGems: number;
  totalGemsEarned: number;
}


