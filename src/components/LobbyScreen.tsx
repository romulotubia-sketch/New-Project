/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  CHARACTERS,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_ORDER,
  MAX_HERO_LEVEL,
  WEAPON_REGISTRY,
  getSkillRequiredHeroLevel,
  getSkillUnlockedAtHeroLevel,
} from '../game/constants';
import { CODEX_POS, DUMMY_POS, HouseInteractable, HouseLobbyEngine, PORTAL_POS, SHRINE_POS } from '../game/houseLobby';
import { KnightAnimMode } from '../game/knightSprite';
import { GameRenderer } from '../game/renderer';
import { CharacterClass, DifficultyId, Skill } from '../game/types';
import { useGameSettings } from '../game/settings';
import { skillTreeManager } from '../game/skillTree';
import { sounds } from '../game/sound';
import {
  Sparkles,
  Shield,
  Heart,
  Zap,
  BookOpen,
  HelpCircle,
  Gauge,
  Crosshair,
  ArrowLeftRight,
  X,
  Check,
  Hand,
  Swords,
  Coins,
  RotateCcw,
  Volume2,
  VolumeX,
  UserCheck,
  Compass,
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  Lock,
  ArrowUpCircle,
} from 'lucide-react';
import { PWAInstallButton, LandscapeModeButton } from './PWAInstallButton';
import { SettingsModal } from './SettingsModal';
import { PortalConfirmModal } from './PortalConfirmModal';

interface LobbyScreenProps {
  onStartGame: (characterId: CharacterClass, selectedSkills: Skill[], difficulty: DifficultyId) => void;
  onOpenSkillTree: () => void;
}

const HeroLivePreviewCanvas: React.FC<{
  classId: CharacterClass;
  mode: KnightAnimMode;
}> = ({ classId, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let animId = 0;
    let lastTime = performance.now();
    let timer = 0;
    let frame = 0;
    let walkCycle = 0;
    let restIdx = 0;
    const restFrames = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 6, 7];

    const cfg = CHARACTERS.find(c => c.id === classId) || CHARACTERS[0];
    const weapon = WEAPON_REGISTRY[cfg.startingWeaponId] || null;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const fps = mode === 'walk' ? 9.5 : mode === 'idle' ? 5.5 : restIdx < 5 ? 6.5 : 2.6;
      timer += dt * fps;
      if (mode === 'walk') {
        walkCycle += dt * 11;
      } else {
        walkCycle = 0;
      }

      if (timer >= 1) {
        timer -= 1;
        if (mode === 'rest') {
          restIdx = (restIdx + 1) % restFrames.length;
          frame = restFrames[restIdx];
        } else {
          frame = (frame + 1) % 8;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height - 10, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      const useBuiltInSheetWeapon = classId === 'knight' || classId === 'mage';
      GameRenderer.drawHeroCharacter(ctx, {
        classId,
        x: Math.round(canvas.width / 2 - 2),
        y: Math.round(canvas.height - 22),
        facingRight: true,
        rotation: 0,
        walkCycle,
        animState: mode,
        animFrame: frame,
        weapon: useBuiltInSheetWeapon || mode === 'rest' ? null : weapon,
        showBuiltInWeapon: useBuiltInSheetWeapon,
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [classId, mode]);

  return <canvas ref={canvasRef} width={68} height={64} className="pixel-art block" />;
};

const MAX_LOBBY_STICK = 38;

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onStartGame, onOpenSkillTree }) => {
  const houseEngineRef = useRef<HouseLobbyEngine | null>(null);
  if (!houseEngineRef.current) {
    houseEngineRef.current = new HouseLobbyEngine();
  }
  const houseEngine = houseEngineRef.current;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joystickZoneRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<SVGCircleElement>(null);
  const stemRef = useRef<SVGLineElement>(null);

  const { hidePcKeyLabels } = useGameSettings();
  const [pickedClass, setPickedClass] = useState<CharacterClass | null>(null);
  const [inspectingClass, setInspectingClass] = useState<CharacterClass | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'loadout' | 'skill_tree'>('loadout');
  const [skillFilter, setSkillFilter] = useState<'all' | 'normal' | 'ultimate' | 'buffs'>('all');
  const [focusedAbility, setFocusedAbility] = useState<{
    kind: 'normal' | 'ultimate' | 'buff';
    index: number;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState<KnightAnimMode>('idle');
  const [treeBranch, setTreeBranch] = useState<'all' | 'offensive' | 'defensive' | 'utility' | 'fortune'>('all');
  const [, setTalentTick] = useState(0);

  const [nearbyPrompt, setNearbyPrompt] = useState<HouseInteractable | null>(null);
  const [showCodex, setShowCodex] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPortalConfirm, setShowPortalConfirm] = useState(false);
  const [difficulty, setDifficultyState] = useState<DifficultyId>(() => skillTreeManager.getDifficulty());
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);

  const handleSelectDifficulty = useCallback((nextDiff: DifficultyId) => {
    sounds.shoot('pistol');
    skillTreeManager.setDifficulty(nextDiff);
    setDifficultyState(nextDiff);
  }, []);

  const handleCycleDifficultyBar = useCallback(() => {
    const idx = DIFFICULTY_ORDER.indexOf(difficulty);
    const nextDiff = DIFFICULTY_ORDER[(idx + 1) % DIFFICULTY_ORDER.length];
    handleSelectDifficulty(nextDiff);
  }, [difficulty, handleSelectDifficulty]);

  const [loadoutsByHero, setLoadoutsByHero] = useState<
    Record<string, { normalIndices: [number, number]; ultimateIndex: number }>
  >(() => {
    const initial: Record<string, { normalIndices: [number, number]; ultimateIndex: number }> = {};
    CHARACTERS.forEach(c => {
      initial[c.id] = { normalIndices: [0, 1], ultimateIndex: 0 };
    });
    return initial;
  });

  const buildSkillsForHero = useCallback(
    (heroId: CharacterClass): Skill[] => {
      const hero = CHARACTERS.find(c => c.id === heroId) || CHARACTERS[0];
      const loadout = loadoutsByHero[hero.id] || { normalIndices: [0, 1], ultimateIndex: 0 };
      const idx1 = skillTreeManager.isSkillUnlocked(hero.id, 'normal', loadout.normalIndices[0])
        ? loadout.normalIndices[0]
        : 0;
      let idx2 = skillTreeManager.isSkillUnlocked(hero.id, 'normal', loadout.normalIndices[1])
        ? loadout.normalIndices[1]
        : 1;
      if (idx2 === idx1) {
        idx2 = idx1 === 0 ? 1 : 0;
      }
      const ultIdx = skillTreeManager.isSkillUnlocked(hero.id, 'ultimate', loadout.ultimateIndex)
        ? loadout.ultimateIndex
        : 0;

      const n1 = hero.normalSkills[idx1] || hero.normalSkills[0];
      const n2 = hero.normalSkills[idx2] || hero.normalSkills[1];
      const ult = hero.ultimateSkills[ultIdx] || hero.ultimateSkills[0];
      return [
        { ...n1, keyHint: 'SPACE' },
        { ...n2, keyHint: 'E' },
        { ...ult, keyHint: 'R', isUltimate: true },
      ];
    },
    [loadoutsByHero]
  );

  const hasLaunchedRef = useRef(false);
  const requestPortalConfirmRef = useRef<() => void>(() => {});
  requestPortalConfirmRef.current = () => {
    if (hasLaunchedRef.current || showPortalConfirm) return;
    houseEngine.portalTriggered = true;
    houseEngine.walkTarget = null;
    houseEngine.walkWaypoints = [];
    houseEngine.keys = {};
    houseEngine.setJoystick(0, 0, false);
    sounds.shoot('pistol');
    setShowPortalConfirm(true);
  };

  const handleConfirmEnterDungeon = useCallback(() => {
    if (hasLaunchedRef.current) return;
    hasLaunchedRef.current = true;
    setShowPortalConfirm(false);
    const candidateHero = houseEngine.pickedClass || pickedClass || 'knight';
    const targetHero: CharacterClass = skillTreeManager.isHeroUnlocked(candidateHero)
      ? candidateHero
      : 'knight';
    sounds.chestOpen();
    onStartGame(targetHero, buildSkillsForHero(targetHero), difficulty);
  }, [houseEngine, pickedClass, buildSkillsForHero, onStartGame, difficulty]);

  const handleCancelEnterDungeon = useCallback(() => {
    sounds.shoot('pistol');
    setShowPortalConfirm(false);
    houseEngine.cancelPortalEntry();
  }, [houseEngine]);

  const triggerHouseInteract = useCallback(() => {
    const item = houseEngine.nearbyInteractable;
    if (!item) return;

    if (item.kind === 'portal') {
      requestPortalConfirmRef.current();
    } else if (item.kind === 'hero' && item.heroId) {
      sounds.shoot('pistol');
      setInspectingClass(item.heroId);
      setInspectorTab('loadout');
    } else if (item.kind === 'shrine') {
      sounds.soulGem();
      onOpenSkillTree();
    } else if (item.kind === 'codex') {
      sounds.shoot('pistol');
      setShowCodex(true);
    } else if (item.kind === 'dummy') {
      houseEngine.strikeTrainingDummy();
    }
  }, [houseEngine, onOpenSkillTree]);

  const interactRef = useRef(triggerHouseInteract);
  interactRef.current = triggerHouseInteract;

  const isModalOpen = Boolean(
    inspectingClass || showCodex || showControls || showSettings || showPortalConfirm
  );
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  // Main Interactive Guild House Canvas Loop & Input Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const onMouseMove = (e: MouseEvent) => {
      if (isModalOpenRef.current) return;
      const world = houseEngine.screenToWorld(e.clientX, e.clientY, canvas.width, canvas.height);
      houseEngine.hoveredHero = houseEngine.getHeroAtWorld(world.x, world.y);
    };

    const handleWorldPointTap = (clientX: number, clientY: number) => {
      if (isModalOpenRef.current) return;
      const world = houseEngine.screenToWorld(clientX, clientY, canvas.width, canvas.height);

      // 1. Check if pressing any Hero inside the house!
      const clickedHero = houseEngine.getHeroAtWorld(world.x, world.y);
      if (clickedHero) {
        sounds.shoot('pistol');
        setInspectingClass(clickedHero);
        setInspectorTab('loadout');
        return;
      }

      // 2. Check if clicking the Soul Gem Shrine
      if (Math.hypot(world.x - SHRINE_POS.x, world.y - (SHRINE_POS.y - 16)) < 34) {
        sounds.soulGem();
        onOpenSkillTree();
        return;
      }

      // 3. Check if clicking the Weapon Codex Bookshelf
      if (world.x >= 96 && world.x <= 252 && world.y >= 142 && world.y <= 196) {
        sounds.shoot('pistol');
        setShowCodex(true);
        return;
      }

      // 4. Check if clicking/tapping the Dungeon Portal or its Sanctuary Banner
      const hitPortal =
        Math.hypot(world.x - PORTAL_POS.x, world.y - PORTAL_POS.y) < 62 ||
        (world.x >= PORTAL_POS.x - 68 &&
          world.x <= PORTAL_POS.x + 68 &&
          world.y >= PORTAL_POS.y - 56 &&
          world.y <= PORTAL_POS.y + 48);

      if (hitPortal) {
        if (houseEngine.pickedClass) {
          const d = Math.hypot(houseEngine.player.x - PORTAL_POS.x, houseEngine.player.y - PORTAL_POS.y);
          if (d < 135) {
            requestPortalConfirmRef.current();
          } else {
            houseEngine.setWalkDestination(PORTAL_POS.x, PORTAL_POS.y);
          }
        } else {
          // Prompt to pick a resting hero first by opening Knight if none chosen yet
          sounds.shoot('pistol');
          setInspectingClass('knight');
          setInspectorTab('loadout');
        }
        return;
      }

      // 5. Check if clicking the Training Dummy while walking
      if (houseEngine.pickedClass && Math.hypot(world.x - DUMMY_POS.x, world.y - DUMMY_POS.y) < 34) {
        if (Math.hypot(houseEngine.player.x - DUMMY_POS.x, houseEngine.player.y - DUMMY_POS.y) < 95) {
          houseEngine.strikeTrainingDummy();
        } else {
          houseEngine.setWalkDestination(DUMMY_POS.x - 36, DUMMY_POS.y + 8);
        }
        return;
      }

      // 6. Otherwise, if a hero is picked, walk smoothly to the clicked floor position!
      if (houseEngine.pickedClass) {
        houseEngine.setWalkDestination(world.x, world.y);
      }
    };

    let lastTouchStamp = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (performance.now() - lastTouchStamp < 450) return;
      handleWorldPointTap(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isModalOpenRef.current) return;
      lastTouchStamp = performance.now();
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        handleWorldPointTap(t.clientX, t.clientY);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpenRef.current) {
        if (e.code === 'Escape') {
          setInspectingClass(null);
          setShowCodex(false);
          setShowControls(false);
          setShowSettings(false);
          setShowPortalConfirm(prev => {
            if (prev) houseEngine.cancelPortalEntry();
            return false;
          });
        }
        return;
      }
      houseEngine.keys[e.code] = true;
      if (e.repeat) return;

      if (e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') {
        if (houseEngine.nearbyInteractable) {
          e.preventDefault();
          interactRef.current();
        }
      } else if (e.code === 'KeyC') {
        houseEngine.toggleRest();
      } else if (e.code === 'KeyT') {
        onOpenSkillTree();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      houseEngine.keys[e.code] = false;
    };

    const onBlur = () => {
      houseEngine.keys = {};
      houseEngine.setJoystick(0, 0, false);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let rafId = 0;
    let lastTime = performance.now();
    let lastPromptKey = '';

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!isModalOpenRef.current) {
        houseEngine.update(dt, canvas.width, canvas.height, () => requestPortalConfirmRef.current());
      } else {
        houseEngine.keys = {};
      }

      const curItem = houseEngine.nearbyInteractable;
      const nextKey = curItem ? `${curItem.kind}_${curItem.heroId || ''}` : '';
      if (nextKey !== lastPromptKey) {
        lastPromptKey = nextKey;
        setNearbyPrompt(curItem ? { ...curItem } : null);
      }

      houseEngine.render(ctx, canvas.width, canvas.height);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [houseEngine, onOpenSkillTree]);

  // Smooth Virtual Joystick for Free-Roam Walking Inside the House
  useEffect(() => {
    const zone = joystickZoneRef.current;
    if (!zone || !pickedClass) return;

    let activeTouchId: number | null = null;
    let mouseDragging = false;
    let anchor = { x: 0, y: 0 };

    const updateVisualKnob = (sx: number, sy: number) => {
      if (knobRef.current) {
        knobRef.current.setAttribute('cx', (52 + sx).toFixed(1));
        knobRef.current.setAttribute('cy', (52 + sy).toFixed(1));
      }
      if (stemRef.current) {
        stemRef.current.setAttribute('x2', (52 + sx).toFixed(1));
        stemRef.current.setAttribute('y2', (52 + sy).toFixed(1));
      }
    };

    const beginStick = (cx: number, cy: number) => {
      const rect = zone.getBoundingClientRect();
      anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      moveStick(cx, cy);
    };

    const moveStick = (cx: number, cy: number) => {
      const dx = cx - anchor.x;
      const dy = cy - anchor.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, MAX_LOBBY_STICK);
      const ang = dist > 0.001 ? Math.atan2(dy, dx) : 0;
      const sx = dist > 0.001 ? Math.cos(ang) * clamped : 0;
      const sy = dist > 0.001 ? Math.sin(ang) * clamped : 0;
      updateVisualKnob(sx, sy);
      houseEngine.setJoystick(sx / MAX_LOBBY_STICK, sy / MAX_LOBBY_STICK, true);
    };

    const endStick = () => {
      activeTouchId = null;
      mouseDragging = false;
      updateVisualKnob(0, 0);
      houseEngine.setJoystick(0, 0, false);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeTouchId === null && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        activeTouchId = t.identifier;
        beginStick(t.clientX, t.clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchId) {
          if (e.cancelable) e.preventDefault();
          moveStick(e.touches[i].clientX, e.touches[i].clientY);
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          endStick();
          break;
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      mouseDragging = true;
      beginStick(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDragging) return;
      moveStick(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (!mouseDragging) return;
      endStick();
    };

    zone.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
    zone.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      zone.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      zone.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [pickedClass, houseEngine]);

  // Currently inspected hero details
  const inspectedHero = useMemo(
    () => (inspectingClass ? CHARACTERS.find(c => c.id === inspectingClass) || CHARACTERS[0] : null),
    [inspectingClass]
  );

  const activeHeroConfig = useMemo(
    () => (pickedClass ? CHARACTERS.find(c => c.id === pickedClass) || CHARACTERS[0] : null),
    [pickedClass]
  );

  const passiveBuffs = skillTreeManager.calculatePassiveBuffs();
  const soulGems = skillTreeManager.getSoulGems();
  const allTreeNodes = skillTreeManager.getNodes();
  const filteredTreeNodes =
    treeBranch === 'all' ? allTreeNodes : allTreeNodes.filter(n => n.branch === treeBranch);

  const inspectedLoadout = inspectedHero
    ? loadoutsByHero[inspectedHero.id] || { normalIndices: [0, 1], ultimateIndex: 0 }
    : { normalIndices: [0, 1] as [number, number], ultimateIndex: 0 };

  const chosenNormal1 = inspectedHero
    ? inspectedHero.normalSkills[inspectedLoadout.normalIndices[0]] || inspectedHero.normalSkills[0]
    : null;
  const chosenNormal2 = inspectedHero
    ? inspectedHero.normalSkills[inspectedLoadout.normalIndices[1]] || inspectedHero.normalSkills[1]
    : null;
  const chosenUltimate = inspectedHero
    ? inspectedHero.ultimateSkills[inspectedLoadout.ultimateIndex] || inspectedHero.ultimateSkills[0]
    : null;

  const exclusiveBonusHp = inspectedHero
    ? inspectedHero.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusHp || 0), 0)
    : 0;
  const exclusiveBonusShield = inspectedHero
    ? inspectedHero.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusShield || 0), 0)
    : 0;
  const exclusiveBonusEnergy = inspectedHero
    ? inspectedHero.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusEnergy || 0), 0)
    : 0;
  const exclusiveBonusSpeed = inspectedHero
    ? inspectedHero.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusSpeed || 0), 0)
    : 0;
  const exclusiveBonusCrit = inspectedHero
    ? inspectedHero.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusCrit || 0), 0)
    : 0;

  const bonusHp = passiveBuffs.bonusMaxHp + (chosenUltimate?.bonusHp || 0) + exclusiveBonusHp;
  const bonusShield = passiveBuffs.bonusMaxShield + (chosenUltimate?.bonusShield || 0) + exclusiveBonusShield;
  const bonusEnergy = passiveBuffs.bonusMaxEnergy + (chosenUltimate?.bonusEnergy || 0) + exclusiveBonusEnergy;
  const bonusSpeed = (chosenUltimate?.bonusSpeed || 0) + exclusiveBonusSpeed;
  const totalCritPercent = inspectedHero
    ? Math.round(
        (inspectedHero.critBonus +
          passiveBuffs.critRateBonus +
          (chosenUltimate?.bonusCrit || 0) +
          exclusiveBonusCrit) *
          100
      )
    : 0;

  // Reset focusedAbility to null on hero open/switch so skill descriptions ONLY show after clicking an icon!
  useEffect(() => {
    setFocusedAbility(null);
  }, [inspectingClass]);

  const handleCycleHero = (dir: -1 | 1) => {
    if (!inspectedHero) return;
    sounds.shoot('pistol');
    const curIdx = CHARACTERS.findIndex(c => c.id === inspectedHero.id);
    const nextIdx = (curIdx + dir + CHARACTERS.length) % CHARACTERS.length;
    setInspectingClass(CHARACTERS[nextIdx].id);
  };

  const handleClickAbilityIcon = (kind: 'normal' | 'ultimate' | 'buff', index: number) => {
    sounds.shoot('pistol');
    setFocusedAbility(prev =>
      prev && prev.kind === kind && prev.index === index ? null : { kind, index }
    );
  };

  const handleAssignNormalSlot = (heroId: CharacterClass, slot: 0 | 1, skillIdx: number) => {
    if (!skillTreeManager.isSkillUnlocked(heroId, 'normal', skillIdx)) return;
    sounds.shoot('pistol');
    setFocusedAbility({ kind: 'normal', index: skillIdx });
    setLoadoutsByHero(prev => {
      const cur = prev[heroId] || { normalIndices: [0, 1], ultimateIndex: 0 };
      const [first, second] = cur.normalIndices;
      if (slot === 0) {
        if (second === skillIdx) {
          return { ...prev, [heroId]: { ...cur, normalIndices: [skillIdx, first] } };
        }
        return { ...prev, [heroId]: { ...cur, normalIndices: [skillIdx, second] } };
      } else {
        if (first === skillIdx) {
          return { ...prev, [heroId]: { ...cur, normalIndices: [second, skillIdx] } };
        }
        return { ...prev, [heroId]: { ...cur, normalIndices: [first, skillIdx] } };
      }
    });
  };

  const handleSwapNormalOrder = (heroId: CharacterClass) => {
    sounds.shoot('pistol');
    setLoadoutsByHero(prev => {
      const cur = prev[heroId] || { normalIndices: [0, 1], ultimateIndex: 0 };
      return { ...prev, [heroId]: { ...cur, normalIndices: [cur.normalIndices[1], cur.normalIndices[0]] } };
    });
  };

  const handleSelectUltimate = (heroId: CharacterClass, ultIdx: number) => {
    if (!skillTreeManager.isSkillUnlocked(heroId, 'ultimate', ultIdx)) return;
    sounds.soulGem();
    setFocusedAbility({ kind: 'ultimate', index: ultIdx });
    setLoadoutsByHero(prev => {
      const cur = prev[heroId] || { normalIndices: [0, 1], ultimateIndex: 0 };
      return { ...prev, [heroId]: { ...cur, ultimateIndex: ultIdx } };
    });
  };

  const handlePickHeroAndWalk = (heroId: CharacterClass) => {
    if (!skillTreeManager.isHeroUnlocked(heroId)) return;
    sounds.levelUp();
    houseEngine.pickHero(heroId);
    setPickedClass(heroId);
    setInspectingClass(null);
  };

  const handleUnlockHero = (heroId: CharacterClass) => {
    if (skillTreeManager.unlockHero(heroId)) {
      sounds.levelUp();
      setTalentTick(t => t + 1);
    }
  };

  const handleLevelUpHero = (heroId: CharacterClass) => {
    if (skillTreeManager.levelUpHero(heroId)) {
      sounds.levelUp();
      setTalentTick(t => t + 1);
    }
  };

  const handleUpgradeTalentInline = (nodeId: string) => {
    if (skillTreeManager.upgradeNode(nodeId)) {
      sounds.levelUp();
      setTalentTick(t => t + 1);
    }
  };

  const handleResetTreeInline = () => {
    skillTreeManager.resetTree();
    sounds.coin();
    setTalentTick(t => t + 1);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#07080d] overflow-hidden font-pixel select-none">
      {/* Interactive Pixel-Art Soul Knight Guild House Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pixel-art cursor-pointer touch-none"
      />

      {/* Top Unobtrusive Guild House HUD Bar (Keeps bottom of screen 100% clear of text overlays!) */}
      <header className="relative z-20 pointer-events-none flex items-start justify-between gap-2 px-3 py-2 lg:px-5 lg:py-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 bg-slate-950/90 border-2 border-slate-800 px-3 py-1.5 rounded-lg shadow-lg max-w-[68vw] sm:max-w-none">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[10px] sm:text-xs lg:text-sm font-bold text-amber-400 whitespace-nowrap">
                GUILD LIVING ROOM
              </h1>
              <button
                type="button"
                onClick={() => {
                  sounds.shoot('pistol');
                  setInspectingClass(pickedClass || 'knight');
                  setInspectorTab('loadout');
                }}
                className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-200 px-2 py-1 rounded cursor-pointer whitespace-nowrap transition-colors"
              >
                <Users className="w-3 h-3 shrink-0" />
                <span>CHOOSE HERO</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 font-vt leading-tight mt-0.5">
              {pickedClass && activeHeroConfig
                ? `Walk North into the Portal · Tap any Hero or Choose Hero to switch`
                : 'Tap any hero in the house or press Choose Hero to inspect Skills & Passives'}
            </p>
          </div>

          {pickedClass && activeHeroConfig && (
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
              <button
                type="button"
                onClick={() => {
                  sounds.shoot('pistol');
                  setInspectingClass(pickedClass);
                  setInspectorTab('loadout');
                }}
                className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400 px-2.5 py-1 rounded text-[9px] text-amber-300 cursor-pointer whitespace-nowrap min-h-[32px]"
                title="View active hero Exclusive Buffs, Stats, Skills & Skill Tree"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{activeHeroConfig.name.toUpperCase()}</span>
                <span className="hidden md:inline text-xs leading-none ml-0.5">
                  {activeHeroConfig.exclusiveBuffs[0].icon}
                  {activeHeroConfig.exclusiveBuffs[1].icon}
                </span>
              </button>

              <button
                type="button"
                onClick={() => requestPortalConfirmRef.current()}
                className="flex items-center gap-1 bg-purple-900/90 hover:bg-purple-800 border border-purple-400 px-2.5 py-1 rounded text-[9px] text-purple-100 font-bold cursor-pointer whitespace-nowrap min-h-[32px]"
                title="Confirm difficulty & enter Dungeon Portal"
              >
                <span>ENTER PORTAL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.shoot('pistol');
                  houseEngine.pickedClass = null;
                  houseEngine.portalTriggered = false;
                  setPickedClass(null);
                  setNearbyPrompt(null);
                }}
                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[9px] text-slate-300 cursor-pointer whitespace-nowrap min-h-[32px]"
                title="Zoom out to full Guild House overview"
              >
                <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="hidden sm:inline">ALL HEROES</span>
              </button>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleCycleDifficultyBar}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded text-[9px] sm:text-[10px] font-bold cursor-pointer transition-colors min-h-[36px] whitespace-nowrap shrink-0 ${
              (DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium).badgeColor
            }`}
            title="Tap to cycle Difficulty (Easy -> Medium -> Hard -> Nightmare -> Hell)"
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>{(DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium).name.toUpperCase()}</span>
          </button>

          <PWAInstallButton compact />
          <LandscapeModeButton iconOnly />

          <button
            type="button"
            onClick={() => {
              sounds.toggleMute();
              setSoundEnabled(sounds.enabled);
            }}
            className="p-2 bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
            title="Toggle Audio"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          <button
            type="button"
            onClick={onOpenSkillTree}
            className="flex items-center gap-1.5 bg-purple-950/90 hover:bg-purple-900 border-2 border-purple-500 px-2.5 py-1.5 rounded text-purple-200 cursor-pointer transition-colors tabular-nums min-h-[36px] whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold">{soulGems} GEMS</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCodex(true)}
            className="flex items-center gap-1.5 bg-slate-950/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200 text-[9px] sm:text-[10px] cursor-pointer transition-colors min-h-[36px] whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">CODEX</span>
          </button>

          <button
            type="button"
            onClick={() => setShowControls(true)}
            className="p-2 bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
            title="Controls Guide"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.shoot('pistol');
              setShowSettings(true);
            }}
            className="p-2 bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </header>

      {/* Corner-Only Exploration Controls (Zero bottom-center text blocking any Guild House characters!) */}
      {pickedClass && (
        <>
          {/* Virtual Analog Joystick (Bottom-Left) for Mobile & Mouse House Exploration */}
          <div
            ref={joystickZoneRef}
            className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-20 w-28 h-28 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
            title="Drag to walk around the Guild House"
          >
            <svg width="104" height="104" viewBox="0 0 104 104" className="overflow-visible pointer-events-none">
              <circle
                cx="52"
                cy="52"
                r="42"
                fill="rgba(9, 13, 22, 0.65)"
                stroke="#334155"
                strokeWidth="2.5"
              />
              <line
                ref={stemRef}
                x1="52"
                y1="52"
                x2="52"
                y2="52"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle
                ref={knobRef}
                cx="52"
                cy="52"
                r="17"
                fill="#0284c7"
                stroke="#bae6fd"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          {/* Contextual Proximity Action Button anchored cleanly in Bottom-Right Corner */}
          {nearbyPrompt && (
            <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 z-20">
              <button
                type="button"
                onClick={triggerHouseInteract}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border-2 font-bold text-[10px] sm:text-xs shadow-2xl cursor-pointer active:scale-95 transition-transform whitespace-nowrap min-h-[42px] ${
                  nearbyPrompt.kind === 'portal'
                    ? 'bg-purple-950/95 hover:bg-purple-900 border-purple-400 text-purple-100 shadow-[0_0_20px_rgba(192,132,252,0.45)]'
                    : 'bg-slate-950/95 hover:bg-amber-950/90 border-amber-400 text-amber-300'
                }`}
              >
                <Hand className="w-4 h-4 shrink-0" />
                <span>{hidePcKeyLabels ? nearbyPrompt.label : `[F] · ${nearbyPrompt.label}`}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* REDESIGNED SPLIT-PANE HERO SELECTION & SKILL DESCRIPTION SHOWCASE     */}
      {/* ===================================================================== */}
      {inspectedHero && chosenNormal1 && chosenNormal2 && chosenUltimate && (() => {
        const starterWeapon = WEAPON_REGISTRY[inspectedHero.startingWeaponId];
        const isHeroUnlocked = skillTreeManager.isHeroUnlocked(inspectedHero.id);
        const heroUnlockCost = skillTreeManager.getHeroUnlockCost(inspectedHero.id);
        const heroLevel = skillTreeManager.getHeroLevel(inspectedHero.id);
        const nextLevelCost = skillTreeManager.getNextHeroLevelCost(inspectedHero.id);
        const nextLevelReward =
          heroLevel < MAX_HERO_LEVEL ? getSkillUnlockedAtHeroLevel(inspectedHero, heroLevel + 1) : null;

        const spotlightNormal =
          focusedAbility?.kind === 'normal'
            ? inspectedHero.normalSkills[focusedAbility.index] || null
            : null;
        const spotlightUlt =
          focusedAbility?.kind === 'ultimate'
            ? inspectedHero.ultimateSkills[focusedAbility.index] || null
            : null;
        const spotlightBuff =
          focusedAbility?.kind === 'buff'
            ? inspectedHero.exclusiveBuffs[focusedAbility.index] || null
            : null;

        const isSpotlightNormalUnlocked =
          focusedAbility?.kind === 'normal'
            ? skillTreeManager.isSkillUnlocked(inspectedHero.id, 'normal', focusedAbility.index)
            : false;
        const spotlightNormalReqLevel =
          focusedAbility?.kind === 'normal'
            ? getSkillRequiredHeroLevel('normal', focusedAbility.index)
            : 1;

        const isSpotlightUltUnlocked =
          focusedAbility?.kind === 'ultimate'
            ? skillTreeManager.isSkillUnlocked(inspectedHero.id, 'ultimate', focusedAbility.index)
            : false;
        const spotlightUltReqLevel =
          focusedAbility?.kind === 'ultimate'
            ? getSkillRequiredHeroLevel('ultimate', focusedAbility.index)
            : 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-1.5 sm:p-3">
            <div className="bg-slate-950 border-2 border-amber-500/90 rounded-xl w-full max-w-6xl h-[96dvh] sm:h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
              {/* TOP COMPACT BAR: 12-Hero Roster Strip + View Mode Tabs + Close */}
              <div className="flex items-center gap-2 px-2.5 py-2 sm:px-4 bg-slate-900 border-b border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCycleHero(-1)}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-700 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
                  title="Previous Hero"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Scrollable 12-Hero Quick Selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5">
                  {CHARACTERS.map(hero => {
                    const isCurrent = hero.id === inspectedHero.id;
                    const isPickedInHouse = hero.id === pickedClass;
                    const unlocked = skillTreeManager.isHeroUnlocked(hero.id);
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => {
                          sounds.shoot('pistol');
                          setInspectingClass(hero.id);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] cursor-pointer whitespace-nowrap transition-colors min-h-[34px] shrink-0 ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-md'
                            : isPickedInHouse
                            ? 'bg-amber-950/50 text-amber-200 border-amber-500/60 hover:bg-slate-800'
                            : unlocked
                            ? 'bg-slate-950/90 text-slate-200 border-slate-700 hover:border-slate-500 hover:text-white'
                            : 'bg-slate-950/70 text-slate-400 border-slate-800/90 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-sm leading-none shrink-0">
                          {unlocked ? hero.exclusiveBuffs[0].icon : '🔒'}
                        </span>
                        <span>{hero.name.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleCycleHero(1)}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-700 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
                  title="Next Hero"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Primary View Switcher */}
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('loadout')}
                    className={`px-2.5 py-1.5 rounded text-[9px] cursor-pointer whitespace-nowrap transition-colors min-h-[30px] ${
                      inspectorTab === 'loadout'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    SKILLS
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('skill_tree')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] cursor-pointer whitespace-nowrap transition-colors min-h-[30px] tabular-nums ${
                      inspectorTab === 'skill_tree'
                        ? 'bg-purple-600 text-white font-bold'
                        : 'text-purple-300 hover:text-purple-100'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="hidden md:inline">SKILL TREE</span>
                    <span>({soulGems})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingClass(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center shrink-0"
                  title="Close Hero Selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* MOBILE PORTRAIT COMPACT HERO SUMMARY (< 640px only) */}
              <div className="sm:hidden flex items-center justify-between gap-2.5 px-3 py-2 bg-slate-900/70 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <HeroLivePreviewCanvas classId={inspectedHero.id} mode={previewMode} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <h2 className="text-xs font-bold text-amber-300">{inspectedHero.name}</h2>
                      <span className="text-xs font-vt text-slate-400">{inspectedHero.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-vt tabular-nums mt-0.5">
                      <span className="text-red-400">HP {inspectedHero.maxHp + bonusHp}</span>
                      <span className="text-sky-400">SHD {inspectedHero.maxShield + bonusShield}</span>
                      <span className="text-cyan-400">MP {inspectedHero.maxEnergy + bonusEnergy}</span>
                      <span className="text-emerald-400">SPD {inspectedHero.speed + bonusSpeed}</span>
                      <span className="text-amber-300">CRIT {totalCritPercent}%</span>
                    </div>
                    <div className="text-xs font-vt text-sky-300 truncate">
                      Weapon: {starterWeapon?.name || 'Bad Pistol'} ({starterWeapon?.damage || 5} DMG)
                    </div>
                  </div>
                </div>
              </div>

              {/* MAIN SPLIT BODY: Left Hero Profile Sidebar (sm+) + Right Dedicated Skills & Descriptions Showcase */}
              <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
                {/* LEFT COLUMN: Hero Sprite, Stats, Active Loadout & Pick CTA (Side-by-side on Landscape & Desktop!) */}
                <aside className="hidden sm:flex sm:w-64 lg:w-76 shrink-0 border-r border-slate-800 bg-slate-900/55 flex-col justify-between p-3 lg:p-4 overflow-y-auto gap-3">
                  <div className="space-y-3">
                    {/* Hero Animated Sprite & Bio */}
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex flex-col items-center">
                        <HeroLivePreviewCanvas classId={inspectedHero.id} mode={previewMode} />
                        <div className="flex items-center gap-1 mt-1">
                          {(['idle', 'walk', 'rest'] as KnightAnimMode[]).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPreviewMode(m)}
                              className={`px-1.5 py-0.5 rounded text-[7px] uppercase border cursor-pointer whitespace-nowrap ${
                                previewMode === m
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm lg:text-base font-bold text-amber-300 leading-tight">
                          {inspectedHero.name}
                        </h2>
                        <div className="text-sm font-vt text-amber-200/80 leading-tight mt-0.5">
                          {inspectedHero.title}
                        </div>
                        <p className="text-xs lg:text-sm font-vt text-slate-300 leading-snug mt-1.5">
                          {inspectedHero.description}
                        </p>
                      </div>
                    </div>

                    {/* Starter Weapon Card */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 tabular-nums">
                      <div className="min-w-0">
                        <div className="text-[7px] text-slate-400">STARTER WEAPON</div>
                        <div className="text-sm font-vt font-bold text-sky-300 truncate">
                          {starterWeapon?.name || 'Bad Pistol'}
                        </div>
                      </div>
                      <div className="text-right shrink-0 text-xs font-vt">
                        <div className="text-amber-300 font-bold">{starterWeapon?.damage || 5} DMG</div>
                        <div className="text-cyan-400">{starterWeapon?.energyCost ?? 0} MP</div>
                      </div>
                    </div>

                    {/* 5-Stat Readout Grid */}
                    <div className="grid grid-cols-2 gap-1.5 tabular-nums">
                      <div className="bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <div>
                          <div className="text-[7px] text-slate-400">HEALTH</div>
                          <div className="text-[11px] font-bold text-red-400">
                            {inspectedHero.maxHp + bonusHp}
                            {bonusHp > 0 && <span className="text-[8px] text-emerald-400 ml-0.5">+{bonusHp}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <div>
                          <div className="text-[7px] text-slate-400">SHIELD</div>
                          <div className="text-[11px] font-bold text-sky-400">
                            {inspectedHero.maxShield + bonusShield}
                            {bonusShield > 0 && (
                              <span className="text-[8px] text-emerald-400 ml-0.5">+{bonusShield}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div>
                          <div className="text-[7px] text-slate-400">ENERGY</div>
                          <div className="text-[11px] font-bold text-cyan-400">
                            {inspectedHero.maxEnergy + bonusEnergy}
                            {bonusEnergy > 0 && (
                              <span className="text-[8px] text-emerald-400 ml-0.5">+{bonusEnergy}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-[7px] text-slate-400">SPEED</div>
                          <div className="text-[11px] font-bold text-emerald-400">
                            {inspectedHero.speed + bonusSpeed}
                            {bonusSpeed > 0 && (
                              <span className="text-[8px] text-amber-300 ml-0.5">+{bonusSpeed}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[7px] text-slate-400">CRIT CHANCE</span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-400">{totalCritPercent}%</span>
                      </div>
                    </div>

                    {/* Equipped Loadout Icon-Only Quick-Inspect Slots */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-slate-400">EQUIPPED SKILLS</span>
                        <span className="text-[11px] font-vt text-slate-400">Tap icon for info</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectorTab('loadout');
                            handleClickAbilityIcon('normal', inspectedLoadout.normalIndices[0]);
                          }}
                          className={`relative h-14 rounded-lg border-2 flex items-center justify-center text-2xl cursor-pointer transition-all ${
                            focusedAbility?.kind === 'normal' &&
                            focusedAbility.index === inspectedLoadout.normalIndices[0]
                              ? 'bg-sky-950/70 border-white ring-2 ring-sky-400'
                              : 'bg-slate-950/90 border-sky-500/80 hover:border-sky-300'
                          }`}
                          title="Tap to inspect Slot 1 Skill"
                        >
                          <span>{chosenNormal1.icon}</span>
                          <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[7px] font-bold leading-none whitespace-nowrap">
                            {hidePcKeyLabels ? '1' : '[Space]'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setInspectorTab('loadout');
                            handleClickAbilityIcon('normal', inspectedLoadout.normalIndices[1]);
                          }}
                          className={`relative h-14 rounded-lg border-2 flex items-center justify-center text-2xl cursor-pointer transition-all ${
                            focusedAbility?.kind === 'normal' &&
                            focusedAbility.index === inspectedLoadout.normalIndices[1]
                              ? 'bg-sky-950/70 border-white ring-2 ring-sky-400'
                              : 'bg-slate-950/90 border-sky-500/80 hover:border-sky-300'
                          }`}
                          title="Tap to inspect Slot 2 Skill"
                        >
                          <span>{chosenNormal2.icon}</span>
                          <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[7px] font-bold leading-none whitespace-nowrap">
                            {hidePcKeyLabels ? '2' : '[E]'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setInspectorTab('loadout');
                            handleClickAbilityIcon('ultimate', inspectedLoadout.ultimateIndex);
                          }}
                          className={`relative h-14 rounded-lg border-2 flex items-center justify-center text-2xl cursor-pointer transition-all ${
                            focusedAbility?.kind === 'ultimate' &&
                            focusedAbility.index === inspectedLoadout.ultimateIndex
                              ? 'bg-amber-950/70 border-white ring-2 ring-amber-400'
                              : 'bg-slate-950/90 border-amber-400/90 hover:border-amber-200'
                          }`}
                          title="Tap to inspect Ultimate Skill"
                        >
                          <span>{chosenUltimate.icon}</span>
                          <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7px] font-bold leading-none whitespace-nowrap">
                            {hidePcKeyLabels ? 'ULT' : '[R]'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Primary Pick OR Unlock Hero CTA pinned at bottom of Left Column */}
                  {isHeroUnlocked ? (
                    <button
                      type="button"
                      onClick={() => handlePickHeroAndWalk(inspectedHero.id)}
                      className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg border-2 border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 text-[10px] lg:text-xs whitespace-nowrap shadow-lg min-h-[42px]"
                    >
                      <Check className="w-4 h-4 stroke-[3] shrink-0" />
                      <span>
                        {pickedClass === inspectedHero.id
                          ? `PLAY AS ${inspectedHero.name.toUpperCase()}`
                          : `PICK ${inspectedHero.name.toUpperCase()}`}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={soulGems < heroUnlockCost}
                      onClick={() => handleUnlockHero(inspectedHero.id)}
                      className={`w-full px-4 py-3 font-bold rounded-lg border-2 flex items-center justify-center gap-2 text-[10px] lg:text-xs whitespace-nowrap min-h-[42px] tabular-nums transition-all ${
                        soulGems >= heroUnlockCost
                          ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer shadow-lg active:scale-95'
                          : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>UNLOCK · {heroUnlockCost} GEMS</span>
                    </button>
                  )}
                </aside>

                {/* RIGHT PANE: Icon-Only Skill Selector + Click-to-Reveal Description */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-slate-950">
                  {inspectorTab === 'loadout' ? (
                    <>
                      {/* Category Filter Sub-Bar + Swap Slots */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 bg-slate-900/60 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                          {[
                            { id: 'all', label: 'ALL (10)' },
                            { id: 'normal', label: 'NORMAL (5)' },
                            { id: 'ultimate', label: 'ULTIMATE (3)' },
                            { id: 'buffs', label: 'BUFFS (2)' },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setSkillFilter(tab.id as 'all' | 'normal' | 'ultimate' | 'buffs');
                                setFocusedAbility(null);
                              }}
                              className={`px-2.5 py-1.5 rounded text-[8px] sm:text-[9px] cursor-pointer whitespace-nowrap transition-colors min-h-[30px] ${
                                skillFilter === tab.id
                                  ? 'bg-sky-500 text-slate-950 font-bold'
                                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSwapNormalOrder(inspectedHero.id)}
                          className="flex items-center gap-1.5 text-[8px] sm:text-[9px] text-sky-200 hover:text-amber-300 bg-slate-950 border border-slate-700 hover:border-amber-400 px-2.5 py-1.5 rounded cursor-pointer whitespace-nowrap min-h-[30px]"
                        >
                          <ArrowLeftRight className="w-3 h-3 shrink-0" />
                          <span>{hidePcKeyLabels ? 'SWAP SLOTS 1 & 2' : 'SWAP [Space] & [E]'}</span>
                        </button>
                      </div>

                      {/* Icon-Only Skill Rows + Hero Level-Up Bar + Click-to-Inspect Description Card */}
                      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
                        {/* HERO LEVEL & GEM SKILL UNLOCK PROGRESSION BAR */}
                        <div className="bg-slate-900/75 border border-slate-800 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 tabular-nums">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold">
                              <span className="text-purple-300">
                                HERO LV. {heroLevel} / {MAX_HERO_LEVEL}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-300 font-vt text-sm">
                                {heroLevel >= MAX_HERO_LEVEL
                                  ? 'All Normal & Ultimate Skills Unlocked!'
                                  : nextLevelReward
                                  ? `Next Level unlocks ${
                                      nextLevelReward.kind === 'ultimate' ? 'Ultimate' : 'Normal'
                                    } Skill: ${nextLevelReward.skill.icon} ${nextLevelReward.skill.name}`
                                  : 'Level up with Gems to unlock locked skills'}
                              </span>
                            </div>
                          </div>

                          {!isHeroUnlocked ? (
                            <button
                              type="button"
                              disabled={soulGems < heroUnlockCost}
                              onClick={() => handleUnlockHero(inspectedHero.id)}
                              className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                                soulGems >= heroUnlockCost
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>UNLOCK HERO · {heroUnlockCost} GEMS</span>
                            </button>
                          ) : nextLevelCost !== null ? (
                            <button
                              type="button"
                              disabled={soulGems < nextLevelCost}
                              onClick={() => handleLevelUpHero(inspectedHero.id)}
                              className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                                soulGems >= nextLevelCost
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>LEVEL UP TO LV.{heroLevel + 1} · {nextLevelCost} GEMS</span>
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-400">MAX HERO LEVEL</span>
                          )}
                        </div>

                        {/* 1. NORMAL SKILLS ICON BAR (5 Icons Only — First 2 Unlocked at Lv.1) */}
                        {(skillFilter === 'all' || skillFilter === 'normal') && (
                          <section className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-[10px] sm:text-xs font-bold text-sky-300">
                                {hidePcKeyLabels
                                  ? 'NORMAL SKILLS · CHOOSE 2'
                                  : 'NORMAL SKILLS · CHOOSE 2 ([Space] & [E])'}
                              </h3>
                              <span className="text-xs font-vt text-slate-400">
                                Tap an icon to view description
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {inspectedHero.normalSkills.map((skill, idx) => {
                                const isUnlocked = skillTreeManager.isSkillUnlocked(
                                  inspectedHero.id,
                                  'normal',
                                  idx
                                );
                                const reqLevel = getSkillRequiredHeroLevel('normal', idx);
                                const isSlot1 = isUnlocked && inspectedLoadout.normalIndices[0] === idx;
                                const isSlot2 = isUnlocked && inspectedLoadout.normalIndices[1] === idx;
                                const isEquipped = isSlot1 || isSlot2;
                                const isFocused =
                                  focusedAbility?.kind === 'normal' && focusedAbility.index === idx;

                                return (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    onClick={() => handleClickAbilityIcon('normal', idx)}
                                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl transition-all cursor-pointer active:scale-95 ${
                                      isFocused
                                        ? 'border-white bg-sky-900/75 ring-2 ring-sky-400 scale-105 shadow-[0_0_18px_rgba(56,189,248,0.4)]'
                                        : !isUnlocked
                                        ? 'border-slate-800 bg-slate-950/90 opacity-65 hover:opacity-95 hover:border-purple-500/60'
                                        : isEquipped
                                        ? 'border-sky-400 bg-sky-950/55 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                                    }`}
                                    aria-label={skill.name}
                                  >
                                    <span>{skill.icon}</span>
                                    {!isUnlocked ? (
                                      <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[7px] font-bold leading-none whitespace-nowrap">
                                        🔒 LV.{reqLevel}
                                      </span>
                                    ) : (
                                      isEquipped && (
                                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[7px] font-bold leading-none shadow whitespace-nowrap">
                                          {isSlot1
                                            ? hidePcKeyLabels
                                              ? '1'
                                              : 'Space'
                                            : hidePcKeyLabels
                                            ? '2'
                                            : 'E'}
                                        </span>
                                      )
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {/* 2. ULTIMATE SKILLS ICON BAR (3 Icons Only — 1st Ultimate Unlocked at Lv.1) */}
                        {(skillFilter === 'all' || skillFilter === 'ultimate') && (
                          <section className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-[10px] sm:text-xs font-bold text-amber-400">
                                {hidePcKeyLabels
                                  ? 'ULTIMATE SKILL · CHOOSE 1'
                                  : 'ULTIMATE SKILL · CHOOSE 1 ([R])'}
                              </h3>
                              <span className="text-xs font-vt text-amber-300/90">
                                Grants passive run boost
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {inspectedHero.ultimateSkills.map((ult, idx) => {
                                const isUnlocked = skillTreeManager.isSkillUnlocked(
                                  inspectedHero.id,
                                  'ultimate',
                                  idx
                                );
                                const reqLevel = getSkillRequiredHeroLevel('ultimate', idx);
                                const isSelected = isUnlocked && inspectedLoadout.ultimateIndex === idx;
                                const isFocused =
                                  focusedAbility?.kind === 'ultimate' && focusedAbility.index === idx;

                                return (
                                  <button
                                    key={ult.id}
                                    type="button"
                                    onClick={() => handleClickAbilityIcon('ultimate', idx)}
                                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl transition-all cursor-pointer active:scale-95 ${
                                      isFocused
                                        ? 'border-white bg-amber-900/70 ring-2 ring-amber-400 scale-105 shadow-[0_0_18px_rgba(245,158,11,0.4)]'
                                        : !isUnlocked
                                        ? 'border-slate-800 bg-slate-950/90 opacity-65 hover:opacity-95 hover:border-purple-500/60'
                                        : isSelected
                                        ? 'border-amber-400 bg-amber-950/55 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                                    }`}
                                    aria-label={ult.name}
                                  >
                                    <span>{ult.icon}</span>
                                    {!isUnlocked ? (
                                      <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[7px] font-bold leading-none whitespace-nowrap">
                                        🔒 LV.{reqLevel}
                                      </span>
                                    ) : (
                                      isSelected && (
                                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7px] font-bold leading-none shadow whitespace-nowrap">
                                          {hidePcKeyLabels ? '★' : 'R'}
                                        </span>
                                      )
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {/* 3. EXCLUSIVE HERO BUFFS ICON BAR (2 Icons Only) */}
                        {(skillFilter === 'all' || skillFilter === 'buffs') && (
                          <section className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-[10px] sm:text-xs font-bold text-emerald-400">
                                EXCLUSIVE BUFFS · 2 PASSIVES
                              </h3>
                              <span className="text-xs font-vt text-emerald-300/90">
                                Always active on {inspectedHero.name}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {inspectedHero.exclusiveBuffs.map((buff, idx) => {
                                const isFocused =
                                  focusedAbility?.kind === 'buff' && focusedAbility.index === idx;

                                return (
                                  <button
                                    key={buff.id}
                                    type="button"
                                    onClick={() => handleClickAbilityIcon('buff', idx)}
                                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl transition-all cursor-pointer active:scale-95 ${
                                      isFocused
                                        ? 'border-white bg-emerald-900/70 ring-2 ring-emerald-400 scale-105 shadow-[0_0_18px_rgba(16,185,129,0.4)]'
                                        : 'border-emerald-500/75 bg-emerald-950/35 hover:border-emerald-400'
                                    }`}
                                    aria-label={buff.name}
                                  >
                                    <span>{buff.icon}</span>
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[8px] font-bold flex items-center justify-center shadow">
                                      ✓
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {/* CLICK-TO-REVEAL SKILL DESCRIPTION PANEL (Hidden until a skill icon is clicked!) */}
                        {!focusedAbility && (
                          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-3.5 text-center">
                            <p className="text-sm sm:text-base font-vt text-slate-400">
                              Click or tap any skill icon above to view its description. Level up heroes with Gems to unlock locked skills!
                            </p>
                          </div>
                        )}

                        {spotlightNormal && focusedAbility?.kind === 'normal' && (
                          <div className="rounded-xl border-2 border-sky-400/90 bg-sky-950/30 p-3.5 sm:p-4 shadow-lg">
                            <div className="flex flex-wrap items-start justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-slate-950 border border-sky-500/60 flex items-center justify-center text-2xl shrink-0">
                                  {spotlightNormal.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-white">
                                      {spotlightNormal.name}
                                    </span>
                                    <span className="text-[9px] text-sky-300 font-vt">
                                      {!isSpotlightNormalUnlocked
                                        ? `🔒 Unlocks at Hero Lv. ${spotlightNormalReqLevel}`
                                        : inspectedLoadout.normalIndices[0] === focusedAbility.index
                                        ? hidePcKeyLabels
                                          ? 'Equipped · Slot 1'
                                          : 'Equipped [Space]'
                                        : inspectedLoadout.normalIndices[1] === focusedAbility.index
                                        ? hidePcKeyLabels
                                          ? 'Equipped · Slot 2'
                                          : 'Equipped [E]'
                                        : 'Normal Skill'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-sm font-vt tabular-nums">
                                    <span className="text-cyan-300 font-bold">
                                      Energy Cost: {spotlightNormal.energyCost} MP
                                    </span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-amber-300 font-bold">
                                      Cooldown: {spotlightNormal.cooldown}s
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSpotlightNormalUnlocked ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAssignNormalSlot(inspectedHero.id, 0, focusedAbility.index)
                                      }
                                      className={`px-2.5 py-1.5 rounded text-[9px] font-bold border cursor-pointer whitespace-nowrap min-h-[34px] ${
                                        inspectedLoadout.normalIndices[0] === focusedAbility.index
                                          ? 'bg-sky-400 text-slate-950 border-sky-200'
                                          : 'bg-slate-900 hover:bg-sky-950 text-sky-300 border-sky-600'
                                      }`}
                                    >
                                      {inspectedLoadout.normalIndices[0] === focusedAbility.index
                                        ? hidePcKeyLabels
                                          ? 'ACTIVE SLOT 1'
                                          : 'ACTIVE [Space]'
                                        : hidePcKeyLabels
                                        ? 'EQUIP SLOT 1'
                                        : 'EQUIP [Space]'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAssignNormalSlot(inspectedHero.id, 1, focusedAbility.index)
                                      }
                                      className={`px-2.5 py-1.5 rounded text-[9px] font-bold border cursor-pointer whitespace-nowrap min-h-[34px] ${
                                        inspectedLoadout.normalIndices[1] === focusedAbility.index
                                          ? 'bg-sky-400 text-slate-950 border-sky-200'
                                          : 'bg-slate-900 hover:bg-sky-950 text-sky-300 border-sky-600'
                                      }`}
                                    >
                                      {inspectedLoadout.normalIndices[1] === focusedAbility.index
                                        ? hidePcKeyLabels
                                          ? 'ACTIVE SLOT 2'
                                          : 'ACTIVE [E]'
                                        : hidePcKeyLabels
                                        ? 'EQUIP SLOT 2'
                                        : 'EQUIP [E]'}
                                    </button>
                                  </>
                                ) : !isHeroUnlocked ? (
                                  <button
                                    type="button"
                                    disabled={soulGems < heroUnlockCost}
                                    onClick={() => handleUnlockHero(inspectedHero.id)}
                                    className={`px-3 py-1.5 rounded text-[9px] font-bold border whitespace-nowrap min-h-[34px] ${
                                      soulGems >= heroUnlockCost
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                        : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                    }`}
                                  >
                                    UNLOCK HERO · {heroUnlockCost} GEMS
                                  </button>
                                ) : (
                                  nextLevelCost !== null && (
                                    <button
                                      type="button"
                                      disabled={soulGems < nextLevelCost}
                                      onClick={() => handleLevelUpHero(inspectedHero.id)}
                                      className={`px-3 py-1.5 rounded text-[9px] font-bold border whitespace-nowrap min-h-[34px] ${
                                        soulGems >= nextLevelCost
                                          ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                          : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                      }`}
                                    >
                                      LEVEL UP TO LV.{heroLevel + 1} · {nextLevelCost} GEMS
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  onClick={() => setFocusedAbility(null)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 rounded cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                                  title="Hide description"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="mt-2.5 text-base sm:text-lg font-vt text-slate-100 leading-snug bg-slate-950/75 border border-slate-800 rounded-lg px-3 py-2">
                              {spotlightNormal.description}
                            </p>
                          </div>
                        )}

                        {spotlightUlt && focusedAbility?.kind === 'ultimate' && (
                          <div className="rounded-xl border-2 border-amber-400/90 bg-amber-950/25 p-3.5 sm:p-4 shadow-lg">
                            <div className="flex flex-wrap items-start justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-slate-950 border border-amber-500/60 flex items-center justify-center text-2xl shrink-0">
                                  {spotlightUlt.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-amber-200">
                                      {spotlightUlt.name}
                                    </span>
                                    <span className="text-[9px] text-amber-300 font-vt">
                                      {!isSpotlightUltUnlocked
                                        ? `🔒 Unlocks at Hero Lv. ${spotlightUltReqLevel}`
                                        : inspectedLoadout.ultimateIndex === focusedAbility.index
                                        ? hidePcKeyLabels
                                          ? 'Equipped Ultimate'
                                          : 'Equipped [R]'
                                        : 'Ultimate Skill'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm font-vt tabular-nums">
                                    <span className="text-cyan-300 font-bold">
                                      Energy Cost: {spotlightUlt.energyCost} MP
                                    </span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-amber-300 font-bold">
                                      Cooldown: {spotlightUlt.cooldown}s
                                    </span>
                                    {spotlightUlt.statBonusText && (
                                      <>
                                        <span className="text-slate-500">·</span>
                                        <span className="text-emerald-400 font-bold">
                                          Passive: {spotlightUlt.statBonusText}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSpotlightUltUnlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectUltimate(inspectedHero.id, focusedAbility.index)}
                                    className={`px-3 py-1.5 rounded text-[9px] font-bold border cursor-pointer whitespace-nowrap min-h-[34px] ${
                                      inspectedLoadout.ultimateIndex === focusedAbility.index
                                        ? 'bg-amber-400 text-slate-950 border-amber-200'
                                        : 'bg-slate-900 hover:bg-amber-950 text-amber-300 border-amber-500'
                                    }`}
                                  >
                                    {inspectedLoadout.ultimateIndex === focusedAbility.index
                                      ? hidePcKeyLabels
                                        ? 'EQUIPPED ULTIMATE'
                                        : 'ACTIVE [R]'
                                      : hidePcKeyLabels
                                      ? 'EQUIP ULTIMATE'
                                      : 'EQUIP ULTIMATE [R]'}
                                  </button>
                                ) : !isHeroUnlocked ? (
                                  <button
                                    type="button"
                                    disabled={soulGems < heroUnlockCost}
                                    onClick={() => handleUnlockHero(inspectedHero.id)}
                                    className={`px-3 py-1.5 rounded text-[9px] font-bold border whitespace-nowrap min-h-[34px] ${
                                      soulGems >= heroUnlockCost
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                        : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                    }`}
                                  >
                                    UNLOCK HERO · {heroUnlockCost} GEMS
                                  </button>
                                ) : (
                                  nextLevelCost !== null && (
                                    <button
                                      type="button"
                                      disabled={soulGems < nextLevelCost}
                                      onClick={() => handleLevelUpHero(inspectedHero.id)}
                                      className={`px-3 py-1.5 rounded text-[9px] font-bold border whitespace-nowrap min-h-[34px] ${
                                        soulGems >= nextLevelCost
                                          ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer'
                                          : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                      }`}
                                    >
                                      LEVEL UP TO LV.{heroLevel + 1} · {nextLevelCost} GEMS
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  onClick={() => setFocusedAbility(null)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 rounded cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                                  title="Hide description"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="mt-2.5 text-base sm:text-lg font-vt text-slate-100 leading-snug bg-slate-950/75 border border-slate-800 rounded-lg px-3 py-2">
                              {spotlightUlt.description}
                            </p>
                          </div>
                        )}

                        {spotlightBuff && focusedAbility?.kind === 'buff' && (
                          <div className="rounded-xl border-2 border-emerald-400/90 bg-emerald-950/25 p-3.5 sm:p-4 shadow-lg">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-slate-950 border border-emerald-500/60 flex items-center justify-center text-2xl shrink-0">
                                  {spotlightBuff.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-emerald-200">
                                      {spotlightBuff.name}
                                    </span>
                                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-emerald-950 whitespace-nowrap">
                                      INNATE PASSIVE · ALWAYS ACTIVE
                                    </span>
                                  </div>
                                  <div className="text-sm font-vt text-amber-300 mt-0.5">
                                    {spotlightBuff.tagline}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setFocusedAbility(null)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 rounded cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center shrink-0"
                                title="Hide description"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <p className="mt-2.5 text-base sm:text-lg font-vt text-slate-100 leading-snug bg-slate-950/75 border border-slate-800 rounded-lg px-3 py-2">
                              {spotlightBuff.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* INLINE SKILL TREE TAB */
                    <div className="flex-1 overflow-y-auto p-3.5 lg:p-5 space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2.5">
                        {[
                          { id: 'all', label: 'All Talents', icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" /> },
                          { id: 'offensive', label: 'Offensive', icon: <Swords className="w-3.5 h-3.5 text-red-400" /> },
                          { id: 'defensive', label: 'Defensive', icon: <Shield className="w-3.5 h-3.5 text-sky-400" /> },
                          { id: 'utility', label: 'Utility', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
                          { id: 'fortune', label: 'Fortune', icon: <Coins className="w-3.5 h-3.5 text-emerald-400" /> },
                        ].map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setTreeBranch(b.id as any)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] cursor-pointer whitespace-nowrap ${
                              treeBranch === b.id
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {b.icon}
                            <span>{b.label}</span>
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={handleResetTreeInline}
                          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded text-[9px] cursor-pointer whitespace-nowrap tabular-nums"
                        >
                          <RotateCcw className="w-3 h-3 shrink-0" />
                          <span>RESET ({soulGems} GEMS)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        {filteredTreeNodes.map(node => {
                          const isMaxed = node.level >= node.maxLevel;
                          const check = skillTreeManager.canUpgrade(node.id);
                          const nextCost = !isMaxed ? node.cost[node.level] : null;

                          return (
                            <div
                              key={node.id}
                              className={`p-3 rounded-lg border-2 flex flex-col justify-between gap-2 ${
                                isMaxed
                                  ? 'border-emerald-600/80 bg-emerald-950/25'
                                  : node.level > 0
                                  ? 'border-indigo-500/80 bg-indigo-950/25'
                                  : 'border-slate-800 bg-slate-900/60'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{node.icon}</span>
                                    <span className="text-[10px] font-bold text-slate-100">{node.name}</span>
                                  </div>
                                  <span className="text-xs font-vt text-indigo-300 tabular-nums">
                                    Lv {node.level}/{node.maxLevel}
                                  </span>
                                </div>
                                <p className="text-sm font-vt text-slate-200 leading-snug">{node.description}</p>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                <span className="text-xs font-vt text-slate-400 uppercase">{node.branch}</span>
                                {isMaxed ? (
                                  <span className="text-[9px] text-emerald-400 font-bold">MAXED</span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!check.can}
                                    onClick={() => handleUpgradeTalentInline(node.id)}
                                    className={`px-2.5 py-1 rounded text-[9px] font-bold border whitespace-nowrap tabular-nums ${
                                      check.can
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 cursor-pointer'
                                        : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                    }`}
                                  >
                                    UPGRADE · {nextCost} GEMS
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MOBILE PORTRAIT BOTTOM BAR (< 640px only): Equipped Loadout Icons + Pick Hero CTA */}
              <div className="sm:hidden shrink-0 px-3 py-2 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-vt overflow-x-auto min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('loadout');
                      handleClickAbilityIcon('normal', inspectedLoadout.normalIndices[0]);
                    }}
                    className="bg-slate-950 border border-sky-600 px-2 py-1 rounded text-sky-300 whitespace-nowrap cursor-pointer"
                  >
                    {hidePcKeyLabels ? chosenNormal1.icon : `[Space] ${chosenNormal1.icon}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('loadout');
                      handleClickAbilityIcon('normal', inspectedLoadout.normalIndices[1]);
                    }}
                    className="bg-slate-950 border border-sky-600 px-2 py-1 rounded text-sky-300 whitespace-nowrap cursor-pointer"
                  >
                    {hidePcKeyLabels ? chosenNormal2.icon : `[E] ${chosenNormal2.icon}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('loadout');
                      handleClickAbilityIcon('ultimate', inspectedLoadout.ultimateIndex);
                    }}
                    className="bg-slate-950 border border-amber-500 px-2 py-1 rounded text-amber-300 whitespace-nowrap cursor-pointer"
                  >
                    {hidePcKeyLabels ? chosenUltimate.icon : `[R] ${chosenUltimate.icon}`}
                  </button>
                </div>

                {isHeroUnlocked ? (
                  <button
                    type="button"
                    onClick={() => handlePickHeroAndWalk(inspectedHero.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg border-2 border-amber-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-[10px] shrink-0 whitespace-nowrap min-h-[38px]"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                    <span>PICK {inspectedHero.name.toUpperCase()}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={soulGems < heroUnlockCost}
                    onClick={() => handleUnlockHero(inspectedHero.id)}
                    className={`px-3.5 py-2 font-bold rounded-lg border-2 flex items-center justify-center gap-1.5 text-[10px] shrink-0 whitespace-nowrap min-h-[38px] tabular-nums ${
                      soulGems >= heroUnlockCost
                        ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 cursor-pointer active:scale-95'
                        : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>UNLOCK · {heroUnlockCost}G</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Portal Entry Confirmation & Difficulty Modal */}
      {showPortalConfirm && (() => {
        const confirmHero: CharacterClass =
          pickedClass && skillTreeManager.isHeroUnlocked(pickedClass) ? pickedClass : 'knight';
        return (
          <PortalConfirmModal
            mode="lobby"
            heroId={confirmHero}
            skills={buildSkillsForHero(confirmHero)}
            difficulty={difficulty}
            onSelectDifficulty={handleSelectDifficulty}
            onConfirm={handleConfirmEnterDungeon}
            onCancel={handleCancelEnterDungeon}
          />
        );
      })()}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            setSoundEnabled(sounds.enabled);
          }}
          onOpenControls={() => setShowControls(true)}
        />
      )}

      {/* Controls Modal */}
      {showControls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="bg-slate-950 border-2 border-sky-500 p-5 rounded-lg max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl">
            <h3 className="text-xs font-bold text-sky-400 mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span>CONTROLS GUIDE</span>
            </h3>
            <div className="space-y-2 text-slate-300 font-vt text-base">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">Click / Tap Hero in House</span>
                <span>Inspect Stats, Skills &amp; Skill Tree</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">WASD / Joystick / Tap Floor</span>
                <span>Walk Around House &amp; Dungeon</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">Walk to North Portal / [F]</span>
                <span>Enter Dungeon Run</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">Left Click / Attack Button</span>
                <span>Attack (Auto-Targets Enemies)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">SPACE / E / R</span>
                <span>Skills 1, 2 &amp; Ultimate</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-amber-300">Q / F / C</span>
                <span>Swap Weapon / Interact / Camp Rest</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowControls(false)}
              className="w-full mt-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[10px] cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* Armory / Codex Modal */}
      {showCodex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border-2 border-amber-500 p-6 rounded-lg max-w-2xl w-full max-h-[82vh] flex flex-col shadow-2xl">
            <h3 className="text-xs font-bold text-amber-400 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>DUNGEON WEAPON CODEX ({Object.keys(WEAPON_REGISTRY).length})</span>
            </h3>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
              {Object.values(WEAPON_REGISTRY).map(w => {
                const rarityColor =
                  w.rarity === 'mythic'
                    ? 'text-red-400 border-red-500 bg-red-950/40'
                    : w.rarity === 'legendary'
                    ? 'text-amber-400 border-amber-500 bg-amber-950/40'
                    : w.rarity === 'epic'
                    ? 'text-purple-400 border-purple-500 bg-purple-950/40'
                    : w.rarity === 'rare'
                    ? 'text-sky-400 border-sky-500 bg-sky-950/40'
                    : 'text-slate-300 border-slate-700 bg-slate-900/60';

                return (
                  <div key={w.id} className={`p-3 border-2 rounded-lg flex flex-col justify-between ${rarityColor}`}>
                    <div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-bold text-slate-100">{w.name}</span>
                        <span className="text-[8px] uppercase tracking-wider font-bold">{w.rarity}</span>
                      </div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-vt">
                        {w.type} {w.isMelee ? '· MELEE DEFLECT' : '· RANGED'}
                      </div>
                      <p className="text-xs text-slate-300 font-vt mb-2">{w.description}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300 font-vt border-t border-slate-800/80 pt-1.5 tabular-nums">
                      <span className="text-red-400">DMG {w.damage}</span>
                      <span className="text-cyan-400">MP {w.energyCost}</span>
                      <span className="text-amber-400">CRIT {Math.round(w.critChance * 100)}%</span>
                      <span className="text-emerald-400">{w.fireRate}/s</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowCodex(false)}
              className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[10px] cursor-pointer"
            >
              CLOSE CODEX
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
