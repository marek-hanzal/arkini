import { match } from "ts-pattern";
import { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import type { GameConfig } from "~/config/GameConfigTypes";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	formatGrantSelector,
	formatIssuePath,
	formatItemLabel,
	formatItemSelector,
} from "~/config/validation/GameConfigValidationFormatting";
import {
	readActivationOutputEffectEntries,
	readActivationOutputItemIds,
	readConfigCraftRecipes,
	readConfigLines,
	type Line,
} from "~/config/validation/GameConfigValidationReaders";
import {
	doesGameGrantSelectorMatchIdsLocal,
	readMandatoryGrantIds,
	readSelectorMatchingIds,
} from "~/config/validation/GameConfigSelectorValidation";

type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

type GameplayReachableEntityKind = "grant" | "item";

type GameplayRequirement =
	| {
			itemId: string;
			kind: "item";
			path: GameConfigIssuePath;
	  }
	| {
			kind: "grantSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
	  }
	| {
			kind: "nearbyItemSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
	  };

type GameplaySource = {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
	targetKind: GameplayReachableEntityKind;
};

type GameplayReachability = {
	reachableGrantIds: Set<string>;
	reachableItemIds: Set<string>;
};

export const validateGameplaySoftLockRisks = (ctx: z.RefinementCtx, config: GameConfig) => {
	const sources = createGameplaySources(config);
	const reachability = readGameplayReachability(config, sources);

	validateNearbyRequirementsHaveBoardSource(ctx, config);
	validateGrantRequirementsHavePossibleSource(ctx, config, sources);
	validateGrantRequirementBlockerContradictions(ctx, config);
	validateProducerGameplayReachability(ctx, config, sources, reachability);
};

const createGameplayItemSource = ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
}: {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
}): GameplaySource => ({
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
}: {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
}): GameplaySource => ({
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

const createGameplaySources = (config: GameConfig) => [
	...createStartingBoardGameplaySources(config),
	...createStartingInventoryGameplaySources(config),
	...createPassiveGrantGameplaySources(config),
	...createMergeGameplaySources(config),
	...createRemovalGameplaySources(config),
	...createCraftGameplaySources(config),
	...createLineGameplaySources(config),
];

const isGameplaySourceSatisfied = ({
	config,
	reachability,
	source,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	source: GameplaySource;
}) =>
	source.requirements.every((requirement) =>
		isGameplayRequirementSatisfied({
			config,
			reachableGrantIds: reachability.reachableGrantIds,
			reachableItemIds: reachability.reachableItemIds,
			requirement,
		}),
	);

const applyGameplaySourceReachability = ({
	reachability,
	source,
}: {
	reachability: GameplayReachability;
	source: GameplaySource;
}) =>
	match(source.targetKind)
		.with("item", () => {
			const changed = !reachability.reachableItemIds.has(source.targetId);
			reachability.reachableItemIds.add(source.targetId);
			return changed;
		})
		.with("grant", () => {
			const changed = !reachability.reachableGrantIds.has(source.targetId);
			reachability.reachableGrantIds.add(source.targetId);
			return changed;
		})
		.exhaustive();

const readGameplayReachability = (
	config: GameConfig,
	sources: readonly GameplaySource[],
): GameplayReachability => {
	const reachability = {
		reachableGrantIds: new Set<string>(),
		reachableItemIds: new Set<string>(),
	};
	const appliedSourceIds = new Set<string>();
	let changed = true;

	while (changed) {
		changed = false;

		for (const source of sources) {
			if (appliedSourceIds.has(source.sourceId)) continue;
			if (
				!isGameplaySourceSatisfied({
					config,
					reachability,
					source,
				})
			)
				continue;

			appliedSourceIds.add(source.sourceId);
			changed =
				applyGameplaySourceReachability({
					reachability,
					source,
				}) || changed;
		}
	}

	return reachability;
};

const validateProducerGameplayReachability = (
	ctx: z.RefinementCtx,
	config: GameConfig,
	sources: readonly GameplaySource[],
	reachability: GameplayReachability,
) => {
	for (const [itemId, item] of Object.entries(config.items).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		if (!item.producer && !item.stash) continue;
		if (!isGameplayProgressionProducer(config, itemId)) continue;
		if (reachability.reachableItemIds.has(itemId)) continue;

		addIssue(
			ctx,
			[
				"items",
				itemId,
			],
			formatUnreachableGameplayTargetMessage({
				config,
				reachability,
				sources,
				targetId: itemId,
				targetKind: "item",
				targetLabel: `producer ${formatItemLabel(config, itemId)}`,
			}),
		);
	}
};

const isGameplayProgressionProducer = (config: GameConfig, producerId: string) => {
	const item = config.items[producerId];
	return producerId.startsWith("producer:") || item?.tags.includes("producer") === true;
};

const validateNearbyRequirementsHaveBoardSource = (ctx: z.RefinementCtx, config: GameConfig) => {
	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (
				lineEffect.kind !== "nearby.require" &&
				lineEffect.kind !== "nearby.capacity.spend"
			) {
				continue;
			}

			const matchingBoardItemIds = readSelectorMatchingIds({
				entityIds: Object.keys(config.items),
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			}).filter((itemId) => config.items[itemId]?.storage !== "inventory");

			if (matchingBoardItemIds.length > 0) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"items",
				],
				`Soft-lock risk: ${lineEffect.kind} on ${usage.label} cannot be satisfied because its selector matches no board-placeable item. Selector: ${formatItemSelector(config, lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>)}.`,
			);
		}
	}
};

const validateGrantRequirementsHavePossibleSource = (
	ctx: z.RefinementCtx,
	config: GameConfig,
	sources: readonly GameplaySource[],
) => {
	const possibleGrantIds = new Set(
		sources.filter((source) => source.targetKind === "grant").map((source) => source.targetId),
	);

	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (lineEffect.kind !== "grant.require") continue;
			if (doesGameGrantSelectorMatchIdsLocal(possibleGrantIds, lineEffect.selector)) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"selector",
				],
				`Soft-lock risk: grant requirement on ${usage.label} can never be satisfied because no passive item or active line can provide ${formatGrantSelector(config, lineEffect.selector)}.`,
			);
		}
	}
};

type GrantBlockerEntry = {
	effectIndex: number;
	lineEffect: Extract<
		GameConfigRuntimeEffect,
		{
			kind: "grant.blockStart";
		}
	>;
};

type GrantRequirementEntry = {
	effectIndex: number;
	lineEffect: Extract<
		GameConfigRuntimeEffect,
		{
			kind: "grant.require";
		}
	>;
	requiredGrantIds: Set<string>;
};

const readGrantBlockerEntries = (lineEffects: readonly GameConfigRuntimeEffect[]) =>
	lineEffects
		.map((lineEffect, effectIndex) => ({
			effectIndex,
			lineEffect,
		}))
		.filter(
			(entry): entry is GrantBlockerEntry => entry.lineEffect.kind === "grant.blockStart",
		);

const readGrantRequirementEntries = (lineEffects: readonly GameConfigRuntimeEffect[]) =>
	lineEffects.flatMap((lineEffect, effectIndex): GrantRequirementEntry[] => {
		if (lineEffect.kind !== "grant.require") return [];
		const requiredGrantIds = readMandatoryGrantIds(lineEffect.selector);
		return requiredGrantIds.size > 0
			? [
					{
						effectIndex,
						lineEffect,
						requiredGrantIds,
					},
				]
			: [];
	});

const addGrantRequirementBlockerContradictionIssue = ({
	blocker,
	config,
	ctx,
	requirement,
	usage,
}: {
	blocker: GrantBlockerEntry;
	config: GameConfig;
	ctx: z.RefinementCtx;
	requirement: GrantRequirementEntry;
	usage: ReturnType<typeof readLineEffectUsages>[number];
}) => {
	addIssue(
		ctx,
		[
			...usage.path,
			requirement.effectIndex,
			"selector",
		],
		`Soft-lock risk: ${usage.label} requires and blocks the same mandatory grant set. Required ${formatGrantSelector(config, requirement.lineEffect.selector)} conflicts with blocker ${formatGrantSelector(config, blocker.lineEffect.selector)} at ${formatIssuePath(
			[
				...usage.path,
				blocker.effectIndex,
				"selector",
			],
		)}.`,
	);
};

const validateGrantRequirementBlockerUsageContradictions = ({
	config,
	ctx,
	usage,
}: {
	config: GameConfig;
	ctx: z.RefinementCtx;
	usage: ReturnType<typeof readLineEffectUsages>[number];
}) => {
	const blockers = readGrantBlockerEntries(usage.lineEffects);
	if (blockers.length === 0) return;

	for (const requirement of readGrantRequirementEntries(usage.lineEffects)) {
		for (const blocker of blockers) {
			if (
				!doesGameGrantSelectorMatchIdsLocal(
					requirement.requiredGrantIds,
					blocker.lineEffect.selector,
				)
			) {
				continue;
			}

			addGrantRequirementBlockerContradictionIssue({
				blocker,
				config,
				ctx,
				requirement,
				usage,
			});
		}
	}
};

const validateGrantRequirementBlockerContradictions = (
	ctx: z.RefinementCtx,
	config: GameConfig,
) => {
	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		validateGrantRequirementBlockerUsageContradictions({
			config,
			ctx,
			usage,
		});
	}
};

const readLineEffectUsages = (config: GameConfig) => [
	...readConfigLines(config).map(({ line, linePath, ownerItemId }) => ({
		enforceSoftLock: isGameplayProgressionProducer(config, ownerItemId),
		label: `line "${line.id}" (${line.name})`,
		lineEffects: line.effects ?? [],
		path: [
			...linePath,
			"effects",
		] satisfies GameConfigIssuePath,
	})),
	...readConfigLines(config).flatMap(({ line, linePath, ownerItemId }) =>
		readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		}).map((outputEntry) => ({
			enforceSoftLock: isGameplayProgressionProducer(config, ownerItemId),
			label: `line "${line.id}" (${line.name}) output ${formatItemLabel(config, outputEntry.itemId)}`,
			lineEffects: outputEntry.effects,
			path: [
				...outputEntry.path,
				"effects",
			] satisfies GameConfigIssuePath,
		})),
	),
	...readConfigCraftRecipes(config).map(([craftRecipeId, recipe]) => ({
		enforceSoftLock: isGameplayProgressionProducer(config, recipe.resultItemId),
		label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, recipe.resultItemId)}`,
		lineEffects: recipe.effects ?? [],
		path: [
			"items",
			craftRecipeId,
			"craft",
			"effects",
		] satisfies GameConfigIssuePath,
	})),
];

const readLineEffectGameplayRequirements = ({
	lineEffects,
	path,
}: {
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	const requirements: GameplayRequirement[] = [];

	for (const [effectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			requirements.push({
				kind: "grantSelector",
				path: [
					...path,
					effectIndex,
					"selector",
				],
				selector: lineEffect.selector,
			});
		}

		if (lineEffect.kind === "nearby.require" || lineEffect.kind === "nearby.capacity.spend") {
			requirements.push({
				kind: "nearbyItemSelector",
				path: [
					...path,
					effectIndex,
					"items",
				],
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			});
		}
	}

	return requirements;
};

type GameplayOutputSourceEntry = ReturnType<typeof readActivationOutputEffectEntries>[number] & {
	availabilityRequirements: GameplayRequirement[];
};

const readGameplayOutputSourceEntries = ({
	line,
	output,
	path,
}: {
	line: Line;
	output: z.infer<typeof ActivationOutputSchema>;
	path: GameConfigIssuePath;
}): GameplayOutputSourceEntry[] =>
	readActivationOutputEffectEntries({
		output,
		path,
	}).flatMap((entry) =>
		readOutputAvailabilityRequirementVariants({
			entry,
			line,
		}).map((availabilityRequirements, variantIndex) => ({
			...entry,
			availabilityRequirements,
			sourceKey:
				variantIndex === 0
					? entry.sourceKey
					: `${entry.sourceKey}:availability:${variantIndex}`,
		})),
	);

const readOutputAvailabilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	const visibilityRequirementVariants = readOutputVisibilityRequirementVariants({
		entry,
		line,
	});
	const enableRequirementVariants = readOutputEnableRequirementVariants(entry);

	return visibilityRequirementVariants.flatMap((visibilityRequirements) =>
		enableRequirementVariants.map((enableRequirements) => [
			...visibilityRequirements,
			...enableRequirements,
		]),
	);
};

const readOutputVisibilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	if (line.visibility !== "hidden" && entry.visibility !== "hidden")
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		const effectPath = [
			...entry.path,
			"effects",
			effectIndex,
		] satisfies GameConfigIssuePath;

		if (effect.kind === "grant.drop.show") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "grant.require" && effect.phase === "visibility") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "nearby.require" && effect.phase === "visibility") {
			return [
				[
					createNearbyItemRequirement({
						path: [
							...effectPath,
							"items",
						],
						selector: effect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
					}),
				],
			];
		}

		return [];
	});
};

const readOutputEnableRequirementVariants = (
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number],
): GameplayRequirement[][] => {
	if (entry.enabled !== false)
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		if (effect.kind !== "grant.drop.enable") return [];

		return [
			[
				createGrantRequirement({
					path: [
						...entry.path,
						"effects",
						effectIndex,
						"selector",
					],
					selector: effect.selector,
				}),
			],
		];
	});
};

const createGrantRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "grantSelector",
	path,
	selector,
});

const createNearbyItemRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "nearbyItemSelector",
	path,
	selector,
});

const createItemRequirement = ({
	itemId,
	path,
}: {
	itemId: string;
	path: GameConfigIssuePath;
}): GameplayRequirement => ({
	itemId,
	kind: "item",
	path,
});

const isGameplayRequirementSatisfied = ({
	config,
	reachableGrantIds,
	reachableItemIds,
	requirement,
}: {
	config: GameConfig;
	reachableGrantIds: ReadonlySet<string>;
	reachableItemIds: ReadonlySet<string>;
	requirement: GameplayRequirement;
}) => {
	if (requirement.kind === "item") {
		return reachableItemIds.has(requirement.itemId);
	}

	if (requirement.kind === "grantSelector") {
		return doesGameGrantSelectorMatchIdsLocal(reachableGrantIds, requirement.selector);
	}

	return doesItemSelectorMatchReachableBoardItem({
		config,
		reachableItemIds,
		selector: requirement.selector,
	});
};

const doesItemSelectorMatchReachableBoardItem = ({
	config,
	reachableItemIds,
	selector,
}: {
	config: GameConfig;
	reachableItemIds: ReadonlySet<string>;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	Object.keys(config.items).some(
		(itemId) =>
			reachableItemIds.has(itemId) &&
			config.items[itemId]?.storage !== "inventory" &&
			doesResolvedDomainSelectorMatchId({
				entityId: itemId,
				selector,
			}),
	);

const formatUnreachableGameplayTargetMessage = ({
	config,
	reachability,
	sources,
	targetId,
	targetKind,
	targetLabel,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	sources: readonly GameplaySource[];
	targetId: string;
	targetKind: GameplayReachableEntityKind;
	targetLabel: string;
}) => {
	const targetSources = sources.filter(
		(source) => source.targetKind === targetKind && source.targetId === targetId,
	);

	if (targetSources.length === 0) {
		return `Soft-lock risk: ${targetLabel} is not reachable from startingState. No starting entry, merge, craft recipe, line output, passive effect, or active effect can create it.`;
	}

	const closestSource = [
		...targetSources,
	].sort(
		(left, right) =>
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: left.requirements,
			}).length -
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: right.requirements,
			}).length,
	)[0];

	const missingRequirements = closestSource
		? readMissingGameplayRequirements({
				config,
				reachability,
				requirements: closestSource.requirements,
			})
		: [];
	const missingLabel =
		missingRequirements.length > 0
			? ` Missing: ${missingRequirements.slice(0, 6).join("; ")}.`
			: " The dependency chain is cyclic or blocked by selectors that never become true.";
	const sourceLabel = closestSource
		? ` Closest source: ${closestSource.label} at ${formatIssuePath(closestSource.path)}.`
		: "";

	return `Soft-lock risk: ${targetLabel} is not reachable from startingState.${sourceLabel}${missingLabel}`;
};

const readMissingGameplayRequirements = ({
	config,
	reachability,
	requirements,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	requirements: readonly GameplayRequirement[];
}) =>
	requirements.flatMap((requirement) => {
		if (requirement.kind === "item") {
			return reachability.reachableItemIds.has(requirement.itemId)
				? []
				: [
						`item ${formatItemLabel(config, requirement.itemId)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		if (requirement.kind === "grantSelector") {
			return doesGameGrantSelectorMatchIdsLocal(
				reachability.reachableGrantIds,
				requirement.selector,
			)
				? []
				: [
						`grant ${formatGrantSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		return doesItemSelectorMatchReachableBoardItem({
			config,
			reachableItemIds: reachability.reachableItemIds,
			selector: requirement.selector,
		})
			? []
			: [
					`nearby item ${formatItemSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
				];
	});
