import { useCallback, useMemo } from "react";
import { match } from "ts-pattern";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { resolveInventorySlotTapAction } from "~/inventory/control/resolveInventorySlotTapAction";
import { resolveInventoryDropFeedback } from "~/inventory/drop/resolveInventoryDropFeedback";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { createRuntimeDropLifecycle } from "~/play/drag/createRuntimeDropLifecycle";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";
import { readBoardFirstEmptyCell } from "~/play/runtime/readers/readBoardFirstEmptyCell";
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
		drag: InventoryTileEngineDragConfig;
	}
}

type InventoryTileEngineDragConfig = TileEngine.DragConfig<
	InventorySurface.TileData,
	InventorySurface.SlotData,
	DragSource,
	DropTarget
>;

type InventoryTileEngineTile = Parameters<InventoryTileEngineDragConfig["tile"]>[0];
type InventoryTileEngineSlot = Parameters<InventoryTileEngineDragConfig["slot"]>[0];

type PlaceInventoryOnBoardInput = {
	expectedItemId: string;
	expectedStackId: string;
	slotIndex: number;
};

const useInventorySurfaceSlots = ({
	inventory,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
}) => {
	const slotLayoutKey = inventory.slots.map((slot) => slot.slotIndex).join("|");
	return useMemo(
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
};

const useInventorySurfaceTiles = ({
	inventory,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
}) =>
	useMemo(
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

const placeInventoryAtPlacementSeed = ({
	actions,
	feedback,
	input,
	placementTarget,
	stack,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	feedback: Feedback.Type;
	input: PlaceInventoryOnBoardInput;
	placementTarget: NonNullable<useInventoryTileEngineModel.Props["placementTarget"]>;
	stack: NonNullable<ReturnType<typeof useGameInventoryView>["slots"][number]["stack"]>;
}) => {
	void actions
		.placeInventoryItem({
			expectedItemId: stack.itemId,
			expectedStackId: stack.id,
			placementMode: "nearest_by_manhattan",
			quantity: 1,
			slotIndex: input.slotIndex,
			x: placementTarget.x,
			y: placementTarget.y,
		})
		.catch(feedback.showError);
};

const placeInventoryFromTapAction = ({
	actions,
	feedback,
	input,
	snapshot,
	stack,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	feedback: Feedback.Type;
	input: PlaceInventoryOnBoardInput;
	snapshot: ReturnType<ReturnType<typeof useGameRuntimeStore>["getSnapshot"]>;
	stack: NonNullable<ReturnType<typeof useGameInventoryView>["slots"][number]["stack"]>;
}) => {
	const action = resolveInventorySlotTapAction({
		firstEmptyCell: readBoardFirstEmptyCell(snapshot),
		slot: readInventoryView(snapshot).bySlotIndex[String(input.slotIndex)]!,
	});

	match(action)
		.with(
			{
				type: "flash-inventory-slot",
			},
			({ slotIndex }) => feedback.flashInventorySlot(slotIndex),
		)
		.with(
			{
				type: "place-on-board",
			},
			({ slotIndex, x, y }) => {
				void actions
					.placeInventoryItem({
						expectedItemId: stack.itemId,
						expectedStackId: stack.id,
						slotIndex,
						x,
						y,
					})
					.catch(feedback.showError);
			},
		)
		.exhaustive();
};

const usePlaceInventoryOnBoard = ({
	actions,
	feedback,
	placementTarget,
	runtimeStore,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	feedback: Feedback.Type;
	placementTarget: useInventoryTileEngineModel.Props["placementTarget"];
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) =>
	useCallback(
		(input: PlaceInventoryOnBoardInput) => {
			const snapshot = runtimeStore.getSnapshot();
			const liveInventory = readInventoryView(snapshot);
			const liveSlot = liveInventory.bySlotIndex[String(input.slotIndex)];
			const stack = liveSlot?.stack;
			if (
				!stack ||
				stack.id !== input.expectedStackId ||
				stack.itemId !== input.expectedItemId
			) {
				feedback.flashInventorySlot(input.slotIndex);
				return;
			}

			if (placementTarget) {
				placeInventoryAtPlacementSeed({
					actions,
					feedback,
					input,
					placementTarget,
					stack,
				});
				return;
			}

			placeInventoryFromTapAction({
				actions,
				feedback,
				input,
				snapshot,
				stack,
			});
		},
		[
			actions,
			feedback,
			placementTarget,
			runtimeStore,
		],
	);

const readInventoryTileDragActor = ({
	inventory,
	placeInventoryOnBoard,
	tile,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
	placeInventoryOnBoard(input: PlaceInventoryOnBoardInput): void;
	tile: InventoryTileEngineTile;
}) => {
	const slot = inventory.bySlotIndex[String(tile.data.slotIndex)];
	const stack = slot?.stack;
	if (!slot || !stack) return undefined;

	return {
		id: `inventory:${slot.slotIndex}`,
		data: {
			kind: "inventory" as const,
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
};

const readInventorySlotDropTarget = ({ slot }: { slot: InventoryTileEngineSlot }) => ({
	data: {
		kind: "inventory-slot" as const,
		slotIndex: slot.data.slotIndex,
	},
});

const readInventoryDropFeedbackFromRuntimeSnapshot = ({
	context,
	runtimeStore,
}: {
	context: Parameters<NonNullable<InventoryTileEngineDragConfig["dropFeedback"]>>[0];
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) =>
	resolveInventoryDropFeedback({
		context,
		inventory: readInventoryView(runtimeStore.getSnapshot()),
	});

const useInventoryDragConfig = ({
	actions,
	audio,
	feedback,
	inventory,
	placeInventoryOnBoard,
	runtimeStore,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	audio: ReturnType<typeof useGameAudio>;
	feedback: Feedback.Type;
	inventory: ReturnType<typeof useGameInventoryView>;
	placeInventoryOnBoard(input: PlaceInventoryOnBoardInput): void;
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}): InventoryTileEngineDragConfig =>
	useMemo(
		() => ({
			tile: (tile) =>
				readInventoryTileDragActor({
					inventory,
					placeInventoryOnBoard,
					tile,
				}),
			slot: (slot) =>
				readInventorySlotDropTarget({
					slot,
				}),
			dropFeedback: (context) =>
				readInventoryDropFeedbackFromRuntimeSnapshot({
					context,
					runtimeStore,
				}),
			...createRuntimeDropLifecycle<InventorySurface.TileData, InventorySurface.SlotData>({
				actions,
				audio,
				feedback,
				runtimeStore,
			}),
		}),
		[
			actions,
			audio,
			feedback,
			inventory,
			placeInventoryOnBoard,
			runtimeStore,
		],
	);

export const useInventoryTileEngineModel = ({
	feedback,
	placementTarget,
}: useInventoryTileEngineModel.Props): useInventoryTileEngineModel.Result => {
	const audio = useGameAudio();
	const inventory = useGameInventoryView();
	const columns = useGameRuntimeSelector((state) => state.runtime.config.game.board.width);
	const actions = useGameRuntimeDropActions();
	const runtimeStore = useGameRuntimeStore();
	const slots = useInventorySurfaceSlots({
		inventory,
	});
	const tiles = useInventorySurfaceTiles({
		inventory,
	});
	const placeInventoryOnBoard = usePlaceInventoryOnBoard({
		actions,
		feedback,
		placementTarget,
		runtimeStore,
	});
	const drag = useInventoryDragConfig({
		actions,
		audio,
		feedback,
		inventory,
		placeInventoryOnBoard,
		runtimeStore,
	});

	return {
		columns,
		drag,
		slots,
		tiles,
	};
};
