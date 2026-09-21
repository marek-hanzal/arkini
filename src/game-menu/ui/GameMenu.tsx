import { useEffect, useState } from "react";
import { useGameMenuActions } from "~/game-menu/ui/useGameMenuActions";
import { match } from "ts-pattern";

import type { Game } from "~/installed-game/type/Game";
import { GameMenuDialog } from "~/game-menu/ui/GameMenuDialog";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

/** Renders the active game overlay through one explicit enter/open/exit lifecycle. */
export const GameMenu = ({ game }: { readonly game: Game }) => {
	const { phase } = useGameMenuControl();
	const actions = useGameMenuActions({
		game,
		phase,
	});
	const [notice, setNoticeFn] = useState<string | null>(null);
	useEffect(() => {
		setNoticeFn(actions.status);
		if (actions.pending || actions.status === null) return;
		const timeout = setTimeout(() => setNoticeFn(null), 4000);
		return () => clearTimeout(timeout);
	}, [
		actions.status,
		actions.pending,
	]);
	return match(phase)
		.with("closed", () =>
			notice === null ? null : (
				<div
					data-ui="GameSaveNotice"
					className="pointer-events-none absolute bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-lg border border-line bg-modal px-4 py-2 text-sm text-foreground shadow-lg"
				>
					{notice}
				</div>
			),
		)
		.with("entering", "open", "exiting", (activePhase) => (
			<GameMenuDialog
				game={game}
				actions={actions}
				phase={activePhase}
			/>
		))
		.exhaustive();
};
