import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { CraftRecipeSchema } from "~/config/schema/GameCraftRecipeSchema";
import {
	addIssue,
	type GameConfigIssuePath,
	validateCraftRecipeInputs,
	validateItemInputs,
	validateUniqueStringList,
} from "~/config/validation/GameConfigValidationCommon";
import {
	type ProducerLikeCapability,
	readProducerCapabilityLines,
	type StashLikeCapability,
} from "~/config/validation/GameConfigValidationReaders";
import {
	validateCraftRecipeEffectRuntimeSupport,
	validateGameLineEffects,
} from "~/config/validation/GameConfigEffectValidation";
import { validateActivationOutput } from "~/config/validation/validateGameConfigActivationOutput";

export const validateProducerCapability = ({
	capability,
	capabilityId,
	ctx,
	grantIds,
	hasItem,
	itemIds,
	section,
}: {
	capability: ProducerLikeCapability | StashLikeCapability;
	capabilityId: string;
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
	section: "producer" | "stash";
}) => {
	const sectionPath = [
		"items",
		capabilityId,
		section,
	] satisfies GameConfigIssuePath;
	const lines = readProducerCapabilityLines(capability);
	const linePathKey = section === "stash" ? "line" : "lines";

	validateUniqueStringList(
		ctx,
		[
			...sectionPath,
			linePathKey,
		],
		lines.map((line) => line.id),
		(value) => `Duplicate line "${value}".`,
	);

	for (const [lineIndex, line] of lines.entries()) {
		const linePath =
			section === "stash"
				? [
						...sectionPath,
						"line",
					]
				: [
						...sectionPath,
						"lines",
						lineIndex,
					];

		validateUniqueStringList(
			ctx,
			[
				...linePath,
				"tags",
			],
			line.tags,
			(value) => `Duplicate tag "${value}".`,
		);

		if (line.inputs) {
			validateItemInputs(
				ctx,
				[
					...linePath,
					"inputs",
				],
				line.inputs,
				hasItem,
			);
		}

		if (line.output) {
			validateActivationOutput(
				ctx,
				[
					...linePath,
					"output",
				],
				line.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}

		validateGameLineEffects(
			ctx,
			[
				...linePath,
				"effects",
			],
			line.effects ?? [],
			{
				grantIds,
				hasItem,
				itemIds,
			},
		);

		if (section === "stash" && line.chargeCost <= 0) {
			addIssue(
				ctx,
				[
					...linePath,
					"chargeCost",
				],
				`Stash line "${line.id}" must spend charges with chargeCost > 0.`,
			);
		}

		if (line.effect && line.output) {
			addIssue(
				ctx,
				[
					...linePath,
					"effect",
				],
				"Active effect lines must not also define output.",
			);
		}
	}
};

export const validateCraftCapability = ({
	craftItemId,
	ctx,
	grantIds,
	hasItem,
	itemIds,
	recipe,
	value,
}: {
	craftItemId: string;
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
	recipe: z.infer<typeof CraftRecipeSchema>;
	value: GameConfig;
}) => {
	if (!hasItem(recipe.resultItemId)) {
		addIssue(
			ctx,
			[
				"items",
				craftItemId,
				"craft",
				"resultItemId",
			],
			`Missing item "${recipe.resultItemId}".`,
		);
	} else if (value.items[recipe.resultItemId]?.storage === "inventory") {
		addIssue(
			ctx,
			[
				"items",
				craftItemId,
				"craft",
				"resultItemId",
			],
			`Craft recipe result "${recipe.resultItemId}" must be placeable on the board because craft completion replaces the board target.`,
		);
	}

	validateCraftRecipeInputs(
		ctx,
		[
			"items",
			craftItemId,
			"craft",
			"inputs",
		],
		recipe.inputs,
		hasItem,
	);
	validateGameLineEffects(
		ctx,
		[
			"items",
			craftItemId,
			"craft",
			"effects",
		],
		recipe.effects ?? [],
		{
			grantIds,
			hasItem,
			itemIds,
		},
	);
	validateCraftRecipeEffectRuntimeSupport(
		ctx,
		[
			"items",
			craftItemId,
			"craft",
			"effects",
		],
		recipe.effects ?? [],
	);
};
