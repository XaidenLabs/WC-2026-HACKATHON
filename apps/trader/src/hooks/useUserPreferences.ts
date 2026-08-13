"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PREFERENCES, normalisePreferences, profileStorageKey, type UserPreferences } from "@/lib/profile/preferences";

export function useUserPreferences(userId: string | null) {
  const storageKey = useMemo(() => profileStorageKey(userId), [userId]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const task = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        setPreferences(normalisePreferences(saved ? JSON.parse(saved) : null));
      } catch {
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, [storageKey]);

  function save(next: UserPreferences) {
    const value = normalisePreferences(next);
    setPreferences(value);
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  }

  function patch(update: Partial<UserPreferences>) {
    save(normalisePreferences({ ...preferences, ...update }));
  }

  return { preferences, loaded, save, patch };
}
