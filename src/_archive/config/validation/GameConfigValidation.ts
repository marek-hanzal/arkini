import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	createRecordGuard,
	type GameConfigValidationContext,
} from "~/config/validation/GameConfigValidationCommon";
import { readGameEffectGrantIds } from "~/config/validation/GameConfigValidationReaders";
import { validateBlueprintDependencyCycles } from "~/config/validation/validateBlueprintDependencyCycles";
import { validateConfigDefinitionReferences } from "~/config/validation/validateGameConfigDefinitionReferences";
import { validateConfigEffects } from "~/config/validation/GameConfigEffectValidation";
import { validateGameplaySoftLockRisks } from "~/config/validation/validateGameplaySoftLockRisks";
import { validateStartingState } from "~/config/validation/validateGameConfigStartingState";
import { validateQuestItems } from "~/config/validation/validateQuestItems";

export const validateGameConfig = (config: GameConfig, ctx: z.RefinementCtx) => {
	const context = createGameConfigValidationContext(config, ctx);

	validateConfigDefinitionReferences(context);
	validateConfigEffects(ctx, config);
	validateBlueprintDependencyCycles(ctx, config);
	validateGameplaySoftLockRisks(ctx, config);
	validateQuestItems(ctx, config);
	validateStartingState(context);
};

const createGameConfigValidationContext = (
	config: GameConfig,
	ctx: z.RefinementCtx,
): GameConfigValidationContext => ({
	config,
	ctx,
	grantIds: readGameEffectGrantIds(config),
	hasAsset: createRecordGuard(config.assets),
	hasItem: createRecordGuard(config.items),
	hasResource: createRecordGuard(config.resources),
	itemIds: Object.keys(config.items),
});
