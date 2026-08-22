import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect, useRef } from "react";

import { usePackageGameEngine } from "~/bridge/game/usePackageGameEngine";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { Cheats } from "~/ui/cheats/Cheats";
import { useCheatsModel } from "~/ui/cheats/useCheatsModel";

/** Composes the save-scoped Cheats page and native history return to the active Board. */
export const CheatsScreen = () => {
	const game = usePackageGameEngine();
	const cheatAvailability = useCheatAvailability();
	const router = useRouter();
	const navigate = useNavigate();
	const model = useCheatsModel(game);
	const unavailableExitRequestedRef = useRef(false);

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
			model.requestExit,
			returnToBoardFx,
		],
	);

	useEffect(() => {
		if (cheatAvailability.available) {
			unavailableExitRequestedRef.current = false;
			return;
		}
		if (unavailableExitRequestedRef.current) return;
		unavailableExitRequestedRef.current = true;
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
