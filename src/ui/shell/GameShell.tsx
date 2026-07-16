import { Effect } from "effect";
import { type PropsWithChildren, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import type { Game } from "~/bridge/game/Game";
import { GameProvider } from "~/bridge/game/GameProvider";
import { createGameFx } from "~/bridge/game/createGameFx";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

export namespace GameShell {
	export interface Props extends PropsWithChildren {
		packageId: string;
	}
}

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

/** Owns the replaceable live game instance for one selected package route subtree. */
export function GameShell({ children, packageId }: GameShell.Props) {
	const [state, setState] = useState<GameShellState>({
		type: "loading",
	});

	useEffect(() => {
		let cancelled = false;
		setState({
			type: "loading",
		});
		const gamePromise = Effect.runPromise(
			createGameFx({
				packageId,
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
	}, [
		packageId,
	]);

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
				<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-sm text-red-300">
					<p>Game failed to start: {String(state.error)}</p>
					<Link
						to="/"
						className="rounded-lg border border-white/15 px-3 py-2 text-slate-100"
					>
						Back to packages
					</Link>
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
