import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";

export const renderBoardTile = ({ tile }: TileEngine.RenderTileProps<BoardSurface.TileData>) => (
	<div
		data-ak-board-item-id={tile.data.boardItem.id}
		className="h-full w-full"
	>
		<GameItemView
			item={tile.data.item}
			variant="board"
			activation={tile.data.boardItem.activation}
			activationNowMs={tile.data.activationNowMs}
		/>
	</div>
);
