/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { gameSettings } from './settings';
import { DropItem, Weapon } from './types';

export class WeaponRenderer {
  public static lastInspectionCardBounds: { x: number; y: number; width: number; height: number } | null = null;

  public static getRarityColor(rarity: string): { border: string; glow: string; text: string; bg: string } {
    switch (rarity) {
      case 'mythic':
        return { border: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', text: '#fca5a5', bg: 'rgba(127, 29, 29, 0.92)' };
      case 'legendary':
        return { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', text: '#fde68a', bg: 'rgba(120, 53, 15, 0.92)' };
      case 'epic':
        return { border: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)', text: '#e9d5ff', bg: 'rgba(88, 28, 135, 0.92)' };
      case 'rare':
        return { border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)', text: '#bae6fd', bg: 'rgba(12, 74, 110, 0.92)' };
      default:
        return { border: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', text: '#f1f5f9', bg: 'rgba(30, 41, 59, 0.92)' };
    }
  }

  /**
   * Draws custom detailed pixel-art sprite for any weapon in the game
   */
  public static drawWeaponSprite(
    ctx: CanvasRenderingContext2D,
    weapon: Weapon,
    x: number,
    y: number,
    scale: number = 1.0,
    rotation: number = 0,
    flipped: boolean = false
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (flipped) {
      ctx.scale(1, -1);
    }
    ctx.scale(scale, scale);

    const id = weapon.id;

    if (id === 'bad_pistol') {
      // Classic Revolver: gray barrel, brown wooden grip, cylinder, hammer
      ctx.fillStyle = '#78350f'; // wood grip
      ctx.fillRect(-6, 2, 5, 8);
      ctx.fillStyle = '#475569'; // receiver
      ctx.fillRect(-6, -2, 8, 5);
      ctx.fillStyle = '#64748b'; // cylinder
      ctx.fillRect(-2, -3, 5, 6);
      ctx.fillStyle = '#94a3b8'; // barrel
      ctx.fillRect(3, -3, 12, 4);
      ctx.fillStyle = '#334155'; // front sight
      ctx.fillRect(13, -5, 2, 2);
    } else if (id === 'knight_broadsword') {
      // Heavy Broadsword: steel crossguard, sapphire fuller, wrapped blue grip, gold pommel
      ctx.fillStyle = '#eab308'; // pommel
      ctx.fillRect(-10, -2, 3, 4);
      ctx.fillStyle = '#1e3a8a'; // grip
      ctx.fillRect(-7, -1, 5, 2);
      ctx.fillStyle = '#f59e0b'; // crossguard
      ctx.fillRect(-2, -7, 3, 14);
      ctx.fillStyle = '#cbd5e1'; // blade body
      ctx.fillRect(1, -4, 22, 8);
      ctx.fillStyle = '#ffffff'; // blade edge
      ctx.fillRect(3, -5, 20, 2);
      ctx.fillRect(3, 3, 20, 2);
      // blade tip
      ctx.beginPath();
      ctx.moveTo(23, -4);
      ctx.lineTo(28, 0);
      ctx.lineTo(23, 4);
      ctx.closePath();
      ctx.fill();
      // Glowing blue sapphire rune fuller line
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 4;
      ctx.fillRect(2, -1, 18, 2);
    } else if (id === 'pixel_blaster') {
      // Plasma Carbine: black body, glowing emerald power coil, scope
      ctx.fillStyle = '#0f172a'; // stock & grip
      ctx.fillRect(-8, 1, 6, 7);
      ctx.fillRect(-10, -3, 8, 4);
      ctx.fillStyle = '#1e293b'; // body
      ctx.fillRect(-2, -4, 16, 6);
      // Glowing green plasma energy coil
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 6;
      ctx.fillRect(2, -2, 10, 3);
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(4, -1, 6, 1);
      // Barrel nozzle
      ctx.fillStyle = '#059669';
      ctx.fillRect(14, -3, 4, 4);
      // Scope
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -7, 8, 3);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(6, -6, 2, 2);
    } else if (id === 'shotgun_galaxy') {
      // Galaxy Shotgun: twin chrome barrels, deep purple cosmic body, wooden pump
      ctx.fillStyle = '#581c87'; // galactic violet body
      ctx.fillRect(-6, -3, 14, 7);
      // Cosmic stars speckles
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(-3, -1, 2, 2);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(3, 0, 2, 2);
      // Twin chrome barrels
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(8, -4, 12, 3);
      ctx.fillRect(8, 0, 12, 3);
      // Pump slide
      ctx.fillStyle = '#78350f';
      ctx.fillRect(10, 3, 6, 3);
      // Stock
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(-12, 0, 7, 6);
    } else if (id === 'frost_bow') {
      // Cryo Crystal Bow: curved ice limbs, glowing string, crystal arrow
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-2, 0, 14, -Math.PI / 2.3, Math.PI / 2.3);
      ctx.stroke();
      // Bowstring
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-2, 13);
      ctx.stroke();
      // Ready ice arrow
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(-6, -1, 18, 2);
      ctx.fillStyle = '#0284c7';
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(12, -3);
      ctx.lineTo(17, 0);
      ctx.lineTo(12, 3);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'flame_staff') {
      // Pyromancer Staff: carved ebony wood with burning sun ruby orb
      ctx.fillStyle = '#451a03'; // shaft
      ctx.fillRect(-10, -2, 22, 4);
      ctx.fillStyle = '#d97706'; // brass bands
      ctx.fillRect(-3, -3, 3, 6);
      ctx.fillRect(6, -3, 3, 6);
      // Flaming Headpiece
      ctx.fillStyle = '#ea580c';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(15, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      // Inner incandescent core
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(15, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'soul_calibur') {
      // Heavy Rail Sniper: huge chrome barrel, magenta power core, optical scope
      ctx.fillStyle = '#1e1b4b'; // stock
      ctx.fillRect(-12, -2, 8, 6);
      ctx.fillStyle = '#312e81'; // receiver
      ctx.fillRect(-4, -4, 12, 7);
      // Glowing magenta rail
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 8;
      ctx.fillRect(0, -3, 10, 2);
      // Long sniper barrel
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(8, -2, 18, 3);
      ctx.fillStyle = '#475569'; // muzzle brake
      ctx.fillRect(26, -3, 4, 5);
      // High-power scope
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -8, 12, 4);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(10, -7, 2, 2);
    } else if (id === 'rocket_launcher') {
      // RPG-7 Pixel: military olive body, protruding warhead cone
      ctx.fillStyle = '#3f6212'; // olive tube
      ctx.fillRect(-10, -4, 22, 8);
      ctx.fillStyle = '#78350f'; // wood heat shield
      ctx.fillRect(-2, -3, 8, 6);
      // Iron sights & trigger
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, 4, 3, 5);
      ctx.fillRect(-4, -7, 2, 3);
      // Protruding Rocket Warhead
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(12, -5, 6, 10);
      ctx.fillStyle = '#eab308'; // warhead cone
      ctx.beginPath();
      ctx.moveTo(18, -5);
      ctx.lineTo(24, 0);
      ctx.lineTo(18, 5);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'moonlight_katana') {
      // Moonlight Katana: curved lunar steel blade with ethereal cyan glow
      ctx.fillStyle = '#1e293b'; // tsuka handle
      ctx.fillRect(-10, -1, 7, 3);
      ctx.fillStyle = '#f59e0b'; // golden tsuba
      ctx.fillRect(-3, -5, 2, 10);
      // Curved blade
      ctx.strokeStyle = '#93c5fd';
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.quadraticCurveTo(12, -3, 24, -6);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, -7, 2, 2);
    } else if (id === 'magic_bow') {
      // Ancient Spirit Bow: ethereal violet arms, triple magic feathers
      ctx.strokeStyle = '#818cf8';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-2, 0, 15, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
      // Bowstring
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -14);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-2, 14);
      ctx.stroke();
      // Spirit Arrow
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(-6, -1, 16, 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.lineTo(15, 0);
      ctx.lineTo(10, 3);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'one_punch') {
      // The Legendary Red Hero Boxing Glove: oversized, steam vents, glowing knuckles
      ctx.fillStyle = '#dc2626'; // crimson glove
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillRect(-4, -8, 18, 16);
      // Gold knuckle plates
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(14, -7, 4, 14);
      // Wrist cuff
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -6, 4, 12);
      // Steam vents
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(6, -6, 3, 3);
      ctx.fillRect(6, 3, 3, 3);
    } else if (id === 'laser_fish') {
      // The Iconic Soul Knight Laser Fish! Cyan robot fish with fin, eye, and mouth laser emitter
      ctx.fillStyle = '#06b6d4'; // fish body
      ctx.fillRect(-6, -5, 16, 10);
      // Tail fin
      ctx.fillStyle = '#0891b2';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12, -6);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-12, 6);
      ctx.closePath();
      ctx.fill();
      // Dorsal fin
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(0, -8, 6, 3);
      // Fish eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, -4, 4, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, -3, 2, 2);
      // Laser nozzle in mouth
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 6;
      ctx.fillRect(10, -2, 4, 4);
    } else if (id === 'gatling_gun') {
      // Rotary Minigun: 6 revolving gold barrels, ammo drum, heavy frame
      ctx.fillStyle = '#78350f'; // rear body
      ctx.fillRect(-10, -4, 10, 8);
      // Ammo drum underneath
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-6, 4, 8, 7);
      // Cluster of 6 golden revolving barrels
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, -5, 18, 3);
      ctx.fillRect(0, 2, 18, 3);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(0, -2, 19, 4);
      // Front barrel collar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(16, -6, 3, 12);
    } else if (id === 'thunder_hammer') {
      // Heavy Thunder Warhammer: solid runic iron block, leather haft, lightning runes
      ctx.fillStyle = '#78350f'; // haft
      ctx.fillRect(-12, -2, 22, 4);
      ctx.fillStyle = '#cbd5e1'; // pommel spike
      ctx.fillRect(-14, -2, 2, 4);
      // Big hammer head
      ctx.fillStyle = '#475569';
      ctx.fillRect(10, -10, 12, 20);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(12, -8, 8, 16);
      // Glowing yellow lightning rune etching
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 8;
      ctx.fillRect(14, -6, 4, 12);
      ctx.fillRect(12, -1, 8, 2);
    } else if (id === 'sacred_flail') {
      // Sacred Flail: gold-trimmed handle, silver chain links, radiant spiked morningstar
      ctx.fillStyle = '#854d0e'; // handle
      ctx.fillRect(-10, -2, 12, 4);
      ctx.fillStyle = '#fbbf24'; // gold guard & pommel
      ctx.fillRect(-12, -3, 3, 6);
      ctx.fillRect(1, -4, 3, 8);
      // Chain links
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(4, -1, 3, 2);
      ctx.fillRect(8, 0, 3, 2);
      // Radiant spiked ball
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(16, 1, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(15, -8, 2, 18);
      ctx.fillRect(8, 0, 16, 2);
    } else if (id === 'windforce_bow') {
      // Windforce Elven Bow: sculpted emerald/gold recurve limbs + glowing gale arrow
      ctx.strokeStyle = '#10b981';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-2, 0, 15, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
      // Gold grip wrap
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(10, -3, 4, 6);
      // Bowstring
      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -14);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-2, 14);
      ctx.stroke();
      // Emerald wind shaft
      ctx.fillStyle = '#6ee7b7';
      ctx.fillRect(-6, -1, 20, 2);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(14, -3.5);
      ctx.lineTo(20, 0);
      ctx.lineTo(14, 3.5);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'plague_scepter') {
      // Plague Scepter: dark obsidian shaft, horned bone skull, glowing violet soul orb
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(-11, -2, 21, 4);
      ctx.fillStyle = '#e2e8f0'; // bone skull head
      ctx.fillRect(9, -5, 7, 10);
      ctx.fillStyle = '#0f172a'; // eye sockets
      ctx.fillRect(12, -3, 2, 2);
      ctx.fillRect(12, 1, 2, 2);
      // Floating soul-fire gem
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(19, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'titan_gauntlets') {
      // Titan Gauntlets: heavy volcanic iron cestus with molten orange knuckle vents
      ctx.fillStyle = '#431407';
      ctx.fillRect(-6, -7, 8, 14);
      ctx.fillStyle = '#ea580c';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.fillRect(2, -8, 13, 16);
      // Molten knuckle spikes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(15, -7, 4, 3);
      ctx.fillRect(16, -1.5, 5, 3);
      ctx.fillRect(15, 4, 4, 3);
    } else if (id === 'tesla_cannon') {
      // Tesla Coil Gun: brass receiver, copper rings, glowing cyan arc emitter
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-9, 1, 6, 7);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-5, -4, 13, 7);
      // Copper induction coils
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(8, -5, 3, 9);
      ctx.fillRect(13, -5, 3, 9);
      // Glowing cyan voltaic core & prong
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fillRect(6, -2, 13, 3);
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(20, -0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'crimson_chalice') {
      // Blood Chalice: ornate gold goblet brimming with glowing ruby essence
      ctx.fillStyle = '#eab308'; // base & stem
      ctx.fillRect(-4, 5, 8, 3);
      ctx.fillRect(-1.5, 1, 3, 5);
      // Goblet cup
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-6, -6, 12, 8);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-7, -7, 14, 2);
      // Glowing sanguine pool & hovering blood jewel
      ctx.fillStyle = '#e11d48';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 9;
      ctx.fillRect(-5, -6, 10, 3);
      ctx.beginPath();
      ctx.arc(0, -11, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'thorn_spear') {
      // Briarwood Javelin: living oak shaft, vine wraps, glowing emerald crystal spearhead
      ctx.fillStyle = '#713f12';
      ctx.fillRect(-12, -1.5, 23, 3);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-4, -2.5, 4, 5);
      ctx.fillRect(4, -2.5, 4, 5);
      // Emerald spearhead
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(11, -4.5);
      ctx.lineTo(22, 0);
      ctx.lineTo(11, 4.5);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'storm_wakizashi') {
      // Storm Odachi: navy wrapped hilt, silver cross-tsuba, long glowing azure gale katana
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-11, -1.5, 8, 3);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-3, -5, 2, 10);
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#0ea5e9';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.quadraticCurveTo(13, -2.5, 26, -5.5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(23, -6.5, 3, 2);
    } else if (id === 'knight_sword_shield') {
      // Iconic Knight Arming Sword + Gold-Cross Heater Crest
      ctx.fillStyle = '#0b0d12'; // crisp outline around sword
      ctx.fillRect(-9, -2.5, 7, 5);
      ctx.fillRect(-3, -6, 4, 12);
      ctx.fillRect(1, -4, 19, 8);
      ctx.fillStyle = '#87161c'; // crimson leather grip
      ctx.fillRect(-8, -1.5, 5, 3);
      ctx.fillStyle = '#f4a636'; // golden crossguard & pommel
      ctx.fillRect(-10, -2, 2, 4);
      ctx.fillRect(-2, -5, 2, 10);
      ctx.fillStyle = '#cbd5e1'; // steel arming blade
      ctx.fillRect(0, -3, 18, 6);
      ctx.fillStyle = '#ffffff'; // top edge gleam
      ctx.fillRect(1, -3, 16, 2);
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.lineTo(23, 0);
      ctx.lineTo(18, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4a636'; // gold fuller line
      ctx.fillRect(1, -0.5, 11, 1.5);
    } else if (id === 'mage_arcane_staff') {
      // Iconic Mage Ancient Crystal Staff: dark-outlined oak shaft, gold collar, faceted sky-blue crystal
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(-11, -2.5, 22, 5);
      ctx.fillStyle = '#5e3718'; // oak shadow
      ctx.fillRect(-10, -1.5, 20, 3);
      ctx.fillStyle = '#9c6230'; // oak highlight
      ctx.fillRect(-10, -1.5, 20, 1.5);
      ctx.fillStyle = '#fbb02d'; // gold collar band
      ctx.fillRect(8, -2.5, 2.5, 5);
      // Faceted glowing sky-blue magic crystal head
      ctx.fillStyle = '#0b0d12';
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(16, -6.5);
      ctx.lineTo(22, 0);
      ctx.lineTo(16, 6.5);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#42b8e8';
      ctx.shadowColor = '#42b8e8';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(11, -4.5);
      ctx.lineTo(16, -5);
      ctx.lineTo(20.5, 0);
      ctx.lineTo(16, 5);
      ctx.lineTo(11, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1d74b8'; // lower sapphire facet
      ctx.fillRect(12, 1, 6, 3);
      ctx.fillStyle = '#9be7ff'; // top-left ice gleam
      ctx.fillRect(12, -4, 5, 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(13, -3.5, 2.5, 1.5);
    } else if (id === 'venom_blowgun') {
      // Viper Needler: carved emerald bamboo tube with toxic neon-lime venom sac & sight
      ctx.fillStyle = '#14532d';
      ctx.fillRect(-10, -2.5, 26, 5);
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(-4, -3.5, 4, 7);
      ctx.fillRect(6, -3.5, 4, 7);
      // Glowing venom reservoir bulb underneath
      ctx.fillStyle = '#84cc16';
      ctx.shadowColor = '#a3e635';
      ctx.shadowBlur = 7;
      ctx.fillRect(0, 2.5, 6, 4);
      // Protruding toxic needle tip
      ctx.fillStyle = '#bef264';
      ctx.fillRect(16, -1, 6, 2);
    } else if (id === 'boomerang_glaive') {
      // Cyclone Glaive: curved tri-wing teal astral chakram/boomerang
      ctx.strokeStyle = '#2dd4bf';
      ctx.shadowColor = '#14b8a6';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(4, 0, 10, -Math.PI * 0.72, Math.PI * 0.72);
      ctx.stroke();
      // Razor wing tips & golden hub
      ctx.fillStyle = '#99f6e4';
      ctx.fillRect(-3, -10, 5, 3);
      ctx.fillRect(-3, 7, 5, 3);
      ctx.fillRect(12, -1.5, 5, 3);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(1, -3, 4, 6);
    } else if (id === 'sawblade_launcher') {
      // Buzzsaw Ripper: heavy industrial yellow/slate frame + protruding serrated steel saw disc
      ctx.fillStyle = '#334155';
      ctx.fillRect(-11, -4, 18, 8);
      ctx.fillStyle = '#eab308'; // hazard stripes frame
      ctx.fillRect(-6, -3, 10, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-3, -3, 2, 6);
      ctx.fillRect(1, -3, 2, 6);
      // Loaded spinning circular sawblade at muzzle
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowColor = '#94a3b8';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(13, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626'; // red arbor hub
      ctx.beginPath();
      ctx.arc(13, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'dragon_breath') {
      // Dragon Breath Shotgun: dark iron & crimson scale blunderbuss with golden dragon-jaw muzzle
      ctx.fillStyle = '#450a0a'; // stock
      ctx.fillRect(-12, -1, 8, 6);
      ctx.fillStyle = '#991b1b'; // crimson scaled receiver
      ctx.fillRect(-5, -4, 15, 8);
      ctx.fillStyle = '#f59e0b'; // brass dragon maw barrel
      ctx.fillRect(10, -5, 10, 10);
      ctx.fillStyle = '#fb923c'; // glowing molten throat
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.fillRect(15, -3, 6, 6);
      ctx.fillStyle = '#fef08a'; // dragon fangs
      ctx.fillRect(18, -5, 3, 2);
      ctx.fillRect(18, 3, 3, 2);
    } else if (id === 'prism_railgun') {
      // Prism Carbine: sleek pearl-white & indigo chassis with rainbow refracting crystal core
      ctx.fillStyle = '#312e81';
      ctx.fillRect(-11, -3, 9, 7);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-2, -4, 18, 8);
      // Tri-color prism crystal core
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(1, -2, 4, 4);
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(5, -2, 4, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(9, -2, 4, 4);
      // Crystal emitter prongs
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(16, -4, 6, 2);
      ctx.fillRect(16, 2, 6, 2);
    } else if (id === 'gravity_orb_staff') {
      // Singularity Staff: cosmic obsidian shaft with golden crescent cradle & miniature black hole
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-12, -2, 22, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-2, -3, 2, 6);
      // Crescent cradle
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(14, 0, 7, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
      // Event horizon core + violet halo
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(16, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090a10';
      ctx.beginPath();
      ctx.arc(16, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'mjolnir_breaker') {
      // Stormbreaker Greataxe: gnarled root haft + massive bifurcated thunder axe-hammer head
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-13, -2, 23, 4);
      // Hammer back-poll + broad crescent axe front
      ctx.fillStyle = '#475569';
      ctx.fillRect(8, -9, 9, 18);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(13, -12);
      ctx.lineTo(22, -7);
      ctx.lineTo(22, 7);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();
      // Glowing cyan lightning rune core
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 9;
      ctx.fillRect(11, -4, 6, 8);
    } else if (id === 'phoenix_crossbow') {
      // Phoenix Arbalest: crimson stock + swept golden phoenix-wing bow limbs + blazing solar bolt
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-10, -2.5, 20, 5);
      // Golden phoenix wings
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(2, -13);
      ctx.moveTo(8, 0);
      ctx.lineTo(2, 13);
      ctx.stroke();
      // Blazing solar bolt ready in groove
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-2, -1, 20, 2);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(17, -3.5);
      ctx.lineTo(23, 0);
      ctx.lineTo(17, 3.5);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'excalibur_prime') {
      // Mythic Excalibur: royal sapphire hilt, winged golden crossguard, radiant sunlit blade
      ctx.fillStyle = '#facc15'; // pommel
      ctx.fillRect(-12, -2.5, 3, 5);
      ctx.fillStyle = '#1d4ed8'; // royal blue grip
      ctx.fillRect(-9, -1.5, 6, 3);
      // Winged golden crossguard
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3, -8, 4, 16);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-2, -6, 2, 12);
      // Radiant golden-white mythic blade
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillRect(1, -4, 24, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -2, 22, 4);
      ctx.beginPath();
      ctx.moveTo(25, -4);
      ctx.lineTo(31, 0);
      ctx.lineTo(25, 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Fallback
      ctx.fillStyle = weapon.bulletColor;
      ctx.fillRect(-8, -3, 16, 6);
    }

    ctx.restore();
  }

  /**
   * Draws a dropped weapon hovering on an altar pedestal with ambient aura, runes, and bobbing
   */
  public static drawDroppedWeapon(ctx: CanvasRenderingContext2D, drop: DropItem) {
    if (!drop.weaponData) return;
    const weapon = drop.weaponData;
    const palette = this.getRarityColor(weapon.rarity);

    ctx.save();

    // 1. Carved Dungeon Pedestal Base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(drop.x - 22, drop.y + 4, 44, 12);
    ctx.fillStyle = '#334155';
    ctx.fillRect(drop.x - 20, drop.y + 6, 40, 8);

    // Glowing runic engravings in pedestal matching weapon rarity
    ctx.fillStyle = palette.border;
    ctx.shadowColor = palette.border;
    ctx.shadowBlur = 6;
    ctx.fillRect(drop.x - 14, drop.y + 9, 6, 2);
    ctx.fillRect(drop.x - 3, drop.y + 9, 6, 2);
    ctx.fillRect(drop.x + 8, drop.y + 9, 6, 2);
    ctx.shadowBlur = 0;

    // 2. Pulsing Ambient Magic Aura
    const bobY = Math.sin(drop.bobPhase) * 5;
    const itemY = drop.y - 4 + bobY;
    const pulse = Math.sin(Date.now() * 0.005) * 4;

    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.ellipse(drop.x, itemY, 20 + pulse, 12 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Ground Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Render the distinctive pixel-art weapon sprite!
    this.drawWeaponSprite(ctx, weapon, drop.x, itemY, 1.25, 0, false);

    // 5. Weapon floating name banner above pedestal
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.text;
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(weapon.name, drop.x, itemY - 18);

    // Rarity sub-tag
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = palette.border;
    ctx.fillText(`[${weapon.rarity.toUpperCase()}]`, drop.x, itemY - 9);

    // Shop price tag if sold by merchant
    if (drop.price !== undefined) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(`🏷️ ${drop.price} GOLD`, drop.x, drop.y + 28);
    }

    ctx.restore();
  }

  /**
   * Renders the complete, beautiful Soul Knight Weapon Inspection Tooltip Card
   * Shows all weapon stats, comparison with current weapon, elemental traits, and swap prompt
   */
  public static renderWeaponInspectionCard(
    ctx: CanvasRenderingContext2D,
    drop: DropItem,
    currentWeapon: Weapon | null,
    camera: { x: number; y: number },
    screenWidth: number,
    screenHeight: number,
    coins: number = 0
  ) {
    if (!drop.weaponData) return;
    const weapon = drop.weaponData;
    const palette = this.getRarityColor(weapon.rarity);

    ctx.save();

    // Convert drop world coordinates to screen coordinates
    const screenX = drop.x - camera.x + screenWidth / 2;
    const screenY = drop.y - camera.y + screenHeight / 2;

    // Card dimensions
    const cardW = 280;
    const cardH = 175;

    // Anchor card smartly above weapon, or below if near top of screen
    let cardX = screenX - cardW / 2;
    let cardY = screenY - cardH - 35;

    // Keep card within viewport bounds
    cardX = Math.max(16, Math.min(screenWidth - cardW - 16, cardX));
    if (cardY < 16) {
      cardY = screenY + 35; // show below weapon
    }

    this.lastInspectionCardBounds = { x: cardX, y: cardY, width: cardW, height: cardH };

    // Outer Glow & Drop Shadow
    ctx.shadowColor = palette.border;
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(10, 14, 26, 0.96)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    // Border with rarity color
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Top Header Banner
    ctx.fillStyle = palette.bg;
    ctx.fillRect(cardX + 2, cardY + 2, cardW - 4, 32);
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(cardX + 2, cardY + 34);
    ctx.lineTo(cardX + cardW - 2, cardY + 34);
    ctx.stroke();

    // Weapon Name & Rarity
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(weapon.name, cardX + 10, cardY + 16);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'right';
    ctx.fillText(weapon.rarity.toUpperCase(), cardX + cardW - 10, cardY + 16);

    // Weapon Type / Category subtitle
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    const typeLabel = weapon.type.toUpperCase() + (weapon.isMelee ? ' (MELEE)' : ' (RANGED)');
    ctx.fillText(typeLabel, cardX + 10, cardY + 27);

    // 4-Stat Comparison Grid (Soul Knight Style)
    const gridY = cardY + 44;
    const colW = (cardW - 20) / 4;

    const stats = [
      {
        label: 'DMG',
        val: weapon.damage,
        currVal: currentWeapon?.damage,
        icon: '⚔️',
        color: '#ef4444',
      },
      {
        label: 'ENERGY',
        val: `${weapon.energyCost} MP`,
        currVal: currentWeapon ? `${currentWeapon.energyCost} MP` : null,
        icon: '⚡',
        color: '#38bdf8',
      },
      {
        label: 'CRIT',
        val: `${Math.round(weapon.critChance * 100)}%`,
        currVal: currentWeapon ? `${Math.round(currentWeapon.critChance * 100)}%` : null,
        icon: '🎯',
        color: '#f59e0b',
      },
      {
        label: 'SPEED',
        val: `${weapon.fireRate}/s`,
        currVal: currentWeapon ? `${currentWeapon.fireRate}/s` : null,
        icon: '💨',
        color: '#10b981',
      },
    ];

    stats.forEach((st, i) => {
      const cx = cardX + 10 + i * colW;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.fillRect(cx, gridY, colW - 4, 36);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, gridY, colW - 4, 36);

      // Label & Icon
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(st.label, cx + (colW - 4) / 2, gridY + 10);

      // Value
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.fillStyle = st.color;
      ctx.fillText(String(st.val), cx + (colW - 4) / 2, gridY + 24);
    });

    // Special Properties / Status Badges Row
    const propsY = gridY + 44;
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';

    const badges: Array<{ text: string; color: string }> = [];
    if (weapon.freezeChance) badges.push({ text: `❄ FREEZE ${Math.round(weapon.freezeChance * 100)}%`, color: '#38bdf8' });
    if (weapon.burnChance) badges.push({ text: `🔥 BURN ${Math.round(weapon.burnChance * 100)}%`, color: '#f97316' });
    if (weapon.piercing) badges.push({ text: '🏹 PIERCE', color: '#a855f7' });
    if (weapon.bounces) badges.push({ text: `🪃 BOUNCE x${weapon.bounces}`, color: '#34d399' });
    if (weapon.aoeRadius) badges.push({ text: '💥 AOE BLAST', color: '#f59e0b' });
    if (weapon.isMelee) badges.push({ text: '🛡️ DEFLECT BULLETS', color: '#60a5fa' });
    if (weapon.type === 'laser') badges.push({ text: '⚡ CONTINUOUS BEAM', color: '#06b6d4' });

    let bx = cardX + 10;
    badges.slice(0, 3).forEach(b => {
      const bw = ctx.measureText(b.text).width + 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(bx, propsY, bw, 13);
      ctx.strokeStyle = b.color;
      ctx.strokeRect(bx, propsY, bw, 13);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, bx + 4, propsY + 7);
      bx += bw + 5;
    });

    // Description text
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    const descText = weapon.description.length > 55 ? weapon.description.slice(0, 52) + '...' : weapon.description;
    ctx.fillText(descText, cardX + 10, cardY + 120);

    // Bottom Action Prompt Bar
    const bottomY = cardY + cardH - 24;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cardX + 2, bottomY, cardW - 4, 22);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(cardX + 2, bottomY);
    ctx.lineTo(cardX + cardW - 2, bottomY);
    ctx.stroke();

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    const hideKeys = gameSettings.get().hidePcKeyLabels;
    if (drop.price !== undefined) {
      const canAfford = coins >= drop.price;
      ctx.fillStyle = canAfford ? '#fbbf24' : '#ef4444';
      const buyLabel = hideKeys
        ? `TAP TO BUY (${drop.price} GOLD)`
        : `TAP OR [F] TO BUY (${drop.price} GOLD)`;
      ctx.fillText(
        canAfford ? buyLabel : `NEED ${drop.price} GOLD (HAVE ${coins})`,
        cardX + cardW / 2,
        bottomY + 11
      );
    } else {
      ctx.fillStyle = '#34d399';
      ctx.fillText(
        hideKeys ? 'TAP TO EQUIP / SWAP' : 'TAP OR [F] TO EQUIP / SWAP',
        cardX + cardW / 2,
        bottomY + 11
      );
    }

    ctx.restore();
  }
}
