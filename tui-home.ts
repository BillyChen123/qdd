export type TuiVisualState = "idle-home" | "session-log" | "running";

export type HomeLayoutMode = "split" | "stack";

export type { HomeHeroDensity, TuiShellStatus } from "./src/ui/tui-home-art";
import { getBearArt as getSharedBearArt, type HomeHeroDensity, type TuiShellStatus } from "./src/ui/tui-home-art";


export type CompactHeaderLayoutMode = "row" | "column";

const FULL_PANRANK_WORDMARK = [
  "  ██████╗  █████╗ ███╗   ██╗██████╗  █████╗ ███╗   ██╗██╗  ██╗",
  "  ██╔══██╗██╔══██╗████╗  ██║██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝",
  "  ██████╔╝███████║██╔██╗ ██║██████╔╝███████║██╔██╗ ██║█████╔╝ ",
  "  ██╔═══╝ ██╔══██║██║╚██╗██║██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ",
  "  ██║     ██║  ██║██║ ╚████║██║  ██║██║  ██║██║ ╚████║██║  ██╗",
  "  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝",
] as const;

const HERO_SYSTEM_LINES = [
  "PANRANK CLI [Version 1.0.4]",
  "(c) 2026 PanRank Corp. All rights reserved.",
  "",
  "Type /help for a list of commands.",
] as const;

export function getTuiVisualState(input: {
  busy: boolean;
  logCount: number;
}): TuiVisualState {
  if (input.busy) {
    return "running";
  }

  if (input.logCount === 0) {
    return "idle-home";
  }

  return "session-log";
}

export function getHomeLayoutMode(mainWidth: number): HomeLayoutMode {
  return mainWidth >= 92 ? "split" : "stack";
}

export function getHomeHeroDensity(input: {
  mainWidth: number;
  terminalRows: number;
}): HomeHeroDensity {
  // Preserve the branded idle hero as long as the full terminal still has room.
  // The empty message area should collapse before the hero does.
  return input.mainWidth < 60 || input.terminalRows < 20 ? "compact" : "full";
}

export function buildPanRankWordmark(density: HomeHeroDensity = "full"): string[] {
  return density === "compact" ? ["PANRANK"] : [...FULL_PANRANK_WORDMARK];
}

export function getCompactHeaderLayoutMode(mainWidth: number): CompactHeaderLayoutMode {
  return mainWidth >= 72 ? "row" : "column";
}

export function getCompactHeaderReservedRows(mainWidth: number): number {
  return getCompactHeaderLayoutMode(mainWidth) === "row" ? 5 : 8;
}

export function getBearArt(
  status: TuiShellStatus,
  density: HomeHeroDensity = "full",
): string[] {
  return getSharedBearArt(status, density);
}

export function getShellPathLabel(root: string): string {
  return root;
}

export function getHeroSystemLines(): string[] {
  return [...HERO_SYSTEM_LINES];
}
