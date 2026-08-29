import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

export interface DropTransferActor {
	readonly id: string;
	readonly item: {
		readonly id: string;
	};
	readonly revision: string;
	readonly location: GridLocationSchema.Type;
	readonly quantity: number;
}

/** Projects the canonical current actor shape shared by drop commit results. */
export const projectDropActorCurrentFn = (item: DropTransferActor | undefined) => {
	return item === undefined
		? null
		: {
				itemId: item.id,
				canonicalItemId: item.item.id,
				revision: item.revision,
				location: item.location,
				quantity: item.quantity,
			};
};
