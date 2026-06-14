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
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { BoardView, GameDragView, InventoryView } from "~/play/logic/playTypes";
import type { FlyerKind, RectLike, DragSource, DropTarget, VisualMeta } from "~/play/types";
import { resolveMagneticDropTarget } from "./resolveMagneticDropTarget";

export type { Feedback } from "~/interaction/types";

export namespace usePlayDraggableControl {
	export interface Props {
		feedback: Feedback;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
	}
}

export function usePlayDraggableControl({
	feedback,
	addFlyer,
	schedule,
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
		(animation: {
			itemId: string;
			from: RectLike;
			to: RectLike;
			kind?: FlyerKind;
			overlay?: VisualMeta;
		}) =>
			addFlyer(
				animation.itemId,
				animation.from,
				animation.to,
				animation.kind,
				animation.overlay,
			),
		[
			addFlyer,
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
	const control = useDraggableControl<string, DragSource, DropTarget, VisualMeta, FlyerKind>({
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
