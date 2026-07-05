import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { Feedback } from "~/play/feedback/Feedback";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export type BoardItemActivationContext = {
	feedback: Feedback.Type;
	liveBoard: BoardView;
	liveBoardItem: BoardViewItem;
	nowMs: number;
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: GameRuntimeStore;
};
