import { Equal } from "effect";
import { useMemo } from "react";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";

/** Keeps structurally unchanged live Item Detail line projections referentially stable. */
export const useItemDetailLinesEquality = () =>
	useMemo(
		() => (left: ItemDetailLines.Projection, right: ItemDetailLines.Projection) =>
			Equal.equals(left, right),
		[],
	);
