/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

export interface GameSettings {
  hidePcKeyLabels: boolean;
  joystickScale: number; // 0.75 to 1.40, default 1.0
  skillButtonsScale: number; // 0.75 to 1.40, default 1.0
  screenDragEnabled: boolean; // default true
  screenDragSensitivity: number; // 0.4 to 2.5, default 1.0
}

const STORAGE_KEY = 'soul_knight_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  hidePcKeyLabels: false,
  joystickScale: 1.0,
  skillButtonsScale: 1.0,
  screenDragEnabled: true,
  screenDragSensitivity: 1.0,
};

type SettingsListener = (settings: GameSettings) => void;

class GameSettingsManager {
  private state: GameSettings;
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    this.state = this.load();
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);

      const clampNum = (val: unknown, fallback: number, min: number, max: number): number => {
        if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
        return Math.max(min, Math.min(max, val));
      };

      return {
        hidePcKeyLabels: Boolean(parsed?.hidePcKeyLabels),
        joystickScale: clampNum(parsed?.joystickScale, 1.0, 0.7, 1.5),
        skillButtonsScale: clampNum(parsed?.skillButtonsScale, 1.0, 0.7, 1.5),
        screenDragEnabled:
          parsed?.screenDragEnabled !== undefined ? Boolean(parsed.screenDragEnabled) : true,
        screenDragSensitivity: clampNum(parsed?.screenDragSensitivity, 1.0, 0.3, 3.0),
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
  }

  public get(): GameSettings {
    return this.state;
  }

  public update(patch: Partial<GameSettings>) {
    this.state = { ...this.state, ...patch };
    this.save();
    this.listeners.forEach(listener => listener(this.state));
  }

  public toggleHidePcKeyLabels(): boolean {
    const next = !this.state.hidePcKeyLabels;
    this.update({ hidePcKeyLabels: next });
    return next;
  }

  public setJoystickScale(scale: number) {
    const clamped = Math.max(0.7, Math.min(1.5, Math.round(scale * 100) / 100));
    this.update({ joystickScale: clamped });
  }

  public setSkillButtonsScale(scale: number) {
    const clamped = Math.max(0.7, Math.min(1.5, Math.round(scale * 100) / 100));
    this.update({ skillButtonsScale: clamped });
  }

  public setScreenDragSensitivity(sens: number) {
    const clamped = Math.max(0.3, Math.min(3.0, Math.round(sens * 10) / 10));
    this.update({ screenDragSensitivity: clamped });
  }

  public toggleScreenDragEnabled(): boolean {
    const next = !this.state.screenDragEnabled;
    this.update({ screenDragEnabled: next });
    return next;
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const gameSettings = new GameSettingsManager();

export function useGameSettings(): GameSettings {
  const [settings, setSettings] = useState<GameSettings>(() => gameSettings.get());

  useEffect(() => {
    return gameSettings.subscribe(next => {
      setSettings(next);
    });
  }, []);

  return settings;
}

/**
 * Formats interaction prompts dynamically so PC keybind hints like [F] or "Press F"
 * are cleanly removed whenever hidePcKeyLabels is enabled.
 */
export function formatInteractPrompt(prompt: string | null, hidePcKeyLabels: boolean): string | null {
  if (!prompt) return null;
  if (!hidePcKeyLabels) return prompt;

  return prompt
    .replace(/TAP OR \[F\] TO /gi, 'TAP TO ')
    .replace(/^Press F to /i, 'Tap to ')
    .replace(/\s*\[[A-Z0-9 /+]+\]/gi, '')
    .trim();
}
