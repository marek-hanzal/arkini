export const boardConfig = {
  width: 7,
  height: 9,
  startingSlots: 63,
} as const;

export const gameConfig = {
  id: "arkini",
  title: "Arkini",
  saveGameVersion: 1,
  board: boardConfig,
} as const;

export type BoardConfig = typeof boardConfig;
export type GameConfig = typeof gameConfig;
