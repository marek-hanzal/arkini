import type { AppliedGameEffectOperation } from "~/effects/EffectiveLine";

export const createAppliedGameEffectOperation = ({
	durationMultiplier,
	kind,
	lineEffectId,
	lineEffectName,
	sourceId = lineEffectId,
	sourceItemInstanceId,
	targetItemId,
}: {
	durationMultiplier?: number;
	kind: AppliedGameEffectOperation["kind"];
	lineEffectId: string;
	lineEffectName: string;
	sourceId?: string;
	sourceItemInstanceId: string;
	targetItemId?: string;
}): AppliedGameEffectOperation => ({
	durationMultiplier,
	effectId: lineEffectId,
	effectName: lineEffectName,
	kind,
	sourceId,
	sourceItemInstanceId,
	targetItemId,
});
