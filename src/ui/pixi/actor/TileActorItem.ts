import type { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { TileActorVisual } from "~/ui/pixi/actor/TileActorVisual";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly badgeCount?: number;
	readonly badgeKind?: "queue";
	readonly id: string;
	readonly itemType: TypeSchema.Type;
	readonly revision: string;
	readonly quantity: number;
	readonly location: GridLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly progressRatio?: number;
	readonly running: boolean;
	readonly activityEffect: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
