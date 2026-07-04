import { match, P } from "ts-pattern";
import { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import type { GameConfig } from "~/config/GameConfigTypes";
import { CraftRecipeSchema } from "~/config/schema/GameCraftRecipeSchema";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import {
	ResolvedDomainSelectorClauseSchema,
	ResolvedDomainSelectorSchema,
} from "~/config/schema/GameDomainSelectorSchema";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameEffectSchema } from "~/config/schema/GameEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";

type GameConfigIssuePath = (string | number)[];

type GameConfigValidationContext = {
	config: GameConfig;
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasAsset: (assetId: string) => boolean;
	hasItem: (itemId: string) => boolean;
	hasResource: (resourceId: string) => boolean;
	itemIds: readonly string[];
};

export const validateGameConfig = (config: GameConfig, ctx: z.RefinementCtx) => {
	const context = createGameConfigValidationContext(config, ctx);

	validateConfigDefinitionReferences(context);
	validateConfigEffects(ctx, config);
	validateBlueprintDependencyCycles(ctx, config);
	validateGameplaySoftLockRisks(ctx, config);
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

const validateConfigDefinitionReferences = ({
	config: value,
	ctx,
	grantIds,
	hasAsset,
	hasItem,
	hasResource,
	itemIds,
}: GameConfigValidationContext) => {
	validateAssetDefinitionReferences({
		ctx,
		hasAsset,
		hasResource,
		value,
	});
	validateItemDefinitionReferences({
		ctx,
		grantIds,
		hasItem,
		itemIds,
		value,
	});
};

const validateAssetDefinitionReferences = ({
	ctx,
	hasAsset,
	hasResource,
	value,
}: {
	ctx: z.RefinementCtx;
	hasAsset: (assetId: string) => boolean;
	hasResource: (resourceId: string) => boolean;
	value: GameConfig;
}) => {
	for (const [assetId, asset] of Object.entries(value.assets)) {
		if (!hasResource(asset.resourceId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"resourceId",
				],
				`Missing resource "${asset.resourceId}".`,
			);
		}
		if (asset.overlayAssetId && !hasAsset(asset.overlayAssetId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"overlayAssetId",
				],
				`Missing overlay asset "${asset.overlayAssetId}".`,
			);
		}
	}
};

const validateItemDefinitionReferences = ({
	ctx,
	grantIds,
	hasItem,
	itemIds,
	value,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
	value: GameConfig;
}) => {
	for (const [itemId, item] of Object.entries(value.items)) {
		validateItemAssetReferences({
			ctx,
			item,
			itemId,
			value,
		});
		validateItemOwnDefinition({
			ctx,
			hasItem,
			item,
			itemId,
		});
		validateItemMergeReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemRemovalReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemCapabilityReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
			value,
		});
	}
};

type ConfigItem = GameConfig["items"][string];

const validateItemAssetReferences = ({
	ctx,
	item,
	itemId,
	value,
}: {
	ctx: z.RefinementCtx;
	item: ConfigItem;
	itemId: string;
	value: GameConfig;
}) => {
	for (const [assetIndex, assetId] of item.assetIds.entries()) {
		if (value.assets[assetId]) continue;
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"assetIds",
				assetIndex,
			],
			`Missing asset "${assetId}".`,
		);
	}
};

const validateItemOwnDefinition = ({
	ctx,
	hasItem,
	item,
	itemId,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
}) => {
	validateUniqueStringList(
		ctx,
		[
			"items",
			itemId,
			"tags",
		],
		item.tags,
		(value) => `Duplicate tag "${value}".`,
	);

	if (item.capacity?.onDepleted === "replace" && !hasItem(item.capacity.replaceItemId)) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"capacity",
				"replaceItemId",
			],
			`Missing item "${item.capacity.replaceItemId}".`,
		);
	}
	if (item.capacity && item.maxStackSize !== 1) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"maxStackSize",
			],
			`Item "${itemId}" has capacity and must use maxStackSize 1 to preserve per-instance state.`,
		);
	}
};

const validateItemMergeReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
}) => {
	for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
		if (!hasItem(merge.withItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"withItemId",
				],
				`Missing item "${merge.withItemId}".`,
			);
		}
		if ("resultItemId" in merge && !hasItem(merge.resultItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"resultItemId",
				],
				`Missing item "${merge.resultItemId}".`,
			);
		}
		if (merge.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"output",
				],
				merge.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};

const validateItemRemovalReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
}) => {
	for (const [index, removal] of (item.removeBy ?? []).entries()) {
		if (!hasItem(removal.itemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"itemId",
				],
				`Missing item "${removal.itemId}".`,
			);
		}
		if (removal.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"output",
				],
				removal.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};

const validateItemCapabilityReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
	value,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
	value: GameConfig;
}) => {
	if (item.producer && item.stash) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
			],
			`Item "${itemId}" must not define both producer and stash capabilities.`,
		);
	}

	if (item.producer) {
		validateProducerCapability({
			capability: item.producer,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "producer",
		});
	}
	if (item.stash) {
		validateProducerCapability({
			capability: item.stash,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "stash",
		});
	}
	if (item.craft) {
		validateCraftCapability({
			craftItemId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			recipe: item.craft,
			value,
		});
	}
};

const validateStartingState = ({ config: value, ctx, hasItem }: GameConfigValidationContext) => {
	validateStartingInventoryState({
		ctx,
		hasItem,
		value,
	});
	validateStartingBoardState({
		ctx,
		hasItem,
		value,
	});
};

const validateStartingInventoryState = ({
	ctx,
	hasItem,
	value,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	value: GameConfig;
}) => {
	if (value.startingState.inventory.length > value.game.inventory.slots) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
			],
			`Starting inventory has ${value.startingState.inventory.length} stacks but only ${value.game.inventory.slots} slots are configured.`,
		);
	}

	for (const [index, entry] of value.startingState.inventory.entries()) {
		validateStartingInventoryEntry({
			ctx,
			entry,
			hasItem,
			index,
			value,
		});
	}
};

const validateStartingBoardState = ({
	ctx,
	hasItem,
	value,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	value: GameConfig;
}) => {
	const usedStartingBoardCells = new Set<string>();
	const startingBoardItemCountByItemId = new Map<string, number>();
	for (const [index, entry] of value.startingState.board.entries()) {
		validateStartingBoardEntryItem({
			ctx,
			entry,
			hasItem,
			index,
			value,
		});
		validateStartingBoardEntryPosition({
			ctx,
			entry,
			index,
			value,
		});
		startingBoardItemCountByItemId.set(
			entry.itemId,
			(startingBoardItemCountByItemId.get(entry.itemId) ?? 0) + 1,
		);
		recordStartingBoardCellUsage({
			ctx,
			entry,
			index,
			usedStartingBoardCells,
		});
	}

	validateStartingBoardItemMaxCounts({
		ctx,
		startingBoardItemCountByItemId,
		value,
	});
};

type StartingInventoryEntry = GameConfig["startingState"]["inventory"][number];
type StartingBoardEntry = GameConfig["startingState"]["board"][number];

const validateStartingInventoryEntry = ({
	ctx,
	entry,
	hasItem,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingInventoryEntry;
	hasItem: (itemId: string) => boolean;
	index: number;
	value: GameConfig;
}) => {
	if (!hasItem(entry.itemId)) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			`Missing item "${entry.itemId}".`,
		);
		return;
	}
	const item = value.items[entry.itemId];
	if (item?.storage === "board") {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			`Item "${entry.itemId}" storage policy forbids inventory placement.`,
		);
	}
	if (item && entry.quantity > item.maxStackSize) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"quantity",
			],
			`Quantity must be <= item maxStackSize (${item.maxStackSize}).`,
		);
	}
};

const validateStartingBoardEntryItem = ({
	ctx,
	entry,
	hasItem,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	hasItem: (itemId: string) => boolean;
	index: number;
	value: GameConfig;
}) => {
	if (!hasItem(entry.itemId)) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"itemId",
			],
			`Missing item "${entry.itemId}".`,
		);
		return;
	}
	if (value.items[entry.itemId]?.storage === "inventory") {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"itemId",
			],
			`Item "${entry.itemId}" storage policy forbids board placement.`,
		);
	}
};

const validateStartingBoardEntryPosition = ({
	ctx,
	entry,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	index: number;
	value: GameConfig;
}) => {
	if (entry.x >= value.game.board.width) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"x",
			],
			`x must be < board width (${value.game.board.width}).`,
		);
	}
	if (entry.y >= value.game.board.height) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"y",
			],
			`y must be < board height (${value.game.board.height}).`,
		);
	}
};

const recordStartingBoardCellUsage = ({
	ctx,
	entry,
	index,
	usedStartingBoardCells,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	index: number;
	usedStartingBoardCells: Set<string>;
}) => {
	const cellKey = `${entry.x}:${entry.y}`;
	if (usedStartingBoardCells.has(cellKey)) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
			],
			`Duplicate starting board cell (${entry.x}, ${entry.y}).`,
		);
	}
	usedStartingBoardCells.add(cellKey);
};

const validateStartingBoardItemMaxCounts = ({
	ctx,
	startingBoardItemCountByItemId,
	value,
}: {
	ctx: z.RefinementCtx;
	startingBoardItemCountByItemId: ReadonlyMap<string, number>;
	value: GameConfig;
}) => {
	for (const [itemId, quantity] of startingBoardItemCountByItemId) {
		const maxCount = value.items[itemId]?.maxCount;
		if (maxCount === undefined || quantity <= maxCount) continue;
		addIssue(
			ctx,
			[
				"startingState",
				"board",
			],
			`Starting board has ${quantity} item(s) of "${itemId}" but maxCount is ${maxCount}.`,
		);
	}
};

const createRecordGuard = (record: Readonly<Record<string, unknown>>) => (key: string) =>
	Object.hasOwn(record, key);

const addIssue = (ctx: z.RefinementCtx, path: GameConfigIssuePath, message: string) => {
	ctx.addIssue({
		code: "custom",
		path,
		message,
	});
};

const validateUniqueStringList = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	values: readonly string[],
	createMessage: (value: string) => string,
) => {
	const firstIndexByValue = new Map<string, number>();

	for (const [index, value] of values.entries()) {
		const firstIndex = firstIndexByValue.get(value);
		if (firstIndex !== undefined) {
			addIssue(
				ctx,
				[
					...path,
					index,
				],
				createMessage(value),
			);
			continue;
		}

		firstIndexByValue.set(value, index);
	}
};

const validateItemInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		capacity: number;
		itemId: string;
		quantity: number;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate input item "${value}".`,
	);

	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}

		if (input.capacity < input.quantity) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"capacity",
				],
				`Capacity must be >= quantity (${input.quantity}).`,
			);
		}
	}
};

const validateCraftRecipeInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		consume: boolean;
		itemId: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate craft input item "${value}".`,
	);

	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}

		if (!input.consume) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"consume",
				],
				"Craft inputs must currently be consumed because craft start clears stored input state and completion replaces the board target.",
			);
		}
	}
};

const readDomainSelectorIds = (selector: z.infer<typeof ResolvedDomainSelectorSchema>) => {
	if ("mode" in selector) return [];
	return [
		...(selector.anyOf ?? []),
		...(selector.allOf ?? []),
		...(selector.noneOf ?? []),
	].flatMap((clause) => clause.ids);
};

const validateResolvedDomainSelectorClauses = ({
	clauses,
	ctx,
	hasEntity,
	label,
	path,
}: {
	clauses: readonly z.infer<typeof ResolvedDomainSelectorClauseSchema>[] | undefined;
	ctx: z.RefinementCtx;
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
}) => {
	for (const [clauseIndex, clause] of (clauses ?? []).entries()) {
		validateUniqueStringList(
			ctx,
			[
				...path,
				clauseIndex,
				"ids",
			],
			clause.ids,
			(value) => `Duplicate ${label} "${value}".`,
		);

		for (const [index, entityId] of clause.ids.entries()) {
			if (hasEntity(entityId)) continue;
			addIssue(
				ctx,
				[
					...path,
					clauseIndex,
					"ids",
					index,
				],
				`Missing ${label} "${entityId}".`,
			);
		}
	}
};

const validateResolvedDomainSelector = ({
	ctx,
	entityIds,
	hasEntity,
	label,
	path,
	selector,
}: {
	ctx: z.RefinementCtx;
	entityIds: readonly string[];
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Domain selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	validateResolvedDomainSelectorClauses({
		clauses: selector.anyOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"anyOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.allOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"allOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.noneOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"noneOf",
		],
	});

	if (
		!entityIds.some((entityId) =>
			doesResolvedDomainSelectorMatchId({
				entityId,
				selector,
			}),
		)
	) {
		addIssue(ctx, path, `Domain selector matched no ${label}s.`);
	}
};

type GrantSelectorClauseKey = "allOf" | "anyOf" | "noneOf";

const validateGameGrantSelectorClauseGroup = ({
	ctx,
	grantIds,
	path,
	selector,
	selectorKey,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	path: GameConfigIssuePath;
	selector: Exclude<
		z.infer<typeof ResolvedDomainSelectorSchema>,
		{
			mode: "all";
		}
	>;
	selectorKey: GrantSelectorClauseKey;
}) => {
	validateResolvedDomainSelectorClauses({
		clauses: selector[selectorKey],
		ctx,
		hasEntity: (grantId) => grantIds.includes(grantId),
		label: "grant",
		path: [
			...path,
			selectorKey,
		],
	});
};

const validateGameGrantSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	grantIds: readonly string[],
) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Grant selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	for (const selectorKey of [
		"anyOf",
		"allOf",
		"noneOf",
	] satisfies GrantSelectorClauseKey[]) {
		validateGameGrantSelectorClauseGroup({
			ctx,
			grantIds,
			path,
			selector,
			selectorKey,
		});
	}
};

const validateGameLineItemSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	entities: {
		entityIds: readonly string[];
		hasEntity: (itemId: string) => boolean;
	},
) => {
	validateResolvedDomainSelector({
		ctx,
		entityIds: entities.entityIds,
		hasEntity: entities.hasEntity,
		label: "item",
		path,
		selector,
	});
};

type GameEffectValidationEntities = {
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
};

type CommonGameLineEffect = z.infer<typeof GameLineEffectSchema>;
type GameDropEffect = z.infer<typeof GameDropEffectSchema>;

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

const validateGameLineEffects = (
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

type GameDropEffectValidationProps = {
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

const validateGameDropEffects = (
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

const validateCraftRecipeEffectRuntimeSupport = (
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

const readConfigCraftRecipes = (config: GameConfig) =>
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

const readConfigLines = (config: GameConfig) =>
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

type ConfigEffectEntry = {
	effect: z.infer<typeof GameEffectSchema>;
	path: GameConfigIssuePath;
};

const readConfigEffects = (config: GameConfig): ConfigEffectEntry[] =>
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

const validateConfigEffects = (ctx: z.RefinementCtx, config: GameConfig) => {
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

const readGameEffectGrantIds = (config: GameConfig) => [
	...new Set(
		readConfigEffects(config).flatMap(({ effect }) => effect.grants.map((grant) => grant.id)),
	),
];

type ProducerLikeCapability = NonNullable<GameConfig["items"][string]["producer"]>;
type StashLikeCapability = NonNullable<GameConfig["items"][string]["stash"]>;
type Line = ProducerLikeCapability["lines"][number] | StashLikeCapability["line"];

const readProducerCapabilityLines = (
	capability: ProducerLikeCapability | StashLikeCapability,
): readonly Line[] =>
	"line" in capability
		? [
				capability.line,
			]
		: capability.lines;

const validateProducerCapability = ({
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

const validateCraftCapability = ({
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

type BlueprintDependencyEdge = {
	path: GameConfigIssuePath;
	toBlueprintItemId: string;
	viaItemId: string;
};

type BlueprintDependencyCollector = {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	edgesByBlueprintItemId: Map<string, BlueprintDependencyEdge[]>;
};

type BlueprintDependencyItem = {
	fromBlueprintItemId: string;
	itemId: string;
	path: GameConfigIssuePath;
};

const addBlueprintDependencyItem = (
	collector: BlueprintDependencyCollector,
	item: BlueprintDependencyItem,
) => {
	for (const toBlueprintItemId of readBlueprintDependenciesForItem({
		blueprintItemIds: collector.blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: collector.blueprintItemIdsByCraftResultItemId,
		itemId: item.itemId,
	})) {
		const edges = collector.edgesByBlueprintItemId.get(item.fromBlueprintItemId) ?? [];
		edges.push({
			path: item.path,
			toBlueprintItemId,
			viaItemId: item.itemId,
		});
		collector.edgesByBlueprintItemId.set(item.fromBlueprintItemId, edges);
	}
};

const createBlueprintDependencyCollector = (config: GameConfig): BlueprintDependencyCollector => {
	const blueprintItemIds = readBlueprintItemIds(config);
	return {
		blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: readBlueprintItemIdsByCraftResultItemId(
			config,
			blueprintItemIds,
		),
		edgesByBlueprintItemId: new Map(),
	};
};

const collectBlueprintDependencyEdges = (config: GameConfig) => {
	const collector = createBlueprintDependencyCollector(config);
	const addDependencyItem = (item: BlueprintDependencyItem) =>
		addBlueprintDependencyItem(collector, item);

	collectCraftRecipeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectLineBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectMergeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});

	return collector;
};

const addBlueprintDependencyCycleIssue = ({
	config,
	ctx,
	cycle,
}: {
	config: GameConfig;
	ctx: z.RefinementCtx;
	cycle: ReturnType<typeof readBlueprintDependencyCycles>[number];
}) => {
	const firstCycleEdge = cycle.edges[0];
	const issuePath = firstCycleEdge?.path ?? [
		"items",
		cycle.blueprintItemIds[0] ?? "blueprints",
	];
	const cycleLabel = cycle.blueprintItemIds
		.map((itemId) => readBlueprintItemDisplayName(config, itemId))
		.join(" -> ");
	const viaLabel = firstCycleEdge ? ` via required item "${firstCycleEdge.viaItemId}"` : "";

	addIssue(
		ctx,
		issuePath,
		`Blueprint dependency cycle detected${viaLabel}: ${cycleLabel}. Blueprint progression must not require itself directly or through another blueprint/building chain.`,
	);
};

const validateBlueprintDependencyCycles = (ctx: z.RefinementCtx, config: GameConfig) => {
	const collector = collectBlueprintDependencyEdges(config);
	for (const cycle of readBlueprintDependencyCycles({
		blueprintItemIds: collector.blueprintItemIds,
		edgesByBlueprintItemId: collector.edgesByBlueprintItemId,
	})) {
		addBlueprintDependencyCycleIssue({
			config,
			ctx,
			cycle,
		});
	}
};

const readBlueprintItemIds = (config: GameConfig) =>
	new Set(
		Object.entries(config.items)
			.filter(([itemId, item]) => {
				const primaryAsset = config.assets[item.assetIds[0]];

				return (
					itemId.startsWith("item:blueprint-") ||
					item.tags.includes("blueprint") ||
					primaryAsset?.render === "blueprint"
				);
			})
			.map(([itemId]) => itemId),
	);

const readBlueprintItemIdsByCraftResultItemId = (
	config: GameConfig,
	blueprintItemIds: ReadonlySet<string>,
) => {
	const result = new Map<string, string[]>();

	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;
		result.set(recipe.resultItemId, [
			...(result.get(recipe.resultItemId) ?? []),
			craftRecipeId,
		]);
	}

	return result;
};

const readBlueprintDependenciesForItem = ({
	blueprintItemIds,
	blueprintItemIdsByCraftResultItemId,
	itemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	itemId: string;
}) => {
	const dependencies = new Set<string>();
	if (blueprintItemIds.has(itemId)) dependencies.add(itemId);
	for (const blueprintItemId of blueprintItemIdsByCraftResultItemId.get(itemId) ?? []) {
		dependencies.add(blueprintItemId);
	}
	return dependencies;
};

const collectCraftRecipeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;

		for (const [inputIndex, input] of recipe.inputs.entries()) {
			addDependencyItem({
				fromBlueprintItemId: craftRecipeId,
				itemId: input.itemId,
				path: [
					"items",
					craftRecipeId,
					"craft",
					"inputs",
					inputIndex,
					"itemId",
				],
			});
		}

		collectLineEffectDependencyItems({
			addDependencyItem,
			config,
			fromBlueprintItemId: craftRecipeId,
			lineEffects: recipe.effects ?? [],
			path: [
				"items",
				craftRecipeId,
				"craft",
				"effects",
			],
		});
	}
};

const collectLineBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const { line, lineIndex, linePath, ownerItemId } of readConfigLines(config)) {
		const outputEntries = readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		});

		for (const outputEntry of outputEntries) {
			if (!blueprintItemIds.has(outputEntry.itemId)) continue;
			const fromBlueprintItemId = outputEntry.itemId;
			addDependencyItem({
				fromBlueprintItemId,
				itemId: ownerItemId,
				path:
					lineIndex === undefined
						? [
								...linePath,
								"id",
							]
						: [
								"items",
								ownerItemId,
								"producer",
								"lines",
								lineIndex,
								"id",
							],
			});

			for (const [inputIndex, input] of (line.inputs ?? []).entries()) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: input.itemId,
					path: [
						...linePath,
						"inputs",
						inputIndex,
						"itemId",
					],
				});
			}

			collectLineEffectDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				lineEffects: outputEntry.effects,
				path: [
					...outputEntry.path,
					"effects",
				],
			});
		}
	}
};

const collectMergeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [sourceItemId, item] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
			const outputBlueprintIds = [
				...("resultItemId" in merge
					? [
							merge.resultItemId,
						]
					: []),
				...readActivationOutputItemIds(merge.output ?? []),
			].filter((itemId) => blueprintItemIds.has(itemId));
			for (const blueprintItemId of outputBlueprintIds) {
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: sourceItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
					],
				});
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: merge.withItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
						"withItemId",
					],
				});
			}
		}
	}
};

type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

const collectLineEffectDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	lineEffects,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: GameConfig;
	fromBlueprintItemId: string;
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	for (const [lineEffectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			collectGrantDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				selector: lineEffect.selector,
				path: [
					...path,
					lineEffectIndex,
					"selector",
				],
			});
		}

		if (lineEffect.kind === "nearby.require") {
			for (const itemId of readDomainSelectorIds(
				lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			)) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId,
					path: [
						...path,
						lineEffectIndex,
						"items",
					],
				});
			}
		}
	}
};

const collectGrantDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	selector,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: GameConfig;
	fromBlueprintItemId: string;
	selector: z.infer<typeof ResolvedDomainSelectorSchema> | undefined;
	path: GameConfigIssuePath;
}) => {
	if (!selector) return;

	const grantSourceItemIdsByGrantId = readPassiveGrantSourceItemIdsByGrantId(config);
	for (const grantId of readDomainSelectorIds(selector)) {
		for (const itemId of grantSourceItemIdsByGrantId.get(grantId) ?? []) {
			addDependencyItem({
				fromBlueprintItemId,
				itemId,
				path,
			});
		}
	}
};

const readPassiveGrantSourceItemIdsByGrantId = (config: GameConfig) => {
	const result = new Map<string, string[]>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const effect of item.effects ?? []) {
			for (const grantId of effect.grants.map((grant) => grant.id)) {
				result.set(grantId, [
					...(result.get(grantId) ?? []),
					itemId,
				]);
			}
		}
	}
	return result;
};

type BlueprintDependencyCycle = {
	blueprintItemIds: string[];
	edges: BlueprintDependencyEdge[];
};

type BlueprintDependencyCycleWalkState = {
	cycles: BlueprintDependencyCycle[];
	edgeStack: BlueprintDependencyEdge[];
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>;
	reportedCycleKeys: Set<string>;
	stack: string[];
	stackIndexByBlueprintItemId: Map<string, number>;
	visited: Set<string>;
	visiting: Set<string>;
};

const createBlueprintDependencyCycleWalkState = (
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>,
): BlueprintDependencyCycleWalkState => ({
	cycles: [],
	edgeStack: [],
	edgesByBlueprintItemId,
	reportedCycleKeys: new Set(),
	stack: [],
	stackIndexByBlueprintItemId: new Map(),
	visited: new Set(),
	visiting: new Set(),
});

const enterBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	state.visiting.add(blueprintItemId);
	state.stackIndexByBlueprintItemId.set(blueprintItemId, state.stack.length);
	state.stack.push(blueprintItemId);
};

const leaveBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	state.stack.pop();
	state.stackIndexByBlueprintItemId.delete(blueprintItemId);
	state.visiting.delete(blueprintItemId);
	state.visited.add(blueprintItemId);
};

const readBlueprintDependencyCycleForEdge = ({
	edge,
	state,
}: {
	edge: BlueprintDependencyEdge;
	state: BlueprintDependencyCycleWalkState;
}): BlueprintDependencyCycle | undefined => {
	const cycleStartIndex = state.stackIndexByBlueprintItemId.get(edge.toBlueprintItemId);
	if (cycleStartIndex === undefined) return undefined;

	return {
		blueprintItemIds: [
			...state.stack.slice(cycleStartIndex),
			edge.toBlueprintItemId,
		],
		edges: [
			...state.edgeStack.slice(cycleStartIndex),
			edge,
		],
	};
};

const recordBlueprintDependencyCycle = (
	state: BlueprintDependencyCycleWalkState,
	cycle: BlueprintDependencyCycle,
) => {
	const cycleKey = readBlueprintDependencyCycleKey(cycle.blueprintItemIds);
	if (state.reportedCycleKeys.has(cycleKey)) return;

	state.reportedCycleKeys.add(cycleKey);
	state.cycles.push(cycle);
};

const visitBlueprintDependencyEdge = ({
	edge,
	state,
	visit,
}: {
	edge: BlueprintDependencyEdge;
	state: BlueprintDependencyCycleWalkState;
	visit: (blueprintItemId: string) => void;
}) => {
	const cycle = readBlueprintDependencyCycleForEdge({
		edge,
		state,
	});
	if (cycle) {
		recordBlueprintDependencyCycle(state, cycle);
		return;
	}

	if (state.visiting.has(edge.toBlueprintItemId)) return;
	state.edgeStack.push(edge);
	visit(edge.toBlueprintItemId);
	state.edgeStack.pop();
};

const visitBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	if (state.visited.has(blueprintItemId)) return;

	enterBlueprintDependencyNode(state, blueprintItemId);
	for (const edge of state.edgesByBlueprintItemId.get(blueprintItemId) ?? []) {
		visitBlueprintDependencyEdge({
			edge,
			state,
			visit: (nextBlueprintItemId) =>
				visitBlueprintDependencyNode(state, nextBlueprintItemId),
		});
	}
	leaveBlueprintDependencyNode(state, blueprintItemId);
};

const readBlueprintDependencyCycles = ({
	blueprintItemIds,
	edgesByBlueprintItemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>;
}) => {
	const state = createBlueprintDependencyCycleWalkState(edgesByBlueprintItemId);
	for (const blueprintItemId of [
		...blueprintItemIds,
	].sort()) {
		visitBlueprintDependencyNode(state, blueprintItemId);
	}
	return state.cycles;
};

const readBlueprintDependencyCycleKey = (cycleBlueprintItemIds: readonly string[]) => {
	const uniqueCycleItemIds = cycleBlueprintItemIds.slice(0, -1);
	if (uniqueCycleItemIds.length === 0) return cycleBlueprintItemIds.join("->");

	const rotations = uniqueCycleItemIds.map((_, index) =>
		[
			...uniqueCycleItemIds.slice(index),
			...uniqueCycleItemIds.slice(0, index),
		].join("->"),
	);

	return rotations.sort()[0] ?? cycleBlueprintItemIds.join("->");
};

const readBlueprintItemDisplayName = (config: GameConfig, itemId: string) =>
	config.items[itemId]?.name ?? itemId;

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

const validateGameplaySoftLockRisks = (ctx: z.RefinementCtx, config: GameConfig) => {
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

const doesGameGrantSelectorMatchIdsLocal = (
	grantIds: ReadonlySet<string>,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => {
	if ("mode" in selector) return true;

	if (selector.anyOf && !selector.anyOf.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}

	return true;
};

const hasAnyGrantId = (grantIds: ReadonlySet<string>, ids: readonly string[]) =>
	ids.some((id) => grantIds.has(id));

const readMandatoryGrantIds = (selector: z.infer<typeof ResolvedDomainSelectorSchema>) => {
	const grantIds = new Set<string>();
	if ("mode" in selector) return grantIds;

	for (const clause of selector.allOf ?? []) {
		const [grantId] = clause.ids;
		if (clause.ids.length === 1 && grantId) {
			grantIds.add(grantId);
		}
	}

	return grantIds;
};

const readActivationOutputItemIds = (output: z.infer<typeof ActivationOutputSchema>) =>
	readActivationOutputEffectEntries({
		output,
		path: [],
	}).map((entry) => entry.itemId);

const readActivationOutputEffectEntries = ({
	output,
	path,
}: {
	output: z.infer<typeof ActivationOutputSchema>;
	path: GameConfigIssuePath;
}) =>
	output.flatMap((entry, outputIndex) => {
		const outputPath = [
			...path,
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
				sourceKey: `${outputIndex}:entry:${weightedEntryIndex}:${weightedEntry.itemId}`,
				visibility: weightedEntry.visibility,
			}));
		}

		return [
			{
				enabled: entry.enabled,
				effects: entry.effects ?? [],
				itemId: entry.itemId,
				path: outputPath satisfies GameConfigIssuePath,
				sourceKey: `${outputIndex}:${entry.itemId}`,
				visibility: entry.visibility,
			},
		];
	});

const readSelectorMatchingIds = ({
	entityIds,
	selector,
}: {
	entityIds: readonly string[];
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	entityIds.filter((entityId) =>
		doesResolvedDomainSelectorMatchId({
			entityId,
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

const formatIssuePath = (path: readonly (string | number)[]) =>
	path.map((segment) => String(segment)).join(".");

const formatItemLabel = (config: GameConfig, itemId: string) => {
	const itemName = config.items[itemId]?.name;
	return itemName ? `"${itemId}" (${itemName})` : `"${itemId}"`;
};

const formatItemSelector = (
	config: GameConfig,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => formatResolvedSelector(selector, (itemId) => formatItemLabel(config, itemId));

const formatGrantSelector = (
	config: GameConfig,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => {
	const grantNameById = readGrantNameById(config);
	return formatResolvedSelector(selector, (grantId) => {
		const grantName = grantNameById.get(grantId);
		return grantName ? `"${grantId}" (${grantName})` : `"${grantId}"`;
	});
};

const formatResolvedSelector = (
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	formatId: (id: string) => string,
) => {
	if ("mode" in selector) return 'mode "all"';

	const parts: string[] = [];
	const formatClauses = (label: "allOf" | "anyOf" | "noneOf") => {
		for (const clause of selector[label] ?? []) {
			parts.push(`${label} [${clause.ids.map(formatId).join(" OR ")}]`);
		}
	};

	formatClauses("anyOf");
	formatClauses("allOf");
	formatClauses("noneOf");

	return parts.join(", ") || "empty selector";
};

const readGrantNameById = (config: GameConfig) => {
	const grantNameById = new Map<string, string>();

	for (const { effect } of readConfigEffects(config)) {
		for (const grant of effect.grants) {
			grantNameById.set(grant.id, grant.name);
		}
	}

	return grantNameById;
};

const validateActivationOutput = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	output: z.infer<typeof ActivationOutputSchema>,
	entities: {
		grantIds: readonly string[];
		hasItem: (itemId: string) => boolean;
		itemIds: readonly string[];
	},
) => {
	for (const [index, entry] of output.entries()) {
		if (entry.type === "weighted") {
			for (const [entryIndex, weightedEntry] of entry.entries.entries()) {
				if (!entities.hasItem(weightedEntry.itemId)) {
					addIssue(
						ctx,
						[
							...path,
							index,
							"entries",
							entryIndex,
							"itemId",
						],
						`Missing item "${weightedEntry.itemId}".`,
					);
				}
				validateGameDropEffects(
					ctx,
					[
						...path,
						index,
						"entries",
						entryIndex,
						"effects",
					],
					weightedEntry.effects ?? [],
					entities,
				);
			}

			continue;
		}

		if (!entities.hasItem(entry.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${entry.itemId}".`,
			);
		}

		validateGameDropEffects(
			ctx,
			[
				...path,
				index,
				"effects",
			],
			entry.effects ?? [],
			entities,
		);
	}
};
