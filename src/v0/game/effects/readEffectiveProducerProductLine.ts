import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { AppliedGameEffectOperation } from "~/v0/game/effects/EffectiveProducerProductLine";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { compareGameEffectSourceInstances } from "~/v0/game/effects/compareGameEffectSourceInstances";
import { doesGameEffectTargetProductLine } from "~/v0/game/effects/doesGameEffectTargetProductLine";
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
	let revealed = product.visibility !== "hidden";
	let hidden = false;
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

	for (const source of sources) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;

		for (const operation of effect.operations) {
			if (operation.kind === "item.blockCreate") continue;

			if (
				!doesGameEffectTargetProductLine({
					producerId,
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
		durationMs: Math.max(0, Math.ceil((baseDurationMs + durationAddMs) * durationMultiplier)),
		lootPlan: {
			appendOutputs,
			baseDropChance: clampProbability(baseDropChance),
			baseOutput,
			chanceItems,
		},
		visible: revealed && !hidden,
	};
};
