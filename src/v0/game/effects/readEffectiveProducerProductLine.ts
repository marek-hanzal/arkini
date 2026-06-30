import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { AppliedGameEffectOperation } from "~/v0/game/effects/EffectiveProducerProductLine";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { doesGameGrantSelectorMatchIds } from "~/v0/game/effects/doesGameGrantSelectorMatchIds";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";
import { readGameWorldGrantIds } from "~/v0/game/effects/readGameWorldGrantIds";

export namespace readEffectiveProducerProductLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs?: number;
		producerItemInstanceId: string;
		product: GameConfig["products"][string];
		productId: string;
		save: GameSave;
	}
}

type ProducerProductLineOutput = NonNullable<GameConfig["products"][string]["output"]>[number];

const doesOutputItemTargetMatch = ({
	itemId,
	target,
}: {
	itemId: string;
	target: Extract<
		NonNullable<GameConfig["products"][string]["effects"]>[number],
		{
			kind: "grant.loot.extraOutputChance.add";
		}
	>["outputItems"];
}) =>
	doesResolvedDomainSelectorMatchId({
		entityId: itemId,
		selector: target.items as Parameters<
			typeof doesResolvedDomainSelectorMatchId
		>[0]["selector"],
	});

const readExtraOutputChanceItems = ({
	baseOutput,
	lineEffectId,
	lineEffectName,
	lineEffect,
}: {
	baseOutput: NonNullable<GameConfig["products"][string]["output"]>;
	lineEffectId: string;
	lineEffectName: string;
	lineEffect: Extract<
		NonNullable<GameConfig["products"][string]["effects"]>[number],
		{
			kind: "grant.loot.extraOutputChance.add";
		}
	>;
}): EffectiveProducerProductLine["lootPlan"]["chanceItems"] =>
	baseOutput.flatMap((output) => {
		if (output.type === "weighted") return [];
		if (
			!doesOutputItemTargetMatch({
				itemId: output.itemId,
				target: lineEffect.outputItems,
			})
		) {
			return [];
		}

		return [
			{
				chance: lineEffect.chance,
				effectId: lineEffectId,
				effectName: lineEffectName,
				itemId: output.itemId,
				quantity: lineEffect.quantity,
			},
		];
	});

const readLineEffectLabel = ({
	fallback,
	lineEffect,
}: {
	fallback: string;
	lineEffect: {
		label?: string;
	};
}) => lineEffect.label ?? fallback;

const createAppliedOperation = ({
	kind,
	lineEffectId,
	lineEffectName,
	sourceId = lineEffectId,
	sourceItemInstanceId,
}: {
	kind: AppliedGameEffectOperation["kind"];
	lineEffectId: string;
	lineEffectName: string;
	sourceId?: string;
	sourceItemInstanceId: string;
}): AppliedGameEffectOperation => ({
	effectId: lineEffectId,
	effectName: lineEffectName,
	kind,
	sourceId,
	sourceItemInstanceId,
});

const readNearbyMatches = ({
	config,
	items,
	radius,
	save,
	targetCell,
}: {
	config: GameConfig;
	items: Extract<
		NonNullable<GameConfig["products"][string]["effects"]>[number],
		{
			kind: "nearby.require" | "nearby.duration.multiply";
		}
	>["items"];
	radius: number;
	save: GameSave;
	targetCell?: BoardCell;
}) => {
	if (!targetCell) return [];

	return Object.values(save.board.items)
		.flatMap((item) => {
			const cell = readGameEffectSourceCell({
				save,
				sourceItemInstanceId: item.id,
			});
			if (!cell) return [];
			if (
				!doesResolvedDomainSelectorMatchId({
					entityId: item.itemId,
					selector: items as Parameters<
						typeof doesResolvedDomainSelectorMatchId
					>[0]["selector"],
				})
			) {
				return [];
			}
			const distance = readChebyshevDistance(cell, targetCell);
			if (distance > radius) return [];
			return [
				{
					distance,
					item,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance || left.item.id.localeCompare(right.item.id),
		);
};

const readDistanceMultiplier = ({
	bands,
	distance,
}: {
	bands: Extract<
		NonNullable<GameConfig["products"][string]["effects"]>[number],
		{
			kind: "nearby.duration.multiply";
		}
	>["bands"];
	distance: number;
}) =>
	bands.find(
		(band) =>
			distance >= band.minDistance &&
			(band.maxDistance === undefined || distance <= band.maxDistance),
	)?.multiplier;

export const readEffectiveProducerProductLine = ({
	baseDurationMs,
	config,
	ignoredProducerJobIds,
	nowMs,
	producerItemInstanceId,
	product,
	productId,
	save,
}: readEffectiveProducerProductLine.Props): EffectiveProducerProductLine => {
	let visible = product.visibility !== "hidden";
	let startRequirementsReady = true;
	let hasVisibilityRequirement = false;
	let visibilityReady = true;
	let blocked = false;
	let durationMultiplier = 1;
	const baseOutput = product.output ?? [];
	const chanceItems: EffectiveProducerProductLine["lootPlan"]["chanceItems"] = [];
	const appliedEffects: AppliedGameEffectOperation[] = [];
	const blockReasons: AppliedGameEffectOperation[] = [];
	const requirements: EffectiveProducerProductLine["requirements"] = [];
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: producerItemInstanceId,
	});
	const grantIds = readGameWorldGrantIds({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	});

	const recordRequirementOutcome = ({
		display,
		kind,
		label,
		operation,
		phase,
		ready,
	}: {
		display: EffectiveProducerProductLine["requirements"][number]["display"];
		kind: "grant.require" | "nearby.require";
		label: string;
		operation: AppliedGameEffectOperation;
		phase: "start" | "visibility";
		ready: boolean;
	}) => {
		if (phase === "visibility") {
			hasVisibilityRequirement = true;
			if (!ready) visibilityReady = false;
		}
		if (phase === "start" && !ready) startRequirementsReady = false;
		requirements.push({
			display,
			kind,
			label,
			phase,
			ready,
		});
		if (ready) appliedEffects.push(operation);
	};

	for (const [lineEffectIndex, lineEffect] of (product.effects ?? []).entries()) {
		const lineEffectId = `${productId}:effect:${lineEffectIndex}`;
		const lineEffectName = readLineEffectLabel({
			fallback: lineEffect.kind,
			lineEffect,
		});
		const appliedOperation = createAppliedOperation({
			kind: lineEffect.kind,
			lineEffectId,
			lineEffectName,
			sourceItemInstanceId: producerItemInstanceId,
		});

		if (lineEffect.kind === "grant.require") {
			recordRequirementOutcome({
				display: lineEffect.display,
				kind: lineEffect.kind,
				label: lineEffectName,
				operation: appliedOperation,
				phase: lineEffect.phase,
				ready: doesGameGrantSelectorMatchIds({
					grantIds,
					selector: lineEffect.selector,
				}),
			});
			continue;
		}

		if (lineEffect.kind === "grant.blockStart") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (active) {
				blocked = true;
				blockReasons.push(appliedOperation);
				appliedEffects.push(appliedOperation);
			}
			requirements.push({
				display: lineEffect.display,
				kind: lineEffect.kind,
				label: lineEffectName,
				phase: "start",
				ready: !active,
			});
			continue;
		}

		if (lineEffect.kind === "nearby.require") {
			recordRequirementOutcome({
				display: lineEffect.display,
				kind: lineEffect.kind,
				label: lineEffectName,
				operation: appliedOperation,
				phase: lineEffect.phase,
				ready:
					readNearbyMatches({
						config,
						items: lineEffect.items,
						radius: lineEffect.radius,
						save,
						targetCell,
					}).length > 0,
			});
			continue;
		}

		if (lineEffect.kind === "nearby.duration.multiply") {
			const matches = readNearbyMatches({
				config,
				items: lineEffect.items,
				radius: lineEffect.radius,
				save,
				targetCell,
			}).slice(0, lineEffect.maxSources ?? Number.POSITIVE_INFINITY);
			for (const match of matches) {
				const multiplier = readDistanceMultiplier({
					bands: lineEffect.bands,
					distance: match.distance,
				});
				if (multiplier === undefined) continue;
				durationMultiplier *= multiplier;
				appliedEffects.push(
					createAppliedOperation({
						kind: lineEffect.kind,
						lineEffectId,
						lineEffectName,
						sourceId: match.item.itemId,
						sourceItemInstanceId: match.item.id,
					}),
				);
			}
			continue;
		}

		if (lineEffect.kind === "grant.duration.multiply") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (active) {
				durationMultiplier *= lineEffect.multiplier;
				appliedEffects.push(appliedOperation);
			}
			continue;
		}

		if (lineEffect.kind === "grant.loot.extraOutputChance.add") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (active) {
				const extraOutputChanceItems = readExtraOutputChanceItems({
					baseOutput,
					lineEffect,
					lineEffectId,
					lineEffectName,
				});
				if (extraOutputChanceItems.length) {
					chanceItems.push(...extraOutputChanceItems);
					appliedEffects.push(appliedOperation);
				}
			}
			continue;
		}
	}

	if (hasVisibilityRequirement) visible = visibilityReady;

	return {
		appliedEffects,
		blocked,
		blockReasons,
		durationMs: Math.max(0, Math.ceil(baseDurationMs * durationMultiplier)),
		grantIds: [
			...grantIds,
		].sort(),
		startRequirementsReady,
		lootPlan: {
			baseOutput,
			chanceItems,
		},
		requirements,
		visible,
	};
};
