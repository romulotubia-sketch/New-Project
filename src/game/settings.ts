/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

export interface GameSettings {
  hidePcKeyLabels: boolean;
}

const STORAGE_KEY = 'soul_knight_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  hidePcKeyLabels: false,
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
      return {
        hidePcKeyLabels: Boolean(parsed?.hidePcKeyLabels),
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
