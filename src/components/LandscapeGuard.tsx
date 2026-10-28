/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, Maximize2, WifiOff, Play } from 'lucide-react';
import { useLandscapeAppMode } from '../hooks/usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

export const LandscapeGuard: React.FC = () => {
  const { isPortraitMobile, isOnline, toggleLandscapeFullscreen } = useLandscapeAppMode();
  const [dismissedPortrait, setDismissedPortrait] = useState(false);

  // Reset dismissal whenever the user rotates into landscape so rotating back to portrait helps them again
  useEffect(() => {
    if (!isPortraitMobile) {
      setDismissedPortrait(false);
    }
  }, [isPortraitMobile]);

  return (
    <>
      {/* Subtle Offline Status Banner */}
      {!isOnline && (
        <div className="fixed top-1.5 left-1/2 -translate-x-1/2 z-[65] pointer-events-none flex items-center gap-1.5 bg-amber-950/95 border border-amber-500/80 text-amber-200 px-3 py-1 rounded text-[9px] shadow-lg whitespace-nowrap">
          <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
          <span>OFFLINE MODE · PROGRESS SAVED</span>
        </div>
      )}

      {/* Portrait-to-Landscape Helper Overlay on Mobile/Touch Portrait Viewports */}
      {isPortraitMobile && !dismissedPortrait && (
        <div className="fixed inset-0 z-[60] bg-[#090a10]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center font-pixel select-none">
          <div className="w-full max-w-sm bg-slate-950 border-2 border-sky-500 rounded-xl p-6 shadow-2xl flex flex-col items-center">
            {/* Animated Phone Rotation Visual */}
            <div className="relative w-20 h-20 rounded-2xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center mb-4">
              <Smartphone className="w-10 h-10 text-sky-400 -rotate-90 transition-transform duration-300" />
            </div>

            <h2 className="text-xs sm:text-sm font-bold text-amber-400 mb-2">
              ROTATE TO LANDSCAPE
            </h2>

            <p className="text-slate-300 font-vt text-lg leading-snug mb-5">
              Soul Rogue is built for widescreen horizontal dungeon combat with dual-thumb joystick &amp; 3-skill controls.
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  await toggleLandscapeFullscreen();
                  setDismissedPortrait(true);
                }}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <Maximize2 className="w-4 h-4 shrink-0" />
                <span>ENTER LANDSCAPE FULLSCREEN</span>
              </button>

              <PWAInstallButton fullWidth />

              <button
                onClick={() => setDismissedPortrait(true)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span>CONTINUE IN CURRENT VIEW</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
