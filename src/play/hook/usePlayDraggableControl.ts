import { usePlayDragView } from "~/play/hook/usePlayDragView";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { FlyerKind, RectLike, GameDragSource, GameDropTarget, GameVisualMeta } from "~/play/types";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import {
  flashGameDrop,
  getGameDragBoundaryNodeId,
  resolveGameDrop,
  type GameDragActions,
  type GameDragFeedback,
} from "./playDragRules";
import { resolveMagneticGameDropTarget } from "./resolveMagneticGameDropTarget";

export type { GameDragActions, GameDragFeedback } from "./playDragRules";

export namespace usePlayDraggableControl {
  export interface Props {
    actions: GameDragActions;
    feedback: GameDragFeedback;
    addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind, meta?: GameVisualMeta): Promise<void>;
    schedule(label: string, operation: () => Promise<void>): Promise<void>;
  }
}

export function usePlayDraggableControl({
  actions,
  feedback,
  addFlyer,
  schedule,
}: usePlayDraggableControl.Props) {
  const game = usePlayDragView();
  const items = usePlayItems().data;
  const control = useDraggableControl<string, GameDragSource, GameDropTarget, GameVisualMeta, FlyerKind>({
    schedule: (operation) => schedule("drag/drop", operation),
    resolveDrop: (context) => resolveGameDrop(context, game, actions, feedback),
    resolveMagneticDropTarget: resolveMagneticGameDropTarget,
    animate: (animation) => addFlyer(animation.itemId, animation.from, animation.to, animation.kind, animation.overlay),
    onError(error, context) {
      flashGameDrop(context, game, feedback);
      feedback.showError(error);
    },
    getDragBoundaryNodeId: getGameDragBoundaryNodeId,
  });

  const activeItem = control.activeDrag && items ? (items[control.activeDrag.itemId] ?? null) : null;

  return { ...control, activeItem };
}
