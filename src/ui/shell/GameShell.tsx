import { Effect } from "effect";
import { type PropsWithChildren, useEffect, useState } from "react";

import ArkiniGamePackUrl from "../../../game/arkini.game.arkpack?url";
import type { Game } from "~/bridge/game/Game";
import { GameProvider } from "~/bridge/game/GameProvider";
import { createGameFx } from "~/bridge/game/createGameFx";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

type GameShellState =
	| {
			readonly type: "loading";
	  }
	| {
			readonly type: "ready";
			readonly game: Game;
	  }
	| {
			readonly type: "failed";
			readonly error: unknown;
	  };

/** Owns the replaceable live game instance for the `/game` route subtree. */
export function GameShell({ children }: PropsWithChildren) {
	const [state, setState] = useState<GameShellState>({
		type: "loading",
	});

	useEffect(() => {
		let cancelled = false;
		const gamePromise = Effect.runPromise(
			createGameFx({
				packUrl: ArkiniGamePackUrl,
			}),
		);

		void gamePromise.then(
			(game) => {
				if (cancelled) {
					void game.dispose();
					return;
				}
				setState({
					type: "ready",
					game,
				});
			},
			(error) => {
				if (!cancelled)
					setState({
						type: "failed",
						error,
					});
			},
		);

		return () => {
			cancelled = true;
			void gamePromise.then(
				(game) => game.dispose(),
				() => undefined,
			);
		};
	}, []);

	return (
		<main
			className="min-h-dvh bg-slate-950 text-slate-100"
			data-ui="GameShell"
		>
			{state.type === "loading" ? (
				<div className="flex min-h-dvh items-center justify-center text-sm text-slate-300">
					Loading game…
				</div>
			) : state.type === "failed" ? (
				<div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-red-300">
					Game failed to start: {String(state.error)}
				</div>
			) : (
				<GameProvider
					key={state.game.instanceKey}
					game={state.game}
				>
					<TileSystemProvider>{children}</TileSystemProvider>
				</GameProvider>
			)}
		</main>
	);
}
