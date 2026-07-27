import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

interface DropTransferActor {
	readonly id: string;
	readonly item: {
		readonly id: string;
	};
	readonly revision: string;
	readonly location: GridLocationSchema.Type;
	readonly quantity: number;
}

/** Projects the shared current actor shape used by stack, merge, and input commits. */
export const projectDropActorCurrent = (item: DropTransferActor | undefined) =>
	item === undefined
		? null
		: {
				itemId: item.id,
				canonicalItemId: item.item.id,
				revision: item.revision,
				location: item.location,
				quantity: item.quantity,
			};

/** Projects the shared before/after transfer actor shape. */
export const projectDropTransferActor = ({
	after,
	before,
}: {
	readonly after: DropTransferActor | undefined;
	readonly before: DropTransferActor;
}) => ({
	itemId: before.id,
	canonicalItemId: before.item.id,
	previousRevision: before.revision,
	previousLocation: before.location,
	previousQuantity: before.quantity,
	current: projectDropActorCurrent(after),
});
