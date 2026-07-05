import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import {
	readActivationOutputItemIds,
	readConfigCraftRecipes,
	readConfigLines,
} from "~/config/validation/GameConfigValidationReaders";
import {
	createItemRequirement,
	readGameplayOutputSourceEntries,
	readLineEffectGameplayRequirements,
} from "~/config/validation/GameplaySoftLockRequirements";
import type {
	GameplayRequirement,
	GameplaySource,
} from "~/config/validation/GameplaySoftLockTypes";

type GameplaySourceInput = {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
};

const createGameplayItemSource = ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
}: GameplaySourceInput): GameplaySource => ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
	targetKind: "item",
});

const createGameplayGrantSource = ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
}: GameplaySourceInput): GameplaySource => ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
	targetKind: "grant",
});

const createStartingBoardGameplaySources = (config: GameConfig) =>
	config.startingState.board.map((entry, index) =>
		createGameplayItemSource({
			label: `starting board slot ${index}`,
			path: [
				"startingState",
				"board",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:board:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		}),
	);

const createStartingInventoryGameplaySources = (config: GameConfig) =>
	config.startingState.inventory.map((entry, index) =>
		createGameplayItemSource({
			label: `starting inventory stack ${index}`,
			path: [
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:inventory:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		}),
	);

const createPassiveGrantGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.effects ?? []).flatMap((effect, effectIndex) =>
			effect.grants.map((grant) =>
				createGameplayGrantSource({
					label: `passive effect "${effect.id}" on ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"effects",
						effectIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
							],
						}),
					],
					sourceId: `passive:${itemId}:${effect.id}:${grant.id}`,
					targetId: grant.id,
				}),
			),
		),
	);

const readMergeOutputItemIds = (
	merge: NonNullable<GameConfig["items"][string]["merges"]>[number],
) => [
	...("resultItemId" in merge
		? [
				merge.resultItemId,
			]
		: []),
	...readActivationOutputItemIds(merge.output ?? []),
];

const createMergeGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.merges ?? []).flatMap((merge, mergeIndex) =>
			readMergeOutputItemIds(merge).map((outputItemId) =>
				createGameplayItemSource({
					label: `merge ${mergeIndex} from ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"merges",
						mergeIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
								"merges",
								mergeIndex,
							],
						}),
						createItemRequirement({
							itemId: merge.withItemId,
							path: [
								"items",
								itemId,
								"merges",
								mergeIndex,
								"withItemId",
							],
						}),
					],
					sourceId: `merge:${itemId}:${mergeIndex}:${merge.withItemId}:${outputItemId}`,
					targetId: outputItemId,
				}),
			),
		),
	);

const createRemovalGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.removeBy ?? []).flatMap((removal, removeIndex) =>
			readActivationOutputItemIds(removal.output ?? []).map((outputItemId) =>
				createGameplayItemSource({
					label: `tile removal of ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"removeBy",
						removeIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
							],
						}),
						createItemRequirement({
							itemId: removal.itemId,
							path: [
								"items",
								itemId,
								"removeBy",
								removeIndex,
								"itemId",
							],
						}),
					],
					sourceId: `remove:${itemId}:${removeIndex}:output:${outputItemId}`,
					targetId: outputItemId,
				}),
			),
		),
	);

const createCraftGameplaySources = (config: GameConfig) =>
	readConfigCraftRecipes(config).map(([craftRecipeId, recipe]) =>
		createGameplayItemSource({
			label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, recipe.resultItemId)}`,
			path: [
				"items",
				craftRecipeId,
				"craft",
			],
			requirements: [
				createItemRequirement({
					itemId: craftRecipeId,
					path: [
						"items",
						craftRecipeId,
						"craft",
					],
				}),
				...recipe.inputs.map((input, inputIndex) =>
					createItemRequirement({
						itemId: input.itemId,
						path: [
							"items",
							craftRecipeId,
							"craft",
							"inputs",
							inputIndex,
							"itemId",
						],
					}),
				),
				...readLineEffectGameplayRequirements({
					lineEffects: recipe.effects ?? [],
					path: [
						"items",
						craftRecipeId,
						"craft",
						"effects",
					],
				}),
			],
			sourceId: `craft:${craftRecipeId}`,
			targetId: recipe.resultItemId,
		}),
	);

type GameplayLineSourceEntry = Pick<
	ReturnType<typeof readConfigLines>[number],
	"line" | "linePath" | "ownerItemId"
>;

const readLineBaseGameplayRequirements = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry): GameplayRequirement[] => [
	createItemRequirement({
		itemId: ownerItemId,
		path: [
			"items",
			ownerItemId,
		],
	}),
	...(line.inputs ?? []).map((input, inputIndex) =>
		createItemRequirement({
			itemId: input.itemId,
			path: [
				...linePath,
				"inputs",
				inputIndex,
				"itemId",
			],
		}),
	),
	...readLineEffectGameplayRequirements({
		lineEffects: line.effects ?? [],
		path: [
			...linePath,
			"effects",
		],
	}),
];

const createLineOutputGameplaySources = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry) => {
	const lineRequirements = readLineBaseGameplayRequirements({
		line,
		linePath,
		ownerItemId,
	});
	return readGameplayOutputSourceEntries({
		line,
		output: line.output ?? [],
		path: [
			...linePath,
			"output",
		],
	}).map((outputEntry) =>
		createGameplayItemSource({
			label: `line "${line.id}" (${line.name})`,
			path: linePath,
			requirements: [
				...lineRequirements,
				...outputEntry.availabilityRequirements,
				...readLineEffectGameplayRequirements({
					lineEffects: outputEntry.effects,
					path: [
						...outputEntry.path,
						"effects",
					],
				}),
			],
			sourceId: `line:${ownerItemId}:${line.id}:output:${outputEntry.sourceKey}`,
			targetId: outputEntry.itemId,
		}),
	);
};

const createLineEffectGameplaySources = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry) => {
	if (!line.effect) return [];

	const lineRequirements = readLineBaseGameplayRequirements({
		line,
		linePath,
		ownerItemId,
	});
	return line.effect.grants.map((grant) =>
		createGameplayGrantSource({
			label: `active effect line "${line.id}" (${line.name})`,
			path: [
				...linePath,
				"effect",
			],
			requirements: lineRequirements,
			sourceId: `line:${ownerItemId}:${line.id}:active:${line.effect?.id}:${grant.id}`,
			targetId: grant.id,
		}),
	);
};

const createLineGameplaySources = (config: GameConfig) =>
	readConfigLines(config).flatMap((entry) => [
		...createLineOutputGameplaySources(entry),
		...createLineEffectGameplaySources(entry),
	]);

export const createGameplaySoftLockSources = (config: GameConfig) => [
	...createStartingBoardGameplaySources(config),
	...createStartingInventoryGameplaySources(config),
	...createPassiveGrantGameplaySources(config),
	...createMergeGameplaySources(config),
	...createRemovalGameplaySources(config),
	...createCraftGameplaySources(config),
	...createLineGameplaySources(config),
];
