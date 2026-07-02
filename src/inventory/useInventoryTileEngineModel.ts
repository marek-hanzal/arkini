import { useCallback, useMemo } from "react";
import { resolveInventoryDropFeedback } from "~/inventory/drop/resolveInventoryDropFeedback";
import { resolveInventorySlotTapAction } from "~/inventory/logic/resolveInventorySlotTapAction";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { resolveDrop } from "~/play/drop/resolveDrop";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";
import { readBoardFirstEmptyCell } from "~/play/runtime/readers/readBoardFirstEmptyCell";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

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
		columns: number;
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
	const inventory = useGameInventoryView();
	const columns = useGameRuntimeSelector((state) => state.runtime.config.game.board.width);
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
		({
			expectedItemId,
			expectedStackId,
			slotIndex,
		}: {
			expectedItemId: string;
			expectedStackId: string;
			slotIndex: number;
		}) => {
			const snapshot = runtimeStore.getSnapshot();
			const liveInventory = readInventoryView(snapshot);
			const liveSlot = liveInventory.bySlotIndex[String(slotIndex)];
			if (
				!liveSlot?.stack ||
				liveSlot.stack.id !== expectedStackId ||
				liveSlot.stack.itemId !== expectedItemId
			) {
				feedback.flashInventorySlot(slotIndex);
				return;
			}

			if (placementTarget) {
				void actions
					.placeInventoryItem({
						expectedItemId: liveSlot.stack.itemId,
						expectedStackId: liveSlot.stack.id,
						placementMode: "nearest_by_manhattan",
						quantity: 1,
						slotIndex,
						x: placementTarget.x,
						y: placementTarget.y,
					})
					.catch(feedback.showError);
				return;
			}

			const action = resolveInventorySlotTapAction({
				firstEmptyCell: readBoardFirstEmptyCell(snapshot),
				slot: liveSlot,
			});

			if (action.type === "flash-inventory-slot") {
				feedback.flashInventorySlot(action.slotIndex);
				return;
			}

			void actions
				.placeInventoryItem({
					expectedItemId: liveSlot.stack.itemId,
					expectedStackId: liveSlot.stack.id,
					slotIndex: action.slotIndex,
					x: action.x,
					y: action.y,
				})
				.catch(feedback.showError);
		},
		[
			actions,
			feedback,
			placementTarget,
			runtimeStore,
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
					onDoubleActivate: () =>
						placeInventoryOnBoard({
							expectedItemId: stack.itemId,
							expectedStackId: stack.id,
							slotIndex: slot.slotIndex,
						}),
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
				const snapshot = runtimeStore.getSnapshot();

				return resolveInventoryDropFeedback({
					context,
					inventory: readInventoryView(snapshot),
				});
			},
			onDrop(context) {
				const snapshot = runtimeStore.getSnapshot();
				const nowMs = Date.now();

				return resolveDrop({
					context,
					board: readBoardView(snapshot, nowMs),
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
			runtimeStore,
		],
	);

	return {
		columns,
		drag,
		slots,
		tiles,
	};
};
