import { type FC, useCallback } from "react";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { SheetHeader } from "~/play/sheet/SheetHeader";
import { UiButton } from "~/ui/UiButton";

export namespace BoardMemorySheet {
	export interface Props {
		boardItemId: string;
		onClose(): void;
	}
}

export const BoardMemorySheet: FC<BoardMemorySheet.Props> = ({ boardItemId, onClose }) => {
	const store = useGameRuntimeStore();
	const itemCount = useGameRuntimeSelector(
		(state) => state.runtime.save.boardMemoryLayouts[boardItemId]?.items.length ?? 0,
		Object.is,
	);
	const clearMemory = useCallback(() => {
		void store
			.dispatch({
				action: {
					boardItemId,
					type: "board.memory.clear",
				},
				nowMs: Date.now(),
			})
			.then(onClose);
	}, [
		boardItemId,
		onClose,
		store,
	]);

	return (
		<div className="space-y-4">
			<SheetHeader
				onClose={onClose}
				title="Board Memory"
			/>
			<div className="rounded-sm border border-ak-border bg-ak-surface p-3 text-sm text-ak-text-muted">
				Memory stores board item positions. Restore keeps the saved memory and only uses it
				as a layout preset.
			</div>
			<UiButton
				className="w-full border-rose-300/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
				disabled={itemCount === 0}
				onClick={clearMemory}
			>
				Clear memory{itemCount > 0 ? ` (${itemCount})` : ""}
			</UiButton>
		</div>
	);
};
