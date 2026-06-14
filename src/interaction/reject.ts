import type { DropPlan } from "~/drag/hook/useDraggableControl";
import type { FlyerKind, VisualMeta } from "~/play/types";

export const reject = (feedback?: () => void): DropPlan<string, FlyerKind, VisualMeta> => ({
	type: "reject",
	feedback,
});
