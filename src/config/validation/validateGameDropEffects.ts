import { match, P } from "ts-pattern";
import { z } from "zod";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	validateGameGrantSelector,
	validateGameLineItemSelector,
} from "~/config/validation/GameConfigSelectorValidation";
import type {
	CommonGameLineEffect,
	GameDropEffect,
	GameDropEffectValidationProps,
	GameEffectValidationEntities,
} from "~/config/validation/GameConfigEffectValidationTypes";
import { validateCommonGameLineEffect } from "~/config/validation/validateCommonGameLineEffect";

const addDropCapacitySpendIssue = ({
	ctx,
	effectIndex,
	path,
}: Pick<GameDropEffectValidationProps, "ctx" | "effectIndex" | "path">) => {
	addIssue(
		ctx,
		[
			...path,
			effectIndex,
			"kind",
		],
		"nearby.capacity.spend must be authored on the producer line, not on a concrete output entry.",
	);
};

const validateDropGrantSelectorEffect = ({
	ctx,
	effect,
	effectIndex,
	entities,
	path,
}: GameDropEffectValidationProps & {
	effect: Extract<
		GameDropEffect,
		{
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
		}
	>;
}) => {
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
};

const validateNearbyLootOutputChanceEffect = ({
	ctx,
	effect,
	effectIndex,
	entities,
	path,
}: GameDropEffectValidationProps & {
	effect: Extract<
		GameDropEffect,
		{
			kind: "nearby.loot.outputChance.add";
		}
	>;
}) => {
	for (const [sourceIndex, source] of effect.sources.entries()) {
		validateGameLineItemSelector(
			ctx,
			[
				...path,
				effectIndex,
				"sources",
				sourceIndex,
				"items",
			],
			source.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			{
				entityIds: entities.itemIds,
				hasEntity: entities.hasItem,
			},
		);
	}
};

const GrantDropEffectKindPattern = P.union(
	"grant.drop.hide",
	"grant.drop.show",
	"grant.drop.disable",
	"grant.drop.enable",
	"grant.loot.extraOutputChance.add",
);

const isCommonGameLineEffect = (effect: GameDropEffect): effect is CommonGameLineEffect =>
	effect.kind === "grant.require" ||
	effect.kind === "grant.blockStart" ||
	effect.kind === "nearby.require" ||
	effect.kind === "nearby.duration.multiply" ||
	effect.kind === "nearby.capacity.spend" ||
	effect.kind === "grant.duration.multiply";

const validateGameDropEffect = (props: GameDropEffectValidationProps) => {
	match(props.effect)
		.with(
			{
				kind: "nearby.capacity.spend",
			},
			() => addDropCapacitySpendIssue(props),
		)
		.when(isCommonGameLineEffect, (effect) =>
			validateCommonGameLineEffect({
				...props,
				effect,
			}),
		)
		.with(
			{
				kind: GrantDropEffectKindPattern,
			},
			(effect) =>
				validateDropGrantSelectorEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "nearby.loot.outputChance.add",
			},
			(effect) =>
				validateNearbyLootOutputChanceEffect({
					...props,
					effect,
				}),
		)
		.exhaustive();
};

export const validateGameDropEffects = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly GameDropEffect[],
	entities: GameEffectValidationEntities,
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		validateGameDropEffect({
			ctx,
			effect,
			effectIndex,
			entities,
			path,
		});
	}
};
