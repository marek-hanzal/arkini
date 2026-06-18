import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import { toTileEngineEnterMotion } from "~/v0/play/tile-engine-motion/toTileEngineEnterMotion";
import { registerTileEngineMotionRequests } from "~/v0/tile-engine";
import type { TileEngineMotionRequest } from "~/v0/tile-engine";

export namespace registerTileEngineEnterRequests {
	export interface Props {
		board: BoardView | undefined;
		events: readonly ActionVisualEventSchema.Type[];
		inventory: InventoryView | undefined;
	}
}

const boardEnterRequests = ({
	board,
	events,
}: {
	board: BoardView | undefined;
	events: readonly ActionVisualEventSchema.Type[];
}): readonly TileEngineMotionRequest[] => {
	if (!board) return [];

	return events.flatMap((event) => {
		if (event.type === "item.spawned") {
			if (event.to.kind !== "board" || !event.itemInstanceId) return [];
			if (!board.byId[event.itemInstanceId]) return [];

			return [
				{
					cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
					tileId: event.itemInstanceId,
					enter: toTileEngineEnterMotion(event.animation, {
						fromTileId: event.originItemInstanceId,
					}),
				},
			];
		}

		if (event.type === "item.merged") {
			if (!board.byId[event.targetItemInstanceId]) return [];

			return [
				{
					cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
					tileId: event.targetItemInstanceId,
					enter: toTileEngineEnterMotion(event.animation),
				},
			];
		}

		if (event.type === "item.replaced" && event.animation) {
			if (!board.byId[event.itemInstanceId]) return [];

			return [
				{
					cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
					tileId: event.itemInstanceId,
					enter: toTileEngineEnterMotion(event.animation),
				},
			];
		}

		return [];
	});
};

const inventoryEnterRequests = ({
	events,
	inventory,
}: {
	events: readonly ActionVisualEventSchema.Type[];
	inventory: InventoryView | undefined;
}): readonly TileEngineMotionRequest[] => {
	if (!inventory) return [];

	return events.flatMap((event) => {
		if (event.type !== "item.spawned" || event.to.kind !== "inventory") return [];

		const slot = inventory.bySlotIndex[String(event.to.slotIndex)];
		const stack = slot?.stack;
		if (!stack) return [];

		return [
			{
				cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
				tileId: stack.id,
				enter: toTileEngineEnterMotion(event.animation, {
					fromTileId: event.originItemInstanceId,
				}),
			},
		];
	});
};

export const registerTileEngineEnterRequests = ({
	board,
	events,
	inventory,
}: registerTileEngineEnterRequests.Props) => {
	registerTileEngineMotionRequests({
		engineId: "board",
		requests: boardEnterRequests({
			board,
			events,
		}),
	});
	registerTileEngineMotionRequests({
		engineId: "inventory",
		requests: inventoryEnterRequests({
			events,
			inventory,
		}),
	});
};
