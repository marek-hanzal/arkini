import { match, P } from "ts-pattern";
import { z } from "zod";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { formatIssuePath } from "~/config/validation/GameConfigValidationFormatting";
import { readConfigEffects } from "~/config/validation/GameConfigValidationReaders";
import {
	validateGameGrantSelector,
	validateGameLineItemSelector,
} from "~/config/validation/GameConfigSelectorValidation";
import type { GameConfig } from "~/config/GameConfigTypes";

export type GameEffectValidationEntities = {
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
};

export type CommonGameLineEffect = z.infer<typeof GameLineEffectSchema>;
export type GameDropEffect = z.infer<typeof GameDropEffectSchema>;

const validateCommonGameLineEffect = ({
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

export const validateGameLineEffects = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly CommonGameLineEffect[],
	entities: GameEffectValidationEntities,
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		validateCommonGameLineEffect({
			ctx,
			effect,
			effectIndex,
			entities,
			path,
		});
	}
};

export type GameDropEffectValidationProps = {
	ctx: z.RefinementCtx;
	effect: GameDropEffect;
	effectIndex: number;
	entities: GameEffectValidationEntities;
	path: GameConfigIssuePath;
};

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

const isCommonGameLineEffect = (effect: GameDropEffect): effect is CommonGameLineEffect =>
	effect.kind === "grant.require" ||
	effect.kind === "grant.blockStart" ||
	effect.kind === "nearby.require" ||
	effect.kind === "nearby.duration.multiply" ||
	effect.kind === "nearby.capacity.spend" ||
	effect.kind === "grant.duration.multiply";

export const validateCraftRecipeEffectRuntimeSupport = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly z.infer<typeof GameLineEffectSchema>[],
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		if (effect.kind === "grant.blockStart") continue;

		if (effect.kind === "grant.require") {
			if (effect.phase !== "start") {
				addIssue(
					ctx,
					[
						...path,
						effectIndex,
						"phase",
					],
					'Craft recipe grant requirements only support phase "start" because craft targets do not own visible lines.',
				);
			}
			continue;
		}

		addIssue(
			ctx,
			[
				...path,
				effectIndex,
				"kind",
			],
			`Craft recipe effects only support "grant.require" start gates and "grant.blockStart" blockers at runtime. "${effect.kind}" is a producer output effect.`,
		);
	}
};

export const validateConfigEffects = (ctx: z.RefinementCtx, config: GameConfig) => {
	const effectIds = new Map<string, GameConfigIssuePath>();
	const grantIds = new Map<string, GameConfigIssuePath>();

	for (const { effect, path } of readConfigEffects(config)) {
		const previousEffectPath = effectIds.get(effect.id);
		if (previousEffectPath) {
			addIssue(
				ctx,
				[
					...path,
					"id",
				],
				`Duplicate effect id "${effect.id}" already defined at ${formatIssuePath(previousEffectPath)}.`,
			);
		} else {
			effectIds.set(effect.id, path);
		}

		for (const [grantIndex, grant] of effect.grants.entries()) {
			const grantPath: GameConfigIssuePath = [
				...path,
				"grants",
				grantIndex,
				"id",
			];
			const previousGrantPath = grantIds.get(grant.id);
			if (previousGrantPath) {
				addIssue(
					ctx,
					grantPath,
					`Duplicate grant id "${grant.id}" already defined at ${formatIssuePath(previousGrantPath)}.`,
				);
				continue;
			}
			grantIds.set(grant.id, grantPath);
		}
	}
};
