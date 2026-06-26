import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { AppliedGameEffectOperation } from "~/v0/game/effects/EffectiveProducerProductLine";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { doesGameEffectTargetProductLine } from "~/v0/game/effects/doesGameEffectTargetProductLine";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export namespace readEffectiveProducerProductLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
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

const compareGameEffectSources = ({
	config,
	left,
	right,
}: {
	config: GameConfig;
	left: GameEffectSourceInstance;
	right: GameEffectSourceInstance;
}) => {
	const leftEffect = config.effects[left.effectId];
	const rightEffect = config.effects[right.effectId];
	const leftScopePriority = leftEffect?.scope === "local" ? 0 : 1;
	const rightScopePriority = rightEffect?.scope === "local" ? 0 : 1;
	if (leftScopePriority !== rightScopePriority) return leftScopePriority - rightScopePriority;
	if (left.activatedAtMs !== right.activatedAtMs) return left.activatedAtMs - right.activatedAtMs;
	return (
		left.sourceId.localeCompare(right.sourceId) || left.effectId.localeCompare(right.effectId)
	);
};

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
}) => {
	const effect = config.effects[source.effectId];
	if (!effect) return false;
	if (effect.scope === "global") return true;

	const sourceCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: source.sourceItemInstanceId,
	});
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: targetItemInstanceId,
	});
	if (!sourceCell || !targetCell) return false;

	return readChebyshevDistance(sourceCell, targetCell) <= effect.radius;
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

export const readEffectiveProducerProductLine = ({
	baseDurationMs,
	config,
	nowMs,
	producerId,
	producerItemId,
	producerItemInstanceId,
	product,
	productId,
	save,
}: readEffectiveProducerProductLine.Props): EffectiveProducerProductLine => {
	const producerTags = config.items[producerItemId]?.tags ?? [];
	let revealed = product.visibility !== "hidden";
	let hidden = false;
	let blocked = false;
	let durationAddMs = 0;
	let durationMultiplier = 1;
	let baseDropChance = 1;
	let lootTableIds = product.outputTableId
		? [
				product.outputTableId,
			]
		: [];
	const appendTables: EffectiveProducerProductLine["lootPlan"]["appendTables"] = [];
	const chanceItems: EffectiveProducerProductLine["lootPlan"]["chanceItems"] = [];
	const appliedEffects: AppliedGameEffectOperation[] = [];
	const blockReasons: AppliedGameEffectOperation[] = [];

	const sources = readGameEffectSourceInstances({
		config,
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
			compareGameEffectSources({
				config,
				left,
				right,
			}),
		);

	for (const source of sources) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;

		for (const operation of effect.operations) {
			if (operation.kind === "item.blockCreate") continue;

			if (
				!doesGameEffectTargetProductLine({
					producerId,
					producerTags,
					product,
					productId,
					target: operation.target,
				})
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
						revealed = true;
					},
				)
				.with(
					{
						kind: "line.hide",
					},
					() => {
						hidden = true;
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
						kind: "loot.appendTable",
					},
					(operation) => {
						appendTables.push({
							chance: operation.chance ?? 1,
							lootTableId: operation.lootTableId,
						});
					},
				)
				.with(
					{
						kind: "loot.replaceTable",
					},
					(operation) => {
						lootTableIds = [
							operation.lootTableId,
						];
					},
				)
				.with(
					{
						kind: "loot.addChanceItem",
					},
					(operation) => {
						chanceItems.push({
							chance: operation.chance,
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
				.exhaustive();
		}
	}

	return {
		appliedEffects,
		blocked,
		blockReasons,
		durationMs: Math.max(1, Math.ceil((baseDurationMs + durationAddMs) * durationMultiplier)),
		lootPlan: {
			appendTables,
			baseDropChance: clampProbability(baseDropChance),
			chanceItems,
			lootTableIds,
		},
		visible: revealed && !hidden,
	};
};
