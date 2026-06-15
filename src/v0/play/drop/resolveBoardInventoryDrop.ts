import type { DragSource } from "~/v0/play/drag/DragSource";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";

export namespace resolveBoardInventoryDrop {
	export interface Props {
		source: Extract<
			DragSource,
			{
				kind: "board";
			}
		>;
		actions: DropActions;
	}
}

export const resolveBoardInventoryDrop = ({
	source,
	actions,
}: resolveBoardInventoryDrop.Props): TileEngine.DropOutcome =>
	acceptDrop(() =>
		actions.stashBoardItem({
			boardItemId: source.boardItemId,
		}),
	);
