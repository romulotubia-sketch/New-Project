/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CHARACTERS } from '../game/constants';
import { HERO_TALENT_THEMES } from '../game/heroTalentTrees';
import { skillTreeManager } from '../game/skillTree';
import { sounds } from '../game/sound';
import { CharacterClass, SkillTreeNode } from '../game/types';
import {
  Sparkles,
  RotateCcw,
  X,
  Shield,
  Swords,
  Zap,
  Coins,
  Lock,
  ChevronRight,
  Flame,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface SkillTreeModalProps {
  defaultHeroId?: CharacterClass;
  onClose: () => void;
  onTalentUpdated?: () => void;
}

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({
  defaultHeroId,
  onClose,
  onTalentUpdated,
}) => {
  const initialHero = defaultHeroId || skillTreeManager.getActiveHero();
  const [selectedHero, setSelectedHero] = useState<CharacterClass>(initialHero);
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'offensive' | 'defensive' | 'utility' | 'fortune'>('all');
  const [, setRefresh] = useState(0);

  const soulGems = skillTreeManager.getSoulGems();
  const heroConfig = useMemo(() => {
    return CHARACTERS.find(c => c.id === selectedHero) || CHARACTERS[0];
  }, [selectedHero]);

  const heroTheme = HERO_TALENT_THEMES[selectedHero] || HERO_TALENT_THEMES.knight;
  const heroNodes = skillTreeManager.getHeroNodes(selectedHero);
  const heroLevel = skillTreeManager.getHeroLevel(selectedHero);

  const handleSelectHero = (heroId: CharacterClass) => {
    sounds.shoot('pistol');
    setSelectedHero(heroId);
    skillTreeManager.setActiveHero(heroId);
  };

  const handleUpgrade = (nodeId: string) => {
    const success = skillTreeManager.upgradeNode(nodeId, selectedHero);
    if (success) {
      sounds.levelUp();
      setRefresh(r => r + 1);
      if (onTalentUpdated) onTalentUpdated();
    }
  };

  const handleResetCurrentHero = () => {
    const refunded = skillTreeManager.resetHeroTree(selectedHero);
    sounds.coin();
    setRefresh(r => r + 1);
    if (onTalentUpdated) onTalentUpdated();
  };

  const filteredNodes = selectedBranch === 'all'
    ? heroNodes
    : heroNodes.filter(n => n.branch === selectedBranch);

  const branches = [
    { id: 'all', label: 'All Talents', icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" /> },
    { id: 'offensive', label: 'Offensive Spells', icon: <Swords className="w-3.5 h-3.5 text-red-400" /> },
    { id: 'defensive', label: 'Aegis & Ward', icon: <Shield className="w-3.5 h-3.5 text-sky-400" /> },
    { id: 'utility', label: 'Arcane Flow', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'fortune', label: 'Bounty & Relics', icon: <Coins className="w-3.5 h-3.5 text-emerald-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 font-pixel select-none">
      <div className="relative w-full max-w-5xl max-h-[94dvh] bg-[#140e09] border-4 border-[#b45309] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-[#78593a] px-3 py-2 sm:px-5 sm:py-3 bg-[#1d120a] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl">🔮</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-amber-300 font-cinzel tracking-wider">HERO TALENT GRIMOIRES</h2>
                <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded bg-[#2e190d] text-amber-300 border border-[#b45309] font-bold uppercase font-cinzel">
                  Hero Specific
                </span>
              </div>
              <p className="hidden sm:block text-amber-200/70 font-vt text-sm leading-none mt-0.5">
                Each hero commands their own specialized talent path tailored to their combat playstyle!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Soul Gem Counter */}
            <div className="flex items-center gap-1.5 bg-[#2c133a] border-2 border-purple-500/80 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)] tabular-nums font-cinzel">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span className="text-xs font-bold">{soulGems} GEMS</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a] rounded cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
              title="Close Skill Tree"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Selector Tabs Bar (All 12 Heroes) */}
        <div className="flex items-center gap-1.5 border-b border-[#573922] px-3 py-1.5 sm:px-4 sm:py-2 bg-[#19100a] overflow-x-auto shrink-0">
          <span className="text-[8px] text-amber-300/80 font-bold shrink-0 uppercase pr-1 font-cinzel">HERO:</span>
          {CHARACTERS.map(hero => {
            const isSelected = hero.id === selectedHero;
            const isUnlocked = skillTreeManager.isHeroUnlocked(hero.id);
            const level = skillTreeManager.getHeroLevel(hero.id);
            return (
              <button
                key={hero.id}
                type="button"
                onClick={() => handleSelectHero(hero.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[8px] sm:text-[9px] cursor-pointer whitespace-nowrap shrink-0 transition-all font-cinzel ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-md scale-102'
                    : isUnlocked
                    ? 'bg-[#241710] hover:bg-[#342217] text-amber-200 border-[#78593a]'
                    : 'bg-[#150d08]/80 text-amber-900/60 border-[#3d2314]'
                }`}
              >
                <span className="text-xs leading-none">
                  {isUnlocked ? hero.exclusiveBuffs[0].icon : '🔒'}
                </span>
                <span>{hero.name.toUpperCase()}</span>
                <span className={`text-[7px] px-1 rounded ${isSelected ? 'bg-slate-900 text-amber-300' : 'bg-[#140e09] text-amber-400/80'}`}>
                  Lv.{level}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Hero Identity & Playstyle Banner */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 sm:px-5 sm:py-2.5 ${heroTheme.accentBg} shrink-0`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0 p-1 bg-slate-950/70 border border-slate-700 rounded-lg">
              {heroConfig.exclusiveBuffs[0].icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className={`text-xs sm:text-sm font-bold font-cinzel ${heroTheme.themeColor}`}>
                  {heroConfig.name.toUpperCase()} TALENT GRIMOIRE
                </h3>
                <span className="text-xs font-vt text-amber-200/80">
                  {heroConfig.title} (Hero Level {heroLevel})
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] font-vt text-amber-100/80 truncate">
                Combat Way: <span className="text-amber-300 font-bold">{heroTheme.tagline}</span> · Focus: <span className="text-amber-200">{heroTheme.focus}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Reset Hero Tree Button */}
            <button
              onClick={handleResetCurrentHero}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded text-[8px] sm:text-[9px] whitespace-nowrap cursor-pointer shadow-sm font-cinzel"
              title={`Refund all Soul Gems invested into ${heroConfig.name}'s talent tree`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET {heroConfig.name.toUpperCase()} GRIMOIRE</span>
            </button>
          </div>
        </div>

        {/* Branch Filter Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-[#573922] px-3 py-1.5 sm:px-5 sm:py-2 bg-[#19100a] overflow-x-auto shrink-0">
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[8px] sm:text-[9px] whitespace-nowrap shrink-0 cursor-pointer transition-all font-cinzel ${
                selectedBranch === b.id
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-bold border border-amber-300 shadow-md'
                  : 'bg-[#241710] hover:bg-[#342217] text-amber-200 border border-[#78593a]'
              }`}
            >
              {b.icon}
              <span>{b.label}</span>
            </button>
          ))}
        </div>

        {/* Nodes Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
          {filteredNodes.map(node => {
            const isMaxed = node.level >= node.maxLevel;
            const check = skillTreeManager.canUpgrade(node.id, selectedHero);
            const nextCost = !isMaxed ? node.cost[node.level] : null;

            return (
              <div
                key={node.id}
                className={`relative flex flex-col justify-between p-3 rounded-lg border-2 transition-all ${
                  isMaxed
                    ? 'bg-[#2a1b12]/90 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                    : node.level > 0
                    ? 'bg-[#1e130c]/90 border-amber-600/70'
                    : check.can
                    ? 'bg-[#18100a]/80 border-[#78593a] hover:border-amber-400'
                    : 'bg-[#120b07]/80 border-[#3d2314] opacity-75'
                }`}
              >
                {/* Node Top Row: Icon + Name + Branch Badge */}
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg text-lg sm:text-xl shrink-0 flex items-center justify-center border ${
                    isMaxed
                      ? 'bg-amber-500/20 border-amber-400/80'
                      : node.level > 0
                      ? 'bg-amber-600/20 border-amber-500/80'
                      : 'bg-[#241710] border-[#78593a]'
                  }`}>
                    {node.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <h4 className={`text-[10px] sm:text-xs font-bold leading-tight font-cinzel ${
                        isMaxed ? 'text-amber-300' : 'text-amber-100'
                      }`}>
                        {node.name}
                      </h4>
                      <span className={`text-[7px] uppercase px-1.5 py-0.5 rounded font-bold border font-cinzel ${
                        node.branch === 'offensive'
                          ? 'bg-red-950/70 text-red-300 border-red-800'
                          : node.branch === 'defensive'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-800'
                          : node.branch === 'utility'
                          ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                      }`}>
                        {node.branch}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs font-vt text-amber-150/90 leading-snug mt-1 text-amber-100/85">
                      {node.description}
                    </p>
                  </div>
                </div>

                {/* Level Progress Indicator */}
                <div className="mt-2.5 pt-2 border-t border-[#3d2314] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-amber-300/70 font-bold uppercase font-cinzel">Rank:</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: node.maxLevel }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-4 h-2 rounded-xs border ${
                            idx < node.level
                              ? 'bg-amber-400 border-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                              : 'bg-[#241710] border-[#573922]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[8px] text-amber-300/70 ml-1">
                      ({node.level}/{node.maxLevel})
                    </span>
                  </div>

                  {/* Upgrade / Max Button */}
                  <div>
                    {isMaxed ? (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500 px-2 py-1 rounded font-cinzel">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>MAXED</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgrade(node.id)}
                        disabled={!check.can}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-[8px] sm:text-[9px] font-bold cursor-pointer transition-all border font-cinzel ${
                          check.can
                            ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-amber-100 border-amber-300 shadow-md active:scale-95'
                            : 'bg-[#241710] text-amber-900 border-[#573922] cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>UPGRADE ({nextCost} GEMS)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Prerequisite or Gem Warning */}
                {!isMaxed && !check.can && check.reason && (
                  <div className="mt-1 flex items-center gap-1 text-[8px] font-vt text-amber-400/90 leading-tight">
                    <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                    <span>{check.reason}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="border-t border-[#573922] px-3 py-2 sm:px-5 sm:py-2.5 bg-[#19100a] flex items-center justify-between text-[8px] sm:text-[9px] text-amber-300/70 shrink-0 font-cinzel">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-amber-300 font-bold">LORE:</span>
            <span className="truncate font-vt text-xs text-amber-200/80">
              Talents are inscribed into {heroConfig.name}'s soul and empower them throughout the catacombs!
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-vt text-xs text-amber-200/80">
              Talents Inscribed: <span className="text-amber-300 font-bold">{heroNodes.filter(n => n.level > 0).length}/{heroNodes.length}</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
