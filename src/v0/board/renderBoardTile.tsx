import { BoardTile } from "~/v0/board/BoardTile";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const renderBoardTile = ({ tile }: TileEngine.RenderTileProps<BoardSurface.TileData>) => (
	<BoardTile boardItemId={tile.data.boardItemId} />
);
