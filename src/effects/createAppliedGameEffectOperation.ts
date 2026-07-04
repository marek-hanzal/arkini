import type { AppliedGameEffectOperation } from "~/effects/EffectiveLine";

export const createAppliedGameEffectOperation = ({
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
