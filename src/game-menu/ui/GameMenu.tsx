import { match } from "ts-pattern";

import type { Game } from "~/installed-game/type/Game";
import { GameMenuDialog } from "~/game-menu/ui/GameMenuDialog";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

/** Renders the active game overlay through one explicit enter/open/exit lifecycle. */
export const GameMenu = ({ game }: { readonly game: Game }) => {
	const { phase } = useGameMenuControl();
	return match(phase)
		.with("closed", () => null)
		.with("entering", "open", "exiting", (activePhase) => (
			<GameMenuDialog
				game={game}
				phase={activePhase}
			/>
		))
		.exhaustive();
};
