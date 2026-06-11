export type HomeHeroDensity = 'full' | 'compact';

export type TuiShellStatus = 'idle' | 'thinking' | 'happy';

const FULL_BEAR_ART: Record<TuiShellStatus, readonly string[]> = {
  idle: [
    '    ▄▄▄   ▄▄▄',
    '   █▀  ▀█▀  ▀█',
    '  █          █',
    '  █  ●  ω  ●  █',
    '  █▄        ▄█',
    '   █        █',
    '  ▄█        █▄',
    '  ▀▀▀      ▀▀▀',
  ],
  thinking: [
    '    ▄▄▄   ▄▄▄   ?',
    '   █▀  ▀█▀  ▀█  .',
    '  █          █  .',
    '  █  ?  ω  ?  █',
    '  █▄        ▄█',
    '   █        █',
    '  ▄█        █▄',
    '  ▀▀▀      ▀▀▀',
  ],
  happy: [
    '    ▄▄▄   ▄▄▄',
    '   █▀  ▀█▀  ▀█',
    '  █          █',
    '  █  ^  ω  ^  █',
    '  █▄   ♥    ▄█',
    '   █        █',
    '  ▄█        █▄',
    '  ▀▀▀      ▀▀▀   *',
  ],
};

const COMPACT_BEAR_ART: Record<TuiShellStatus, readonly string[]> = {
  idle: [
    ' ▄▄▄ ▄▄▄ ',
    '█ ● ω ● █',
    '█▄     ▄█',
    ' ▀▀   ▀▀ ',
  ],
  thinking: [
    ' ▄▄▄ ▄▄▄ ?',
    '█ ? ω ? █ .',
    '█▄     ▄█ .',
    ' ▀▀   ▀▀ ',
  ],
  happy: [
    ' ▄▄▄ ▄▄▄ ',
    '█ ^ ω ^ █',
    '█▄ ♥   ▄█',
    ' ▀▀   ▀▀ *',
  ],
};

export function getBearArt(
  status: TuiShellStatus,
  density: HomeHeroDensity = 'full',
): string[] {
  const art = density === 'compact' ? COMPACT_BEAR_ART[status] : FULL_BEAR_ART[status];
  return [...art];
}
