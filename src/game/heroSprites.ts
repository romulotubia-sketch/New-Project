/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterClass } from './types';

export type HeroAnimState = 'walk' | 'idle' | 'rest';

export interface HeroDrawOptions {
  classId: CharacterClass;
  x: number;
  y: number;
  facingRight: boolean;
  state: HeroAnimState;
  frame: number; // 0..7
  pixelSize?: number;
  gazeY?: number;
  showBuiltInWeapon?: boolean;
}

export const HERO_SHEET_MAP: Record<string, number> = {
  paladin: 0,
  ranger: 1,
  ronin: 2,
  alchemist: 3,
  berserker: 4,
  vampire: 5,
  necromancer: 6,
  druid: 7,
  engineer: 8,
  assassin: 9,
};

// Exact character color palettes from the Fantasy Class Pixel Sprite Sheet
export const HERO_PALETTES: Record<string, {
  primary: string;
  secondary: string;
  accent: string;
  trim: string;
  skin: string;
}> = {
  paladin: {
    primary: '#738290', // Silver-blue steel armor
    secondary: '#2563eb', // Blue heraldic cross & tabard
    accent: '#38bdf8', // Bright blue crest
    trim: '#f8fafc', // White plate
    skin: '#f2b88c',
  },
  ranger: {
    primary: '#166534', // Forest green hooded cowl
    secondary: '#15803d', // Cloak & tunic
    accent: '#854d0e', // Leather quiver & composite bow
    trim: '#ca8a04', // Golden buckle
    skin: '#f5c39e',
  },
  ronin: {
    primary: '#78350f', // Woven straw hat (kasa)
    secondary: '#991b1b', // Crimson scarf & haori
    accent: '#1e293b', // Dark samurai hakama
    trim: '#e2e8f0', // Dual katana steel
    skin: '#f2b88c',
  },
  alchemist: {
    primary: '#78350f', // Leather trench coat & pack
    secondary: '#15803d', // Glowing green acid vials
    accent: '#0284c7', // Cyan potion flask
    trim: '#eab308', // Brass goggles
    skin: '#f0b589',
  },
  berserker: {
    primary: '#7f1d1d', // Battle-scarred crimson war paint
    secondary: '#1e293b', // Spiked iron harness & pelt
    accent: '#dc2626', // Crimson eyes & horns
    trim: '#94a3b8', // Heavy steel battle axe
    skin: '#ea580c', // War-red tanned skin
  },
  vampire: {
    primary: '#450a0a', // Crimson-lined black Dracula cape
    secondary: '#18181b', // Midnight noble doublet
    accent: '#dc2626', // Blood-red ruby medallion & collar
    trim: '#f8fafc', // Pale porcelain complexion & fangs
    skin: '#f1f5f9',
  },
  necromancer: {
    primary: '#3b0764', // Deep obsidian-purple cowl & robes
    secondary: '#6b21a8', // Arcane shadow fabric
    accent: '#34d399', // Eerie spectral green skull lantern/soul flame
    trim: '#4ade80', // Glowing rune trim
    skin: '#c4b5fd', // Pale spectral skin
  },
  druid: {
    primary: '#15803d', // Verdant leaf cloak & antler horns
    secondary: '#78350f', // Living bark wooden staff
    accent: '#84cc16', // Glowing nature emerald leaves
    trim: '#a3e635', // Sprouting flower buds
    skin: '#f2b88c',
  },
  engineer: {
    primary: '#ea580c', // Safety orange mechanic jumper
    secondary: '#1e3a8a', // Deep indigo utility suspenders
    accent: '#f59e0b', // Cyan welder goggles & wrench
    trim: '#06b6d4', // Pressurized steam pack
    skin: '#f0b589',
  },
  assassin: {
    primary: '#1e1b4b', // Midnight violet shinobi cowl & wrap
    secondary: '#581c87', // Flowing violet ninja scarf
    accent: '#a855f7', // Glowing dual kunai blades
    trim: '#c084fc', // Ninja headband plate
    skin: '#f2b88c',
  },
};

export class HeroSpriteRenderer {
  private static sheetImage: HTMLImageElement | null = null;
  private static isLoaded = false;
  private static isLoading = false;

  public static init() {
    if (this.sheetImage || typeof Image === 'undefined') return;
    this.isLoading = true;
    const img = new Image();
    img.src = '/assets/heroes_spritesheet.png';
    img.onload = () => {
      this.sheetImage = img;
      this.isLoaded = true;
      this.isLoading = false;
    };
    img.onerror = () => {
      // Fallback to secondary location
      const fallback = new Image();
      fallback.src = '/assets/aistudio/heroes_spritesheet.png';
      fallback.onload = () => {
        this.sheetImage = fallback;
        this.isLoaded = true;
        this.isLoading = false;
      };
      fallback.onerror = () => {
        this.isLoading = false;
      };
    };
  }

  public static isSupportedClass(classId: string): boolean {
    return classId in HERO_SHEET_MAP;
  }

  public static draw(ctx: CanvasRenderingContext2D, opts: HeroDrawOptions) {
    if (!this.sheetImage && !this.isLoading) {
      this.init();
    }

    const heroIdx = HERO_SHEET_MAP[opts.classId];
    if (heroIdx === undefined || heroIdx < 0) return;

    const animIdx = opts.state === 'walk' ? 1 : opts.state === 'rest' ? 2 : 0;
    const f = ((Math.floor(opts.frame) % 8) + 8) % 8;
    const facing = opts.facingRight ? 1 : -1;

    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.scale(facing, 1);

    if (this.isLoaded && this.sheetImage) {
      this.drawFromSheet(ctx, heroIdx, animIdx, f, opts);
    } else {
      this.drawProceduralFallback(ctx, opts.classId, opts.state, f);
    }

    // Peaceful floating "z Z" animation in rest state (Frames 5..7)
    if (opts.state === 'rest' && f >= 4) {
      this.drawSleepZs(ctx, f, opts.facingRight);
    }

    ctx.restore();
  }

  private static drawFromSheet(
    ctx: CanvasRenderingContext2D,
    heroIdx: number,
    animIdx: number,
    frame: number,
    opts: HeroDrawOptions
  ) {
    if (!this.sheetImage) return;

    const CELL_W = 48;
    const CELL_H = 48;
    const rowGlobal = heroIdx * 3 + animIdx;

    const sx = frame * CELL_W;
    const sy = rowGlobal * CELL_H;

    // Ground contact point is at y + 14 in world space.
    // In our 48x48 cell, the character's feet contact at cell y = 42, center at x = 24.
    const dx = -24;
    const dy = 14 - 42; // = -28

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.sheetImage,
      sx,
      sy,
      CELL_W,
      CELL_H,
      dx,
      dy,
      CELL_W,
      CELL_H
    );
  }

  private static drawSleepZs(ctx: CanvasRenderingContext2D, f: number, facingRight: boolean) {
    const pal = '#7dd3fc';
    const t = Date.now() * 0.003;
    const drift = Math.sin(t * 2) * 1.5;

    ctx.save();
    if (!facingRight) {
      ctx.scale(-1, 1);
    }

    ctx.font = 'bold 7px "Press Start 2P", monospace';
    ctx.fillStyle = pal;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = 4;

    const z1Y = -24 + (f === 5 ? -1 : f === 6 ? -3 : -5) + drift;
    const z2Y = -32 + (f === 6 ? -1 : -4) + drift;

    ctx.fillText('z', 8, z1Y);
    if (f >= 5) {
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.fillText('Z', 14, z2Y);
    }

    ctx.restore();
  }

  /**
   * High-fidelity procedural fallback when sprite sheet is loading or in headless environments
   */
  private static drawProceduralFallback(
    ctx: CanvasRenderingContext2D,
    classId: CharacterClass,
    state: HeroAnimState,
    frame: number
  ) {
    const pal = HERO_PALETTES[classId] || HERO_PALETTES.paladin;
    const isRest = state === 'rest';
    const isWalk = state === 'walk';
    const walkBob = isWalk ? (frame % 2 === 0 ? -1 : 1) : 0;
    const restSink = isRest ? Math.min(6, frame) : 0;
    const by = walkBob + restSink;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = pal.primary;
    ctx.fillRect(-8, -10 + by, 16, 18 - Math.floor(restSink * 0.4));

    // Torso Accent
    ctx.fillStyle = pal.secondary;
    ctx.fillRect(-5, -6 + by, 10, 12 - Math.floor(restSink * 0.4));

    // Head / Helm / Cowl
    ctx.fillStyle = pal.primary;
    ctx.fillRect(-7, -22 + by, 14, 12);

    // Face / Skin
    ctx.fillStyle = pal.skin;
    ctx.fillRect(-4, -18 + by, 8, 7);

    // Eyes / Visor
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, -17 + by, 4, 3);

    // Trim / Icon
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-2, -22 + by, 4, 2);

    // Legs / Boots
    if (!isRest) {
      ctx.fillStyle = '#0f172a';
      const legOffset = isWalk ? (frame % 4 < 2 ? 2 : -2) : 0;
      ctx.fillRect(-6 + legOffset, 8 + by, 4, 6);
      ctx.fillRect(2 - legOffset, 8 + by, 4, 6);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, 10, 8, 4);
    }
  }
}
