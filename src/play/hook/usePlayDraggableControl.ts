import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import { flashDrop } from "~/interaction/flashDrop";
import { getDragBoundaryNodeId } from "~/interaction/getDragBoundaryNodeId";
import { resolveDrop } from "~/interaction/resolveDrop";
import type { AnyDropContext, Feedback } from "~/interaction/types";
import { useCommand } from "~/play/hook/useCommand";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { BoardView, GameDragView, InventoryView } from "~/play/logic/playTypes";
import type { VisualTransitionKind, DragSource, DropTarget, VisualMeta } from "~/play/types";
import { tileEngineMotionDurationMs } from "~/tile-engine/hook/useTileEngineMotionAnimation";
import { waitForMs } from "~/shared/util/waitForMs";
import { resolveMagneticDropTarget } from "./resolveMagneticDropTarget";

export type { Feedback } from "~/interaction/types";

export namespace usePlayDraggableControl {
	export interface Props {
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

export function usePlayDraggableControl({
	feedback,
	schedule,
	visualMotions,
}: usePlayDraggableControl.Props) {
	const queryClient = useQueryClient();
	const items = usePlayItems().data;
	const command = useCommand({
		invalidateOnSuccess: true,
	});
	const run = command.mutateAsync;
	const readGame = useCallback((): GameDragView | undefined => {
		const board = queryClient.getQueryData<BoardView>(playQueryKeys.board);
		const inventory = queryClient.getQueryData<InventoryView>(playQueryKeys.inventory);

		if (!board || !inventory) return undefined;

		return {
			boardItemsById: board.byId,
			inventoryBySlotIndex: inventory.bySlotIndex,
		};
	}, [
		queryClient,
	]);
	const resolvePlayDrop = useCallback(
		(context: AnyDropContext) =>
			resolveDrop({
				context,
				game: readGame(),
				feedback,
				run,
			}),
		[
			feedback,
			readGame,
			run,
		],
	);
	const animate = useCallback(
		async (animation: {
			actorKey?: string;
			from: import("~/play/types").RectLike;
			to: import("~/play/types").RectLike;
		}) => {
			if (!animation.actorKey) return;
			visualMotions.stage([
				{
					key: animation.actorKey,
					from: animation.from,
					to: animation.to,
					priority: "raised",
				},
			]);
			await waitForMs(tileEngineMotionDurationMs);
		},
		[
			visualMotions,
		],
	);
	const onError = useCallback(
		(error: unknown, context: AnyDropContext) => {
			flashDrop({
				context,
				game: readGame(),
				feedback,
			});
			feedback.showError(error);
		},
		[
			feedback,
			readGame,
		],
	);
	const scheduleDrop = useCallback(
		(operation: () => Promise<void>) => schedule("drag/drop", operation),
		[
			schedule,
		],
	);
	const resolveBoundaryNodeId = useCallback(
		(source: DraggablePayload<string, DragSource, VisualMeta>) =>
			getDragBoundaryNodeId({
				source,
			}),
		[],
	);
	const control = useDraggableControl<
		string,
		DragSource,
		DropTarget,
		VisualMeta,
		VisualTransitionKind
	>({
		schedule: scheduleDrop,
		resolveDrop: resolvePlayDrop,
		resolveMagneticDropTarget: resolveMagneticDropTarget,
		animate,
		onError,
		getDragBoundaryNodeId: resolveBoundaryNodeId,
	});

	const activeItem =
		control.activeDrag && items ? (items[control.activeDrag.itemId] ?? null) : null;

	return useMemo(
		() => ({
			...control,
			activeItem,
		}),
		[
			activeItem,
			control,
		],
	);
}
