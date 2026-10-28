/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { GameEngine } from './game/gameEngine';
import { CHARACTERS } from './game/constants';
import { CharacterClass, DifficultyId, Skill } from './game/types';
import { LobbyScreen } from './components/LobbyScreen';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { SkillTreeModal } from './components/SkillTreeModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import { PortalConfirmModal } from './components/PortalConfirmModal';
import { MobileControls } from './components/MobileControls';
import { LandscapeGuard } from './components/LandscapeGuard';
import { skillTreeManager } from './game/skillTree';
import { sounds } from './game/sound';

export default function App() {
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<
    'none' | 'revive' | 'gameover' | 'victory' | 'portal'
  >('none');

  // Lightweight state check for death/revive, portal confirmation, and victory modal transitions
  useEffect(() => {
    if (gameState !== 'playing' || !engine) return;

    const interval = setInterval(() => {
      const next: 'none' | 'revive' | 'gameover' | 'victory' | 'portal' = engine.isVictory
        ? 'victory'
        : engine.isGameOver
        ? 'gameover'
        : engine.isAwaitingRevive
        ? 'revive'
        : engine.isAwaitingPortalConfirm
        ? 'portal'
        : 'none';

      setActiveOverlay(prev => (prev === next ? prev : next));
    }, 80);

    return () => clearInterval(interval);
  }, [gameState, engine]);

  const handleStartGame = useCallback(
    (characterId: CharacterClass, selectedSkills?: Skill[], difficulty?: DifficultyId) => {
      const chosenDifficulty = difficulty || skillTreeManager.getDifficulty();
      const newEngine = new GameEngine(characterId, selectedSkills, chosenDifficulty);
      setEngine(newEngine);
      setActiveOverlay('none');
      setGameState('playing');
      setIsPaused(false);
    },
    []
  );

  const handleReturnToLobby = useCallback(() => {
    engine?.claimEndOfRunRewards(false);
    sounds.stopChiptune();
    setEngine(null);
    setActiveOverlay('none');
    setGameState('lobby');
    setIsPaused(false);
  }, [engine]);

  const handleRevived = useCallback(() => {
    setActiveOverlay('none');
  }, []);

  const handleConfirmDungeonPortal = useCallback(() => {
    if (!engine) return;
    engine.confirmEnterPortal();
    setActiveOverlay(engine.isVictory ? 'victory' : 'none');
  }, [engine]);

  const handleCancelDungeonPortal = useCallback(() => {
    if (!engine) return;
    engine.cancelEnterPortal();
    setActiveOverlay('none');
  }, [engine]);

  const handleOpenSkillTree = useCallback(() => {
    setShowSkillTree(true);
  }, []);

  const handleCloseSkillTree = useCallback(() => {
    setShowSkillTree(false);
  }, []);

  const handlePause = useCallback(() => {
    if (!engine) return;
    engine.isPaused = true;
    setIsPaused(true);
  }, [engine]);

  const handleResume = useCallback(() => {
    if (engine) engine.isPaused = false;
    setIsPaused(false);
  }, [engine]);

  const handleSwitchWeapon = useCallback(() => {
    engine?.switchWeapon();
  }, [engine]);

  const handleTalentUpdated = useCallback(() => {
    if (engine) {
      engine.player.soulGems = skillTreeManager.getSoulGems();
      const buffs = skillTreeManager.calculatePassiveBuffs(engine.player.classId);
      const hpDiff = buffs.bonusMaxHp - engine.passiveBuffs.bonusMaxHp;
      const shieldDiff = buffs.bonusMaxShield - engine.passiveBuffs.bonusMaxShield;
      const energyDiff = buffs.bonusMaxEnergy - engine.passiveBuffs.bonusMaxEnergy;

      engine.passiveBuffs = buffs;
      const cfg = CHARACTERS.find(c => c.id === engine.player.classId);
      const ultCrit = engine.player.skills.find(s => s.isUltimate)?.bonusCrit || 0;
      const exclCrit = engine.player.exclusiveBuffs.reduce((sum, b) => sum + (b.bonusCrit || 0), 0);
      engine.applyHeroInnatePassiveFlags((cfg?.critBonus || 0) + ultCrit + exclCrit);

      if (hpDiff > 0) {
        engine.player.maxHp += hpDiff;
        engine.player.hp += hpDiff;
      }
      if (shieldDiff > 0) {
        engine.player.maxShield += shieldDiff;
        engine.player.shield += shieldDiff;
      }
      if (energyDiff > 0) {
        engine.player.maxEnergy += energyDiff;
        engine.player.energy += energyDiff;
      }
    }
  }, [engine]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#090a10] font-pixel text-slate-100 game-touch-lock">
      <LandscapeGuard />

      {gameState === 'lobby' && (
        <LobbyScreen
          onStartGame={handleStartGame}
          onOpenSkillTree={handleOpenSkillTree}
        />
      )}

      {gameState === 'playing' && engine && (
        <div className="relative w-full h-full">
          {/* Canvas Engine */}
          <GameCanvas
            engine={engine}
            onOpenSkillTree={handleOpenSkillTree}
            onPause={handlePause}
          />

          {/* Soul Knight Style HUD */}
          <HUD
            engine={engine}
            onOpenSkillTree={handleOpenSkillTree}
            onPause={handlePause}
            onSwitchWeapon={handleSwitchWeapon}
          />

          {/* On-screen Touch Controls for mobile */}
          <MobileControls engine={engine} />

          {/* Modals during play */}
          {isPaused && (
            <PauseModal
              engine={engine}
              onResume={handleResume}
              onOpenSkillTree={handleOpenSkillTree}
              onReturnToLobby={handleReturnToLobby}
            />
          )}

          {(activeOverlay === 'portal' || engine.isAwaitingPortalConfirm) && (
            <PortalConfirmModal
              mode="dungeon"
              currentFloor={engine.floor.floorNumber}
              difficulty={engine.difficulty}
              onConfirm={handleConfirmDungeonPortal}
              onCancel={handleCancelDungeonPortal}
            />
          )}

          {(activeOverlay === 'revive' ||
            activeOverlay === 'gameover' ||
            engine.isAwaitingRevive ||
            engine.isGameOver) && (
            <GameOverModal
              engine={engine}
              onRevived={handleRevived}
              onReturnToLobby={handleReturnToLobby}
            />
          )}

          {(activeOverlay === 'victory' || engine.isVictory) && (
            <VictoryModal
              engine={engine}
              onReturnToLobby={handleReturnToLobby}
              onOpenSkillTree={handleOpenSkillTree}
            />
          )}
        </div>
      )}

      {/* Persistent Skill Tree Modal (accessible in both Lobby & Game) */}
      {showSkillTree && (
        <SkillTreeModal
          defaultHeroId={engine?.player.classId || skillTreeManager.getActiveHero()}
          onClose={handleCloseSkillTree}
          onTalentUpdated={handleTalentUpdated}
        />
      )}
    </div>
  );
}
