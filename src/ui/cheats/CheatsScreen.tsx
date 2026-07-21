import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { Cheats } from "~/ui/cheats/Cheats";

/** Composes the save-scoped Cheats page and native history return to the active Board. */
export const CheatsScreen = () => {
	const game = useGameEngine();
	const cheatAvailability = useCheatAvailability();
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
		if (!cheatAvailability.available)
			returnToBoard({
				replace: true,
			});
	}, [
		cheatAvailability.available,
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
