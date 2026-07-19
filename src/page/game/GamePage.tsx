import { Board } from "~/ui/board/Board";
import { GameShell } from "~/ui/shell/GameShell";

export function GamePage() {
	return (
		<GameShell>
			<Board />
		</GameShell>
	);
}
