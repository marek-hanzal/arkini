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
	export interface Props {}
}

export const Board: FC<Board.Props> = memo(() => {
	const engine = useBoardTileEngine();

	return (
		<TileEngine<useBoardTileEngineType.BoardTileData, BoardCellView, DragData, DropData>
			id="board"
			columns={boardColumns}
			slots={engine.slots}
			tiles={engine.tiles}
			gapPx={1}
			className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
			itemLayerClassName="pointer-events-none"
			activeDropTargetNodeId={engine.activeDropTargetNodeId}
			drag={engine.dragConfig}
			dragConstraintsRef={engine.dragConstraintsRef}
			renderSlot={engine.renderSlot}
			renderTile={engine.renderTile}
		/>
	);
});
