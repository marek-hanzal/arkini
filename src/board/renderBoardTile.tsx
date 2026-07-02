import { BoardStaticTile } from "~/board/BoardStaticTile";
import { BoardTile } from "~/board/BoardTile";
import type { BoardSurface } from "~/board/BoardSurface.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const renderBoardTile = ({ tile }: TileEngine.RenderTileProps<BoardSurface.TileData>) => {
	if (tile.data.kind === "static-item") {
		return (
			<BoardStaticTile
				assetProgress={tile.data.assetProgress}
				itemId={tile.data.itemId}
			/>
		);
	}

	return <BoardTile boardItemId={tile.data.boardItemId} />;
};
