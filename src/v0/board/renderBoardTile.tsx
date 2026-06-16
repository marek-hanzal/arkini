import { BoardStaticTile } from "~/v0/board/BoardStaticTile";
import { BoardTile } from "~/v0/board/BoardTile";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export const renderBoardTile = ({ tile }: TileEngine.RenderTileProps<BoardSurface.TileData>) => {
	if (tile.data.kind === "static-item") {
		return <BoardStaticTile itemId={tile.data.itemId} />;
	}

	return <BoardTile boardItemId={tile.data.boardItemId} />;
};
