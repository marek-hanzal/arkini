import { describe, expect, it } from "vitest";
import { resolveInventoryDropFeedback } from "~/v0/inventory/drop/resolveInventoryDropFeedback";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

const source = {
	kind: "inventory",
	slotIndex: 0,
	itemId: "item:twig",
	slot: {
		slotIndex: 0,
		stack: {
			id: "stack:source",
			itemId: "item:twig",
			quantity: 1,
		},
	},
} satisfies DragSource;

const inventory = rebuildInventoryView([
	{
		slotIndex: 0,
		stack: {
			id: "stack:source",
			itemId: "item:twig",
			quantity: 1,
		},
	},
	{
		slotIndex: 1,
	},
]);

const staleInventory = rebuildInventoryView([
	{
		slotIndex: 0,
	},
	{
		slotIndex: 1,
	},
]);

const createContext = ({
	targetSlotIndex,
	targetTile,
}: {
	targetSlotIndex: number;
	targetTile?: TileEngine.Tile<InventorySurface.TileData> | null;
}): TileEngine.DragOverContext<
	InventorySurface.TileData,
	InventorySlot,
	DragSource,
	DropTarget
> => ({
	source,
	target: {
		kind: "inventory-slot",
		slotIndex: targetSlotIndex,
	},
	targetSlot: {
		id: String(targetSlotIndex),
		data: {
			slotIndex: targetSlotIndex,
		},
	},
	targetTile: targetTile ?? null,
	dropId: `inventory-slot:${targetSlotIndex}`,
});

describe("resolveInventoryDropFeedback", () => {
	it("returns no feedback for the source slot", () => {
		expect(
			resolveInventoryDropFeedback({
				context: createContext({
					targetSlotIndex: 0,
				}),
				inventory,
			}),
		).toBeNull();
	});

	it("returns empty feedback for empty inventory targets", () => {
		expect(
			resolveInventoryDropFeedback({
				context: createContext({
					targetSlotIndex: 1,
				}),
				inventory,
			}),
		).toEqual({
			effect: "empty",
		});
	});

	it("returns empty feedback for occupied inventory swap targets", () => {
		expect(
			resolveInventoryDropFeedback({
				context: createContext({
					targetSlotIndex: 1,
					targetTile: {
						id: "stack:target",
						slotId: "1",
						data: {
							slotIndex: 1,
							stackId: "stack:target",
							itemId: "item:pebble",
							quantity: 1,
						},
					},
				}),
				inventory,
			}),
		).toEqual({
			effect: "empty",
		});
	});

	it("blocks feedback for stale inventory sources", () => {
		expect(
			resolveInventoryDropFeedback({
				context: createContext({
					targetSlotIndex: 1,
				}),
				inventory: staleInventory,
			}),
		).toEqual({
			effect: "blocked",
		});
	});
});
