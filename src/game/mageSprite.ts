/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MageAnimMode = 'walk' | 'idle' | 'rest';

export interface MageDrawOptions {
  x: number;
  y: number; // Character center (ground contact is at y + 7 * pixelSize = y + 14 when pixelSize=2)
  facingRight: boolean;
  state: MageAnimMode;
  frame: number; // 0..7 (8 frames per animation row)
  pixelSize?: number; // Default 2.0 (1 art pixel = 2x2 world px)
  gazeY?: number; // Subtle vertical eye tracking (-1, 0, +1)
  showBuiltInStaff?: boolean; // True in sprite-sheet preview; in rest mode staff is always drawn per sheet
}

// Exact 5-swatch palette & materials from the Mage pixel-art reference sheet
const C = {
  OUTLINE: '#0b0d12',
  HAT_BRIGHT: '#8c24c8',
  HAT_MID: '#592394',
  HAT_DARK: '#36135e',
  TUNIC_BLUE: '#3051b5',
  TUNIC_DEEP: '#1d3273',
  CRYSTAL_WHITE: '#e0f7ff',
  CRYSTAL_GLOW: '#7ddbf8',
  CRYSTAL_MID: '#42b8e8',
  CRYSTAL_DEEP: '#1d74b8',
  GOLD_BRIGHT: '#fbb02d',
  GOLD_SHADE: '#cf8214',
  SKIN: '#f2b88c',
  SKIN_SHADE: '#d99568',
  HAIR_DARK: '#131829',
  WOOD_LIGHT: '#9c6230',
  WOOD_DARK: '#5e3718',
  BOOT_DARK: '#141929',
  BOOT_LIGHT: '#293452',
};

function px(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  color: string,
  ps: number
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(gx * ps), Math.round(gy * ps), Math.round(gw * ps), Math.round(gh * ps));
}

function outlinedBox(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  fill: string,
  ps: number
) {
  px(ctx, gx - 1, gy, gw + 2, gh, C.OUTLINE, ps);
  px(ctx, gx, gy - 1, gw, gh + 2, C.OUTLINE, ps);
  px(ctx, gx, gy, gw, gh, fill, ps);
}

/**
 * Renders the pixel-art Mage character across all 3 animation states (8 frames each)
 * faithful to the Pixel Mage Animation Sprite Sheet:
 * - Crooked bent-tip purple wizard hat with wide curved brim, gold hatband & square gold buckle
 * - 3/4 mysterious peach face framed by dark hair locks & glowing sky-blue arcane eyes
 * - Gold-trimmed royal purple cloak over cobalt blue inner tunic & sash
 * - WALKING (0..7): Brisk 2-beat wizard stride, billowing cloak, hat-tip bounce & upright-angled Crystal Staff
 * - IDLE (0..7): Calm arcane breathing poise, subtle cloak sway & pulsing cyan Crystal Staff
 * - RESTING (0..7): Frames 0..3 drowsy standing poise -> Frame 4 curling down & lowering staff ->
 *   Frames 5..7 peaceful wizard nap curled under tilted hat with grounded Crystal Staff & floating "z Z"
 */
export class MageSpriteRenderer {
  public static draw(ctx: CanvasRenderingContext2D, opts: MageDrawOptions) {
    const ps = opts.pixelSize ?? 2;
    const f = ((Math.floor(opts.frame) % 8) + 8) % 8;
    const facing = opts.facingRight ? 1 : -1;
    const gaze = Math.max(-1, Math.min(1, Math.round(opts.gazeY ?? 0)));
    const showStaff = opts.showBuiltInStaff ?? false;

    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.scale(facing, 1);

    if (opts.state === 'walk') {
      this.drawWalkingFrame(ctx, f, ps, gaze, showStaff);
    } else if (opts.state === 'rest') {
      this.drawRestingFrame(ctx, f, ps, opts.facingRight);
    } else {
      this.drawIdleFrame(ctx, f, ps, gaze, showStaff);
    }

    ctx.restore();
  }

  /**
   * Draws the Mage's crooked backward-bent purple Wizard Hat, wide brim, gold band & square buckle.
   * Anchor (hx, hy) is center-x of head (0) and brim base y (-9 when standing).
   */
  private static drawWizardHat(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    ps: number,
    tipFlex: number = 0,
    sleepingTilt: boolean = false
  ) {
    if (sleepingTilt) {
      // Curled sleeping hat tilted forward/down over the Mage's face (Frames 6–8 of Resting)
      // Wide brim angled low from (-8, hy) down to (+6, hy + 2)
      px(ctx, hx - 8, hy - 1, 14, 3, C.OUTLINE, ps);
      px(ctx, hx - 6, hy + 1, 13, 3, C.OUTLINE, ps);
      px(ctx, hx - 7, hy, 12, 2, C.HAT_MID, ps);
      px(ctx, hx - 5, hy + 1, 11, 2, C.HAT_DARK, ps);
      px(ctx, hx - 7, hy, 6, 1, C.HAT_BRIGHT, ps);

      // Drooped hat cone & bent rear tip
      outlinedBox(ctx, hx - 5, hy - 4, 9, 4, C.HAT_MID, ps);
      outlinedBox(ctx, hx - 7, hy - 5 + tipFlex, 5, 2, C.HAT_BRIGHT, ps);
      px(ctx, hx - 4, hy - 4, 6, 2, C.HAT_BRIGHT, ps);

      // Gold hatband & iconic hollow square gold buckle on front-right
      px(ctx, hx - 4, hy - 1, 8, 1, C.GOLD_SHADE, ps);
      px(ctx, hx, hy - 2, 4, 3, C.GOLD_BRIGHT, ps);
      px(ctx, hx + 1, hy - 1, 2, 1, C.HAT_DARK, ps);
      return;
    }

    // 1. Crooked Bent Wizard Hat Peak (hooking backward -X at the top!)
    // Rear-left bent tail tip
    outlinedBox(ctx, hx - 7, hy - 7 + tipFlex, 3, 2, C.HAT_MID, ps);
    px(ctx, hx - 7, hy - 7 + tipFlex, 2, 1, C.HAT_BRIGHT, ps);

    // Upper cone curving up & forward
    outlinedBox(ctx, hx - 5, hy - 8 + tipFlex, 6, 3, C.HAT_BRIGHT, ps);
    px(ctx, hx - 1, hy - 7 + tipFlex, 2, 2, C.HAT_MID, ps);

    // Mid cone widening down to hatband
    outlinedBox(ctx, hx - 4, hy - 5, 8, 3, C.HAT_MID, ps);
    px(ctx, hx - 4, hy - 5, 5, 2, C.HAT_BRIGHT, ps);
    px(ctx, hx + 2, hy - 5, 2, 3, C.HAT_DARK, ps);

    // 2. Wide Sweeping Wizard Hat Brim (flared tips at -8 and +7)
    px(ctx, hx - 9, hy - 2, 4, 3, C.OUTLINE, ps);
    px(ctx, hx - 7, hy - 1, 15, 3, C.OUTLINE, ps);
    px(ctx, hx + 5, hy - 2, 3, 3, C.OUTLINE, ps);

    // Brim purple shading & top-left highlight
    px(ctx, hx - 8, hy - 1, 3, 1, C.HAT_BRIGHT, ps);
    px(ctx, hx - 6, hy, 13, 1, C.HAT_MID, ps);
    px(ctx, hx - 5, hy, 6, 1, C.HAT_BRIGHT, ps);
    px(ctx, hx - 5, hy + 1, 11, 1, C.HAT_DARK, ps);
    px(ctx, hx + 5, hy - 1, 2, 1, C.HAT_MID, ps);

    // 3. Golden Hatband & Signature Hollow Square Gold Buckle
    px(ctx, hx - 4, hy - 2, 8, 1, C.GOLD_SHADE, ps);
    px(ctx, hx - 3, hy - 2, 4, 1, C.GOLD_BRIGHT, ps);

    // Hollow 4x3 gold buckle on front-right of hatband
    px(ctx, hx + 1, hy - 3, 4, 3, C.GOLD_BRIGHT, ps);
    px(ctx, hx + 4, hy - 3, 1, 3, C.GOLD_SHADE, ps);
    px(ctx, hx + 2, hy - 2, 1, 1, C.HAT_DARK, ps);
  }

  /**
   * Draws the Mage's 3/4 face with dark hair side-locks and glowing cyan magic eyes
   */
  private static drawMageFace(
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    ps: number,
    gazeY: number = 0,
    eyesClosed: boolean = false
  ) {
    // Head outline block under brim
    outlinedBox(ctx, fx - 4, fy, 9, 4, C.SKIN, ps);

    // Dark midnight hair side-locks framing left/back of head & right temple
    px(ctx, fx - 4, fy, 3, 4, C.HAIR_DARK, ps);
    px(ctx, fx - 1, fy, 1, 2, C.HAIR_DARK, ps);
    px(ctx, fx + 4, fy, 1, 2, C.HAIR_DARK, ps);

    // Subtle warm chin shade
    px(ctx, fx - 1, fy + 3, 6, 1, C.SKIN_SHADE, ps);

    const ey = Math.max(fy, Math.min(fy + 2, fy + 1 + gazeY));
    if (eyesClosed) {
      // Peaceful closed/drowsy eyelids with subtle cyan lash glint
      px(ctx, fx, ey + 1, 2, 1, C.OUTLINE, ps);
      px(ctx, fx + 3, ey + 1, 2, 1, C.OUTLINE, ps);
    } else {
      // Signature 2-pixel Mage Eyes: dark vertical pupil + glowing sky-blue iris (#42b8e8)
      px(ctx, fx, ey, 1, 2, C.OUTLINE, ps);
      px(ctx, fx + 1, ey, 1, 2, C.CRYSTAL_MID, ps);
      px(ctx, fx + 1, ey, 1, 1, C.CRYSTAL_GLOW, ps);

      px(ctx, fx + 3, ey, 1, 2, C.OUTLINE, ps);
      px(ctx, fx + 4, ey, 1, 2, C.CRYSTAL_MID, ps);
    }
  }

  /**
   * Draws the Mage's Ancient Wooden Magic Staff crowned with a faceted glowing sky-blue crystal
   */
  private static drawCrystalStaff(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    ps: number,
    pose: 'upright' | 'tilted' | 'grounded',
    gleam: boolean = false
  ) {
    if (pose === 'grounded') {
      // Resting Frames 6–8: Staff lying horizontally/angled on the ground in front (+X)
      outlinedBox(ctx, sx, sy + 1, 5, 1, C.WOOD_DARK, ps);
      px(ctx, sx + 1, sy + 1, 3, 1, C.WOOD_LIGHT, ps);
      // Glowing cyan crystal gem resting on the floor at tip
      px(ctx, sx + 4, sy - 1, 4, 4, C.OUTLINE, ps);
      px(ctx, sx + 5, sy - 2, 2, 1, C.OUTLINE, ps);
      px(ctx, sx + 5, sy, 2, 2, C.CRYSTAL_MID, ps);
      px(ctx, sx + 6, sy + 1, 1, 1, C.CRYSTAL_DEEP, ps);
      px(ctx, sx + 5, sy - 1, 2, 1, gleam ? C.CRYSTAL_WHITE : C.CRYSTAL_GLOW, ps);
      return;
    }

    if (pose === 'tilted') {
      // Resting Frame 5: Staff tipping diagonally down toward the floor
      outlinedBox(ctx, sx - 1, sy + 2, 2, 2, C.WOOD_DARK, ps);
      outlinedBox(ctx, sx + 1, sy, 2, 2, C.WOOD_LIGHT, ps);
      // Angled cyan crystal gem
      px(ctx, sx + 2, sy - 3, 4, 4, C.OUTLINE, ps);
      px(ctx, sx + 3, sy - 2, 2, 2, C.CRYSTAL_MID, ps);
      px(ctx, sx + 3, sy - 2, 1, 1, C.CRYSTAL_WHITE, ps);
      return;
    }

    // Upright slightly forward-angled wooden shaft (matching reference portrait & Walk/Idle rows)
    // Lower shaft segment
    px(ctx, sx - 2, sy + 1, 3, 6, C.OUTLINE, ps);
    px(ctx, sx - 1, sy + 1, 1, 5, C.WOOD_DARK, ps);
    // Upper shaft segment angled +1px forward
    px(ctx, sx - 1, sy - 4, 3, 6, C.OUTLINE, ps);
    px(ctx, sx, sy - 4, 1, 5, C.WOOD_LIGHT, ps);
    // Gold collar ring under crystal
    px(ctx, sx, sy - 4, 1, 1, C.GOLD_BRIGHT, ps);

    // Peach right hand gripping mid-shaft
    outlinedBox(ctx, sx - 2, sy, 2, 2, C.SKIN, ps);

    // Faceted Sky-Blue Magic Crystal crowning the staff
    px(ctx, sx, sy - 9, 3, 1, C.OUTLINE, ps);
    px(ctx, sx - 1, sy - 8, 5, 4, C.OUTLINE, ps);
    px(ctx, sx, sy - 4, 3, 1, C.OUTLINE, ps);

    // Crystal facets: bright ice core top-left, cyan mid-body, deep sapphire lower-right
    px(ctx, sx, sy - 8, 3, 3, C.CRYSTAL_MID, ps);
    px(ctx, sx + 1, sy - 9, 1, 1, C.CRYSTAL_GLOW, ps);
    px(ctx, sx, sy - 8, 2, 2, gleam ? C.CRYSTAL_WHITE : C.CRYSTAL_GLOW, ps);
    px(ctx, sx, sy - 8, 1, 1, C.CRYSTAL_WHITE, ps);
    px(ctx, sx + 1, sy - 6, 2, 1, C.CRYSTAL_DEEP, ps);
  }

  /**
   * Draws crisp un-mirrored sky-blue pixel "z" and "Z" sleep letters (Frames 6–8 of Resting)
   */
  private static drawSleepZs(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    facingRight: boolean
  ) {
    ctx.save();
    // Anchor above-right of sleeping head; un-mirror horizontally if facing left so 'Z' never flips backwards!
    const anchorX = 6 * ps;
    const floatLift = f === 5 ? 0 : f === 6 ? -2 : -3;
    const anchorY = (-5 + floatLift) * ps;
    ctx.translate(anchorX, anchorY);
    if (!facingRight) {
      ctx.scale(-1, 1);
    }

    // Small lower 'z' (3x3 pixel glyph)
    px(ctx, -2, 1, 3, 1, C.CRYSTAL_MID, ps * 0.75);
    px(ctx, -1, 2, 1, 1, C.CRYSTAL_GLOW, ps * 0.75);
    px(ctx, -2, 3, 3, 1, C.CRYSTAL_MID, ps * 0.75);

    // Larger upper 'Z' (4x4 pixel glyph)
    const zShiftX = f === 7 ? 3 : 2;
    const zShiftY = f === 5 ? -3 : -4;
    px(ctx, zShiftX, zShiftY, 4, 1, C.CRYSTAL_GLOW, ps * 0.8);
    px(ctx, zShiftX + 2, zShiftY + 1, 1, 1, C.CRYSTAL_MID, ps * 0.8);
    px(ctx, zShiftX + 1, zShiftY + 2, 1, 1, C.CRYSTAL_MID, ps * 0.8);
    px(ctx, zShiftX, zShiftY + 3, 4, 1, C.CRYSTAL_GLOW, ps * 0.8);

    ctx.restore();
  }

  /**
   * ROW 1: WALKING ANIMATION (8 Frames: 0..7)
   */
  private static drawWalkingFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    gazeY: number,
    showStaff: boolean
  ) {
    // Brisk 2-beat wizard walk bounce (dips slightly on passing frames 2 & 5, rises on 1 & 6)
    const bobTable = [0, -1, 0, 0, 0, -1, 0, 0];
    const by = bobTable[f];
    const tipFlex = [0, 1, 1, 0, 0, 1, 1, 0][f];

    // 1. Flowing Rear Purple Cloak Flaring Behind (-X)
    const cloakFlare = [3, 4, 4, 3, 3, 4, 4, 3][f];
    outlinedBox(ctx, -4 - cloakFlare, -2 + by, cloakFlare + 2, 6, C.HAT_DARK, ps);
    px(ctx, -3 - cloakFlare, -2 + by, cloakFlare, 3, C.HAT_MID, ps);
    px(ctx, -3 - cloakFlare, -2 + by, Math.max(1, cloakFlare - 1), 2, C.HAT_BRIGHT, ps);

    // 2. Alternating Dark Wizard Boots Scissor Stride (8 frames)
    const legPoses: Array<{ lx: number; ly: number; rx: number; ry: number }> = [
      { lx: -4, ly: 4, rx: 1, ry: 4 },  // Frame 1: wide contact stride
      { lx: -3, ly: 4, rx: 1, ry: 4 },  // Frame 2: forward push
      { lx: -1, ly: 4, rx: -2, ry: 3 }, // Frame 3: passing cross-step
      { lx: -3, ly: 4, rx: 2, ry: 4 },  // Frame 4: extended step
      { lx: -4, ly: 4, rx: 1, ry: 4 },  // Frame 5: second contact stride
      { lx: -2, ly: 3, rx: 0, ry: 4 },  // Frame 6: passing high step
      { lx: -2, ly: 4, rx: 1, ry: 4 },  // Frame 7: recovery stride
      { lx: -3, ly: 4, rx: 1, ry: 4 },  // Frame 8: poised stride
    ];
    const lp = legPoses[f];
    outlinedBox(ctx, lp.lx, lp.ly, 2, 3, C.BOOT_DARK, ps);
    outlinedBox(ctx, lp.rx, lp.ry, 3, 3, C.BOOT_DARK, ps);
    px(ctx, lp.rx + 1, lp.ry + 1, 2, 1, C.BOOT_LIGHT, ps);

    // 3. Cobalt Blue Tunic & Gold-Trimmed Purple Cloak Front
    outlinedBox(ctx, -4, -3 + by, 8, 7, C.HAT_MID, ps);
    // Inner cobalt-blue wizard robe & shaded hem
    px(ctx, -1, -3 + by, 4, 7, C.TUNIC_BLUE, ps);
    px(ctx, -1, 3 + by, 4, 1, C.TUNIC_DEEP, ps);
    // Golden horizontal waist sash
    px(ctx, -1, 1 + by, 4, 1, C.GOLD_BRIGHT, ps);
    // Bright violet cloak shoulder highlight
    px(ctx, -4, -3 + by, 2, 4, C.HAT_BRIGHT, ps);
    // Twin vertical Golden Cloak Lapel Trims (signature Mage detail!)
    px(ctx, -2, -3 + by, 1, 6, C.GOLD_BRIGHT, ps);
    px(ctx, -3, 2 + by, 1, 2, C.GOLD_BRIGHT, ps);
    px(ctx, 3, -3 + by, 1, 7, C.GOLD_SHADE, ps);
    px(ctx, 3, -2 + by, 1, 4, C.GOLD_BRIGHT, ps);

    // 4. Swinging Peach Left Hand at Side
    const handSwingX = [0, -1, -1, 0, 0, -1, 0, 0][f];
    const handSwingY = [0, 0, 1, 0, 0, 1, 0, 0][f];
    outlinedBox(ctx, -4 + handSwingX, 1 + by + handSwingY, 2, 2, C.SKIN, ps);

    // 5. 3/4 Face with Cyan Eyes & Crooked Purple Wizard Hat
    this.drawMageFace(ctx, -1, -7 + by, ps, gazeY, false);
    this.drawWizardHat(ctx, 0, -8 + by, ps, tipFlex, false);

    // 6. Optional Built-in Upright-Angled Crystal Staff (matches Reference Walk Row 1..8)
    if (showStaff) {
      const staffBobY = [0, -1, 0, 0, -1, -1, 0, 0][f];
      const staffShiftX = f === 3 || f === 4 ? 1 : 0;
      this.drawCrystalStaff(ctx, 6 + staffShiftX, -1 + by + staffBobY, ps, 'upright', f % 2 === 0);
    }
  }

  /**
   * ROW 2: IDLE ANIMATION (8 Frames: 0..7)
   */
  private static drawIdleFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    gazeY: number,
    showStaff: boolean
  ) {
    // Gentle mystical breathing rise on frames 3..5, calm settle on 0..2 & 6..7
    const breathY = f === 3 || f === 4 || f === 5 ? -1 : 0;
    const hatTipSway = f === 4 || f === 5 ? 1 : 0;

    // 1. Draped Purple Cloak Back
    outlinedBox(ctx, -6, -3 + breathY, 3, 7 - (f === 4 ? 1 : 0), C.HAT_DARK, ps);
    px(ctx, -6, -3 + breathY, 2, 3, C.HAT_BRIGHT, ps);

    // 2. Grounded Dark Wizard Boots
    outlinedBox(ctx, -3, 4, 2, 3, C.BOOT_DARK, ps);
    outlinedBox(ctx, 1, 4, 3, 3, C.BOOT_DARK, ps);
    px(ctx, 2, 5, 2, 1, C.BOOT_LIGHT, ps);

    // 3. Cobalt Blue Tunic & Gold-Trimmed Purple Cloak
    outlinedBox(ctx, -4, -3 + breathY, 8, 7 - breathY, C.HAT_MID, ps);
    px(ctx, -1, -3 + breathY, 4, 7 - breathY, C.TUNIC_BLUE, ps);
    px(ctx, -1, 3, 4, 1, C.TUNIC_DEEP, ps);
    // Golden waist sash
    px(ctx, -1, 1 + breathY, 4, 1, C.GOLD_BRIGHT, ps);
    // Cloak shoulder highlight
    px(ctx, -4, -3 + breathY, 2, 4, C.HAT_BRIGHT, ps);
    // Twin vertical Golden Cloak Lapel Trims
    px(ctx, -2, -3 + breathY, 1, 6, C.GOLD_BRIGHT, ps);
    px(ctx, -3, 2, 1, 2, C.GOLD_BRIGHT, ps);
    px(ctx, 3, -3 + breathY, 1, 7 - breathY, C.GOLD_SHADE, ps);
    px(ctx, 3, -2 + breathY, 1, 4, C.GOLD_BRIGHT, ps);

    // 4. Relaxed Peach Left Hand at Cloak Side
    outlinedBox(ctx, -4, 1 + breathY, 2, 2, C.SKIN, ps);

    // 5. 3/4 Face & Crooked Wizard Hat
    this.drawMageFace(ctx, -1, -7 + breathY, ps, gazeY, false);
    this.drawWizardHat(ctx, 0, -8 + breathY, ps, hatTipSway, false);

    // 6. Optional Built-in Upright-Angled Crystal Staff (matches Reference Idle Row 1..8)
    if (showStaff) {
      const crystalGleam = f === 1 || f === 2 || f === 5 || f === 6;
      this.drawCrystalStaff(ctx, 6, -1 + breathY, ps, 'upright', crystalGleam);
    }
  }

  /**
   * ROW 3: RESTING ANIMATION (8 Frames: 0..7)
   * Frames 0..3 (Sheet 1–4): Standing -> drowsy knee-softening poise with upright staff
   * Frame 4 (Sheet 5): Kneeling / curling down onto floor, staff tipping forward
   * Frames 5..7 (Sheet 6–8): Curled asleep under tilted wizard hat, pooled cloak, grounded staff & "z Z"
   */
  private static drawRestingFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    facingRight: boolean
  ) {
    if (f <= 3) {
      // Frames 1–4: Standing -> gentle drowsy settle before curling down
      const settle = f >= 2 ? 1 : 0;
      const drowsyBlink = f === 3;

      outlinedBox(ctx, -6, -3 + settle, 3, 7 - settle, C.HAT_DARK, ps);
      px(ctx, -6, -3 + settle, 2, 3, C.HAT_BRIGHT, ps);

      outlinedBox(ctx, -3, 4, 2, 3, C.BOOT_DARK, ps);
      outlinedBox(ctx, 1, 4, 3, 3, C.BOOT_DARK, ps);

      outlinedBox(ctx, -4, -3 + settle, 8, 7 - settle, C.HAT_MID, ps);
      px(ctx, -1, -3 + settle, 4, 7 - settle, C.TUNIC_BLUE, ps);
      px(ctx, -1, 1 + settle, 4, 1, C.GOLD_BRIGHT, ps);
      px(ctx, -4, -3 + settle, 2, 4, C.HAT_BRIGHT, ps);
      px(ctx, -2, -3 + settle, 1, 6 - settle, C.GOLD_BRIGHT, ps);
      px(ctx, 3, -3 + settle, 1, 6 - settle, C.GOLD_BRIGHT, ps);

      outlinedBox(ctx, -4, 1 + settle, 2, 2, C.SKIN, ps);

      this.drawMageFace(ctx, -1, -7 + settle, ps, 0, drowsyBlink);
      this.drawWizardHat(ctx, 0, -8 + settle, ps, settle, false);
      this.drawCrystalStaff(ctx, 6, -1 + settle, ps, 'upright', f === 0 || f === 2);
      return;
    }

    if (f === 4) {
      // Frame 5 on sheet: Kneeling / curling down onto the floor, staff tipping down!
      // Wide pooled purple cloak on floor
      outlinedBox(ctx, -7, 1, 11, 5, C.HAT_MID, ps);
      px(ctx, -7, 1, 5, 2, C.HAT_BRIGHT, ps);
      px(ctx, -6, 4, 9, 2, C.HAT_DARK, ps);
      // Gold cloak trim & cobalt tunic glimpse
      px(ctx, 0, 2, 3, 3, C.TUNIC_BLUE, ps);
      px(ctx, -1, 1, 1, 5, C.GOLD_BRIGHT, ps);
      px(ctx, 3, 1, 1, 5, C.GOLD_BRIGHT, ps);
      // Tucked hand on floor
      outlinedBox(ctx, -3, 4, 2, 2, C.SKIN, ps);

      // Lowered drowsy face & hat
      this.drawMageFace(ctx, -1, -3, ps, 1, true);
      this.drawWizardHat(ctx, 0, -4, ps, 1, false);

      // Staff tipping diagonally onto ground in front
      this.drawCrystalStaff(ctx, 5, 2, ps, 'tilted', false);
      return;
    }

    // Frames 6–8 on sheet (f = 5, 6, 7): Curled Asleep on Floor + Grounded Staff + Floating "z Z"!
    const sleepBreath = f === 6 ? 1 : 0;

    // 1. Pooled Purple & Gold Cloak Curled Flat on the Floor (-8..+3, y: +2..+6)
    outlinedBox(ctx, -8, 2, 11, 4, C.HAT_MID, ps);
    px(ctx, -8, 2, 6, 2, C.HAT_BRIGHT, ps);
    px(ctx, -7, 4, 10, 2, C.HAT_DARK, ps);
    // Diagonal golden cloak hem trim resting on floor
    px(ctx, -3, 2, 1, 3, C.GOLD_BRIGHT, ps);
    px(ctx, -4, 4, 2, 2, C.GOLD_BRIGHT, ps);
    px(ctx, 1, 3, 2, 3, C.TUNIC_BLUE, ps);
    px(ctx, 2, 2, 1, 4, C.GOLD_SHADE, ps);

    // 2. Tucked Peach Hand & Peek of Face under Hat Brim
    outlinedBox(ctx, 2, 4, 2, 2, C.SKIN, ps);
    if (f === 5) {
      // Frame 6: slight peek of sleepy face before hat settles completely low in Frames 7–8
      this.drawMageFace(ctx, -1, -1, ps, 1, true);
      this.drawWizardHat(ctx, 0, -2, ps, 1, false);
    } else {
      // Frames 7–8: Crooked purple wizard hat tilted cozily forward/down over sleeping head!
      px(ctx, -1, 2, 3, 2, C.SKIN, ps);
      this.drawWizardHat(ctx, -1, 1 + sleepBreath, ps, f === 7 ? 1 : 0, true);
    }

    // 3. Ancient Crystal Staff Lying on the Floor Ahead (+X)
    this.drawCrystalStaff(ctx, 4, 4, ps, 'grounded', f === 6);

    // 4. Crisp Floating Sky-Blue "z Z" Sleep Letters!
    this.drawSleepZs(ctx, f, ps, facingRight);
  }
}
