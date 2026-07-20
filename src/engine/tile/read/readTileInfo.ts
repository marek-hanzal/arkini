import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { LocationSchema } from "~/engine/location/schema/LocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

export namespace readTileInfo {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Location =
		| {
				readonly kind: "board";
				readonly space: number;
		  }
		| {
				readonly kind: "inventory";
		  }
		| {
				readonly kind: "toolbar";
		  }
		| {
				readonly kind: "input";
		  }
		| {
				readonly kind: "job";
		  }
		| {
				readonly kind: "reserved";
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
} as const satisfies readTileInfo.Result;

const readLocation = (location: LocationSchema.Type): readTileInfo.Location =>
	match(location)
		.with(
			{
				scope: "board",
			},
			({ space }) => ({
				kind: "board" as const,
				space,
			}),
		)
		.with(
			{
				scope: "inventory",
			},
			() => ({
				kind: "inventory" as const,
			}),
		)
		.with(
			{
				scope: "toolbar",
			},
			() => ({
				kind: "toolbar" as const,
			}),
		)
		.with(
			{
				scope: "input",
			},
			() => ({
				kind: "input" as const,
			}),
		)
		.with(
			{
				scope: "job",
			},
			() => ({
				kind: "job" as const,
			}),
		)
		.with(
			{
				scope: "reserved",
			},
			() => ({
				kind: "reserved" as const,
			}),
		)
		.exhaustive();

/** Projects the common authored and live facts rendered only by the Info capability. */
export const readTileInfo = ({ itemId, runtime }: readTileInfo.Props): readTileInfo.Result => {
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
