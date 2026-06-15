import { memo, type FC } from "react";
import { boardColumns } from "~/board/boardColumns";
import { type BoardCellView } from "~/board/boardCells";
import {
	useBoardTileEngine,
	type useBoardTileEngine as useBoardTileEngineType,
} from "~/board/hook/useBoardTileEngine";
import type { DragData, DropData } from "~/play/types";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace Board {
	export type DragState = useBoardTileEngineType.DragState;
	export type FeedbackState = useBoardTileEngineType.FeedbackState;
	export type Actions = useBoardTileEngineType.Actions;

	export interface Props {
		drag: DragState;
		feedback: FeedbackState;
		actions: Actions;
		visualMotions: useBoardTileEngineType.Props["visualMotions"];
	}
}

export const Board: FC<Board.Props> = memo((props) => {
	const engine = useBoardTileEngine(props);

	return (
		<TileEngine<useBoardTileEngineType.BoardTileData, BoardCellView, DragData, DropData>
			id="board"
			columns={boardColumns}
			slots={engine.slots}
			tiles={engine.tiles}
			gapPx={1}
			className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
			itemLayerClassName="pointer-events-none"
			activeDropTargetNodeId={props.drag.activeDropTargetNodeId ?? null}
			drag={engine.dragConfig}
			renderSlot={engine.renderSlot}
			renderTile={engine.renderTile}
		/>
	);
});
