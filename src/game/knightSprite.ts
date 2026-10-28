/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KnightAnimMode = 'walk' | 'idle' | 'rest';

export interface KnightDrawOptions {
  x: number;
  y: number; // Character center (ground contact is at y + 7 * pixelSize = y + 14 when pixelSize=2)
  facingRight: boolean;
  state: KnightAnimMode;
  frame: number; // 0..7 (8 frames per animation row)
  pixelSize?: number; // Default 2.0 (1 art pixel = 2x2 world px)
  gazeY?: number; // Subtle vertical visor tracking (-1, 0, +1)
  showBuiltInSword?: boolean; // True in lobby/sheet preview or when not rendering separate 360-aimed weapon
  showOffhandShield?: boolean; // True by default; renders Knight's iconic gold-cross heater shield
}

// Exact color swatches from the Knight pixel-art reference sheet
const C = {
  OUTLINE: '#0b0d12',
  STEEL_LIGHT: '#76859e',
  STEEL_MID: '#59647a',
  STEEL_DARK: '#3e4656',
  STEEL_DEEP: '#262c38',
  GOLD_BRIGHT: '#f4a636',
  GOLD_SHADE: '#c97b1e',
  CAPE_BRIGHT: '#b92228',
  CAPE_MID: '#87161c',
  CAPE_DARK: '#590d13',
  SKIN: '#f0b589',
  BLADE_LIGHT: '#e2e8f0',
  BLADE_MID: '#94a3b8',
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
 * Renders the pixel-art Knight character across all 3 animation states (8 frames each):
 * - WALKING (Frames 0..7): Brisk 2-beat stride, 1px vertical bounce, billowing 3-tone crimson cape,
 *   alternating armored leg scissor-stride, sword/arm swing, and braced gold-cross shield.
 * - IDLE (Frames 0..7): Frames 0..2 poised sword-ready stance -> Frames 3..7 relaxed hand-at-side
 *   breathing cycle with 1px chest/helm rise & fall and subtle cape sway.
 * - RESTING (Frames 0..7): Frames 0..4 crouch/kneel transition lowering body & shield -> Frames 5..7
 *   seated camp posture on ground with pooled crimson cape, tucked boots, and grounded gold-cross shield.
 */
export class KnightSpriteRenderer {
  public static draw(ctx: CanvasRenderingContext2D, opts: KnightDrawOptions) {
    const ps = opts.pixelSize ?? 2;
    const f = ((Math.floor(opts.frame) % 8) + 8) % 8;
    const facing = opts.facingRight ? 1 : -1;
    const gaze = Math.max(-1, Math.min(1, Math.round(opts.gazeY ?? 0)));
    const showSword = opts.showBuiltInSword ?? false;
    const showShield = opts.showOffhandShield ?? true;

    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.scale(facing, 1);

    if (opts.state === 'walk') {
      this.drawWalkingFrame(ctx, f, ps, gaze, showSword, showShield);
    } else if (opts.state === 'rest') {
      this.drawRestingFrame(ctx, f, ps, showShield);
    } else {
      this.drawIdleFrame(ctx, f, ps, gaze, showSword, showShield);
    }

    ctx.restore();
  }

  /**
   * Draws the Greathelm (rounded 10x9 steel helm + golden T-cross + flanking dark visor eye-slits)
   * Anchor (hx, hy) is top-left interior corner of the 8x8 helm core (default hx = -4, hy = -12)
   */
  private static drawGreathelm(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    ps: number,
    gazeY: number = 0
  ) {
    // Rounded pixel outline silhouette
    px(ctx, hx + 1, hy - 1, 7, 1, C.OUTLINE, ps); // top crown outline
    px(ctx, hx, hy, 9, 1, C.OUTLINE, ps);
    px(ctx, hx - 1, hy + 1, 11, 7, C.OUTLINE, ps); // side outlines
    px(ctx, hx, hy + 8, 9, 1, C.OUTLINE, ps); // chin outline

    // Base mid-steel dome
    px(ctx, hx, hy + 1, 9, 7, C.STEEL_MID, ps);
    px(ctx, hx + 1, hy, 7, 1, C.STEEL_MID, ps);

    // Top-left bevel highlight (#76859e)
    px(ctx, hx + 1, hy, 5, 1, C.STEEL_LIGHT, ps);
    px(ctx, hx, hy + 1, 6, 1, C.STEEL_LIGHT, ps);
    px(ctx, hx, hy + 2, 2, 3, C.STEEL_LIGHT, ps);

    // Lower/back cheekplate shadow (#3e4656)
    px(ctx, hx, hy + 5, 3, 3, C.STEEL_DARK, ps);
    px(ctx, hx + 8, hy + 1, 1, 7, C.STEEL_DARK, ps);

    const vy = hy + 3 + gazeY;

    // Dark recessed visor slits flanking the golden noseguard (3/4 front-right alignment)
    px(ctx, hx + 3, vy + 1, 2, 3, C.OUTLINE, ps); // Left eye slit
    px(ctx, hx + 7, vy + 1, 1, 3, C.OUTLINE, ps); // Right eye slit

    // Warm gold lower cheek-trim flanking noseguard (as in reference portrait)
    px(ctx, hx + 3, vy + 4, 2, 1, C.GOLD_SHADE, ps);
    px(ctx, hx + 7, vy + 4, 1, 1, C.GOLD_SHADE, ps);

    // Iconic Golden T-Cross across brow and down noseguard
    px(ctx, hx + 5, vy - 2, 2, 2, C.GOLD_BRIGHT, ps); // Forehead upper cross stem
    px(ctx, hx + 2, vy, 7, 1, C.GOLD_BRIGHT, ps); // Horizontal brow crossbar
    px(ctx, hx + 2, vy, 1, 1, C.GOLD_SHADE, ps); // Left brow tip shade
    px(ctx, hx + 8, vy, 1, 1, C.GOLD_SHADE, ps); // Right brow tip shade
    px(ctx, hx + 5, vy + 1, 2, 4, C.GOLD_BRIGHT, ps); // Central vertical noseguard
    px(ctx, hx + 6, vy + 3, 1, 2, C.GOLD_SHADE, ps); // Noseguard right bevel
  }

  /**
   * Draws the Knight's front Heater / Kite Shield with dark rim and Golden Cross emblem
   */
  private static drawHeaterShield(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    ps: number,
    tiltedMode: 'upright' | 'angled' | 'flat' = 'upright'
  ) {
    if (tiltedMode === 'flat') {
      // Frame 6 of Resting: shield laid low/tilted on the ground ahead of knees
      px(ctx, sx, sy + 1, 6, 3, C.OUTLINE, ps);
      px(ctx, sx + 1, sy, 4, 4, C.OUTLINE, ps);
      px(ctx, sx + 1, sy + 1, 4, 2, C.STEEL_DARK, ps);
      px(ctx, sx + 1, sy + 1, 4, 1, C.GOLD_BRIGHT, ps);
      px(ctx, sx + 2, sy + 2, 2, 1, C.GOLD_SHADE, ps);
      return;
    }

    if (tiltedMode === 'angled') {
      // Frames 3..5 & 7..8 of Resting: shield propped angled beside legs
      px(ctx, sx, sy, 5, 5, C.OUTLINE, ps);
      px(ctx, sx + 1, sy + 5, 3, 1, C.OUTLINE, ps);
      px(ctx, sx + 1, sy + 1, 3, 4, C.STEEL_DARK, ps);
      // Gold rim & cross
      px(ctx, sx + 2, sy + 1, 1, 4, C.GOLD_BRIGHT, ps);
      px(ctx, sx + 1, sy + 2, 3, 1, C.GOLD_BRIGHT, ps);
      return;
    }

    // Standard upright Heater/Kite shield (5w x 7h interior + 1px dark outline)
    px(ctx, sx, sy, 5, 6, C.OUTLINE, ps);
    px(ctx, sx - 1, sy + 1, 7, 4, C.OUTLINE, ps);
    px(ctx, sx + 1, sy + 6, 3, 1, C.OUTLINE, ps);
    px(ctx, sx + 2, sy + 7, 1, 1, C.OUTLINE, ps);

    // Shield steel & gold trim interior
    px(ctx, sx, sy + 1, 5, 4, C.STEEL_DARK, ps);
    px(ctx, sx + 1, sy + 5, 3, 1, C.STEEL_DARK, ps);
    px(ctx, sx, sy + 1, 1, 4, C.GOLD_SHADE, ps);
    px(ctx, sx + 4, sy + 1, 1, 4, C.GOLD_SHADE, ps);

    // Prominent Golden Cross on shield face
    px(ctx, sx + 2, sy + 1, 1, 5, C.GOLD_BRIGHT, ps);
    px(ctx, sx + 1, sy + 2, 3, 1, C.GOLD_BRIGHT, ps);
  }

  /**
   * ROW 1: WALKING ANIMATION (8 Frames: 0..7)
   */
  private static drawWalkingFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    gazeY: number,
    showSword: boolean,
    showShield: boolean
  ) {
    // 2-beat brisk vertical bounce across the 8 frames
    const bobTable = [0, -1, -1, 0, 0, -1, -1, 0];
    const by = bobTable[f];

    // 1. Billowing 3-tone Crimson Cape behind (-X) with dynamic wave across frames 0..7
    const capeWave = [0, -1, -2, 0, 0, -1, -2, 0][f];
    const capeReach = [5, 6, 5, 4, 5, 6, 5, 4][f];
    outlinedBox(ctx, -3 - capeReach, -4 + by + Math.min(0, capeWave), capeReach, 6, C.CAPE_MID, ps);
    px(ctx, -3 - capeReach, -4 + by + Math.min(0, capeWave), capeReach - 1, 2, C.CAPE_BRIGHT, ps);
    px(ctx, -5, -1 + by, 2, 4, C.CAPE_DARK, ps);

    // 2. Alternating Scissor Leg Stride (8 frames)
    const legPoses: Array<{ lx: number; ly: number; rx: number; ry: number }> = [
      { lx: -5, ly: 4, rx: 1, ry: 4 },  // Frame 1: wide contact stride
      { lx: -4, ly: 4, rx: 0, ry: 4 },  // Frame 2: recoil / closing
      { lx: -1, ly: 3, rx: -2, ry: 4 }, // Frame 3: passing / high knee
      { lx: -4, ly: 4, rx: 2, ry: 4 },  // Frame 4: extended front step
      { lx: -5, ly: 4, rx: 2, ry: 4 },  // Frame 5: second wide stride
      { lx: -4, ly: 4, rx: 0, ry: 4 },  // Frame 6: recoil / closing
      { lx: -2, ly: 4, rx: -1, ry: 3 }, // Frame 7: passing / high knee
      { lx: -3, ly: 4, rx: 1, ry: 4 },  // Frame 8: recovery stride
    ];
    const lp = legPoses[f];
    // Back leg
    outlinedBox(ctx, lp.lx, lp.ly, 2, 3, C.STEEL_DEEP, ps);
    px(ctx, lp.lx, lp.ly, 2, 1, C.STEEL_DARK, ps);
    // Front leg
    outlinedBox(ctx, lp.rx, lp.ry, 3, 3, C.STEEL_DARK, ps);
    px(ctx, lp.rx + 1, lp.ry + 1, 2, 1, C.STEEL_LIGHT, ps);

    // 3. Armored Torso & Belt
    outlinedBox(ctx, -4, -3 + by, 7, 7, C.STEEL_MID, ps);
    px(ctx, -4, 2 + by, 7, 2, C.STEEL_DEEP, ps); // Dark belt & tassets
    px(ctx, -3, -2 + by, 3, 4, C.STEEL_LIGHT, ps); // Breastplate highlight

    // 4. Crimson Neck Scarf Wrap
    px(ctx, -5, -4 + by, 9, 2, C.OUTLINE, ps);
    px(ctx, -4, -4 + by, 7, 1, C.CAPE_BRIGHT, ps);
    px(ctx, -3, -3 + by, 6, 1, C.CAPE_MID, ps);

    // 5. Front Off-hand Gold-Cross Heater Shield
    if (showShield) {
      const shieldBob = f === 2 || f === 6 ? -1 : 0;
      this.drawHeaterShield(ctx, 2, -3 + by + shieldBob, ps, 'upright');
    }

    // 6. Greathelm (shifted +1px forward during brisk walk lean)
    this.drawGreathelm(ctx, -4, -12 + by, ps, gazeY);

    // 7. Right Shoulder Pauldron, Peach Hand & Optional Classic Short-Sword Swing
    const armSwingX = [0, 0, -1, -1, 0, -1, -1, 0][f];
    const armSwingY = [0, 0, 1, 0, 0, 0, 1, 0][f];
    outlinedBox(ctx, -5 + armSwingX, -2 + by, 3, 3, C.STEEL_DARK, ps);
    px(ctx, -5 + armSwingX, -2 + by, 2, 1, C.STEEL_LIGHT, ps);

    if (showSword) {
      // Peach pixel hand gripping hilt
      outlinedBox(ctx, -3 + armSwingX, 1 + by + armSwingY, 2, 2, C.SKIN, ps);
      // 8-frame short-sword swing matching Reference Row 1 (Frames 1..8)
      if (f === 0) {
        // Frame 1: extended diagonal forward-down slash
        outlinedBox(ctx, -1, 2 + by, 3, 2, C.BLADE_LIGHT, ps);
        outlinedBox(ctx, 1, 3 + by, 3, 2, C.BLADE_LIGHT, ps);
        px(ctx, -2, 1 + by, 2, 2, C.GOLD_BRIGHT, ps);
      } else if (f === 1 || f === 7) {
        // Frames 2 & 8: mid diagonal blade
        outlinedBox(ctx, -1, 2 + by, 3, 2, C.BLADE_LIGHT, ps);
        px(ctx, 1, 3 + by, 2, 1, C.BLADE_MID, ps);
      } else if (f === 2 || f === 5 || f === 6) {
        // Frames 3, 6, 7: compact downward swing at hip
        outlinedBox(ctx, -2, 2 + by + armSwingY, 2, 3, C.BLADE_LIGHT, ps);
      } else {
        // Frames 4 & 5: forward thrust poise
        outlinedBox(ctx, 0, 2 + by, 4, 2, C.BLADE_LIGHT, ps);
        px(ctx, -1, 1 + by, 1, 3, C.GOLD_BRIGHT, ps);
      }
    } else {
      // Clean armored gauntlet / hand when external 360° weapon sprite is active
      outlinedBox(ctx, -4 + armSwingX, 1 + by + armSwingY, 2, 2, C.SKIN, ps);
    }
  }

  /**
   * ROW 2: IDLE ANIMATION (8 Frames: 0..7)
   * Frames 0..2: Poised readiness with short sword low at side
   * Frames 3..7: Calm upright breathing cycle with hand relaxed at side & gold-cross shield forward
   */
  private static drawIdleFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    gazeY: number,
    showSword: boolean,
    showShield: boolean
  ) {
    // Subtle 1px breathing rise on frames 4 & 5 (Frames 5-6 on sheet), settling on 6 & 7
    const helmBob = f === 4 || f === 5 ? -1 : 0;
    const chestBob = f === 1 || f === 4 || f === 5 ? -1 : 0;
    const capeSway = f === 4 || f === 5 ? 1 : 0;

    // 1. Draped Crimson Cape behind (-X)
    outlinedBox(ctx, -7, -4 + chestBob, 4, 7 - capeSway, C.CAPE_MID, ps);
    px(ctx, -7, -4 + chestBob, 3, 2, C.CAPE_BRIGHT, ps);
    px(ctx, -5, 0 + chestBob, 2, 3 - capeSway, C.CAPE_DARK, ps);

    // 2. Grounded Armored Boots
    outlinedBox(ctx, -4, 4, 3, 3, C.STEEL_DEEP, ps);
    outlinedBox(ctx, 0, 4, 3, 3, C.STEEL_DARK, ps);
    px(ctx, 1, 5, 2, 1, C.STEEL_LIGHT, ps);

    // 3. Armored Torso
    outlinedBox(ctx, -4, -3 + chestBob, 7, 7 - chestBob, C.STEEL_MID, ps);
    px(ctx, -4, 2, 7, 2, C.STEEL_DEEP, ps);
    px(ctx, -3, -2 + chestBob, 3, 4, C.STEEL_LIGHT, ps);

    // 4. Crimson Scarf Wrap across neck/chest
    px(ctx, -5, -4 + chestBob, 9, 2, C.OUTLINE, ps);
    px(ctx, -4, -4 + chestBob, 7, 1, C.CAPE_BRIGHT, ps);
    px(ctx, -3, -3 + chestBob, 6, 1, C.CAPE_MID, ps);

    // 5. Front Gold-Cross Heater Shield (prominent 3/4 front-right display)
    if (showShield) {
      this.drawHeaterShield(ctx, 1, -3 + chestBob, ps, 'upright');
    }

    // 6. Greathelm
    this.drawGreathelm(ctx, -4, -12 + helmBob, ps, gazeY);

    // 7. Right Shoulder Pauldron & Hand (with sword poise in frames 0..2 when showSword=true)
    outlinedBox(ctx, -5, -2 + chestBob, 3, 3, C.STEEL_DARK, ps);
    px(ctx, -5, -2 + chestBob, 2, 1, C.STEEL_LIGHT, ps);

    if (showSword && f <= 2) {
      outlinedBox(ctx, -4, 1 + chestBob, 2, 2, C.SKIN, ps);
      if (f === 0) {
        outlinedBox(ctx, -2, 2, 3, 2, C.BLADE_LIGHT, ps);
        px(ctx, 0, 3, 2, 1, C.BLADE_MID, ps);
      } else if (f === 1) {
        outlinedBox(ctx, -2, 2, 2, 2, C.BLADE_LIGHT, ps);
      } else {
        px(ctx, -2, 2, 2, 2, C.BLADE_MID, ps);
      }
    } else {
      // Frames 4..8 on sheet: relaxed peach hand at side
      const handY = f === 4 || f === 5 ? 0 : 1;
      outlinedBox(ctx, -5, handY, 2, 2, C.SKIN, ps);
    }
  }

  /**
   * ROW 3: RESTING ANIMATION (8 Frames: 0..7)
   * Frames 0..1: Standing -> softening knees
   * Frames 2..4: Dropping down onto knees / tucking legs
   * Frames 5..7: Seated camp rest on the floor with pooled crimson cape & grounded shield
   */
  private static drawRestingFrame(
    ctx: CanvasRenderingContext2D,
    f: number,
    ps: number,
    showShield: boolean
  ) {
    // Progressive vertical compression from standing (f=0) down to seated on floor (f=5..7)
    const helmDropTable = [0, 1, 3, 4, 4, 6, 5, 6];
    const bodyDropTable = [0, 1, 2, 3, 3, 5, 5, 5];
    const hd = helmDropTable[f];
    const bd = bodyDropTable[f];

    if (f <= 1) {
      // Frames 1–2: Standing -> slight crouch preparation
      outlinedBox(ctx, -7, -4 + bd, 4, 7, C.CAPE_MID, ps);
      px(ctx, -7, -4 + bd, 3, 2, C.CAPE_BRIGHT, ps);

      outlinedBox(ctx, -4, 4, 3, 3, C.STEEL_DEEP, ps);
      outlinedBox(ctx, 0, 4, 3, 3, C.STEEL_DARK, ps);

      outlinedBox(ctx, -4, -3 + bd, 7, 7 - bd, C.STEEL_MID, ps);
      px(ctx, -4, 2, 7, 2, C.STEEL_DEEP, ps);

      px(ctx, -5, -4 + bd, 9, 2, C.OUTLINE, ps);
      px(ctx, -4, -4 + bd, 7, 1, C.CAPE_BRIGHT, ps);
      px(ctx, -3, -3 + bd, 6, 1, C.CAPE_MID, ps);

      if (showShield) {
        this.drawHeaterShield(ctx, 2, -2 + bd, ps, 'upright');
      }

      this.drawGreathelm(ctx, -4, -12 + hd, ps, 0);
      outlinedBox(ctx, -5, -2 + bd, 3, 3, C.STEEL_DARK, ps);
      outlinedBox(ctx, -5, 1 + bd, 2, 2, C.SKIN, ps);
      return;
    }

    if (f <= 4) {
      // Frames 3–5: Kneeling / lowering down toward the dungeon floor
      // Cape draping lower toward ground
      outlinedBox(ctx, -8, -3 + bd, 5, 9 - bd, C.CAPE_MID, ps);
      px(ctx, -8, -3 + bd, 4, 2, C.CAPE_BRIGHT, ps);
      px(ctx, -6, 2, 3, 4, C.CAPE_DARK, ps);

      // Kneeling / tucked boots
      outlinedBox(ctx, -4, 4, 3, 3, C.STEEL_DEEP, ps);
      outlinedBox(ctx, 0, 4, 3, 3, C.STEEL_DARK, ps);

      // Compact torso
      outlinedBox(ctx, -4, -3 + bd, 7, 7 - bd, C.STEEL_MID, ps);
      px(ctx, -4, 3, 7, 2, C.STEEL_DEEP, ps);

      // Crimson scarf
      px(ctx, -5, -4 + bd, 9, 2, C.OUTLINE, ps);
      px(ctx, -4, -4 + bd, 7, 1, C.CAPE_BRIGHT, ps);
      px(ctx, -3, -3 + bd, 6, 1, C.CAPE_MID, ps);

      // Shield lowering beside knee
      if (showShield) {
        this.drawHeaterShield(ctx, 3, f === 2 ? 0 : 1, ps, 'angled');
      }

      this.drawGreathelm(ctx, -4, -12 + hd, ps, 0);
      outlinedBox(ctx, -5, -1 + bd, 3, 3, C.STEEL_DARK, ps);
      outlinedBox(ctx, -4, 2 + Math.min(2, bd - 1), 2, 2, C.SKIN, ps);
      return;
    }

    // Frames 6–8 (f = 5, 6, 7): Seated Camp Rest on the Ground!
    // 1. Pooled Crimson Cape resting on the stone floor behind (-X)
    outlinedBox(ctx, -8, 1, 5, 6, C.CAPE_MID, ps);
    px(ctx, -9, 4, 3, 3, C.OUTLINE, ps);
    px(ctx, -8, 4, 2, 2, C.CAPE_DARK, ps);
    px(ctx, -7, 1, 4, 2, C.CAPE_BRIGHT, ps);

    // 2. Seated Torso & Tucked Forward Boots on Floor
    outlinedBox(ctx, -4, 1, 7, 5, C.STEEL_MID, ps);
    px(ctx, -4, 4, 7, 2, C.STEEL_DEEP, ps);
    // Seated armored boots tucked ahead on floor
    outlinedBox(ctx, -2, 5, 3, 2, C.STEEL_DEEP, ps);
    outlinedBox(ctx, 1, 5, 3, 2, C.STEEL_DARK, ps);
    px(ctx, 2, 5, 2, 1, C.STEEL_LIGHT, ps);

    // 3. Crimson Scarf nestled under chin
    px(ctx, -5, 1, 9, 2, C.OUTLINE, ps);
    px(ctx, -4, 1, 7, 1, C.CAPE_BRIGHT, ps);
    px(ctx, -3, 2, 6, 1, C.CAPE_MID, ps);

    // 4. Resting Hand on knee/lap
    outlinedBox(ctx, -4, 3, 2, 2, C.STEEL_DARK, ps);
    outlinedBox(ctx, -3, 4, 2, 2, C.SKIN, ps);

    // 5. Greathelm nestled low in peaceful camp rest (with 1px gentle breathing between frames 6..8)
    this.drawGreathelm(ctx, -4, -12 + hd, ps, 1);

    // 6. Gold-Cross Shield propped/laid on the ground in front (+X)
    if (showShield) {
      if (f === 5) {
        // Frame 6: shield laid low on ground
        this.drawHeaterShield(ctx, 3, 3, ps, 'flat');
      } else if (f === 6) {
        // Frame 7: shield propped angled beside boots
        this.drawHeaterShield(ctx, 3, 1, ps, 'angled');
      } else {
        // Frame 8: shield propped slightly further forward beside extended boot
        this.drawHeaterShield(ctx, 4, 1, ps, 'angled');
      }
    }
  }
}
