import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useEffect, useRef } from "react";

import { CheatAvailabilityAtom } from "~/ui/cheat-availability/CheatAvailabilityAtom";
import { CheatAvailabilityReady } from "~/ui/cheat-availability/CheatAvailabilityReady";
import { usePackageGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { Cheats } from "~/game-cheat/ui/Cheats";
import { useCheatsModel } from "~/game-cheat/ui/useCheatsModel";
import { PlayableGameRoute } from "~/game-shell/ui/PlayableGameRoute";

export const Route = createFileRoute("/game/$packageId/cheats")({
	beforeLoad: async ({ context, params }) => {
		await context.rendererRuntime.runPromise(Deferred.await(CheatAvailabilityReady));
		if (context.rendererRuntime.runSync(Atom.get(CheatAvailabilityAtom))) return;
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	component: () => {
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
			(options?: { readonly replace?: boolean }) =>
				model.requestExit(returnToBoardFx(options)),
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
			<PlayableGameRoute>
				<Cheats
					model={model}
					onBack={() => returnToBoard()}
				/>
			</PlayableGameRoute>
		);
	},
});
