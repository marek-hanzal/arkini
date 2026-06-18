import { useCallback, useMemo } from "react";
import { resolveInventoryDropFeedback } from "~/v0/inventory/drop/resolveInventoryDropFeedback";
import { resolveInventorySlotTapAction } from "~/v0/inventory/logic/resolveInventorySlotTapAction";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import {
	useGameBoardFirstEmptyCell,
	useGameInventoryView,
	useGameRuntimeDropActions,
	useGameRuntimeStore,
} from "~/v0/play/runtime";
import { readBoardView, readInventoryView } from "~/v0/play/runtime/readers";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace useInventoryTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		placementTarget?: {
			x: number;
			y: number;
		};
	}

	export interface Result {
		slots: TileEngine.Slot<InventorySurface.SlotData>[];
		tiles: TileEngine.Tile<InventorySurface.TileData>[];
		drag: TileEngine.DragConfig<
			InventorySurface.TileData,
			InventorySurface.SlotData,
			DragSource,
			DropTarget
		>;
	}
}

export const useInventoryTileEngineModel = ({
	feedback,
	placementTarget,
}: useInventoryTileEngineModel.Props): useInventoryTileEngineModel.Result => {
	const firstEmptyCell = useGameBoardFirstEmptyCell();
	const inventory = useGameInventoryView();
	const actions = useGameRuntimeDropActions();
	const runtimeStore = useGameRuntimeStore();

	const slotLayoutKey = inventory.slots.map((slot) => slot.slotIndex).join("|");
	const slots = useMemo(
		() =>
			inventory.slots.map((slot) => ({
				id: String(slot.slotIndex),
				dropId: `inventory-slot:${slot.slotIndex}`,
				renderKey: slot.slotIndex,
				data: {
					slotIndex: slot.slotIndex,
				},
			})) satisfies TileEngine.Slot<InventorySurface.SlotData>[],
		[
			slotLayoutKey,
			inventory.slots,
		],
	);

	const tiles = useMemo(
		() =>
			inventory.slots.flatMap((slot) => {
				const stack = slot.stack;
				if (!stack) return [];

				return [
					{
						id: stack.id,
						slotId: String(slot.slotIndex),
						renderKey: `inventory:${stack.id}:${slot.slotIndex}:${stack.itemId}:${stack.quantity}`,
						data: {
							slotIndex: slot.slotIndex,
							stackId: stack.id,
							itemId: stack.itemId,
							quantity: stack.quantity,
						},
					},
				] satisfies TileEngine.Tile<InventorySurface.TileData>[];
			}),
		[
			inventory.slots,
		],
	);

	const placeInventoryOnBoard = useCallback(
		(slot: InventorySlot) => {
			const placementStack = slot.stack;
			if (placementTarget) {
				if (!placementStack) {
					feedback.flashInventorySlot(slot.slotIndex);
					return;
				}

				void actions
					.placeInventoryItem({
						placementMode: "nearest_by_manhattan",
						quantity: 1,
						slotIndex: slot.slotIndex,
						x: placementTarget.x,
						y: placementTarget.y,
					})
					.catch(feedback.showError);
				return;
			}

			const action = resolveInventorySlotTapAction({
				firstEmptyCell,
				slot,
			});

			if (action.type === "flash-inventory-slot") {
				feedback.flashInventorySlot(action.slotIndex);
				return;
			}

			void actions
				.placeInventoryItem({
					slotIndex: action.slotIndex,
					x: action.x,
					y: action.y,
				})
				.catch(feedback.showError);
		},
		[
			actions,
			firstEmptyCell,
			feedback,
			placementTarget,
		],
	);

	const drag = useMemo<
		TileEngine.DragConfig<
			InventorySurface.TileData,
			InventorySurface.SlotData,
			DragSource,
			DropTarget
		>
	>(
		() => ({
			tile(tile) {
				const slot = inventory.bySlotIndex[String(tile.data.slotIndex)];
				const stack = slot?.stack;
				if (!slot || !stack) return undefined;

				return {
					id: `inventory:${slot.slotIndex}`,
					data: {
						kind: "inventory",
						slotIndex: slot.slotIndex,
						itemId: stack.itemId,
						slot,
					},
					onDoubleActivate: () => placeInventoryOnBoard(slot),
				};
			},
			slot(slot) {
				return {
					data: {
						kind: "inventory-slot",
						slotIndex: slot.data.slotIndex,
					},
				};
			},
			dropFeedback(context) {
				return resolveInventoryDropFeedback({
					context,
				});
			},
			onDrop(context) {
				const snapshot = runtimeStore.getSnapshot();

				return resolveDrop({
					context,
					board: readBoardView(snapshot),
					config: snapshot.runtime.config,
					inventory: readInventoryView(snapshot),
					feedback,
					actions,
				});
			},
		}),
		[
			actions,
			feedback,
			inventory,
			placeInventoryOnBoard,
			placementTarget,
			runtimeStore,
		],
	);

	return {
		drag,
		slots,
		tiles,
	};
};
