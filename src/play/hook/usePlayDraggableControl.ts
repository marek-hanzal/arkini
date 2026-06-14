import { useCommand } from "~/play/hook/useCommand";
import { usePlayDragView } from "~/play/hook/usePlayDragView";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { FlyerKind, RectLike, DragSource, DropTarget, VisualMeta } from "~/play/types";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import { flashDrop } from "~/interaction/flashDrop";
import { getDragBoundaryNodeId } from "~/interaction/getDragBoundaryNodeId";
import { resolveDrop } from "~/interaction/resolveDrop";
import type { Feedback } from "~/interaction/types";
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
	const game = usePlayDragView();
	const items = usePlayItems().data;
	const command = useCommand({
		invalidateOnSuccess: true,
	});
	const control = useDraggableControl<string, DragSource, DropTarget, VisualMeta, FlyerKind>({
		schedule: (operation) => schedule("drag/drop", operation),
		resolveDrop: (context) =>
			resolveDrop({
				context,
				game,
				feedback,
				run: (gameCommand) => command.mutateAsync(gameCommand),
			}),
		resolveMagneticDropTarget: resolveMagneticDropTarget,
		animate: (animation) =>
			addFlyer(
				animation.itemId,
				animation.from,
				animation.to,
				animation.kind,
				animation.overlay,
			),
		onError(error, context) {
			flashDrop({
				context,
				game,
				feedback,
			});
			feedback.showError(error);
		},
		getDragBoundaryNodeId: (source) =>
			getDragBoundaryNodeId({
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
