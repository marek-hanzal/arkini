import { Order } from "effect";

import type { AcquisitionRequirement } from "~/flow/type/AcquisitionGraph";

export interface EstimateRequirementGroup {
	readonly consumed: number;
	/** Additive live identities which cannot be shared by sibling roles. */
	readonly distinctOneTime: number;
	readonly factId: string;
	readonly oneTime: number;
	readonly ongoing: number;
	readonly sources: ReadonlyArray<AcquisitionRequirement["source"]>;
}

const readEstimateRequirementQuantityFn = (
	requirement: AcquisitionRequirement,
	actionRuns: number,
) => requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

/** Groups one selected route's authored requirements by fact and sharing semantics. */
export const groupEstimateRequirementsFn = (
	requirements: ReadonlyArray<AcquisitionRequirement>,
	actionRuns: number,
): ReadonlyArray<EstimateRequirementGroup> => {
	const groups = new Map<
		string,
		{
			consumed: number;
			distinctOneTime: number;
			factId: string;
			oneTime: number;
			ongoing: number;
			sources: AcquisitionRequirement["source"][];
		}
	>();
	for (const requirement of requirements) {
		const group = groups.get(requirement.factId) ?? {
			consumed: 0,
			distinctOneTime: 0,
			factId: requirement.factId,
			oneTime: 0,
			ongoing: 0,
			sources: [],
		};
		if (requirement.usage === "consume")
			group.consumed += readEstimateRequirementQuantityFn(requirement, actionRuns);
		if (requirement.usage === "one-time") {
			if (requirement.identity === "distinct") group.distinctOneTime += requirement.quantity;
			else group.oneTime = Math.max(group.oneTime, requirement.quantity);
			group.oneTime = Math.max(group.oneTime, group.distinctOneTime);
		}
		if (requirement.usage === "ongoing")
			group.ongoing = Math.max(group.ongoing, requirement.quantity);
		if (!group.sources.includes(requirement.source)) {
			group.sources.push(requirement.source);
			group.sources.sort();
		}
		groups.set(group.factId, group);
	}
	return [
		...groups.values(),
	].sort((left, right) => Order.String(left.factId, right.factId));
};
