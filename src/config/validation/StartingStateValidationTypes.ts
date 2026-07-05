import type { GameConfig } from "~/config/GameConfigTypes";

export type StartingInventoryEntry = GameConfig["startingState"]["inventory"][number];
export type StartingBoardEntry = GameConfig["startingState"]["board"][number];
