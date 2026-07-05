import { useCallback } from "react";
import { match } from "ts-pattern";
import { resolveInventorySlotTapAction } from "~/inventory/control/resolveInventorySlotTapAction";
import type {
	InventoryPlacementTarget,
	PlaceInventoryOnBoardInput,
} from "~/inventory/InventoryTileEngineModelTypes";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { readBoardFirstEmptyCell } from "~/play/runtime/readers/readBoardFirstEmptyCell";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";

type InventoryStack = NonNullable<
	ReturnType<typeof useGameInventoryView>["slots"][number]["stack"]
>;

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
	placementTarget: InventoryPlacementTarget;
	stack: InventoryStack;
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
	stack: InventoryStack;
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

export const usePlaceInventoryOnBoard = ({
	actions,
	feedback,
	placementTarget,
	runtimeStore,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	feedback: Feedback.Type;
	placementTarget?: InventoryPlacementTarget;
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
