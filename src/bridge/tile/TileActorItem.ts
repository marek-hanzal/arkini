import type { readRuntimeItemPrimaryAction } from "~/engine/item-detail/read/readRuntimeItemPrimaryAction";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem {
	readonly id: string;
	readonly revision: string;
	readonly itemId: string;
	readonly title: string;
	readonly quantity: number;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
	readonly location: GridLocationSchema.Type;
	readonly jobStatus?: JobStatusEnumSchema.Type;
	readonly running: boolean;
	readonly primaryAction: readRuntimeItemPrimaryAction.Result;
}
