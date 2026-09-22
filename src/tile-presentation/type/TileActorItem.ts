import type { readRuntimeItemPrimaryActionFx } from "~/item-interaction/fx/readRuntimeItemPrimaryActionFx";
import type { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { TileActorVisual } from "~/tile-presentation/type/TileActorVisual";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly badgeCount?: number;
	readonly badgeKind?: "units" | "queue";
	readonly id: string;
	readonly revision: string;
	readonly location: BoardLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly progressRatio?: number;
	readonly clockPulse?: {
		readonly intervalMs: number;
		readonly remainingMs: number;
		readonly enabled: boolean;
	};
	/** Waiting-cursor presentation; instant jobs keep their status without flashing a wait. */
	readonly running: boolean;
	readonly activityEffect: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
