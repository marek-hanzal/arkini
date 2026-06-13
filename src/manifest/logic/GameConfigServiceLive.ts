import { GameConfig } from "~/manifest/data/GameConfig";
import { createGameConfigService } from "~/manifest/logic/createGameConfigService";

export const GameConfigServiceLive = createGameConfigService(GameConfig);
