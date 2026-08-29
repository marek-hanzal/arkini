import {
	projectDropActorCurrentFn,
	type DropTransferActor,
} from "~/engine/runtime/drop/fn/projectDropActorCurrentFn";

export namespace projectDropTransferActorFn {
	export interface Props {
		readonly after: DropTransferActor | undefined;
		readonly before: DropTransferActor;
	}
}

/** Projects the shared before/after actor shape used by drop commit results. */
export const projectDropTransferActorFn = ({ after, before }: projectDropTransferActorFn.Props) => {
	return {
		itemId: before.id,
		canonicalItemId: before.item.id,
		previousRevision: before.revision,
		previousLocation: before.location,
		previousQuantity: before.quantity,
		current: projectDropActorCurrentFn(after),
	};
};
