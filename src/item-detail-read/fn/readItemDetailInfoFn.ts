import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace readItemDetailInfoFn {
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
		  }
		| {
				readonly kind: typeof LocationScopeEnumSchema.enum.Delivery;
		  };

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly description: string;
				readonly itemType: TypeSchema.Type;
				readonly storageScope: StorageSchema.Type;
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
} as const satisfies readItemDetailInfoFn.Result;

const readLocationFn = (location: LocationSchema.Type): readItemDetailInfoFn.Location =>
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
		.with(
			{
				scope: LocationScopeEnumSchema.enum.Delivery,
			},
			() => ({
				kind: LocationScopeEnumSchema.enum.Delivery,
			}),
		)
		.exhaustive();

/** Projects the common authored and live facts rendered only by the Info capability. */
export const readItemDetailInfoFn = ({
	itemId,
	runtime,
}: readItemDetailInfoFn.Props): readItemDetailInfoFn.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	const totalCharges = item.item.charges?.amount;
	return {
		kind: "available",
		itemId: item.id,
		description: item.item.description,
		itemType: item.item.type,
		storageScope: item.item.scope,
		location: readLocationFn(item.location),
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
