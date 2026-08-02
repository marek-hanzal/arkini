import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { readItemDetailInfoFx } from "~/engine/item-detail/read/readItemDetailInfoFx";
import type { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

export type ItemDetailInfoProjection =
	| {
			readonly kind: "available";
			readonly itemId: IdSchema.Type;
			readonly description: string;
			readonly itemType: ItemEnumSchema.Type;
			readonly tags: readonly string[];
			readonly storageScope: StorageScopeEnumSchema.Type;
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
