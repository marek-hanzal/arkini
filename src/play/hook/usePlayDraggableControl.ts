import type { GameView } from "~/play/logic/playTypes";
import type { FlyerKind, RectLike, GameDragSource, GameDropTarget, GameVisualMeta } from "~/play/types";
import { useDraggableControl } from "~/drag/hook/useDraggableControl";
import {
  flashGameDrop,
  getGameDragBoundaryNodeId,
  resolveGameDrop,
  type GameDragActions,
  type GameDragFeedback,
} from "./playDragRules";

export type { GameDragActions, GameDragFeedback } from "./playDragRules";

export namespace usePlayDraggableControl {
  export interface Props {
    game: GameView | null | undefined;
    actions: GameDragActions;
    feedback: GameDragFeedback;
    addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind, meta?: GameVisualMeta): Promise<void>;
    schedule(label: string, operation: () => Promise<void>): Promise<void>;
  }
}

export function usePlayDraggableControl({
  game,
  actions,
  feedback,
  addFlyer,
  schedule,
}: Readonly<usePlayDraggableControl.Props>) {
  const control = useDraggableControl<string, GameDragSource, GameDropTarget, GameVisualMeta, FlyerKind>({
    schedule: (operation) => schedule("drag/drop", operation),
    resolveDrop: (context) => resolveGameDrop(context, game, actions, feedback),
    animate: (animation) => addFlyer(animation.itemId, animation.from, animation.to, animation.kind, animation.overlay),
    onError(error, context) {
      flashGameDrop(context, game, feedback);
      feedback.showError(error);
    },
    getDragBoundaryNodeId: getGameDragBoundaryNodeId,
  });

  const activeItem = control.activeDrag && game ? (game.items[control.activeDrag.itemId] ?? null) : null;

  return { ...control, activeItem };
}
