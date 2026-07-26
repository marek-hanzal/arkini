import type { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { TileActorVisual } from "~/bridge/tile/TileActorVisual";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly id: string;
	readonly revision: string;
	readonly quantity: number;
	readonly location: GridLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly running: boolean;
	readonly runningGlow: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
