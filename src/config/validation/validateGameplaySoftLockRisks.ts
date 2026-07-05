import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameplaySoftLockSources } from "~/config/validation/createGameplaySoftLockSources";
import { readGameplaySoftLockReachability } from "~/config/validation/readGameplaySoftLockReachability";
import {
	validateGrantRequirementBlockerContradictions,
	validateGrantRequirementsHavePossibleSource,
	validateNearbyRequirementsHaveBoardSource,
} from "~/config/validation/validateGameplaySoftLockRequirementRisks";
import { validateProducerGameplayReachability } from "~/config/validation/validateProducerGameplayReachability";

export const validateGameplaySoftLockRisks = (ctx: z.RefinementCtx, config: GameConfig) => {
	const sources = createGameplaySoftLockSources(config);
	const reachability = readGameplaySoftLockReachability(config, sources);

	validateNearbyRequirementsHaveBoardSource(ctx, config);
	validateGrantRequirementsHavePossibleSource(ctx, config, sources);
	validateGrantRequirementBlockerContradictions(ctx, config);
	validateProducerGameplayReachability(ctx, config, sources, reachability);
};
