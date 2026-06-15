import { useCallback, useMemo } from "react";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import { flashDrop } from "~/interaction/flashDrop";
import { resolveDrop } from "~/interaction/resolveDrop";
import type { AnyDropContext, Feedback } from "~/interaction/types";
import type { ItemId } from "~/manifest/manifestId";
import { useGameDragViewReader } from "~/play/hook/useGameDragViewReader";
import { usePlayCommandRunner } from "~/play/hook/usePlayCommandRunner";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type {
	DragSource,
	DropTarget,
	RectLike,
	VisualMeta,
	VisualTransitionKind,
} from "~/play/types";
import { waitForMs } from "~/shared/util/waitForMs";
import { tileEngineMotionDurationMs } from "~/tile-engine/hook/useTileEngineMotionAnimation";

export type { Feedback } from "~/interaction/types";

export namespace usePlayDraggableControl {
	export interface Props {
		activeSheet?: ActiveSheet;
		feedback: Feedback;
		schedule<T>(label: string, operation: () => Promise<T>): Promise<T>;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

export function usePlayDraggableControl({
	activeSheet,
	feedback,
	schedule,
	visualMotions,
}: usePlayDraggableControl.Props) {
	const items = usePlayItems();
	const readGame = useGameDragViewReader();
	const run = usePlayCommandRunner({
		activeSheet,
		visualMotions,
	});

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
			from: RectLike;
			to: RectLike;
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
		<T>(operation: () => Promise<T>) => schedule("drag/drop", operation),
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
