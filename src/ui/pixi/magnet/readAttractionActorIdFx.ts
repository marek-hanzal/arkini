import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";

export namespace readAttractionActorIdFx {
	export interface Props {
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly targetItem: TileActorItem | null;
	}
}

/** Selects only an engine-confirmed occupied combine target for magnetic attraction. */
export const readAttractionActorIdFx = Effect.fn("readAttractionActorIdFx")(
	({ previewKind, targetItem }: readAttractionActorIdFx.Props) =>
		Effect.sync(() => {
			if (targetItem === null) return null;
			return match(previewKind)
				.with(null, () => null)
				.with(
					DropItemResultKindEnumSchema.enum.Merge,
					DropItemResultKindEnumSchema.enum.Stack,
					DropItemResultKindEnumSchema.enum.StoreInput,
					() => targetItem.id,
				)
				.with(
					DropItemResultKindEnumSchema.enum.Ignored,
					DropItemResultKindEnumSchema.enum.Move,
					DropItemResultKindEnumSchema.enum.Reject,
					DropItemResultKindEnumSchema.enum.StoreInventory,
					DropItemResultKindEnumSchema.enum.Swap,
					() => null,
				)
				.exhaustive();
		}),
);
