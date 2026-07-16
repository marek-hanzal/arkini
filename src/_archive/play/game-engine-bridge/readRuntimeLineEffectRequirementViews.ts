import { match } from "ts-pattern";
import type { EffectiveLine } from "~/effects/EffectiveLine";

const isRuntimeEffectRequirementActive = (requirement: EffectiveLine["requirements"][number]) =>
	requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready;

const shouldDisplayRuntimeEffectRequirement = (
	requirement: EffectiveLine["requirements"][number],
) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenActive") {
		return isRuntimeEffectRequirementActive(requirement);
	}
	return !requirement.ready;
};

export const readRuntimeLineEffectRequirementViews = (effectiveLine: EffectiveLine) =>
	effectiveLine.requirements.filter(shouldDisplayRuntimeEffectRequirement).map((requirement) => ({
		kind: match(requirement.kind)
			.with("grant.require", "grant.blockStart", "nearby.require", (kind) => kind)
			.otherwise(() => undefined),
		label: requirement.label,
		ready: requirement.ready,
	}));
