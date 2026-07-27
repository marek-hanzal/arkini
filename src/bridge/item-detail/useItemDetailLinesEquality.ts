import { Equal } from "effect";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";

/** Keeps structurally unchanged live Item Detail line projections referentially stable. */
export const useItemDetailLinesEquality = (): ((
	left: ItemDetailLines.Projection,
	right: ItemDetailLines.Projection,
) => boolean) => Equal.equals;
