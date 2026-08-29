import { match } from "ts-pattern";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";

export namespace readAttractionActorIdFn {
	export interface Props {
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly targetItem: TileActorItem | null;
	}
}

/** Selects only an engine-confirmed occupied combine target for magnetic attraction. */
export const readAttractionActorIdFn = ({
	previewKind,
	targetItem,
}: readAttractionActorIdFn.Props): string | null => {
	if (targetItem === null) return null;
	return match(previewKind)
		.with(null, () => null)
		.with(
			DropItemResultKind.Merge,
			DropItemResultKind.Stack,
			DropItemResultKind.StoreInput,
			() => targetItem.id,
		)
		.with(
			DropItemResultKind.Ignored,
			DropItemResultKind.Move,
			DropItemResultKind.Reject,
			DropItemResultKind.StoreInventory,
			DropItemResultKind.Swap,
			() => null,
		)
		.exhaustive();
};
