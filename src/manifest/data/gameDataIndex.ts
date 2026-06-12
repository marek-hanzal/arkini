import { createGameDataIndex } from "./createGameDataIndex";
import { gameDataManifest } from "./gameDataManifest";

export const gameDataIndex = createGameDataIndex(gameDataManifest);

export namespace gameDataIndex {
  export type Value = ReturnType<typeof createGameDataIndex>;
}
