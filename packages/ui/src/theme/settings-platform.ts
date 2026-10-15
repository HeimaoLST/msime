import { useSyncExternalStore } from "react";
import { subscribeMediaQuery } from "../core/media-query";
import { settingsPlatformOf, type SettingsPlatform } from "./platform-tokens";

// The stylesheet's phone breakpoint (`--breakpoint-phone`): an iOS host wider than this is an iPad.
const wideViewport = "(min-width: 601px)";

function subscribeWide(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(wideViewport);
  return subscribeMediaQuery(media, onChange);
}

function wideSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(wideViewport).matches
  );
}

/** The `data-platform` value for the settings root, following the viewport so an iPad split view that narrows to phone width takes the phone look. */
export function useSettingsPlatform(
  host: { platform: string; mobile_settings?: boolean } | undefined,
): SettingsPlatform {
  const wide = useSyncExternalStore(subscribeWide, wideSnapshot, () => false);
  return settingsPlatformOf(host, { wide });
}
