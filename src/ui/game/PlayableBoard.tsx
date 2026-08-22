import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
import { GameCheatItemSpotlight } from "~/ui/cheat-spotlight/GameCheatItemSpotlight";

/** Shared Board + Toolbar gameplay leaf with its exact cheat presentation. */
export const PlayableBoard = ({
	onOpenInventory,
}: {
	readonly onOpenInventory: () => void | PromiseLike<void>;
}) => (
	<>
		<GameBoardLayout onOpenInventory={onOpenInventory} />
		<GameCheatItemSpotlight />
	</>
);
