import type { EffectiveLine } from "~/effects/EffectiveLine";

export const readRuntimeLineStartRequirementsReady = (effectiveLine: EffectiveLine) => {
	const hasStartRequirements = effectiveLine.requirements.some(
		(requirement) => requirement.phase === "start",
	);

	if (effectiveLine.startRequirementsReady === false) return false;
	if (hasStartRequirements) return true;
	return undefined;
};
