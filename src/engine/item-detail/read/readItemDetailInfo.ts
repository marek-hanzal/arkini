import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { LocationSchema } from "~/engine/location/schema/LocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readItemDetailInfo {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Location =
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Board;
				readonly space: number;
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Inventory;
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Toolbar;
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Input;
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Job;
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Reserved;
		  };

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly description: string;
				readonly itemType: ItemEnumSchema.Type;
				readonly categoryId: IdSchema.Type;
				readonly tags: readonly string[];
				readonly storageScope: StorageScopeEnumSchema.Type;
				readonly location: Location;
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
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailInfo.Result;

const readLocation = (location: LocationSchema.Type): readItemDetailInfo.Location =>
	match(location)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Board,
			},
			({ space }) => ({
				kind: LocationScopeEnumSchema.enum.Board,
				space,
			}),
		)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Inventory,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Inventory,
			}),
		)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Toolbar,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Toolbar,
			}),
		)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Input,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Input,
			}),
		)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Job,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Job,
			}),
		)
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Reserved,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Reserved,
			}),
		)
		.exhaustive();

/** Projects the common authored and live facts rendered only by the Info capability. */
export const readItemDetailInfo = ({
	itemId,
	runtime,
}: readItemDetailInfo.Props): readItemDetailInfo.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	const totalCharges = item.item.charges?.amount;
	return {
		kind: "available",
		itemId: item.id,
		description: item.item.description,
		itemType: item.item.type,
		categoryId: item.item.categoryId,
		tags: [
			...item.item.tags,
		],
		storageScope: item.item.scope,
		location: readLocation(item.location),
		quantity: item.quantity,
		maxStackSize: item.item.maxStackSize,
		ownedQuantity: runtime.items.reduce(
			(total, candidate) =>
				candidate.item.id === item.item.id ? total + candidate.quantity : total,
			0,
		),
		...(item.item.maxCount === undefined
			? {}
			: {
					maxCount: item.item.maxCount,
				}),
		...(totalCharges === undefined
			? {}
			: {
					charges: {
						remaining: item.remainingCharges ?? totalCharges,
						total: totalCharges,
					},
				}),
	};
};
