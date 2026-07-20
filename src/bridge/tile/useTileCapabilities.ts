import { useCallback } from "react";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import { readTileCapabilities } from "~/engine/tile/read/readTileCapabilities";
import type { TileCapabilityEnumSchema } from "~/engine/tile/schema/TileCapabilityEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the explicit capabilities supported by one exact live tile identity. */
export namespace useTileCapabilities {
	export type Capability = TileCapabilityEnumSchema.Type;
}

export const useTileCapabilities = (
	itemId: IdSchema.Type,
): readonly useTileCapabilities.Capability[] => {
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readTileCapabilities(runtime.items.find((item) => item.id === itemId)),
		[
			itemId,
		],
	);
	return useRuntimeSelector(selector);
};
