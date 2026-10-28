/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { skillTreeManager } from '../game/skillTree';
import { sounds } from '../game/sound';
import { Sparkles, RotateCcw, X, Shield, Swords, Zap, Coins } from 'lucide-react';
import { SkillTreeNode } from '../game/types';

interface SkillTreeModalProps {
  onClose: () => void;
  onTalentUpdated?: () => void;
}

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({ onClose, onTalentUpdated }) => {
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'offensive' | 'defensive' | 'utility' | 'fortune'>('all');
  const [, setRefresh] = useState(0);

  const soulGems = skillTreeManager.getSoulGems();
  const allNodes = skillTreeManager.getNodes();

  const handleUpgrade = (nodeId: string) => {
    const success = skillTreeManager.upgradeNode(nodeId);
    if (success) {
      sounds.levelUp();
      setRefresh(r => r + 1);
      if (onTalentUpdated) onTalentUpdated();
    }
  };

  const handleReset = () => {
    const refunded = skillTreeManager.resetTree();
    sounds.coin();
    setRefresh(r => r + 1);
    if (onTalentUpdated) onTalentUpdated();
  };

  const filteredNodes = selectedBranch === 'all'
    ? allNodes
    : allNodes.filter(n => n.branch === selectedBranch);

  const branches = [
    { id: 'all', label: 'All Talents', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'offensive', label: 'Offensive', icon: <Swords className="w-4 h-4 text-red-400" /> },
    { id: 'defensive', label: 'Defensive', icon: <Shield className="w-4 h-4 text-sky-400" /> },
    { id: 'utility', label: 'Utility & Flow', icon: <Zap className="w-4 h-4 text-amber-400" /> },
    { id: 'fortune', label: 'Fortune & Loot', icon: <Coins className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2.5 sm:p-4 font-pixel select-none">
      <div className="relative w-full max-w-4xl max-h-[92dvh] bg-slate-950 border-4 border-indigo-600 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-indigo-900 px-4 py-2.5 lg:px-6 lg:py-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl lg:text-2xl">🔮</span>
            <div>
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-indigo-300">HERO TALENT TREE</h2>
              <p className="hidden sm:block text-slate-400 font-vt text-sm leading-none mt-0.5">
                Unlock persistent passives that empower every hero across all runs!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 lg:gap-4 shrink-0">
            {/* Soul Gem Counter */}
            <div className="flex items-center gap-1.5 bg-purple-950/80 border-2 border-purple-500 px-2.5 py-1 lg:px-3 lg:py-1.5 rounded-lg text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)] tabular-nums">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span className="text-xs font-bold">{soulGems} GEMS</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 lg:px-6 bg-slate-900/50 overflow-x-auto shrink-0">
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] lg:text-[10px] whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                selectedBranch === b.id
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              {b.icon}
              <span>{b.label}</span>
            </button>
          ))}

          {/* Reset / Refund Button */}
          <button
            onClick={handleReset}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded text-[9px] whitespace-nowrap shrink-0 cursor-pointer"
            title="Reset all talents and refund all Soul Gems"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET TREE</span>
          </button>
        </div>

        {/* Nodes Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
          {filteredNodes.map(node => {
            const isMaxed = node.level >= node.maxLevel;
            const check = skillTreeManager.canUpgrade(node.id);
            const nextCost = !isMaxed ? node.cost[node.level] : null;

            return (
              <div
                key={node.id}
                className={`relative flex flex-col justify-between p-4 rounded-lg border-2 transition-all ${
                  isMaxed
                    ? 'border-emerald-600/80 bg-emerald-950/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : node.level > 0
                    ? 'border-indigo-500/80 bg-indigo-950/30'
                    : check.can
                    ? 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                    : 'border-slate-800 bg-slate-900/20 opacity-70'
                }`}
              >
                {/* Node Title & Icon */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-1.5 bg-slate-900 border border-slate-700 rounded-md">
                      {node.icon}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">{node.name}</h3>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">
                        {node.branch}
                      </span>
                    </div>
                  </div>

                  {/* Level Pips */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded">
                    {Array.from({ length: node.maxLevel }).map((_, i) => (
                      <div
                        key={`pip_${i}`}
                        className={`w-2.5 h-2.5 rounded-xs border border-black ${
                          i < node.level
                            ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                            : 'bg-slate-700'
                        }`}
                      />
                    ))}
                    <span className="text-[9px] text-amber-300 ml-1 font-vt">
                      {node.level}/{node.maxLevel}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[10px] text-slate-300 font-vt text-sm leading-relaxed mb-4">
                  {node.description}
                </p>

                {/* Footer: Prerequisite & Upgrade Action */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/80">
                  {!check.can && check.reason && !isMaxed ? (
                    <span className="text-[8px] text-rose-400 font-vt">{check.reason}</span>
                  ) : isMaxed ? (
                    <span className="text-[9px] text-emerald-400 font-bold">MAX LEVEL REACHED</span>
                  ) : (
                    <span className="text-[9px] text-purple-300 flex items-center gap-1 font-bold">
                      <Sparkles className="w-3 h-3" />
                      <span>{nextCost} GEMS</span>
                    </span>
                  )}

                  {!isMaxed && (
                    <button
                      onClick={() => handleUpgrade(node.id)}
                      disabled={!check.can}
                      className={`px-3 py-1.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        check.can
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      UPGRADE
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="border-t border-indigo-900/60 px-6 py-2.5 bg-slate-900/80 flex items-center justify-between text-[9px] text-slate-400 font-vt">
          <span>Soul Gems drop from slain monsters, bosses, and treasure chests.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[9px] cursor-pointer"
          >
            RESUME DUNGEON
          </button>
        </div>

      </div>
    </div>
  );
};
