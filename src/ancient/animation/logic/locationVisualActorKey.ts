import type { ItemLocationSchema } from "~/item-instance/type/ItemLocationSchema";
import { visualBoardItemKey, visualInventoryStackKey } from "~/play/hook/useVisualItemMotions";

export namespace locationVisualActorKey {
	export interface Props {
		itemInstanceId?: string;
		location: ItemLocationSchema.Type;
	}
}

export const locationVisualActorKey = ({
	itemInstanceId,
	location,
}: locationVisualActorKey.Props) => {
	if (location.kind === "board" && itemInstanceId) return visualBoardItemKey(itemInstanceId);
	if (location.kind === "inventory" && itemInstanceId)
		return visualInventoryStackKey(itemInstanceId);
	return undefined;
};
