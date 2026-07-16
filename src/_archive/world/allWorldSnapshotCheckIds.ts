import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";

export const allWorldSnapshotCheckIds = [
	"job-delivery",
	"producer-queues",
	"active-effects",
	"replacement-safety",
] as const satisfies readonly WorldSnapshotCheckId[];
