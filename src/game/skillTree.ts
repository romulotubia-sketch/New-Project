/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CHARACTERS,
  DIFFICULTY_CONFIGS,
  HERO_LEVEL_COSTS,
  INITIAL_SKILL_TREE,
  MAX_HERO_LEVEL,
  STARTER_UNLOCKED_HEROES,
  getSkillRequiredHeroLevel,
} from './constants';
import { CharacterClass, DifficultyId, PassiveBuffs, SkillTreeNode } from './types';

const STORAGE_KEY_SKILL_TREE = 'soul_rogue_skill_tree_v1';
const STORAGE_KEY_SOUL_GEMS = 'soul_rogue_gems_v1';
const STORAGE_KEY_UNLOCKED_HEROES = 'soul_rogue_unlocked_heroes_v1';
const STORAGE_KEY_HERO_LEVELS = 'soul_rogue_hero_levels_v1';
const STORAGE_KEY_DIFFICULTY = 'soul_rogue_difficulty_v1';

export class SkillTreeManager {
  private nodes: SkillTreeNode[] = [];
  private soulGems: number = 25; // start with a small bonus for instant initial fun!
  private unlockedHeroes: Set<CharacterClass> = new Set(STARTER_UNLOCKED_HEROES);
  private heroLevels: Partial<Record<CharacterClass, number>> = {};
  private difficulty: DifficultyId = 'medium';

  constructor() {
    this.load();
  }

  public getNodes(): SkillTreeNode[] {
    return this.nodes;
  }

  public getSoulGems(): number {
    return this.soulGems;
  }

  public addSoulGems(amount: number) {
    this.soulGems = Math.max(0, this.soulGems + Math.round(amount));
    this.save();
  }

  public spendSoulGems(amount: number): boolean {
    const cost = Math.max(0, Math.round(amount));
    if (this.soulGems < cost) return false;
    this.soulGems -= cost;
    this.save();
    return true;
  }

  public getDifficulty(): DifficultyId {
    return this.difficulty;
  }

  public setDifficulty(diff: DifficultyId) {
    if (!DIFFICULTY_CONFIGS[diff]) return;
    this.difficulty = diff;
    this.save();
  }

  public isHeroUnlocked(heroId: CharacterClass): boolean {
    if (STARTER_UNLOCKED_HEROES.includes(heroId)) return true;
    return this.unlockedHeroes.has(heroId);
  }

  public getHeroUnlockCost(heroId: CharacterClass): number {
    if (STARTER_UNLOCKED_HEROES.includes(heroId)) return 0;
    const cfg = CHARACTERS.find(c => c.id === heroId);
    return cfg?.unlockCost ?? 150;
  }

  public unlockHero(heroId: CharacterClass): boolean {
    if (this.isHeroUnlocked(heroId)) return true;
    const cost = this.getHeroUnlockCost(heroId);
    if (this.soulGems < cost) return false;
    this.soulGems -= cost;
    this.unlockedHeroes.add(heroId);
    this.save();
    return true;
  }

  public getHeroLevel(heroId: CharacterClass): number {
    const lvl = this.heroLevels[heroId] || 1;
    return Math.max(1, Math.min(MAX_HERO_LEVEL, lvl));
  }

  public getNextHeroLevelCost(heroId: CharacterClass): number | null {
    const cur = this.getHeroLevel(heroId);
    if (cur >= MAX_HERO_LEVEL) return null;
    return HERO_LEVEL_COSTS[cur + 1] ?? null;
  }

  public levelUpHero(heroId: CharacterClass): boolean {
    if (!this.isHeroUnlocked(heroId)) return false;
    const cur = this.getHeroLevel(heroId);
    if (cur >= MAX_HERO_LEVEL) return false;
    const cost = HERO_LEVEL_COSTS[cur + 1];
    if (cost === undefined || this.soulGems < cost) return false;
    this.soulGems -= cost;
    this.heroLevels[heroId] = cur + 1;
    this.save();
    return true;
  }

  public isSkillUnlocked(heroId: CharacterClass, kind: 'normal' | 'ultimate', index: number): boolean {
    const requiredLevel = getSkillRequiredHeroLevel(kind, index);
    return this.getHeroLevel(heroId) >= requiredLevel;
  }

  public load() {
    // Clone initial tree
    const defaultNodes = JSON.parse(JSON.stringify(INITIAL_SKILL_TREE));
    this.unlockedHeroes = new Set(STARTER_UNLOCKED_HEROES);
    this.heroLevels = {};
    this.difficulty = 'medium';

    try {
      const savedGems = localStorage.getItem(STORAGE_KEY_SOUL_GEMS);
      if (savedGems !== null) {
        this.soulGems = parseInt(savedGems, 10) || 0;
      }
      const savedTree = localStorage.getItem(STORAGE_KEY_SKILL_TREE);
      if (savedTree) {
        const parsed = JSON.parse(savedTree);
        // Merge saved levels into nodes
        defaultNodes.forEach((node: SkillTreeNode) => {
          if (parsed[node.id] !== undefined) {
            node.level = Math.min(node.maxLevel, Math.max(0, parsed[node.id]));
          }
        });
      }
      const savedUnlocked = localStorage.getItem(STORAGE_KEY_UNLOCKED_HEROES);
      if (savedUnlocked) {
        const parsedHeroes = JSON.parse(savedUnlocked);
        if (Array.isArray(parsedHeroes)) {
          parsedHeroes.forEach((id: CharacterClass) => {
            if (CHARACTERS.some(c => c.id === id)) {
              this.unlockedHeroes.add(id);
            }
          });
        }
      }
      const savedLevels = localStorage.getItem(STORAGE_KEY_HERO_LEVELS);
      if (savedLevels) {
        const parsedLevels = JSON.parse(savedLevels);
        if (parsedLevels && typeof parsedLevels === 'object') {
          CHARACTERS.forEach(c => {
            const raw = Number(parsedLevels[c.id]);
            if (Number.isFinite(raw) && raw >= 1) {
              this.heroLevels[c.id] = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(raw)));
            }
          });
        }
      }
      const savedDiff = localStorage.getItem(STORAGE_KEY_DIFFICULTY) as DifficultyId | null;
      if (savedDiff && DIFFICULTY_CONFIGS[savedDiff]) {
        this.difficulty = savedDiff;
      }
    } catch (e) {
      console.warn('Could not load skill tree from localStorage', e);
    }
    this.nodes = defaultNodes;
  }

  public save() {
    try {
      localStorage.setItem(STORAGE_KEY_SOUL_GEMS, this.soulGems.toString());
      const levelMap: Record<string, number> = {};
      this.nodes.forEach(n => {
        levelMap[n.id] = n.level;
      });
      localStorage.setItem(STORAGE_KEY_SKILL_TREE, JSON.stringify(levelMap));
      localStorage.setItem(STORAGE_KEY_UNLOCKED_HEROES, JSON.stringify(Array.from(this.unlockedHeroes)));
      localStorage.setItem(STORAGE_KEY_HERO_LEVELS, JSON.stringify(this.heroLevels));
      localStorage.setItem(STORAGE_KEY_DIFFICULTY, this.difficulty);
    } catch (e) {
      console.warn('Could not save skill tree', e);
    }
  }

  public canUpgrade(nodeId: string): { can: boolean; reason?: string } {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return { can: false, reason: 'Node not found' };
    if (node.level >= node.maxLevel) return { can: false, reason: 'Max level reached' };

    // Check prerequisites
    if (node.prerequisites && node.prerequisites.length > 0) {
      for (const reqId of node.prerequisites) {
        const reqNode = this.nodes.find(n => n.id === reqId);
        if (!reqNode || reqNode.level === 0) {
          return { can: false, reason: `Requires "${reqNode?.name || reqId}" unlocked` };
        }
      }
    }

    const cost = node.cost[node.level];
    if (this.soulGems < cost) {
      return { can: false, reason: `Need ${cost} Soul Gems (have ${this.soulGems})` };
    }

    return { can: true };
  }

  public upgradeNode(nodeId: string): boolean {
    const check = this.canUpgrade(nodeId);
    if (!check.can) return false;

    const node = this.nodes.find(n => n.id === nodeId)!;
    const cost = node.cost[node.level];
    this.soulGems -= cost;
    node.level += 1;
    this.save();
    return true;
  }

  public resetTree(): number {
    let totalRefund = 0;
    this.nodes.forEach(node => {
      for (let lvl = 0; lvl < node.level; lvl++) {
        totalRefund += node.cost[lvl];
      }
      node.level = 0;
    });
    this.soulGems += totalRefund;
    this.save();
    return totalRefund;
  }

  public calculatePassiveBuffs(): PassiveBuffs {
    const buffs: PassiveBuffs = {
      pierceChance: 0,
      bonusBounces: 0,
      critRateBonus: 0,
      critDamageBonus: 0,
      damageMultiplier: 1.0,
      elementalBonus: 0,
      bonusMaxHp: 0,
      bonusMaxShield: 0,
      bonusMaxEnergy: 0,
      shieldDelayReduction: 0,
      emergencyShieldWave: false,
      trapImmunity: false,
      cooldownReduction: 0,
      energyDropChanceBonus: 0,
      overchargeBoost: false,
      goldMultiplier: 1.0,
      shopDiscount: 0,
      luckyChestTier: 0,
      extraWeaponSlot: false,
    };

    this.nodes.forEach(node => {
      if (node.level <= 0) return;
      const totalVal = node.level * node.statValuePerLevel;

      switch (node.statKey) {
        case 'pierceChance':
          buffs.pierceChance += totalVal;
          break;
        case 'bonusBounces':
          buffs.bonusBounces += totalVal;
          break;
        case 'critRateBonus':
          buffs.critRateBonus += totalVal;
          buffs.critDamageBonus += node.level * 0.3; // +30% per level
          break;
        case 'damageMultiplier':
          buffs.damageMultiplier += totalVal;
          break;
        case 'elementalBonus':
          buffs.elementalBonus += totalVal;
          break;
        case 'bonusMaxHp':
          buffs.bonusMaxHp += totalVal;
          break;
        case 'bonusMaxShield':
          buffs.bonusMaxShield += totalVal;
          break;
        case 'bonusMaxEnergy':
          buffs.bonusMaxEnergy += totalVal;
          break;
        case 'shieldDelayReduction':
          buffs.shieldDelayReduction += totalVal;
          break;
        case 'emergencyShieldWave':
          buffs.emergencyShieldWave = true;
          break;
        case 'trapImmunity':
          buffs.trapImmunity = true;
          break;
        case 'cooldownReduction':
          buffs.cooldownReduction += totalVal;
          break;
        case 'energyDropChanceBonus':
          buffs.energyDropChanceBonus += totalVal;
          break;
        case 'overchargeBoost':
          buffs.overchargeBoost = true;
          break;
        case 'goldMultiplier':
          buffs.goldMultiplier += totalVal;
          break;
        case 'shopDiscount':
          buffs.shopDiscount += totalVal;
          break;
        case 'luckyChestTier':
          buffs.luckyChestTier += totalVal;
          break;
        case 'extraWeaponSlot':
          buffs.extraWeaponSlot = true;
          break;
      }
    });

    return buffs;
  }
}

export const skillTreeManager = new SkillTreeManager();
