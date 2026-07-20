import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { TileCapabilityEnumSchema } from "~/engine/tile/schema/TileCapabilityEnumSchema";

const noCapabilities: readonly TileCapabilityEnumSchema.Type[] = [];
const infoCapability: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
];

/** Classifies the focused workspaces supported by one exact live runtime item. */
export const readTileCapabilities = (
	item: RuntimeItemSchema.Type | undefined,
): readonly TileCapabilityEnumSchema.Type[] =>
	item === undefined ? noCapabilities : infoCapability;
