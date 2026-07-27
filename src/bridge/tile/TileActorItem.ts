import type { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { TileActorVisual } from "~/bridge/tile/TileActorVisual";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly badgeCount?: number;
	readonly id: string;
	readonly itemType: ItemEnumSchema.Type;
	readonly revision: string;
	readonly quantity: number;
	readonly location: GridLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly progressRatio?: number;
	readonly running: boolean;
	readonly runningGlow: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
