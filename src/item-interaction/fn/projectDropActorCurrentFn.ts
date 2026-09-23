import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

export interface DropTransferActor {
	readonly id: string;
	readonly item: {
		readonly uid: string;
	};
	readonly revision: string;
	readonly location: BoardLocationSchema.Type;
}

/** Projects the canonical current actor shape shared by drop commit results. */
export const projectDropActorCurrentFn = (item: DropTransferActor | undefined) => {
	return item === undefined
		? null
		: {
				itemId: item.id,
				itemUid: item.item.uid,
				revision: item.revision,
				location: item.location,
			};
};
