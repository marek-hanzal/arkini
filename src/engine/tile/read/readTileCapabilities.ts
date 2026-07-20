import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { TileCapabilityEnumSchema } from "~/engine/tile/schema/TileCapabilityEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readTileEffects } from "~/engine/tile/read/readTileEffects";

const noCapabilities: readonly TileCapabilityEnumSchema.Type[] = [];
const infoCapability: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
];
const lineOwnerCapabilities: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
	"status",
	"lines",
	"effects",
];
const infoAndEffectsCapabilities: readonly TileCapabilityEnumSchema.Type[] = [
	"info",
	"effects",
];

/** Classifies the focused workspaces supported by one exact live runtime item. */
export const readTileCapabilities = (
	item: RuntimeItemSchema.Type | undefined,
	runtime?: RuntimeSchema.Type,
): readonly TileCapabilityEnumSchema.Type[] => {
	if (item === undefined) return noCapabilities;
	if (isLineOwnerItem(item.item)) return lineOwnerCapabilities;
	if (runtime === undefined) return infoCapability;
	const effects = readTileEffects({
		itemId: item.id,
		runtime,
	});
	return effects.kind === "available" && effects.outgoing.length > 0
		? infoAndEffectsCapabilities
		: infoCapability;
};
