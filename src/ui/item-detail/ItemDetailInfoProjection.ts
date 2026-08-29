import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { readItemDetailInfoFx } from "~/engine/item-detail/read/readItemDetailInfoFx";
import type { StorageSchema } from "~/engine/scope/schema/StorageSchema";

export type ItemDetailInfoProjection =
	| {
			readonly kind: "available";
			readonly itemId: IdSchema.Type;
			readonly description: string;
			readonly itemType: TypeSchema.Type;
			readonly storageScope: StorageSchema.Type;
			readonly location: readItemDetailInfoFx.Location;
			readonly quantity: number;
			readonly maxStackSize: number;
			readonly ownedQuantity: number;
			readonly maxCount?: number;
			readonly charges?: {
				readonly remaining: number;
				readonly total: number;
			};
	  }
	| {
			readonly kind: "unavailable";
	  };
