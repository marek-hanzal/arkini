import { GameConfig } from "~/manifest/GameConfig";
import { createGameConfigService } from "~/manifest/logic/createGameConfigService";

export const GameConfigServiceLive = createGameConfigService(GameConfig);
