import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";

export const reject = (
	feedback?: () => void,
): DropPlan<ItemId, VisualTransitionKind, VisualMeta> => ({
	type: "reject",
	feedback,
});
