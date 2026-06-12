import { createGameDataIndex } from "./createGameDataIndex";
import { GameConfig } from "./GameConfig";

export const gameDataIndex = createGameDataIndex(GameConfig);

export namespace gameDataIndex {
  export type Value = ReturnType<typeof createGameDataIndex>;
}
