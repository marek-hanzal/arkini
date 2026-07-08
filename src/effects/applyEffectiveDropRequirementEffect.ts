import { createEffectiveDropEffectOutcome } from "~/effects/createEffectiveDropEffectOutcome";
import type {
	EffectiveDropEffectApplicationPropsFor,
	EffectiveDropEvaluation,
} from "~/effects/EffectiveDropEvaluation";
import type { EffectiveChanceItemEntry } from "~/effects/EffectiveLine";
import type { DropEffect, RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import { readDropEffectGrantActive } from "~/effects/readDropEffectGrantActive";
import { readNearbyLineEffectMatches } from "~/effects/readNearbyLineEffectMatches";

const applyRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	ready,
	visible,
}: {
	chanceItems: EffectiveChanceItemEntry[];
	dropEffectId: string;
	dropEffectName: string;
	effect: Extract<
		DropEffect,
		{
			kind: "grant.require" | "nearby.require";
		}
	>;
	enabled: boolean;
	ready: boolean;
	visible: boolean;
}): EffectiveDropEvaluation => {
	const visibilityPhase = effect.phase === "visibility";
	return {
		chanceItems,
		dropEffects: [
			createEffectiveDropEffectOutcome({
				active: ready,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: visibilityPhase ? "visibility" : "availability",
				ready,
				result: ready
					? visibilityPhase
						? "shown"
						: "requirement met"
					: visibilityPhase
						? "hidden"
						: "disabled",
			}),
		],
		enabled: effect.phase === "start" && !ready ? false : enabled,
		visible: visibilityPhase ? ready : visible,
	};
};

export const applyGrantRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: EffectiveDropEffectApplicationPropsFor<"grant.require">) =>
	applyRequirementDropEffect({
		chanceItems: [
			...chanceItems,
		],
		dropEffectId,
		dropEffectName,
		effect,
		enabled,
		ready: readDropEffectGrantActive({
			effect,
			grantIds,
		}),
		visible,
	});

export const applyNearbyRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	save,
	targetCell,
	visible,
}: EffectiveDropEffectApplicationPropsFor<"nearby.require">) =>
	applyRequirementDropEffect({
		chanceItems: [
			...chanceItems,
		],
		dropEffectId,
		dropEffectName,
		effect,
		enabled,
		ready:
			readNearbyLineEffectMatches({
				items: effect.items as RuntimeItemSelector,
				nearbyDistance: effect.distance,
				save,
				targetCell,
			}).length > 0,
		visible,
	});

export const applyGrantBlockStartDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: EffectiveDropEffectApplicationPropsFor<"grant.blockStart">): EffectiveDropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});

	return {
		chanceItems: [
			...chanceItems,
		],
		dropEffects: [
			createEffectiveDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "availability",
				ready: !active,
				result: active ? "disabled" : "not blocked",
			}),
		],
		enabled: active ? false : enabled,
		visible,
	};
};
