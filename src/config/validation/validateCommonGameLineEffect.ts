import { z } from "zod";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	validateGameGrantSelector,
	validateGameLineItemSelector,
} from "~/config/validation/GameConfigSelectorValidation";
import type {
	CommonGameLineEffect,
	GameEffectValidationEntities,
} from "~/config/validation/GameConfigEffectValidationTypes";

export const validateCommonGameLineEffect = ({
	ctx,
	effect,
	effectIndex,
	entities,
	path,
}: {
	ctx: z.RefinementCtx;
	effect: CommonGameLineEffect;
	effectIndex: number;
	entities: GameEffectValidationEntities;
	path: GameConfigIssuePath;
}) => {
	if (
		effect.kind === "grant.require" ||
		effect.kind === "grant.blockStart" ||
		effect.kind === "grant.duration.multiply"
	) {
		validateGameGrantSelector(
			ctx,
			[
				...path,
				effectIndex,
				"selector",
			],
			effect.selector,
			entities.grantIds,
		);
	}

	if (
		effect.kind === "nearby.require" ||
		effect.kind === "nearby.duration.multiply" ||
		effect.kind === "nearby.capacity.spend"
	) {
		validateGameLineItemSelector(
			ctx,
			[
				...path,
				effectIndex,
				"items",
			],
			effect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			{
				entityIds: entities.itemIds,
				hasEntity: entities.hasItem,
			},
		);
	}

	if (
		effect.kind === "nearby.duration.multiply" &&
		effect.bands.every((band) => band.multiplier === 1)
	) {
		addIssue(
			ctx,
			[
				...path,
				effectIndex,
				"bands",
			],
			"Nearby duration effect must contain at least one non-1 multiplier band.",
		);
	}
};
