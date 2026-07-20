import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { TileCapabilityEnumSchema } from "~/engine/tile/schema/TileCapabilityEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";

const noCapabilities: readonly TileCapabilityEnumSchema.Type[] = [];
const infoCapability: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
];
const lineOwnerCapabilities: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
	"status",
];

/** Classifies the focused workspaces supported by one exact live runtime item. */
export const readTileCapabilities = (
	item: RuntimeItemSchema.Type | undefined,
): readonly TileCapabilityEnumSchema.Type[] =>
	item === undefined
		? noCapabilities
		: isLineOwnerItem(item.item)
			? lineOwnerCapabilities
			: infoCapability;
