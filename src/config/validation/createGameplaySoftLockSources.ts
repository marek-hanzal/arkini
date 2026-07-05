import type { GameConfig } from "~/config/GameConfigTypes";
import { createCraftGameplaySources } from "~/config/validation/createCraftGameplaySources";
import { createLineGameplaySources } from "~/config/validation/createLineGameplaySources";
import { createMergeGameplaySources } from "~/config/validation/createMergeGameplaySources";
import { createPassiveGrantGameplaySources } from "~/config/validation/createPassiveGrantGameplaySources";
import { createRemovalGameplaySources } from "~/config/validation/createRemovalGameplaySources";
import { createStartingGameplaySources } from "~/config/validation/createStartingGameplaySources";

export const createGameplaySoftLockSources = (config: GameConfig) => [
	...createStartingGameplaySources(config),
	...createPassiveGrantGameplaySources(config),
	...createMergeGameplaySources(config),
	...createRemovalGameplaySources(config),
	...createCraftGameplaySources(config),
	...createLineGameplaySources(config),
];
