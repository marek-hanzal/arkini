import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
import { GameCheatItemSpotlight } from "~/ui/cheat-spotlight/GameCheatItemSpotlight";

export function GamePage() {
	return (
		<>
			<GameBoardLayout />
			<GameCheatItemSpotlight />
		</>
	);
}
