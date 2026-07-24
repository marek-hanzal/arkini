import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
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

	const returnToBoardFx = useCallback(
		({ replace = false }: { readonly replace?: boolean } = {}) => {
			if (!replace && router.history.canGoBack()) {
				return Effect.try({
					try: () => router.history.back(),
					catch: (error) => error,
				});
			}
			return Effect.tryPromise({
				try: () =>
					navigate({
						to: "/game/$packageId/board",
						params: {
							packageId: game.arkpack.packageId,
						},
						replace: true,
					}),
				catch: (error) => error,
			}).pipe(Effect.asVoid);
		},
		[
			game.arkpack.packageId,
			navigate,
			router,
		],
	);
	const returnToBoard = useCallback(
		(options?: { readonly replace?: boolean }) => model.requestExit(returnToBoardFx(options)),
		[
			model,
			returnToBoardFx,
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
