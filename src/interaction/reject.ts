import type { DropPlan } from "~/drag/DropPlan";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";

export const reject = (
	feedback?: () => void,
): DropPlan<string, VisualTransitionKind, VisualMeta> => ({
	type: "reject",
	feedback,
});
