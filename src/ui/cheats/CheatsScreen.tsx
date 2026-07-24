import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { Cheats } from "~/ui/cheats/Cheats";
import { useCheatsModel } from "~/ui/cheats/useCheatsModel";

/** Composes the save-scoped Cheats page and native history return to the active Board. */
export const CheatsScreen = () => {
	const game = useGameEngine();
	const cheatAvailability = useCheatAvailability();
	const router = useRouter();
	const navigate = useNavigate();
	const model = useCheatsModel(game);

	const returnToBoard = useCallback(
		({ replace = false }: { readonly replace?: boolean } = {}) => {
			if (!model.beginExit()) return;
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
				model.completeExit();
			});
		},
		[
			game.arkpack.packageId,
			model,
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
			model={model}
			onBack={() => returnToBoard()}
		/>
	);
};
