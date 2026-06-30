import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { AppliedGameEffectOperation } from "~/v0/game/effects/EffectiveProducerProductLine";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { compareGameEffectSourceInstances } from "~/v0/game/effects/compareGameEffectSourceInstances";
import { doesGameEffectTargetProductLine } from "~/v0/game/effects/doesGameEffectTargetProductLine";
import { doesGameGrantSelectorMatchIds } from "~/v0/game/effects/doesGameGrantSelectorMatchIds";
import { readGameEffectTargetGrantIds } from "~/v0/game/effects/readGameEffectTargetGrantIds";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";
import { doesGameEffectSourceApplyToBoardCell } from "~/v0/game/effects/doesGameEffectSourceApplyToBoardCell";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export namespace readEffectiveProducerProductLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs?: number;
		producerId: string;
		producerItemId: string;
		producerItemInstanceId: string;
		product: GameConfig["products"][string];
		productId: string;
		save: GameSave;
	}
}

const clampProbability = (value: number) => Math.max(0, Math.min(1, value));

const addQuantityValue = <
	TQuantity extends
		| number
		| {
				min: number;
				max: number;
		  }
		| undefined,
>(
	quantity: TQuantity,
	value: number,
): TQuantity => {
	if (quantity === undefined) return (1 + value) as TQuantity;
	if (typeof quantity === "number") return (quantity + value) as TQuantity;
	return {
		min: quantity.min + value,
		max: quantity.max + value,
	} as TQuantity;
};

type ProducerProductLineOutput = NonNullable<GameConfig["products"][string]["output"]>[number];

const addLootOutputQuantity = <TOutput extends ProducerProductLineOutput>(
	output: TOutput,
	value: number,
): TOutput => {
	if (output.type === "weighted") {
		return {
			...output,
			entries: output.entries.map((entry) => ({
				...entry,
				quantity: addQuantityValue(entry.quantity, value),
			})),
		} as TOutput;
	}

	return {
		...output,
		quantity: addQuantityValue(output.quantity, value),
	} as TOutput;
};

const doesOutputItemTargetMatch = ({
	itemId,
	target,
}: {
	itemId: string;
	target: Extract<
		GameConfig["effects"][string]["operations"][number],
		{
			kind: "loot.extraOutputChance.add";
		}
	>["outputItems"];
}) =>
	doesResolvedDomainSelectorMatchId({
		entityId: itemId,
		selector: target.items,
	});

const readExtraOutputChanceItems = ({
	baseOutput,
	effectId,
	effectName,
	operation,
}: {
	baseOutput: NonNullable<GameConfig["products"][string]["output"]>;
	effectId: string;
	effectName: string;
	operation: Extract<
		GameConfig["effects"][string]["operations"][number],
		{
			kind: "loot.extraOutputChance.add";
		}
	>;
}): EffectiveProducerProductLine["lootPlan"]["chanceItems"] =>
	baseOutput.flatMap((output) => {
		if (output.type === "weighted") return [];
		if (
			!doesOutputItemTargetMatch({
				itemId: output.itemId,
				target: operation.outputItems,
			})
		) {
			return [];
		}

		return [
			{
				chance: operation.chance,
				effectId,
				effectName,
				itemId: output.itemId,
				quantity: operation.quantity,
			},
		];
	});

const readEffectSourceAppliesToTarget = ({
	config,
	save,
	source,
	targetItemInstanceId,
}: {
	config: GameConfig;
	save: GameSave;
	source: GameEffectSourceInstance;
	targetItemInstanceId: string;
}) =>
	doesGameEffectSourceApplyToBoardCell({
		config,
		save,
		source,
		targetCell: readGameEffectSourceCell({
			save,
			sourceItemInstanceId: targetItemInstanceId,
		}),
	});

const readSourceSupportsStackingCategory = ({
	category,
	config,
	producerId,
	productId,
	source,
}: {
	category: string;
	config: GameConfig;
	producerId: string;
	productId: string;
	source: GameEffectSourceInstance;
}) => {
	const effect = config.effects[source.effectId];
	if (!effect) return false;

	return effect.operations.some((operation) => {
		if (operation.kind === "item.blockCreate" || operation.kind === "grant.add") {
			return false;
		}
		if (operation.stacking?.category !== category) return false;

		return doesGameEffectTargetProductLine({
			producerId,
			productId,
			target: operation.target,
		});
	});
};

const readProximityPenaltyMultiplier = ({
	config,
	save,
	source,
	targetCell,
	operation,
}: {
	config: GameConfig;
	save: GameSave;
	source: GameEffectSourceInstance;
	targetCell: ReturnType<typeof readGameEffectSourceCell>;
	operation: Extract<
		GameConfig["effects"][string]["operations"][number],
		{
			kind: "duration.proximityPenalty";
		}
	>;
}) => {
	const effect = config.effects[source.effectId];
	if (!effect || effect.scope !== "local" || !targetCell) return 1;

	const sourceCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: source.sourceItemInstanceId,
	});
	if (!sourceCell) return 1;

	const distance = readChebyshevDistance(sourceCell, targetCell);
	const proximityStrength = effect.radius - distance + 1;
	return Math.max(1, 1 + proximityStrength * operation.durationFactor);
};

const createAppliedOperation = ({
	effectId,
	effectName,
	kind,
	source,
}: {
	effectId: string;
	effectName: string;
	kind: AppliedGameEffectOperation["kind"];
	source: GameEffectSourceInstance;
}): AppliedGameEffectOperation => ({
	effectId,
	effectName,
	kind,
	sourceId: source.sourceId,
	sourceItemInstanceId: source.sourceItemInstanceId,
});

const isStackingLimitReached = ({
	config,
	operation,
	producerId,
	productId,
	source,
	sources,
	targetCell,
	save,
}: {
	config: GameConfig;
	operation: Extract<
		GameConfig["effects"][string]["operations"][number],
		{
			stacking?: unknown;
		}
	>;
	producerId: string;
	productId: string;
	source: GameEffectSourceInstance;
	sources: readonly GameEffectSourceInstance[];
	targetCell: ReturnType<typeof readGameEffectSourceCell>;
	save: GameSave;
}) => {
	const stacking = operation.stacking;
	if (!stacking?.maxSources) return false;

	const selectedSourceIds = sources
		.filter((candidate) =>
			readSourceSupportsStackingCategory({
				category: stacking.category,
				config,
				producerId,
				productId,
				source: candidate,
			}),
		)
		.sort((left, right) =>
			compareGameEffectSourceInstances({
				config,
				distanceOrder: "closest-first",
				left,
				right,
				save,
				targetCell,
			}),
		)
		.slice(0, stacking.maxSources)
		.map((candidate) => candidate.sourceId);

	return !selectedSourceIds.includes(source.sourceId);
};

export const readEffectiveProducerProductLine = ({
	baseDurationMs,
	config,
	ignoredProducerJobIds,
	nowMs,
	producerId,
	producerItemId,
	producerItemInstanceId,
	product,
	productId,
	save,
}: readEffectiveProducerProductLine.Props): EffectiveProducerProductLine => {
	let visibility: "visible" | "hidden" =
		product.visibility === "hidden" && !product.grantSelector ? "hidden" : "visible";
	let blocked = false;
	let durationAddMs = 0;
	let durationMultiplier = 1;
	let baseDropChance = 1;
	let baseOutput = product.output ?? [];
	const appendOutputs: EffectiveProducerProductLine["lootPlan"]["appendOutputs"] = [];
	const chanceItems: EffectiveProducerProductLine["lootPlan"]["chanceItems"] = [];
	const appliedEffects: AppliedGameEffectOperation[] = [];
	const blockReasons: AppliedGameEffectOperation[] = [];
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: producerItemInstanceId,
	});

	const sources = readGameEffectSourceInstances({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	})
		.filter((source) =>
			readEffectSourceAppliesToTarget({
				config,
				save,
				source,
				targetItemInstanceId: producerItemInstanceId,
			}),
		)
		.sort((left, right) =>
			compareGameEffectSourceInstances({
				config,
				left,
				right,
				save,
				targetCell,
			}),
		);

	const grantIds = readGameEffectTargetGrantIds({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
		target: {
			kind: "productLine",
			producerId,
			productId,
			targetCell,
		},
	});
	const grantsReady = product.grantSelector
		? doesGameGrantSelectorMatchIds({
				grantIds,
				selector: product.grantSelector,
			})
		: true;

	for (const source of sources) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;

		for (const operation of effect.operations) {
			if (operation.kind === "item.blockCreate" || operation.kind === "grant.add") continue;

			if (
				!doesGameEffectTargetProductLine({
					producerId,
					productId,
					target: operation.target,
				})
			) {
				continue;
			}

			if (
				isStackingLimitReached({
					config,
					operation,
					producerId,
					productId,
					save,
					source,
					sources,
					targetCell,
				})
			) {
				continue;
			}

			const extraOutputChanceItems =
				operation.kind === "loot.extraOutputChance.add"
					? readExtraOutputChanceItems({
							baseOutput,
							effectId: source.effectId,
							effectName: effect.name,
							operation,
						})
					: [];
			if (
				operation.kind === "loot.extraOutputChance.add" &&
				extraOutputChanceItems.length === 0
			) {
				continue;
			}

			const appliedOperation = createAppliedOperation({
				effectId: source.effectId,
				effectName: effect.name,
				kind: operation.kind,
				source,
			});
			appliedEffects.push(appliedOperation);

			match(operation)
				.with(
					{
						kind: "line.reveal",
					},
					() => {
						visibility = "visible";
					},
				)
				.with(
					{
						kind: "line.hide",
					},
					() => {
						visibility = "hidden";
					},
				)
				.with(
					{
						kind: "line.blockStart",
					},
					() => {
						blocked = true;
						blockReasons.push(appliedOperation);
					},
				)
				.with(
					{
						kind: "duration.addMs",
					},
					(operation) => {
						durationAddMs += operation.valueMs;
					},
				)
				.with(
					{
						kind: "duration.multiply",
					},
					(operation) => {
						durationMultiplier *= operation.multiplier;
					},
				)
				.with(
					{
						kind: "duration.proximityPenalty",
					},
					(operation) => {
						durationMultiplier *= readProximityPenaltyMultiplier({
							config,
							operation,
							save,
							source,
							targetCell,
						});
					},
				)
				.with(
					{
						kind: "loot.appendOutput",
					},
					(operation) => {
						appendOutputs.push({
							chance: operation.chance ?? 1,
							output: operation.output,
						});
					},
				)
				.with(
					{
						kind: "loot.replaceOutput",
					},
					(operation) => {
						baseOutput = operation.output;
					},
				)
				.with(
					{
						kind: "loot.addChanceItem",
					},
					(operation) => {
						chanceItems.push({
							chance: operation.chance,
							effectId: source.effectId,
							effectName: effect.name,
							itemId: operation.itemId,
							quantity: operation.quantity,
						});
					},
				)
				.with(
					{
						kind: "loot.dropChance.add",
					},
					(operation) => {
						baseDropChance += operation.delta;
					},
				)
				.with(
					{
						kind: "loot.quantity.add",
					},
					(operation) => {
						baseOutput = baseOutput.map((output) =>
							addLootOutputQuantity(output, operation.value),
						);
					},
				)
				.with(
					{
						kind: "loot.extraOutputChance.add",
					},
					() => {
						chanceItems.push(...extraOutputChanceItems);
					},
				)
				.exhaustive();
		}
	}

	return {
		appliedEffects,
		blocked,
		blockReasons,
		durationMs: Math.max(0, Math.ceil((baseDurationMs + durationAddMs) * durationMultiplier)),
		lootPlan: {
			appendOutputs,
			baseDropChance: clampProbability(baseDropChance),
			baseOutput,
			chanceItems,
		},
		grantIds: [
			...grantIds,
		].sort(),
		grantsReady,
		visible:
			visibility === "visible" &&
			!(product.visibility === "hidden" && product.grantSelector && !grantsReady),
	};
};
