import { BoardStaticTile } from "~/board/BoardStaticTile";
import { BoardTile } from "~/board/BoardTile";
import type { BoardSurface } from "~/board/BoardSurface.types";
import type { TileEngineNamespace as TileEngine } from "~/tile-engine";

export const renderBoardTile = ({ tile }: TileEngine.RenderTileProps<BoardSurface.TileData>) => {
	if (tile.data.kind === "static-item") {
		return <BoardStaticTile itemId={tile.data.itemId} />;
	}

	return <BoardTile boardItemId={tile.data.boardItemId} />;
};
