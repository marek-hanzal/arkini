import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { stageCommandVisualEvents } from "~/animation/stageCommandVisualEvents";
import type { Command } from "~/command/Command";
import { commandInvalidation } from "~/command/commandInvalidation";
import type { CommandResult } from "~/command/CommandResult";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";
import { flashDrop } from "~/interaction/flashDrop";
import type { AnyDropContext, Feedback } from "~/interaction/types";
import { resolveDrop } from "~/interaction/resolveDrop";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { ItemId } from "~/manifest/manifestId";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { DragSource, DropTarget, VisualMeta, VisualTransitionKind } from "~/play/types";
import { tileEngineMotionDurationMs } from "~/tile-engine/hook/useTileEngineMotionAnimation";
import { waitForMs } from "~/shared/util/waitForMs";

export type { Feedback } from "~/interaction/types";

export namespace usePlayDraggableControl {
	export interface Props {
		activeSheet?: ActiveSheet;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

export function usePlayDraggableControl({
	activeSheet,
	feedback,
	schedule,
	visualMotions,
}: usePlayDraggableControl.Props) {
	const queryClient = useQueryClient();
	const invalidatePlayData = usePlayDataInvalidation();
	const items = usePlayItems();
	const command = useRunCommandMutation({
		invalidateOnSuccess: false,
	});
	const mutateCommand = command.mutateAsync;
	const run = useCallback(
		async <TCommand extends Command>(command: TCommand): Promise<CommandResult<TCommand>> => {
			const result = await mutateCommand(command);

			stageCommandVisualEvents({
				events: result.visualEvents,
				activeSheet,
				visualMotions,
			});

			await invalidatePlayData(
				commandInvalidation({
					command,
				}),
			);

			return result as CommandResult<TCommand>;
		},
		[
			activeSheet,
			invalidatePlayData,
			mutateCommand,
			visualMotions,
		],
	);
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
			kind?: VisualTransitionKind;
		}) => {
			if (!animation.actorKey) return;
			visualMotions.stage([
				{
					key: animation.actorKey,
					from: animation.from,
					to: animation.to,
					priority: "raised",
					kind: animation.kind,
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
	const control = useDraggableControl<
		ItemId,
		DragSource,
		DropTarget,
		VisualMeta,
		VisualTransitionKind
	>({
		schedule: scheduleDrop,
		resolveDrop: resolvePlayDrop,
		animate,
		onError,
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
