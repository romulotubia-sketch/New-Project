/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WEAPON_REGISTRY } from './constants';
import { GameEngine } from './gameEngine';
import { skillTreeManager } from './skillTree';
import { sounds } from './sound';
import { DungeonRoom, Obstacle, Player, Weapon } from './types';

export class DungeonEventsManager {
  /**
   * 1. THE WISHING WELL OF FORTUNE
   * Toss coins for powerful rewards: legendary weapons, permanent max HP/Shield, Soul Gems, or celestial speed!
   */
  public static handleWishingWell(engine: GameEngine, obs: Obstacle, room: DungeonRoom) {
    if (!obs.data) obs.data = { uses: 0, maxUses: 3, cost: 15 };
    if (obs.data.uses >= obs.data.maxUses) {
      engine.addFloatingText(obs.x + 26, obs.y - 12, 'THE FOUNTAIN RESTS IN PEACE', '#94a3b8');
      return;
    }

    const cost = obs.data.cost;
    if (engine.player.coins < cost) {
      sounds.dryFire();
      engine.addFloatingText(obs.x + 26, obs.y - 12, `NEED ${cost} COINS FOR WISH`, '#ef4444');
      return;
    }

    engine.player.coins -= cost;
    obs.data.uses++;
    sounds.coin();

    // Spawn water ripple particles
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      engine.particles.push({
        x: obs.x + 26,
        y: obs.y + 26,
        vx: Math.cos(a) * (40 + Math.random() * 50),
        vy: Math.sin(a) * (40 + Math.random() * 50),
        radius: 2 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#38bdf8' : '#facc15',
        alpha: 1,
        life: 0,
        maxLife: 0.6,
      });
    }

    const outcomeRoll = Math.random();

    if (outcomeRoll < 0.32) {
      // High-tier / Mythic Weapon Wish!
      const legendaries = Object.values(WEAPON_REGISTRY).filter(
        w => w.rarity === 'legendary' || w.rarity === 'epic' || w.rarity === 'mythic'
      );
      const chosenWeapon: Weapon =
        legendaries[Math.floor(Math.random() * legendaries.length)] || WEAPON_REGISTRY['moonlight_katana'];

      room.drops.push({
        id: `wish_weapon_${Date.now()}_${Math.random()}`,
        type: 'weapon',
        x: obs.x + 26,
        y: obs.y + 64,
        value: 0,
        weaponData: JSON.parse(JSON.stringify(chosenWeapon)),
        bobPhase: 0,
      });

      sounds.levelUp();
      engine.addFloatingText(obs.x + 26, obs.y - 14, `🌟 WISHED FORTH: ${chosenWeapon.name.toUpperCase()}!`, '#facc15');
    } else if (outcomeRoll < 0.60) {
      // Vitality Elixir: +1 Max HP and +1 Max Shield!
      engine.player.maxHp += 1;
      engine.player.hp = Math.min(engine.player.maxHp, engine.player.hp + 2);
      engine.player.maxShield += 1;
      engine.player.shield = engine.player.maxShield;

      sounds.potion();
      engine.addFloatingText(obs.x + 26, obs.y - 14, '❤️ ELIXIR OF VITALITY! (+1 MAX HP & +1 SHIELD)', '#38bdf8');
    } else if (outcomeRoll < 0.85) {
      // Soul Gem Geyser: +25 Soul Gems!
      engine.player.soulGems += 25;
      skillTreeManager.addSoulGems(25);

      sounds.soulGem();
      engine.addFloatingText(obs.x + 26, obs.y - 14, '🔮 SOUL GEYSER! (+25 SOUL GEMS)', '#c084fc');
    } else {
      // Celestial Stardust Blessing: Full Energy + 30 Speed Surge
      engine.player.energy = engine.player.maxEnergy;
      engine.player.speed += 25;

      sounds.powerup();
      engine.addFloatingText(obs.x + 26, obs.y - 14, '✨ CELESTIAL BLESSING! (+25 SPEED & MAX MP)', '#a855f7');
    }

    if (obs.data.uses >= obs.data.maxUses) {
      obs.opened = true;
      obs.interactPrompt = 'The Wishing Well has granted all its gifts';
    }
  }

  /**
   * 2. THE BLOOD ALTAR OF SACRIFICE
   * Sacrifice 1 HP to forge a dark demonic pact granting titanic damage and a Mythic weapon!
   */
  public static handleBloodAltar(engine: GameEngine, obs: Obstacle, room: DungeonRoom) {
    if (!obs.data) obs.data = { offered: false };
    if (obs.data.offered) {
      engine.addFloatingText(obs.x + 26, obs.y - 12, 'THE BLOOD PACT HAS BEEN SEALED', '#ef4444');
      return;
    }

    if (engine.player.hp <= 1) {
      sounds.dryFire();
      engine.addFloatingText(obs.x + 26, obs.y - 12, 'LIFE FORCE TOO WEAK FOR SACRIFICE!', '#ef4444');
      return;
    }

    // Sacrifice 1 HP
    engine.player.hp = Math.max(1, engine.player.hp - 1);
    obs.data.offered = true;
    obs.opened = true;
    obs.interactPrompt = 'Blood Pact Sealed';

    sounds.enemyHit();

    // Dark crimson shockwave
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      engine.particles.push({
        x: obs.x + 26,
        y: obs.y + 26,
        vx: Math.cos(a) * (70 + Math.random() * 90),
        vy: Math.sin(a) * (70 + Math.random() * 90),
        radius: 3 + Math.random() * 3,
        color: i % 2 === 0 ? '#ef4444' : '#450a0a',
        alpha: 1,
        life: 0,
        maxLife: 0.8,
      });
    }

    // Grant permanent dungeon buff
    engine.passiveBuffs.damageMultiplier += 0.35;
    engine.passiveBuffs.critRateBonus += 0.25;
    engine.passiveBuffs.critDamageBonus += 0.5;

    // Drop guaranteed Mythic or Legendary relic
    const mythics = [
      WEAPON_REGISTRY['one_punch'],
      WEAPON_REGISTRY['moonlight_katana'],
      WEAPON_REGISTRY['gatling_gun'],
      WEAPON_REGISTRY['laser_fish'],
    ].filter(Boolean);
    const dropW: Weapon = mythics[Math.floor(Math.random() * mythics.length)] || WEAPON_REGISTRY['moonlight_katana'];

    room.drops.push({
      id: `blood_weapon_${Date.now()}`,
      type: 'weapon',
      x: obs.x + 26,
      y: obs.y + 64,
      value: 0,
      weaponData: JSON.parse(JSON.stringify(dropW)),
      bobPhase: 0,
    });

    sounds.levelUp();
    engine.addFloatingText(obs.x + 26, obs.y - 16, '🩸 BLOOD PACT SEALED! (+35% DMG, +25% CRIT & MYTHIC DROP)', '#dc2626');
  }

  /**
   * 3. GOBLIN WHEEL OF FORTUNE
   * Pay 20 coins to spin the carnival wheel for high-stakes jackpot drops!
   */
  public static handleFortuneWheel(engine: GameEngine, obs: Obstacle, room: DungeonRoom) {
    if (!obs.data) obs.data = { spinning: false, spinAngle: 0, cost: 20 };
    if (obs.data.spinning) return;

    const cost = obs.data.cost;
    if (engine.player.coins < cost) {
      sounds.dryFire();
      engine.addFloatingText(obs.x + 28, obs.y - 12, `NEED ${cost} COINS TO SPIN!`, '#ef4444');
      return;
    }

    engine.player.coins -= cost;
    obs.data.spinning = true;
    sounds.coin();

    // Wheel spin simulation
    const prizeIndex = Math.floor(Math.random() * 5);
    const totalSpins = 3 * Math.PI * 2 + (prizeIndex / 5) * Math.PI * 2;
    obs.data.spinAngle = (obs.data.spinAngle || 0) + totalSpins;

    setTimeout(() => {
      obs.data.spinning = false;

      if (prizeIndex === 0) {
        // JACKPOT: 75 Coins + 20 Gems
        engine.player.coins += 75;
        engine.player.soulGems += 20;
        skillTreeManager.addSoulGems(20);
        sounds.levelUp();
        engine.addFloatingText(obs.x + 28, obs.y - 16, '🎰 JACKPOT! (+75 COINS & +20 GEMS)', '#facc15');
      } else if (prizeIndex === 1) {
        // LEGENDARY WEAPON
        const allW = Object.values(WEAPON_REGISTRY).filter(w => w.rarity === 'legendary' || w.rarity === 'epic');
        const wonW = allW[Math.floor(Math.random() * allW.length)] || WEAPON_REGISTRY['rocket_launcher'];
        room.drops.push({
          id: `wheel_w_${Date.now()}`,
          type: 'weapon',
          x: obs.x + 28,
          y: obs.y + 64,
          value: 0,
          weaponData: JSON.parse(JSON.stringify(wonW)),
          bobPhase: 0,
        });
        sounds.levelUp();
        engine.addFloatingText(obs.x + 28, obs.y - 16, `🎁 WON: ${wonW.name.toUpperCase()}!`, '#38bdf8');
      } else if (prizeIndex === 2) {
        // TITAN SHIELD: +2 Max Shield & Full recovery
        engine.player.maxShield += 2;
        engine.player.shield = engine.player.maxShield;
        sounds.powerup();
        engine.addFloatingText(obs.x + 28, obs.y - 16, '🛡️ TITAN SHIELD! (+2 MAX SHIELD)', '#38bdf8');
      } else if (prizeIndex === 3) {
        // SPEED SURGE: +40 Speed
        engine.player.speed += 30;
        sounds.powerup();
        engine.addFloatingText(obs.x + 28, obs.y - 16, '⚡ SPEED SURGE! (+30 MOVE SPEED)', '#a855f7');
      } else {
        // HEALTH TONIC: Full HP & Energy
        engine.player.hp = engine.player.maxHp;
        engine.player.energy = engine.player.maxEnergy;
        sounds.potion();
        engine.addFloatingText(obs.x + 28, obs.y - 16, '🧪 REJUVENATION! (FULL HP & ENERGY)', '#4ade80');
      }
    }, 450);
  }

  /**
   * 4. MASTER BLACKSMITH FORGE
   * Reforge your currently held weapon: +35% damage, -1 energy cost, and higher crit rate!
   */
  public static handleBlacksmithForge(engine: GameEngine, obs: Obstacle) {
    if (!obs.data) obs.data = { upgraded: false, cost: 25 };
    if (obs.data.upgraded) {
      engine.addFloatingText(obs.x + 27, obs.y - 12, 'THE FORGE FIRES ARE SPENT', '#94a3b8');
      return;
    }

    const weapon = engine.player.weapons[engine.player.currentWeaponIndex];
    if (!weapon) {
      engine.addFloatingText(obs.x + 27, obs.y - 12, 'EQUIP A WEAPON TO REFORGE', '#94a3b8');
      return;
    }

    const cost = obs.data.cost;
    if (engine.player.coins < cost) {
      sounds.dryFire();
      engine.addFloatingText(obs.x + 27, obs.y - 12, `NEED ${cost} COINS TO REFORGE`, '#ef4444');
      return;
    }

    engine.player.coins -= cost;
    obs.data.upgraded = true;
    obs.opened = true;
    obs.interactPrompt = 'Weapon Reforged by Master Smith';

    // Upgrade weapon attributes
    weapon.damage = Math.round(weapon.damage * 1.35) + 2;
    weapon.energyCost = Math.max(0, weapon.energyCost - 1);
    weapon.critChance = Math.min(0.85, weapon.critChance + 0.12);
    if (!weapon.name.startsWith('Forged ')) {
      weapon.name = 'Forged ' + weapon.name;
    }

    sounds.shoot('shotgun'); // Hammer clang

    // Golden spark burst
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      engine.particles.push({
        x: obs.x + 27,
        y: obs.y + 25,
        vx: Math.cos(a) * (50 + Math.random() * 60),
        vy: Math.sin(a) * (50 + Math.random() * 60),
        radius: 2 + Math.random() * 2,
        color: '#f97316',
        alpha: 1,
        life: 0,
        maxLife: 0.6,
      });
    }

    sounds.levelUp();
    engine.addFloatingText(obs.x + 27, obs.y - 16, `⚒️ REFORGED: ${weapon.name.toUpperCase()} (+35% DMG, -1 MP, +12% CRIT)`, '#f97316');
  }

  /**
   * 5. CURSED MONOLITH OF THE ABYSS
   * Touch the monolith to awaken an intense phantom trial horde; surviving awards an Abyssal Cursed Chest!
   */
  public static handleCursedMonolith(engine: GameEngine, obs: Obstacle, room: DungeonRoom) {
    if (!obs.data) obs.data = { activated: false };
    if (obs.data.activated) return;

    obs.data.activated = true;
    obs.opened = true;
    obs.interactPrompt = 'Abyssal Trial in Progress...';

    sounds.enemyHit();

    // Dark void shockwave
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      engine.particles.push({
        x: obs.x + 25,
        y: obs.y + 28,
        vx: Math.cos(a) * (80 + Math.random() * 90),
        vy: Math.sin(a) * (80 + Math.random() * 90),
        radius: 3 + Math.random() * 3,
        color: '#a855f7',
        alpha: 1,
        life: 0,
        maxLife: 0.8,
      });
    }

    engine.addFloatingText(obs.x + 25, obs.y - 16, '💀 THE ABYSS AWAKENS! SURVIVE THE TRIAL!', '#c084fc');

    // Spawn 5 elite phantom shades around the monolith
    const spawnOffsets = [
      { x: -90, y: -70 },
      { x: 90, y: -70 },
      { x: -110, y: 50 },
      { x: 110, y: 50 },
      { x: 0, y: 90 },
    ];

    room.combatStarted = true;
    room.isCleared = false;
    room.wavesRemaining = 1;

    // Lock doors during the trial
    room.doors.forEach(d => (d.isOpen = false));

    spawnOffsets.forEach((off, idx) => {
      room.enemies.push({
        id: `abyssal_phantom_${Date.now()}_${idx}`,
        type: 'shadow_assassin',
        name: 'Abyssal Shade',
        x: obs.x + 25 + off.x,
        y: obs.y + 28 + off.y,
        vx: 0,
        vy: 0,
        radius: 18,
        rotation: 0,
        hp: 50,
        maxHp: 50,
        speed: 135,
        damage: 2,
        color: '#c084fc',
        size: 20,
        isBoss: false,
        isElite: true,
        attackCooldown: 1.1,
        attackTimer: 0.5,
        frozenTimer: 0,
        burnTimer: 0,
        burnTicks: 0,
        aiState: 'chase',
        facingRight: true,
        walkCycle: 0,
        xpValue: 40,
        gemValue: 15,
      });
    });
  }

  /**
   * Renders the custom visual pixel-art graphics for all 5 special event obstacles!
   */
  public static renderObstacle(
    ctx: CanvasRenderingContext2D,
    obs: Obstacle,
    t: number,
    player: Player | null
  ) {
    const cx = obs.x + obs.width / 2;
    const cy = obs.y + obs.height / 2;

    if (obs.type === 'wishing_well') {
      // 1. WISHING WELL
      // Circular cobblestone well
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 22, 0, Math.PI * 2);
      ctx.fill();

      // Shimmering cyan magical water pool
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 16, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing water ripples & gold sparkle
      const ripple = (Math.sin(t * 3) + 1) * 3;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 8 + ripple, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - 2 + Math.sin(t * 2) * 4, cy + 2 + Math.cos(t * 2) * 4, 3, 3);

      // Wooden Roof Canopy & Support Posts
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 20, cy - 18, 5, 24);
      ctx.fillRect(cx + 15, cy - 18, 5, 24);

      // Shingle Roof A-frame
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 28);
      ctx.lineTo(cx - 26, cy - 16);
      ctx.lineTo(cx + 26, cy - 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 22, cy - 18, 44, 3);
    } else if (obs.type === 'blood_altar') {
      // 2. BLOOD ALTAR OF SACRIFICE
      // Stepped Obsidian Pedestal
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(obs.x + 2, obs.y + obs.height - 12, obs.width - 4, 12);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(obs.x + 6, obs.y + obs.height - 20, obs.width - 12, 10);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(obs.x + 10, obs.y + 12, obs.width - 20, 18);

      // Glowing crimson skull sigil on altar face
      ctx.fillStyle = obs.opened ? '#7f1d1d' : '#dc2626';
      ctx.fillRect(cx - 4, obs.y + 16, 8, 8);
      ctx.fillRect(cx - 6, obs.y + 24, 12, 3);

      // Levitating Blood Orb above Altar
      const floatY = obs.y + 2 + Math.sin(t * 2.5) * 4;
      ctx.fillStyle = obs.opened ? '#581c87' : '#dc2626';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = obs.opened ? 4 : 14;
      ctx.beginPath();
      ctx.arc(cx, floatY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Crimson flame wisps
      if (!obs.opened) {
        ctx.fillStyle = '#fca5a5';
        ctx.fillRect(cx - 2, floatY - 2, 4, 4);
      }
    } else if (obs.type === 'fortune_wheel') {
      // 3. GOBLIN WHEEL OF FORTUNE
      // Tripod wooden stand
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 3, cy, 6, 26);
      ctx.fillRect(cx - 16, cy + 20, 32, 4);

      // Carnival Wheel Circle with 8 colorful slices
      const spinAngle = obs.data?.spinAngle || 0;
      const r = 20;
      const colors = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

      ctx.save();
      ctx.translate(cx, cy - 4);
      ctx.rotate(spinAngle);
      for (let i = 0; i < 8; i++) {
        const a1 = (i * Math.PI) / 4;
        const a2 = ((i + 1) * Math.PI) / 4;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a1, a2);
        ctx.closePath();
        ctx.fill();
      }
      // Wheel golden rim & hub
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Top Red Pointer
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx - 4, cy - 30);
      ctx.lineTo(cx + 4, cy - 30);
      ctx.closePath();
      ctx.fill();
    } else if (obs.type === 'blacksmith_forge') {
      // 4. MASTER BLACKSMITH FORGE
      // Heavy Oak Log base
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 18, cy + 2, 36, 22);

      // Cast-Iron Anvil
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 14, cy - 8, 28, 12);
      ctx.fillRect(cx - 20, cy - 14, 40, 7);
      ctx.fillRect(cx + 18, cy - 13, 6, 3); // Anvil horn
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx - 18, cy - 13, 34, 2);

      // Flaming Crucible on side
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(obs.x + 2, cy - 2, 12, 18);
      const emberFlicker = Math.sin(t * 8) * 2;
      ctx.fillStyle = '#f97316';
      ctx.fillRect(obs.x + 4, cy - 8 + emberFlicker, 8, 8);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(obs.x + 6, cy - 6 + emberFlicker, 4, 4);
    } else if (obs.type === 'cursed_monolith') {
      // 5. CURSED MONOLITH OF THE ABYSS
      // Jagged dark monolith pillar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 16, cy - 22, 32, 48);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(cx - 12, cy - 20, 24, 44);

      // Glowing violet rune fissures
      const activated = Boolean(obs.data?.activated);
      ctx.fillStyle = activated ? '#ef4444' : '#a855f7';
      ctx.fillRect(cx - 4, cy - 12, 8, 3);
      ctx.fillRect(cx - 2, cy - 6, 4, 12);
      ctx.fillRect(cx - 6, cy + 10, 12, 3);

      // Central glowing void eye
      ctx.fillStyle = activated ? '#dc2626' : '#c084fc';
      ctx.shadowColor = activated ? '#ef4444' : '#a855f7';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
