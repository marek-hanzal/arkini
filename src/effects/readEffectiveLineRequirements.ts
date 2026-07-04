import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { createAppliedGameEffectOperation } from "~/effects/createAppliedGameEffectOperation";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import type { RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import { readNearbyLineEffectMatches } from "~/effects/readNearbyLineEffectMatches";
import { readRuntimeLineEffectLabel } from "~/effects/readRuntimeLineEffectLabel";
import { readNearbyCapacitySpendSource } from "~/capacity/readNearbyCapacitySpendSource";

export type EffectiveLineRequirementEvaluation = Pick<
	EffectiveLine,
	"blocked" | "blockReasons" | "requirements" | "startRequirementsReady"
>;

const shouldLineRequirementDisplay = (requirement: EffectiveLine["requirements"][number]) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenMissing") return !requirement.ready;
	return requirement.ready;
};

export const readEffectiveLineRequirements = ({
	config,
	grantIds,
	itemInstanceId,
	ignoreCapacitySpendRequirements,
	line,
	lineId,
	save,
	targetCell,
}: {
	config: GameConfig;
	grantIds: ReadonlySet<string>;
	itemInstanceId: string;
	ignoreCapacitySpendRequirements?: boolean;
	line: GameLineDefinition;
	lineId: string;
	save: GameSave;
	targetCell?: BoardCell;
}): EffectiveLineRequirementEvaluation => {
	const requirements: EffectiveLine["requirements"] = [];
	const blockReasons: EffectiveLine["blockReasons"] = [];
	let startRequirementsReady = true;
	let blocked = false;

	for (const [effectIndex, effect] of (line.effects ?? []).entries()) {
		const effectId = `${lineId}:effect:${effectIndex}`;
		const effectName = readRuntimeLineEffectLabel({
			config,
			fallback: effect.kind,
			lineEffect: effect,
		});

		if (effect.kind === "grant.require") {
			const ready = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: effect.selector,
			});
			if (effect.phase === "start" && !ready) startRequirementsReady = false;
			const requirement = {
				display: effect.display,
				kind: effect.kind,
				label: effect.label ?? effectName,
				phase: effect.phase,
				ready,
			};
			if (shouldLineRequirementDisplay(requirement)) requirements.push(requirement);
			continue;
		}

		if (effect.kind === "nearby.require") {
			const ready =
				readNearbyLineEffectMatches({
					items: effect.items as RuntimeItemSelector,
					radius: effect.radius,
					save,
					targetCell,
				}).length > 0;
			if (effect.phase === "start" && !ready) startRequirementsReady = false;
			const requirement = {
				display: effect.display,
				kind: effect.kind,
				label: effect.label ?? effectName,
				phase: effect.phase,
				ready,
			};
			if (shouldLineRequirementDisplay(requirement)) requirements.push(requirement);
			continue;
		}

		if (effect.kind === "nearby.capacity.spend") {
			if (ignoreCapacitySpendRequirements) continue;
			const source = readNearbyCapacitySpendSource({
				config,
				effect,
				itemInstanceId,
				save,
			});
			const ready = source !== undefined;
			if (!ready) startRequirementsReady = false;
			const requirement = {
				display: effect.display,
				kind: effect.kind,
				label: effect.label ?? effectName,
				phase: "start" as const,
				ready,
			};
			if (shouldLineRequirementDisplay(requirement)) requirements.push(requirement);
			continue;
		}

		if (effect.kind === "grant.blockStart") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: effect.selector,
			});
			if (active) {
				blocked = true;
				blockReasons.push(
					createAppliedGameEffectOperation({
						kind: effect.kind,
						lineEffectId: effectId,
						lineEffectName: effectName,
						sourceItemInstanceId: itemInstanceId,
					}),
				);
			}
		}
	}

	return {
		blocked,
		blockReasons,
		requirements,
		startRequirementsReady,
	};
};
