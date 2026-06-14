import type { DropPlan } from "~/drag/DropPlan";
import type { FlyerKind, VisualMeta } from "~/play/types";

type AcceptPlan = Omit<
	Extract<
		DropPlan<string, FlyerKind, VisualMeta>,
		{
			type: "accept";
		}
	>,
	"type"
>;

export const accept = (plan: AcceptPlan): DropPlan<string, FlyerKind, VisualMeta> => ({
	type: "accept",
	animationTiming: "afterCommit",
	...plan,
	hide: (plan.hide ?? []).filter(Boolean),
});
