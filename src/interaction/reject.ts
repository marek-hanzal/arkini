import type { DropPlan } from "~/drag/DropPlan";
import type { FlyerKind, VisualMeta } from "~/play/types";

export const reject = (feedback?: () => void): DropPlan<string, FlyerKind, VisualMeta> => ({
	type: "reject",
	feedback,
});
