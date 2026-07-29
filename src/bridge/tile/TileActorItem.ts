import type { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { TileActorVisual } from "~/bridge/tile/TileActorVisual";
import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly badgeCount?: number;
	readonly badgeKind?: "queue";
	readonly id: string;
	readonly footprint: GridSizeSchema.Type;
	readonly itemType: ItemEnumSchema.Type;
	readonly revision: string;
	readonly quantity: number;
	readonly location: GridLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly progressRatio?: number;
	readonly running: boolean;
	readonly activityEffect: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
