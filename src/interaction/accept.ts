import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";

type AcceptPlan = Omit<
	Extract<
		DropPlan<ItemId, VisualTransitionKind, VisualMeta>,
		{
			type: "accept";
		}
	>,
	"type"
>;

export const accept = (plan: AcceptPlan): DropPlan<ItemId, VisualTransitionKind, VisualMeta> => ({
	type: "accept",
	animationTiming: "afterCommit",
	...plan,
	hide: (plan.hide ?? []).filter(Boolean),
});
