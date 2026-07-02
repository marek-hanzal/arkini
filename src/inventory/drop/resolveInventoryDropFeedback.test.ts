import { describe, expect, it } from "vitest";
import { resolveInventoryDropFeedback } from "~/inventory/drop/resolveInventoryDropFeedback";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

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

const occupiedInventory = rebuildInventoryView([
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
		stack: {
			id: "stack:target",
			itemId: "item:pebble",
			quantity: 1,
		},
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

	it("marks occupied inventory swap targets as blocked target feedback", () => {
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
				inventory: occupiedInventory,
			}),
		).toEqual({
			effect: "blocked",
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
