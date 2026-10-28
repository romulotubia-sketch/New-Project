/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DIFFICULTY_CONFIGS, TILE_SIZE, WEAPON_REGISTRY } from './constants';
import {
  DifficultyId,
  DungeonFloor,
  DungeonRoom,
  Enemy,
  EnemyType,
  Obstacle,
  RoomDecoration,
  RoomDecorationKind,
  RoomDoor,
  RoomType,
} from './types';

interface GridPos {
  x: number;
  y: number;
}

export class DungeonGenerator {
  public static generateFloor(floorNumber: number, difficulty: DifficultyId = 'medium'): DungeonFloor {
    const diffCfg = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium;
    const biomes: Array<'ruins' | 'crypt' | 'volcano'> = ['ruins', 'crypt', 'volcano'];
    const biome = biomes[(floorNumber - 1) % biomes.length];

    // Grid coordinates: 0 to 7 (larger dungeon layout so Boss Room spawns deep in the floor)
    const GRID_MAX = 7;
    const roomPositions: Map<string, RoomType> = new Map();
    const roomDepth: Map<string, number> = new Map();
    const startPos: GridPos = { x: 3, y: 3 };
    const startKey = `${startPos.x},${startPos.y}`;
    roomPositions.set(startKey, 'start');
    roomDepth.set(startKey, 0);

    const occupiedCoords: GridPos[] = [{ ...startPos }];

    const directions: GridPos[] = [
      { x: 0, y: -1 }, // North
      { x: 0, y: 1 },  // South
      { x: 1, y: 0 },  // East
      { x: -1, y: 0 }, // West
    ];

    const shuffledDirs = () => [...directions].sort(() => Math.random() - 0.5);
    const inBounds = (p: GridPos) => p.x >= 0 && p.x <= GRID_MAX && p.y >= 0 && p.y <= GRID_MAX;

    // 1. Carve a guaranteed deep main progression spine: Start -> Combat -> Combat -> Combat -> Elite (depth 4)
    const spineTypes: RoomType[] = ['combat', 'combat', 'combat', 'elite'];
    let spineTip: GridPos = { ...startPos };
    let currentDepth = 0;

    for (const sType of spineTypes) {
      let extended = false;
      // Prefer stepping away from startPos so Manhattan & graph distance both grow steadily
      const candidateDirs = shuffledDirs().sort((a, b) => {
        const distA = Math.abs(spineTip.x + a.x - startPos.x) + Math.abs(spineTip.y + a.y - startPos.y);
        const distB = Math.abs(spineTip.x + b.x - startPos.x) + Math.abs(spineTip.y + b.y - startPos.y);
        return distB - distA;
      });

      for (const dir of candidateDirs) {
        const next: GridPos = { x: spineTip.x + dir.x, y: spineTip.y + dir.y };
        const nKey = `${next.x},${next.y}`;
        if (inBounds(next) && !roomPositions.has(nKey)) {
          currentDepth++;
          roomPositions.set(nKey, sType);
          roomDepth.set(nKey, currentDepth);
          occupiedCoords.push(next);
          spineTip = next;
          extended = true;
          break;
        }
      }

      if (!extended) {
        // Fallback: attach to deepest available room
        const sortedByDepth = [...occupiedCoords].sort(
          (a, b) => (roomDepth.get(`${b.x},${b.y}`) || 0) - (roomDepth.get(`${a.x},${a.y}`) || 0)
        );
        for (const base of sortedByDepth) {
          for (const dir of shuffledDirs()) {
            const next: GridPos = { x: base.x + dir.x, y: base.y + dir.y };
            const nKey = `${next.x},${next.y}`;
            if (inBounds(next) && !roomPositions.has(nKey)) {
              const d = (roomDepth.get(`${base.x},${base.y}`) || 0) + 1;
              roomPositions.set(nKey, sType);
              roomDepth.set(nKey, d);
              occupiedCoords.push(next);
              spineTip = next;
              extended = true;
              break;
            }
          }
          if (extended) break;
        }
      }
    }

    // 2. Attach side-branch rooms (Chest, Shop, Statue, extra Combat) to non-boss rooms
    const branchTypes: RoomType[] = ['combat', 'chest', 'shop', 'statue'];
    for (const type of branchTypes) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 140) {
        attempts++;
        const base = occupiedCoords[Math.floor(Math.random() * occupiedCoords.length)];
        const baseKey = `${base.x},${base.y}`;
        // Keep Elite at the deep frontier so Boss can attach cleanly to deep rooms
        if (roomPositions.get(baseKey) === 'elite' && attempts < 90) continue;

        const dir = directions[Math.floor(Math.random() * directions.length)];
        const target: GridPos = { x: base.x + dir.x, y: base.y + dir.y };
        const key = `${target.x},${target.y}`;

        if (inBounds(target) && !roomPositions.has(key)) {
          roomPositions.set(key, type);
          roomDepth.set(key, (roomDepth.get(baseKey) || 0) + 1);
          occupiedCoords.push(target);
          placed = true;
        }
      }
    }

    // 3. Place BOSS Room strictly at the deepest frontier, NEVER adjacent to Start, with a single Boss Gate!
    let bossKey = '';
    let bossParentKey = '';
    const deepCandidates = [...occupiedCoords].sort((a, b) => {
      const ka = `${a.x},${a.y}`;
      const kb = `${b.x},${b.y}`;
      const eliteBonusA = roomPositions.get(ka) === 'elite' ? 2.5 : roomPositions.get(ka) === 'combat' ? 1 : 0;
      const eliteBonusB = roomPositions.get(kb) === 'elite' ? 2.5 : roomPositions.get(kb) === 'combat' ? 1 : 0;
      return (roomDepth.get(kb) || 0) + eliteBonusB - ((roomDepth.get(ka) || 0) + eliteBonusA);
    });

    for (const minManhattanFromStart of [3, 2]) {
      if (bossKey) break;
      for (const base of deepCandidates) {
        const bKey = `${base.x},${base.y}`;
        if (bKey === startKey) continue;
        for (const dir of shuffledDirs()) {
          const target: GridPos = { x: base.x + dir.x, y: base.y + dir.y };
          const tKey = `${target.x},${target.y}`;
          const manhattan = Math.abs(target.x - startPos.x) + Math.abs(target.y - startPos.y);
          if (inBounds(target) && !roomPositions.has(tKey) && manhattan >= minManhattanFromStart) {
            roomPositions.set(tKey, 'boss');
            roomDepth.set(tKey, (roomDepth.get(bKey) || 3) + 1);
            occupiedCoords.push(target);
            bossKey = tKey;
            bossParentKey = bKey;
            break;
          }
        }
        if (bossKey) break;
      }
    }

    const rooms: DungeonRoom[] = [];
    const coordToRoomIndex = new Map<string, number>();

    const ROOM_WIDTH = 22;
    const ROOM_HEIGHT = 16;
    const SPACING_X = ROOM_WIDTH * TILE_SIZE + 240;
    const SPACING_Y = ROOM_HEIGHT * TILE_SIZE + 240;

    let index = 0;
    roomPositions.forEach((type, key) => {
      coordToRoomIndex.set(key, index);
      const [gx, gy] = key.split(',').map(Number);
      const pixelX = gx * SPACING_X;
      const pixelY = gy * SPACING_Y;

      rooms.push({
        index,
        gridX: gx,
        gridY: gy,
        pixelX,
        pixelY,
        width: ROOM_WIDTH,
        height: ROOM_HEIGHT,
        type,
        isCleared: type === 'start' || type === 'chest' || type === 'shop' || type === 'statue',
        isDiscovered: type === 'start',
        doors: [],
        enemies: [],
        obstacles: [],
        decorations: [],
        drops: [],
        wavesRemaining:
          type === 'boss'
            ? 1
            : type === 'elite'
            ? 3 + diffCfg.extraEliteWave
            : type === 'combat'
            ? 3 + diffCfg.extraCombatWave
            : 0,
        combatStarted: false,
      });
      index++;
    });

    // Connect adjacent rooms with doors — Boss Room ONLY connects to its single deep parent room!
    rooms.forEach(room => {
      const myKey = `${room.gridX},${room.gridY}`;
      const neighbors: Array<{ dir: 'north' | 'south' | 'east' | 'west'; dx: number; dy: number }> = [
        { dir: 'north', dx: 0, dy: -1 },
        { dir: 'south', dx: 0, dy: 1 },
        { dir: 'east', dx: 1, dy: 0 },
        { dir: 'west', dx: -1, dy: 0 },
      ];

      neighbors.forEach(n => {
        const neighborKey = `${room.gridX + n.dx},${room.gridY + n.dy}`;
        if (!coordToRoomIndex.has(neighborKey)) return;

        // Enforce single late-floor entrance into the Boss Room (no shortcuts from Start or early rooms!)
        if (myKey === bossKey && neighborKey !== bossParentKey) return;
        if (neighborKey === bossKey && myKey !== bossParentKey) return;

        const targetIndex = coordToRoomIndex.get(neighborKey)!;
        let doorX = room.pixelX + (room.width * TILE_SIZE) / 2;
        let doorY = room.pixelY + (room.height * TILE_SIZE) / 2;

        if (n.dir === 'north') {
          doorY = room.pixelY;
        } else if (n.dir === 'south') {
          doorY = room.pixelY + room.height * TILE_SIZE;
        } else if (n.dir === 'west') {
          doorX = room.pixelX;
        } else if (n.dir === 'east') {
          doorX = room.pixelX + room.width * TILE_SIZE;
        }

        room.doors.push({
          x: doorX,
          y: doorY,
          targetRoomIndex: targetIndex,
          direction: n.dir,
          isOpen: true,
        });
      });
    });

    // Populate room contents & environmental details
    rooms.forEach(room => {
      this.populateRoom(room, floorNumber, biome);
      this.populateRoomDecorations(room, biome);
    });

    return {
      floorNumber,
      biome,
      rooms,
      currentRoomIndex: rooms.findIndex(r => r.type === 'start'),
      clearedRoomCount: 0,
      totalCombatRooms: rooms.filter(r => r.type === 'combat' || r.type === 'elite' || r.type === 'boss').length,
    };
  }

  private static isNearDoor(room: DungeonRoom, x: number, y: number, minClearance: number = 96): boolean {
    return room.doors.some(d => Math.hypot(x - d.x, y - d.y) < minClearance);
  }

  private static populateRoom(room: DungeonRoom, floorNumber: number, biome: 'ruins' | 'crypt' | 'volcano') {
    const rx = room.pixelX;
    const ry = room.pixelY;
    const rw = room.width * TILE_SIZE;
    const rh = room.height * TILE_SIZE;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;

    // Corner columns / braziers in every room
    const pillarMargin = TILE_SIZE * 2;
    const useCornerBraziers = room.type === 'boss' || room.type === 'elite' || biome === 'volcano';
    const cornerType: Obstacle['type'] = useCornerBraziers ? 'brazier' : 'pillar';
    room.obstacles.push(
      { x: rx + pillarMargin, y: ry + pillarMargin, width: TILE_SIZE, height: TILE_SIZE, type: cornerType },
      { x: rx + rw - pillarMargin - TILE_SIZE, y: ry + pillarMargin, width: TILE_SIZE, height: TILE_SIZE, type: cornerType },
      { x: rx + pillarMargin, y: ry + rh - pillarMargin - TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, type: cornerType },
      { x: rx + rw - pillarMargin - TILE_SIZE, y: ry + rh - pillarMargin - TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, type: cornerType },
    );

    if (room.type === 'start') {
      // Sanctuary Statue of Bravery + Twin Lit Braziers
      room.obstacles.push(
        {
          x: cx - 20,
          y: cy - 46,
          width: 40,
          height: 40,
          type: 'statue',
          opened: true,
          interactPrompt: 'Portal of Bravery: Clear all rooms to defeat the dungeon boss!',
        },
        {
          x: cx - 96,
          y: cy - 42,
          width: 32,
          height: 32,
          type: 'brazier',
        },
        {
          x: cx + 64,
          y: cy - 42,
          width: 32,
          height: 32,
          type: 'brazier',
        }
      );

      // Decorative expedition crates tucked safely near upper corners
      room.obstacles.push(
        { x: rx + TILE_SIZE * 3.5, y: ry + TILE_SIZE * 2.1, width: 30, height: 30, type: 'crate', hp: 15, maxHp: 15 },
        { x: rx + rw - TILE_SIZE * 4.5, y: ry + TILE_SIZE * 2.1, width: 30, height: 30, type: 'crate', hp: 15, maxHp: 15 }
      );

      // Starting weapon trial pedestal
      const starterShowcasePool = [
        'pixel_blaster',
        'frost_bow',
        'gatling_gun',
        'laser_fish',
        'flame_staff',
        'knight_broadsword',
        'knight_sword_shield',
        'windforce_bow',
        'sacred_flail',
        'plague_scepter',
        'titan_gauntlets',
        'tesla_cannon',
        'crimson_chalice',
        'thorn_spear',
        'storm_wakizashi',
        'venom_blowgun',
        'boomerang_glaive',
        'sawblade_launcher',
        'dragon_breath',
        'prism_railgun',
        'phoenix_crossbow',
      ];
      const chosenWeaponId = starterShowcasePool[Math.floor(Math.random() * starterShowcasePool.length)];
      const trialWeapon = WEAPON_REGISTRY[chosenWeaponId] || WEAPON_REGISTRY['pixel_blaster'];

      room.drops.push({
        id: 'start_trial_weapon',
        type: 'weapon',
        x: cx + 82,
        y: cy + 32,
        value: 0,
        weaponData: trialWeapon,
        bobPhase: 0,
      });
    } else if (room.type === 'chest') {
      // Central Treasure Chest flanked by Golden Braziers & Vault Supplies
      room.obstacles.push(
        {
          x: cx - 24,
          y: cy - 24,
          width: 48,
          height: 48,
          type: 'chest',
          opened: false,
          interactPrompt: 'Press F to open Chest',
        },
        { x: cx - 106, y: cy - 64, width: 32, height: 32, type: 'brazier' },
        { x: cx + 74, y: cy - 64, width: 32, height: 32, type: 'brazier' },
        { x: cx - 96, y: cy + 28, width: 34, height: 34, type: 'crate', hp: 20, maxHp: 20 },
        { x: cx + 62, y: cy + 28, width: 34, height: 34, type: 'barrel', hp: 15, maxHp: 15, isExplosive: true }
      );
    } else if (room.type === 'shop') {
      const allWeapons = Object.values(WEAPON_REGISTRY).filter(
        w => w.id !== 'bad_pistol' && w.id !== 'one_punch'
      );
      const pick1 = allWeapons[Math.floor(Math.random() * allWeapons.length)];
      let pick2 = allWeapons[Math.floor(Math.random() * allWeapons.length)];
      if (pick2.id === pick1.id && allWeapons.length > 1) {
        pick2 = allWeapons[(allWeapons.indexOf(pick1) + 1) % allWeapons.length];
      }

      // Merchant table + flanking braziers + supply stock behind Peddler
      room.obstacles.push(
        {
          x: cx - 34,
          y: cy - 82,
          width: 68,
          height: 40,
          type: 'shop_table',
          interactPrompt: 'Dungeon Peddler: "Finest relics in the realm for gold coins!"',
        },
        { x: cx - 126, y: cy - 80, width: 32, height: 32, type: 'brazier' },
        { x: cx + 94, y: cy - 80, width: 32, height: 32, type: 'brazier' },
        { x: cx - 86, y: cy - 122, width: 28, height: 28, type: 'crate', hp: 30, maxHp: 30 },
        { x: cx + 58, y: cy - 122, width: 28, height: 28, type: 'barrel', hp: 30, maxHp: 30 }
      );

      room.drops.push(
        {
          id: `shop_item_${Math.random()}`,
          type: 'weapon',
          x: cx - 82,
          y: cy + 2,
          value: 0,
          price: 25 + Math.floor(Math.random() * 20),
          weaponData: pick1,
          bobPhase: 0,
        },
        {
          id: `shop_item_${Math.random()}`,
          type: 'weapon',
          x: cx + 82,
          y: cy + 2,
          value: 0,
          price: 35 + Math.floor(Math.random() * 25),
          weaponData: pick2,
          bobPhase: Math.PI / 2,
        },
        {
          id: `shop_item_hp_${Math.random()}`,
          type: 'health',
          x: cx,
          y: cy + 52,
          value: 3,
          price: 15,
          bobPhase: Math.PI,
        }
      );
    } else if (room.type === 'statue') {
      room.obstacles.push(
        {
          x: cx - 25,
          y: cy - 25,
          width: 50,
          height: 50,
          type: 'statue',
          opened: false,
          interactPrompt: 'Press F to pray to the Statue (+3 Max Shield & Full HP)',
        },
        { x: cx - 110, y: cy - 16, width: 32, height: 32, type: 'brazier' },
        { x: cx + 78, y: cy - 16, width: 32, height: 32, type: 'brazier' }
      );
    } else if (room.type === 'combat' || room.type === 'elite') {
      // Structured tactical room architecture + breakable crates & TNT barrels
      const layoutPattern = room.index % 3;
      if (layoutPattern === 0) {
        // Twin inner pillars / braziers for bullet-hell cover
        const innerType: Obstacle['type'] = room.type === 'elite' ? 'brazier' : 'pillar';
        room.obstacles.push(
          { x: cx - 140, y: cy - 18, width: 36, height: 36, type: innerType },
          { x: cx + 104, y: cy - 18, width: 36, height: 36, type: innerType }
        );
      } else if (layoutPattern === 1) {
        // Four-quadrant tactical stone cover
        room.obstacles.push(
          { x: cx - 120, y: cy - 85, width: 34, height: 34, type: 'pillar' },
          { x: cx + 86, y: cy - 85, width: 34, height: 34, type: 'pillar' },
          { x: cx - 120, y: cy + 51, width: 34, height: 34, type: 'brazier' },
          { x: cx + 86, y: cy + 51, width: 34, height: 34, type: 'brazier' }
        );
      } else {
        // Center brazier beacon with flanking crates
        room.obstacles.push({ x: cx - 18, y: cy - 18, width: 36, height: 36, type: 'brazier' });
      }

      const crateCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < crateCount; i++) {
        const ox = rx + TILE_SIZE * 3 + Math.random() * (rw - TILE_SIZE * 6.5);
        const oy = ry + TILE_SIZE * 3 + Math.random() * (rh - TILE_SIZE * 6.5);
        if (this.isNearDoor(room, ox + 16, oy + 16, 105)) continue;
        const overlapsExisting = room.obstacles.some(
          existing => Math.hypot(existing.x - ox, existing.y - oy) < 46
        );
        if (overlapsExisting) continue;

        const isExplosive = Math.random() < 0.35;
        room.obstacles.push({
          x: ox,
          y: oy,
          width: 32,
          height: 32,
          type: isExplosive ? 'barrel' : 'crate',
          hp: 15,
          maxHp: 15,
          isExplosive,
        });
      }
    } else if (room.type === 'boss') {
      // Grand Boss Arena: 4 inner stone pillars + 2 flanking North-side braziers
      room.obstacles.push(
        { x: rx + rw * 0.3 - 18, y: ry + rh * 0.32 - 18, width: 36, height: 36, type: 'pillar' },
        { x: rx + rw * 0.7 - 18, y: ry + rh * 0.32 - 18, width: 36, height: 36, type: 'pillar' },
        { x: rx + rw * 0.3 - 18, y: ry + rh * 0.68 - 18, width: 36, height: 36, type: 'pillar' },
        { x: rx + rw * 0.7 - 18, y: ry + rh * 0.68 - 18, width: 36, height: 36, type: 'pillar' }
      );
    }
  }

  private static populateRoomDecorations(room: DungeonRoom, biome: 'ruins' | 'crypt' | 'volcano') {
    const rx = room.pixelX;
    const ry = room.pixelY;
    const rw = room.width * TILE_SIZE;
    const rh = room.height * TILE_SIZE;
    const decorations: RoomDecoration[] = [];

    // 1. Wall Torches flanking every doorway + along uninterrupted walls
    room.doors.forEach(door => {
      if (door.direction === 'north' || door.direction === 'south') {
        const wallY = door.direction === 'north' ? ry + 10 : ry + rh - 10;
        decorations.push(
          { x: door.x - 52, y: wallY, kind: 'wall_torch', variant: 0, wallSide: door.direction },
          { x: door.x + 52, y: wallY, kind: 'wall_torch', variant: 1, wallSide: door.direction }
        );
      } else {
        const wallX = door.direction === 'west' ? rx + 10 : rx + rw - 10;
        decorations.push(
          { x: wallX, y: door.y - 52, kind: 'wall_torch', variant: 0, wallSide: door.direction },
          { x: wallX, y: door.y + 52, kind: 'wall_torch', variant: 1, wallSide: door.direction }
        );
      }
    });

    // Additional evenly spaced wall torches on North & South walls away from doors
    const torchOffsetsX = [rx + rw * 0.24, rx + rw * 0.76];
    torchOffsetsX.forEach((tx, idx) => {
      if (!this.isNearDoor(room, tx, ry + 10, 72)) {
        decorations.push({ x: tx, y: ry + 10, kind: 'wall_torch', variant: idx, wallSide: 'north' });
      }
      if (!this.isNearDoor(room, tx, ry + rh - 10, 72)) {
        decorations.push({ x: tx, y: ry + rh - 10, kind: 'wall_torch', variant: idx + 2, wallSide: 'south' });
      }
    });

    // 2. Ceremonial Wall Banners along the North Wall
    const bannerVariant =
      room.type === 'boss' || room.type === 'elite'
        ? 2 // Crimson Skull War Banner
        : room.type === 'shop'
        ? 3 // Violet Peddler Tapestry
        : room.type === 'statue'
        ? 1 // Azure Templar Banner
        : 0; // Royal Gold-Trimmed Banner

    const bannerPositions = [rx + rw * 0.35, rx + rw * 0.65];
    bannerPositions.forEach(bx => {
      if (!this.isNearDoor(room, bx, ry + 8, 60)) {
        decorations.push({ x: bx, y: ry + 4, kind: 'wall_banner', variant: bannerVariant, wallSide: 'north' });
      }
    });

    // 3. Corner Cobwebs in Crypt & Ancient Ruins
    if (biome === 'crypt' || biome === 'ruins') {
      decorations.push(
        { x: rx + 16, y: ry + 16, kind: 'cobweb', variant: 0 },
        { x: rx + rw - 16, y: ry + 16, kind: 'cobweb', variant: 1 },
        { x: rx + 16, y: ry + rh - 16, kind: 'cobweb', variant: 2 },
        { x: rx + rw - 16, y: ry + rh - 16, kind: 'cobweb', variant: 3 }
      );
    }

    // 4. Sacred / Crypt Candle Clusters around Statue & Boss/Elite chambers
    if (room.type === 'statue' || room.type === 'boss' || biome === 'crypt') {
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      const candleRadius = room.type === 'boss' ? 128 : 66;
      for (let a = 0; a < 4; a++) {
        const rad = (a * Math.PI) / 2 + Math.PI / 4;
        decorations.push({
          x: cx + Math.cos(rad) * candleRadius,
          y: cy + Math.sin(rad) * candleRadius,
          kind: 'skull_candle',
          variant: a,
        });
      }
    }

    // 5. Biome-Themed Floor Micro-Details (moss, cracks, bones, lava fissures, grates, pebbles)
    const biomePool: RoomDecorationKind[] =
      biome === 'ruins'
        ? ['moss_patch', 'moss_patch', 'floor_crack', 'pebbles', 'mushroom', 'iron_grate']
        : biome === 'crypt'
        ? ['bone_pile', 'bone_pile', 'floor_crack', 'iron_grate', 'pebbles', 'skull_candle']
        : ['lava_fissure', 'lava_fissure', 'floor_crack', 'iron_grate', 'pebbles'];

    const detailCount = 26;
    for (let i = 0; i < detailCount; i++) {
      // Deterministic pseudo-random spread seeded by room index + i
      const seed1 = Math.sin((room.index + 1) * 97.13 + i * 31.7) * 10000;
      const seed2 = Math.cos((room.index + 3) * 53.79 + i * 71.3) * 10000;
      const randX = seed1 - Math.floor(seed1);
      const randY = seed2 - Math.floor(seed2);

      const dx = rx + 42 + randX * (rw - 84);
      const dy = ry + 42 + randY * (rh - 84);
      if (this.isNearDoor(room, dx, dy, 54)) continue;

      const kind = biomePool[(room.index + i) % biomePool.length];
      decorations.push({
        x: dx,
        y: dy,
        kind,
        variant: (room.index * 7 + i) % 4,
      });
    }

    room.decorations = decorations;
  }

  public static spawnWave(
    room: DungeonRoom,
    floorNumber: number,
    playerPos?: { x: number; y: number },
    difficulty: DifficultyId = 'medium'
  ): Enemy[] {
    const diffCfg = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium;
    const rx = room.pixelX;
    const ry = room.pixelY;
    const rw = room.width * TILE_SIZE;
    const rh = room.height * TILE_SIZE;

    const enemies: Enemy[] = [];

    if (room.type === 'boss') {
      // Spawn Floor-Specific Raid Boss + Elite Vanguard Guards!
      const bossType: EnemyType =
        floorNumber >= 3
          ? 'boss_infernal_dragon'
          : floorNumber === 2
          ? 'boss_skeleton_king'
          : 'boss_grand_knight';

      const bossName =
        bossType === 'boss_infernal_dragon'
          ? 'Ignis, Infernal Wyrm'
          : bossType === 'boss_skeleton_king'
          ? 'The Skeleton King'
          : 'Grand Knight of Void';

      const bossColor =
        bossType === 'boss_infernal_dragon'
          ? '#ea580c'
          : bossType === 'boss_skeleton_king'
          ? '#9333ea'
          : '#dc2626';

      const bossHp = Math.round((1850 + floorNumber * 750) * diffCfg.enemyHpMult);
      const bossSpeed = Math.round(
        (bossType === 'boss_infernal_dragon' ? 128 : bossType === 'boss_grand_knight' ? 116 : 104) *
          diffCfg.enemySpeedMult
      );

      let bx = rx + rw / 2;
      let by = ry + rh / 2;
      if (playerPos && Math.hypot(bx - playerPos.x, by - playerPos.y) < 150) {
        bx = playerPos.x < rx + rw / 2 ? rx + rw * 0.68 : rx + rw * 0.32;
        by = playerPos.y < ry + rh / 2 ? ry + rh * 0.68 : ry + rh * 0.32;
      }

      enemies.push({
        id: `boss_${Date.now()}`,
        type: bossType,
        name: bossName,
        x: bx,
        y: by,
        vx: 0,
        vy: 0,
        radius: 38,
        rotation: 0,
        hp: bossHp,
        maxHp: bossHp,
        speed: bossSpeed,
        damage: Math.max(1, Math.round((24 + floorNumber * 6) * diffCfg.enemyDamageMult)),
        color: bossColor,
        size: 40,
        isBoss: true,
        attackCooldown: Math.max(0.72, 1.05 / Math.sqrt(diffCfg.enemySpeedMult)),
        attackTimer: 0.75,
        frozenTimer: 0,
        burnTimer: 0,
        burnTicks: 0,
        aiState: 'chase',
        facingRight: true,
        walkCycle: 0,
        xpValue: 260,
        gemValue: 55 + floorNumber * 15,
        bossPhase: 1,
        bossPatternIndex: 0,
        bossDashTimer: 0,
        bossDashVx: 0,
        bossDashVy: 0,
        bossSpiralAngle: 0,
        bossSecondaryTimer: 2.2,
      });

      // Spawn Royal Vanguard Escorts alongside the Boss (scaled by difficulty)!
      const rawGuards = (2 + Math.min(2, floorNumber - 1)) * diffCfg.enemyCountMult;
      const guardCount = Math.max(1, Math.round(rawGuards));
      const guardType: EnemyType =
        bossType === 'boss_infernal_dragon'
          ? 'lava_hound'
          : bossType === 'boss_skeleton_king'
          ? 'skeleton_mage'
          : 'dark_knight';

      for (let g = 0; g < guardCount; g++) {
        const ang = (g / guardCount) * Math.PI * 2 + 0.6;
        const gx = Math.max(rx + 64, Math.min(rx + rw - 64, bx + Math.cos(ang) * 115));
        const gy = Math.max(ry + 64, Math.min(ry + rh - 64, by + Math.sin(ang) * 95));
        const guardHp = Math.round((135 + floorNumber * 45) * diffCfg.enemyHpMult);
        enemies.push({
          id: `boss_guard_${Date.now()}_${g}`,
          type: guardType,
          name:
            guardType === 'dark_knight'
              ? 'Void Honour Guard'
              : guardType === 'skeleton_mage'
              ? 'Royal Necrolyte'
              : 'Magma Hellhound',
          x: gx,
          y: gy,
          vx: 0,
          vy: 0,
          radius: 20,
          rotation: 0,
          hp: guardHp,
          maxHp: guardHp,
          speed: Math.round((guardType === 'lava_hound' ? 155 : 105) * diffCfg.enemySpeedMult),
          damage: Math.max(1, Math.round((14 + floorNumber * 3) * diffCfg.enemyDamageMult)),
          color: guardType === 'dark_knight' ? '#475569' : guardType === 'skeleton_mage' ? '#a855f7' : '#f97316',
          size: 20,
          isBoss: false,
          isElite: true,
          attackCooldown: 1.15,
          attackTimer: 0.8 + g * 0.3,
          frozenTimer: 0,
          burnTimer: 0,
          burnTicks: 0,
          aiState: 'chase',
          facingRight: true,
          walkCycle: 0,
          xpValue: 30,
          gemValue: 4,
        });
      }

      return enemies;
    }

    const enemyTypes: EnemyType[] = [
      'goblin_grunt',
      'goblin_archer',
      'skeleton_warrior',
      'skeleton_mage',
      'toxic_slime',
      'shadow_assassin',
      'dark_knight',
      'lava_hound',
    ];

    const isEliteRoom = room.type === 'elite';
    // Wave enemy count scaled by difficulty (1.0x on Medium baseline)
    const rawCount = isEliteRoom
      ? 9 + Math.floor(Math.random() * 4) + (floorNumber - 1) * 2
      : 7 + Math.floor(Math.random() * 4) + Math.floor((floorNumber - 1) * 1.5);
    const baseCount = Math.max(3, Math.round(rawCount * diffCfg.enemyCountMult));

    for (let i = 0; i < baseCount; i++) {
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      let ex = rx + TILE_SIZE * 2.5 + Math.random() * (rw - TILE_SIZE * 5);
      let ey = ry + TILE_SIZE * 2.5 + Math.random() * (rh - TILE_SIZE * 5);

      // Keep safe distance from player when spawning wave
      if (playerPos) {
        let attempts = 0;
        while (Math.hypot(ex - playerPos.x, ey - playerPos.y) < 145 && attempts < 14) {
          ex = rx + TILE_SIZE * 2.5 + Math.random() * (rw - TILE_SIZE * 5);
          ey = ry + TILE_SIZE * 2.5 + Math.random() * (rh - TILE_SIZE * 5);
          attempts++;
        }
      }

      const f = floorNumber;
      let hp = 68 + f * 24;
      let speed = 118 + f * 6;
      let damage = 9 + f * 2;
      let radius = 16;
      let color = '#ef4444';
      let name = 'Goblin Berserker';
      let attackCooldown = 1.15;

      if (type === 'goblin_archer') {
        name = 'Goblin Sharpshooter';
        hp = 56 + f * 20;
        speed = 104 + f * 5;
        damage = 10 + f * 2;
        color = '#10b981';
        attackCooldown = 1.25;
      } else if (type === 'skeleton_warrior') {
        name = 'Armored Revenant';
        hp = 88 + f * 28;
        speed = 115 + f * 6;
        damage = 11 + f * 3;
        radius = 17;
        color = '#cbd5e1';
        attackCooldown = 1.05;
      } else if (type === 'skeleton_mage') {
        name = 'Lich Acolyte';
        hp = 68 + f * 24;
        speed = 92 + f * 5;
        damage = 12 + f * 3;
        color = '#a855f7';
        attackCooldown = 1.35;
      } else if (type === 'toxic_slime') {
        name = 'Venom Juggernaut';
        hp = 112 + f * 34;
        speed = 86 + f * 5;
        damage = 10 + f * 2;
        radius = 21;
        color = '#22c55e';
        attackCooldown = 1.3;
      } else if (type === 'shadow_assassin') {
        name = 'Nightblade Stalker';
        hp = 72 + f * 24;
        speed = 168 + f * 8;
        damage = 13 + f * 3;
        color = '#1e293b';
        attackCooldown = 0.95;
      } else if (type === 'dark_knight') {
        name = 'Dread Juggernaut';
        hp = 165 + f * 48;
        speed = 98 + f * 5;
        damage = 16 + f * 4;
        radius = 22;
        color = '#475569';
        attackCooldown = 1.25;
      } else if (type === 'lava_hound') {
        name = 'Infernal Hellhound';
        hp = 96 + f * 30;
        speed = 156 + f * 8;
        damage = 13 + f * 3;
        radius = 18;
        color = '#f97316';
        attackCooldown = 1.05;
      }

      const isChampion = isEliteRoom || Math.random() < 0.16;
      if (isChampion) {
        hp = Math.round(hp * (isEliteRoom ? 1.75 : 1.45));
        damage += isEliteRoom ? 5 : 3;
        speed = Math.round(speed * 1.12);
        radius += 3;
        attackCooldown = Math.max(0.75, attackCooldown * 0.86);
      }

      hp = Math.max(10, Math.round(hp * diffCfg.enemyHpMult));
      damage = Math.max(1, Math.round(damage * diffCfg.enemyDamageMult));
      speed = Math.round(speed * diffCfg.enemySpeedMult);

      const baseGem = isEliteRoom ? 5 : isChampion ? 3 : 1;

      enemies.push({
        id: `enemy_${Math.random()}`,
        type,
        name: isChampion && !isEliteRoom ? `Elite ${name}` : name,
        x: ex,
        y: ey,
        vx: 0,
        vy: 0,
        radius,
        rotation: 0,
        hp,
        maxHp: hp,
        speed,
        damage,
        color,
        size: radius,
        isBoss: false,
        isElite: isChampion,
        attackCooldown: attackCooldown + Math.random() * 0.35,
        attackTimer: 0.45 + Math.random() * 0.85,
        frozenTimer: 0,
        burnTimer: 0,
        burnTicks: 0,
        aiState: 'chase',
        facingRight: true,
        walkCycle: 0,
        xpValue: isChampion ? 28 : 18,
        gemValue: baseGem,
      });
    }

    return enemies;
  }
}
