import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import { GameEffectSchema } from "~/config/schema/GameEffectSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";

export const readConfigCraftRecipes = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		item.craft
			? [
					[
						itemId,
						item.craft,
					] as const,
				]
			: [],
	);

export const readConfigLines = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([ownerItemId, item]) => {
		const lines = (item.producer?.lines ?? []).map((line, lineIndex) => ({
			line,
			lineIndex,
			linePath: [
				"items",
				ownerItemId,
				"producer",
				"lines",
				lineIndex,
			] satisfies GameConfigIssuePath,
			ownerItemId,
		}));
		const stashLine = item.stash
			? [
					{
						line: item.stash.line,
						lineIndex: undefined,
						linePath: [
							"items",
							ownerItemId,
							"stash",
							"line",
						] satisfies GameConfigIssuePath,
						ownerItemId,
					},
				]
			: [];

		return [
			...lines,
			...stashLine,
		];
	});

export type ConfigEffectEntry = {
	effect: z.infer<typeof GameEffectSchema>;
	path: GameConfigIssuePath;
};

export const readConfigEffects = (config: GameConfig): ConfigEffectEntry[] =>
	Object.entries(config.items).flatMap(([itemId, item]) => {
		const passiveEffects = (item.effects ?? []).map((effect, effectIndex) => ({
			effect,
			path: [
				"items",
				itemId,
				"effects",
				effectIndex,
			] satisfies GameConfigIssuePath,
		}));
		const producerEffects = (item.producer?.lines ?? []).flatMap((line, lineIndex) =>
			line.effect
				? [
						{
							effect: line.effect,
							path: [
								"items",
								itemId,
								"producer",
								"lines",
								lineIndex,
								"effect",
							] satisfies GameConfigIssuePath,
						},
					]
				: [],
		);
		const stashEffect = item.stash?.line.effect
			? [
					{
						effect: item.stash.line.effect,
						path: [
							"items",
							itemId,
							"stash",
							"line",
							"effect",
						] satisfies GameConfigIssuePath,
					},
				]
			: [];

		return [
			...passiveEffects,
			...producerEffects,
			...stashEffect,
		];
	});

export const readGameEffectGrantIds = (config: GameConfig) => [
	...new Set(
		readConfigEffects(config).flatMap(({ effect }) => effect.grants.map((grant) => grant.id)),
	),
];

export type ProducerLikeCapability = NonNullable<GameConfig["items"][string]["producer"]>;
export type StashLikeCapability = NonNullable<GameConfig["items"][string]["stash"]>;
export type Line = ProducerLikeCapability["lines"][number] | StashLikeCapability["line"];

export const readProducerCapabilityLines = (
	capability: ProducerLikeCapability | StashLikeCapability,
): readonly Line[] =>
	"line" in capability
		? [
				capability.line,
			]
		: capability.lines;

export const readActivationOutputItemIds = (output: z.infer<typeof ActivationOutputSchema>) =>
	readActivationOutputEffectEntries({
		output,
		path: [],
	}).map((entry) => entry.itemId);

export const readActivationOutputEffectEntries = ({
	output,
	path,
}: {
	output: z.infer<typeof ActivationOutputSchema>;
	path: GameConfigIssuePath;
}) =>
	output.flatMap((outputSet, outputSetIndex) =>
		outputSet.entries.flatMap((entry, outputIndex) => {
			const outputPath = [
				...path,
				outputSetIndex,
				"entries",
				outputIndex,
			];
			if (entry.type === "weighted") {
				return entry.entries.map((weightedEntry, weightedEntryIndex) => ({
					enabled: weightedEntry.enabled,
					effects: weightedEntry.effects ?? [],
					itemId: weightedEntry.itemId,
					path: [
						...outputPath,
						"entries",
						weightedEntryIndex,
					] satisfies GameConfigIssuePath,
					sourceKey: `${outputSetIndex}:${outputIndex}:entry:${weightedEntryIndex}:${weightedEntry.itemId}`,
					visibility: weightedEntry.visibility,
				}));
			}

			return [
				{
					enabled: entry.enabled,
					effects: entry.effects ?? [],
					itemId: entry.itemId,
					path: outputPath satisfies GameConfigIssuePath,
					sourceKey: `${outputSetIndex}:${outputIndex}:${entry.itemId}`,
					visibility: entry.visibility,
				},
			];
		}),
	);
