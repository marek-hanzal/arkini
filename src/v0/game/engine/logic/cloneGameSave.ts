import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const cloneGameSave = (save: GameSave): GameSave => structuredClone(save);
