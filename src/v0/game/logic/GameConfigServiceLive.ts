import { GameConfig } from "~/v0/manifest/GameConfig";
import { createGameConfigService } from "~/v0/game/logic/createGameConfigService";

export const GameConfigServiceLive = createGameConfigService(GameConfig);
