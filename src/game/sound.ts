/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public musicEnabled: boolean = true;
  private musicInterval: any = null;
  private currentNoteIndex = 0;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public shoot(type: 'pistol' | 'laser' | 'shotgun' | 'explosive' | 'staff' = 'pistol') {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'shotgun') {
      // Noise burst + low thump
      osc.type = 'square';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    } else if (type === 'explosive') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    } else if (type === 'staff') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.2);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } else {
      // standard pistol
      osc.type = 'square';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  public meleeSlash() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.14);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  public hitEnemy(isCrit: boolean = false) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isCrit) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, t);
      osc.frequency.setValueAtTime(1100, t + 0.04);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.14);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + (isCrit ? 0.14 : 0.06));
  }

  public playerHit() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public shieldBreak() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(220, t + 0.08);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public shieldRecharge() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.12);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public explosion() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.4);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public coin() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.06); // E6

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public soulGem() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, t); // E5
    osc.frequency.setValueAtTime(880, t + 0.05); // A5
    osc.frequency.setValueAtTime(1174.66, t + 0.1); // D6

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public skillCast(skillId: string, isUltimate?: boolean) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    if (isUltimate) {
      this.ultimateCast();
      return;
    }

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (skillId.includes('lightning') || skillId.includes('shock')) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    } else if (skillId.includes('shield') || skillId.includes('fortress') || skillId.includes('charge')) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(580, t + 0.2);
    } else if (skillId.includes('meteor') || skillId.includes('slam') || skillId.includes('grenade')) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    } else if (skillId.includes('teleport') || skillId.includes('blink')) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.2);
    } else if (skillId.includes('smoke') || skillId.includes('cryo') || skillId.includes('acid')) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.linearRampToValueAtTime(150, t + 0.25);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    }

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public ultimateCast() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Multi-chord retro fanfare ascending sequence
    [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);
      gain.gain.setValueAtTime(0.2, t + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.05 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.35);
    });
  }

  public chestOpen() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);
      gain.gain.setValueAtTime(0.12, t + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.07 + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.15);
    });
  }

  public levelUp() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [261.63, 329.63, 392.00, 523.25, 659.25].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      gain.gain.setValueAtTime(0.15, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.2);
    });
  }

  public startChiptune() {
    if (!this.musicEnabled || this.musicInterval) return;
    this.initContext();

    // 8-bit atmospheric dungeon melody notes (frequencies in Hz)
    const melody = [
      146.83, 0, 174.61, 220, 196, 0, 174.61, 146.83,
      130.81, 0, 164.81, 196, 174.61, 0, 164.81, 130.81,
      110.00, 0, 146.83, 174.61, 164.81, 0, 146.83, 110.00,
      123.47, 0, 146.83, 164.81, 146.83, 130.81, 123.47, 110.00
    ];

    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled || !this.ctx) return;
      const note = melody[this.currentNoteIndex];
      this.currentNoteIndex = (this.currentNoteIndex + 1) % melody.length;
      if (note > 0) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, t);
        gain.gain.setValueAtTime(0.025, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.23);
      }
    }, 240);
  }

  public stopChiptune() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public dryFire() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public potion() {
    this.shieldRecharge();
  }

  public powerup() {
    this.chestOpen();
  }

  public enemyHit(isCrit: boolean = false) {
    this.hitEnemy(isCrit);
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    this.musicEnabled = this.enabled;
    if (!this.musicEnabled) {
      this.stopChiptune();
    } else {
      this.startChiptune();
    }
    return this.enabled;
  }
}

export const sounds = new SoundSystem();
