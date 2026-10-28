/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, PlusSquare, Maximize2, Minimize2, Smartphone, X, FileDown, Copy, Check } from 'lucide-react';
import { usePWAInstall, useLandscapeAppMode } from '../hooks/usePWAInstall';

declare global {
  interface Window {
    __SOUL_ROGUE_STANDALONE__?: boolean;
  }
}

export const isStandaloneHtmlBuild = (): boolean =>
  typeof window !== 'undefined' &&
  (Boolean(window.__SOUL_ROGUE_STANDALONE__) || window.location.protocol === 'file:');

interface PWAInstallButtonProps {
  compact?: boolean;
  fullWidth?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  fullWidth = false,
}) => {
  const { isIOS, isInIframe, isInstalled, showGuide, setShowGuide, promptInstall } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const standaloneFile = isStandaloneHtmlBuild();

  useEffect(() => {
    if (!showGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, setShowGuide]);

  if (isInstalled || standaloneFile) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    if (!appUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          promptInstall();
        }}
        className={`flex items-center justify-center gap-1.5 bg-emerald-950/90 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-200 rounded cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
          fullWidth
            ? 'w-full py-2.5 px-4 text-[10px] font-bold'
            : compact
            ? 'px-2 py-1.5 text-[9px] font-bold min-h-[36px]'
            : 'px-3 py-2 text-[10px] font-bold min-h-[38px]'
        }`}
        title="Install Landscape App or Download Offline Game"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>INSTALL APP</span>
      </button>

      {showGuide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-modal-title"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md safe-hud p-3 sm:p-4 font-pixel select-none"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#0b0e17] border-2 border-emerald-400 rounded-xl p-4 sm:p-5 shadow-[0_0_60px_rgba(0,0,0,0.95)] text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
                <div
                  id="pwa-install-modal-title"
                  className="flex items-center gap-2 text-emerald-400 text-[11px] sm:text-xs font-bold"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>INSTALL OR DOWNLOAD GAME</span>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer transition-colors"
                  aria-label="Close install instructions"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Direct Offline File Download */}
              <div className="mb-3 p-3 bg-amber-950/35 border border-amber-500/70 rounded-lg">
                <div className="text-[10px] font-bold text-amber-300 mb-1">
                  DIRECT OFFLINE GAME FILE
                </div>
                <p className="text-slate-200 font-vt text-base leading-snug mb-2.5">
                  Download a single self-contained HTML5 game file that runs offline in any mobile or PC browser:
                </p>
                <a
                  href="/Soul-Rogue.html"
                  download="Soul-Rogue.html"
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center justify-center gap-2 transition-colors no-underline"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>DOWNLOAD SOUL-ROGUE.HTML</span>
                </a>
              </div>

              <p className="text-slate-200 font-vt text-base sm:text-lg leading-snug mb-2">
                Or install <span className="text-amber-300 font-bold">Soul Rogue</span> as a{' '}
                <span className="text-emerald-300 font-bold">Home Screen App</span>:
              </p>

              {appUrl && (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 mb-2.5">
                  <span className="font-vt text-sm sm:text-base text-sky-300 truncate flex-1 select-all">
                    {appUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[9px] text-slate-100 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-300" />}
                    <span>{copiedUrl ? 'COPIED' : 'COPY LINK'}</span>
                  </button>
                </div>
              )}

              {isIOS ? (
                <ol className="space-y-2 text-slate-100 font-vt text-base sm:text-lg bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-3.5">
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-pixel text-[10px] mt-1 shrink-0">1.</span>
                    <span>
                      Open the link above in Safari and tap <Share className="inline w-4 h-4 text-sky-400 mx-0.5" />{' '}
                      <strong className="text-sky-300">Share</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-pixel text-[10px] mt-1 shrink-0">2.</span>
                    <span>
                      Tap <PlusSquare className="inline w-4 h-4 text-emerald-400 mx-0.5" />{' '}
                      <strong className="text-emerald-300">Add to Home Screen</strong>.
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2 text-slate-100 font-vt text-base sm:text-lg bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-3.5">
                  {isInIframe && (
                    <li className="flex items-start gap-2.5">
                      <span className="text-amber-400 font-pixel text-[10px] mt-1 shrink-0">1.</span>
                      <span>
                        Open the copied link in Chrome, Edge, or your phone browser outside this preview frame.
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-pixel text-[10px] mt-1 shrink-0">{isInIframe ? '2.' : '1.'}</span>
                    <span>
                      Tap <strong className="text-emerald-300">INSTALL APP</strong> or browser menu (<strong className="text-sky-300">⋮</strong>) &rarr; <strong className="text-emerald-300">Install App / Add to Home Screen</strong>.
                    </span>
                  </li>
                </ol>
              )}

              <button
                onClick={() => setShowGuide(false)}
                className="w-full mt-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer transition-colors"
              >
                GOT IT
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

interface LandscapeModeButtonProps {
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export const LandscapeModeButton: React.FC<LandscapeModeButtonProps> = ({
  iconOnly = false,
  fullWidth = false,
}) => {
  const { isFullscreen, toggleLandscapeFullscreen } = useLandscapeAppMode();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleLandscapeFullscreen();
      }}
      className={`flex items-center justify-center gap-1.5 bg-sky-950/85 hover:bg-sky-900 border border-sky-500/80 text-sky-200 rounded cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
        fullWidth
          ? 'w-full py-2.5 px-4 text-[10px] font-bold'
          : iconOnly
          ? 'p-1.5 min-w-[34px] min-h-[34px]'
          : 'px-3 py-2 text-[10px] min-h-[38px]'
      }`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen & Lock Landscape'}
    >
      {isFullscreen ? (
        <Minimize2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
      ) : (
        <Maximize2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
      )}
      {!iconOnly && <span>{isFullscreen ? 'EXIT FULL' : 'LANDSCAPE'}</span>}
    </button>
  );
};
