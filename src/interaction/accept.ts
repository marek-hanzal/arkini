import type { DropPlan } from "~/drag/DropPlan";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";

type AcceptPlan = Omit<
	Extract<
		DropPlan<string, VisualTransitionKind, VisualMeta>,
		{
			type: "accept";
		}
	>,
	"type"
>;

export const accept = (plan: AcceptPlan): DropPlan<string, VisualTransitionKind, VisualMeta> => ({
	type: "accept",
	animationTiming: "afterCommit",
	...plan,
	hide: (plan.hide ?? []).filter(Boolean),
});
