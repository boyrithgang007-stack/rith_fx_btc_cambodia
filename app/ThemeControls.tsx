"use client";

import ControlButton from "./ControlButton";

import { type ReactNode, useSyncExternalStore } from "react";
import { readAppTheme, serverAppTheme, subscribeAppTheme, toggleAppTheme } from "./theme-store";

export function useAppTheme() { return useSyncExternalStore(subscribeAppTheme, readAppTheme, serverAppTheme); }
export function ThemeScope({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return <div className={`theme-scope theme-${theme}`}>{children}</div>;
}
export function ThemeModeButton() {
  const theme = useAppTheme();
  const dark = theme === "dark";
  return <ControlButton className="connections-theme-toggle shared-theme-toggle" type="button" onClick={toggleAppTheme}
    aria-label={dark ? "ប្ដូរទៅរបៀបធម្មតា" : "ប្ដូរទៅរបៀបងងឹត"} aria-pressed={dark}>
    <span aria-hidden="true">{dark ? "☼" : "☾"}</span> {dark ? "ធម្មតា" : "ងងឹត"}
  </ControlButton>;
}
