/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CHARACTERS,
  DIFFICULTY_CONFIGS,
  HERO_LEVEL_COSTS,
  MAX_HERO_LEVEL,
  STARTER_UNLOCKED_HEROES,
  getSkillRequiredHeroLevel,
} from './constants';
import { INITIAL_HERO_TALENT_TREES } from './heroTalentTrees';
import { CharacterClass, DifficultyId, PassiveBuffs, SkillTreeNode } from './types';

const STORAGE_KEY_HERO_TREES = 'soul_rogue_hero_trees_v2';
const STORAGE_KEY_OLD_TREE = 'soul_rogue_skill_tree_v1';
const STORAGE_KEY_SOUL_GEMS = 'soul_rogue_gems_v1';
const STORAGE_KEY_UNLOCKED_HEROES = 'soul_rogue_unlocked_heroes_v1';
const STORAGE_KEY_HERO_LEVELS = 'soul_rogue_hero_levels_v1';
const STORAGE_KEY_DIFFICULTY = 'soul_rogue_difficulty_v1';
const STORAGE_KEY_ACTIVE_HERO = 'soul_rogue_active_hero_v1';

export class SkillTreeManager {
  private heroTrees: Record<CharacterClass, SkillTreeNode[]> = {} as any;
  private activeHero: CharacterClass = 'knight';
  private soulGems: number = 999999; // 999999 starting gems as requested!
  private unlockedHeroes: Set<CharacterClass> = new Set(STARTER_UNLOCKED_HEROES);
  private heroLevels: Partial<Record<CharacterClass, number>> = {};
  private difficulty: DifficultyId = 'medium';

  constructor() {
    this.load();
  }

  public getActiveHero(): CharacterClass {
    return this.activeHero;
  }

  public setActiveHero(heroId: CharacterClass) {
    if (CHARACTERS.some(c => c.id === heroId)) {
      this.activeHero = heroId;
      this.save();
    }
  }

  public getHeroNodes(heroId: CharacterClass): SkillTreeNode[] {
    return this.heroTrees[heroId] || this.heroTrees['knight'] || [];
  }

  /**
   * Compatibility method: returns nodes for the specified hero, or active hero if omitted.
   */
  public getNodes(heroId?: CharacterClass): SkillTreeNode[] {
    const target = heroId || this.activeHero;
    return this.getHeroNodes(target);
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

  private cloneDefaultTrees(): Record<CharacterClass, SkillTreeNode[]> {
    const trees: Record<CharacterClass, SkillTreeNode[]> = {} as any;
    CHARACTERS.forEach(c => {
      const src = INITIAL_HERO_TALENT_TREES[c.id] || INITIAL_HERO_TALENT_TREES.knight;
      trees[c.id] = JSON.parse(JSON.stringify(src));
    });
    return trees;
  }

  public load() {
    this.heroTrees = this.cloneDefaultTrees();
    this.unlockedHeroes = new Set(STARTER_UNLOCKED_HEROES);
    this.heroLevels = {};
    this.difficulty = 'medium';

    try {
      const savedGems = localStorage.getItem(STORAGE_KEY_SOUL_GEMS);
      if (savedGems !== null) {
        this.soulGems = Math.max(999999, parseInt(savedGems, 10) || 0);
      } else {
        this.soulGems = 999999;
      }

      const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE_HERO) as CharacterClass | null;
      if (savedActive && CHARACTERS.some(c => c.id === savedActive)) {
        this.activeHero = savedActive;
      }

      // Check for v2 separated trees
      const savedTrees = localStorage.getItem(STORAGE_KEY_HERO_TREES);
      if (savedTrees) {
        const parsed = JSON.parse(savedTrees);
        if (parsed && typeof parsed === 'object') {
          CHARACTERS.forEach(c => {
            const heroMap = parsed[c.id];
            if (heroMap && this.heroTrees[c.id]) {
              this.heroTrees[c.id].forEach(node => {
                if (heroMap[node.id] !== undefined) {
                  node.level = Math.min(node.maxLevel, Math.max(0, heroMap[node.id]));
                }
              });
            }
          });
        }
      } else {
        // Migration from v1 shared tree: refund previous spent points back to soulGems
        const oldTree = localStorage.getItem(STORAGE_KEY_OLD_TREE);
        if (oldTree) {
          try {
            const parsedOld = JSON.parse(oldTree);
            let refunded = 0;
            // Add a generous bonus so player can immediately explore their hero's new tree!
            Object.values(parsedOld).forEach((lvl: any) => {
              if (typeof lvl === 'number' && lvl > 0) {
                refunded += lvl * 25;
              }
            });
            this.soulGems += Math.max(30, refunded);
          } catch {
            // Ignore
          }
        }
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
      console.warn('Could not load hero skill trees from localStorage', e);
    }
  }

  public save() {
    try {
      localStorage.setItem(STORAGE_KEY_SOUL_GEMS, this.soulGems.toString());
      localStorage.setItem(STORAGE_KEY_ACTIVE_HERO, this.activeHero);

      const treeSaveObj: Record<string, Record<string, number>> = {};
      CHARACTERS.forEach(c => {
        const map: Record<string, number> = {};
        const nodes = this.heroTrees[c.id] || [];
        nodes.forEach(n => {
          map[n.id] = n.level;
        });
        treeSaveObj[c.id] = map;
      });

      localStorage.setItem(STORAGE_KEY_HERO_TREES, JSON.stringify(treeSaveObj));
      localStorage.setItem(STORAGE_KEY_UNLOCKED_HEROES, JSON.stringify(Array.from(this.unlockedHeroes)));
      localStorage.setItem(STORAGE_KEY_HERO_LEVELS, JSON.stringify(this.heroLevels));
      localStorage.setItem(STORAGE_KEY_DIFFICULTY, this.difficulty);
    } catch (e) {
      console.warn('Could not save hero skill trees', e);
    }
  }

  public canUpgrade(nodeId: string, heroId?: CharacterClass): { can: boolean; reason?: string } {
    const targetHero = heroId || this.activeHero;
    const nodes = this.getHeroNodes(targetHero);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { can: false, reason: 'Node not found' };
    if (node.level >= node.maxLevel) return { can: false, reason: 'Max level reached' };

    // Check prerequisites within this hero's tree
    if (node.prerequisites && node.prerequisites.length > 0) {
      for (const reqId of node.prerequisites) {
        const reqNode = nodes.find(n => n.id === reqId);
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

  public upgradeNode(nodeId: string, heroId?: CharacterClass): boolean {
    const targetHero = heroId || this.activeHero;
    const check = this.canUpgrade(nodeId, targetHero);
    if (!check.can) return false;

    const nodes = this.getHeroNodes(targetHero);
    const node = nodes.find(n => n.id === nodeId)!;
    const cost = node.cost[node.level];
    this.soulGems -= cost;
    node.level += 1;
    this.save();
    return true;
  }

  public resetHeroTree(heroId: CharacterClass): number {
    const nodes = this.getHeroNodes(heroId);
    let totalRefund = 0;
    nodes.forEach(node => {
      for (let lvl = 0; lvl < node.level; lvl++) {
        totalRefund += node.cost[lvl];
      }
      node.level = 0;
    });
    this.soulGems += totalRefund;
    this.save();
    return totalRefund;
  }

  public resetTree(heroId?: CharacterClass): number {
    const targetHero = heroId || this.activeHero;
    return this.resetHeroTree(targetHero);
  }

  public resetAllTrees(): number {
    let totalRefund = 0;
    CHARACTERS.forEach(c => {
      const nodes = this.getHeroNodes(c.id);
      nodes.forEach(node => {
        for (let lvl = 0; lvl < node.level; lvl++) {
          totalRefund += node.cost[lvl];
        }
        node.level = 0;
      });
    });
    this.soulGems += totalRefund;
    this.save();
    return totalRefund;
  }

  public calculatePassiveBuffs(heroId?: CharacterClass): PassiveBuffs {
    const targetHero = heroId || this.activeHero;
    const nodes = this.getHeroNodes(targetHero);

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

    nodes.forEach(node => {
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
          buffs.critDamageBonus += node.level * 0.35;
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
