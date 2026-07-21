import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { Cheats } from "~/ui/cheats/Cheats";

/** Composes the save-scoped Cheats page and native history return to the active Board. */
export const CheatsPage = () => {
	const game = useGameEngine();
	const cheats = useGameCheats(game);
	const router = useRouter();
	const navigate = useNavigate();
	const leavingRef = useRef(false);

	const returnToBoard = useCallback(
		({ replace = false }: { readonly replace?: boolean } = {}) => {
			if (leavingRef.current) return;
			leavingRef.current = true;
			if (!replace && router.history.canGoBack()) {
				router.history.back();
				return;
			}
			void navigate({
				to: "/game/$packageId/board",
				params: {
					packageId: game.arkpack.packageId,
				},
				replace: true,
			}).finally(() => {
				leavingRef.current = false;
			});
		},
		[
			game.arkpack.packageId,
			navigate,
			router,
		],
	);

	useEffect(() => {
		if (!cheats.enabled)
			returnToBoard({
				replace: true,
			});
	}, [
		cheats.enabled,
		returnToBoard,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			returnToBoard();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		returnToBoard,
	]);

	return (
		<Cheats
			game={game}
			onBack={() => returnToBoard()}
		/>
	);
};
