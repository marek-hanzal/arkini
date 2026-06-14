import { useGameCommand } from "~/play/hook/useGameCommand";
import { usePlayDragView } from "~/play/hook/usePlayDragView";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type {
	FlyerKind,
	RectLike,
	GameDragSource,
	GameDropTarget,
	GameVisualMeta,
} from "~/play/types";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import {
	flashGameDrop,
	getGameDragBoundaryNodeId,
	resolveGameDrop,
	type GameDragFeedback,
} from "~/interaction/dragDropEngine";
import { resolveMagneticGameDropTarget } from "./resolveMagneticGameDropTarget";

export type { GameDragFeedback } from "~/interaction/dragDropEngine";

export namespace usePlayDraggableControl {
	export interface Props {
		feedback: GameDragFeedback;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: GameVisualMeta,
		): Promise<void>;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
	}
}

export function usePlayDraggableControl({
	feedback,
	addFlyer,
	schedule,
}: usePlayDraggableControl.Props) {
	const game = usePlayDragView();
	const items = usePlayItems().data;
	const command = useGameCommand({
		invalidateOnSuccess: true,
	});
	const control = useDraggableControl<
		string,
		GameDragSource,
		GameDropTarget,
		GameVisualMeta,
		FlyerKind
	>({
		schedule: (operation) => schedule("drag/drop", operation),
		resolveDrop: (context) =>
			resolveGameDrop({
				context,
				game,
				feedback,
				runCommand: (gameCommand) => command.mutateAsync(gameCommand),
			}),
		resolveMagneticDropTarget: resolveMagneticGameDropTarget,
		animate: (animation) =>
			addFlyer(
				animation.itemId,
				animation.from,
				animation.to,
				animation.kind,
				animation.overlay,
			),
		onError(error, context) {
			flashGameDrop({
				context,
				game,
				feedback,
			});
			feedback.showError(error);
		},
		getDragBoundaryNodeId: (source) =>
			getGameDragBoundaryNodeId({
				source,
			}),
	});

	const activeItem =
		control.activeDrag && items ? (items[control.activeDrag.itemId] ?? null) : null;

	return {
		...control,
		activeItem,
	};
}
