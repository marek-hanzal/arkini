import {
	projectDropActorCurrentFn,
	type DropTransferActor,
} from "~/item-interaction/fn/projectDropActorCurrentFn";

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
		itemUid: before.item.uid,
		previousRevision: before.revision,
		previousLocation: before.location,
		current: projectDropActorCurrentFn(after),
	};
};
