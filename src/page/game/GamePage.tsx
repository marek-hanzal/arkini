import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
import { GameShell } from "~/ui/shell/GameShell";

export function GamePage() {
	return (
		<GameShell>
			<GameBoardLayout />
		</GameShell>
	);
}
