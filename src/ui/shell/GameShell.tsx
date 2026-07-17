import { Link } from "@tanstack/react-router";
import type { Effect } from "effect";
import { type PropsWithChildren, useSyncExternalStore } from "react";

import { GameProvider } from "~/bridge/game/GameProvider";
import { useGameOwner } from "~/bridge/game/useGameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

const runOwnerCommand = (command: Effect.Effect<void, unknown>) => {
	void RendererRuntime.runPromise(command).catch(() => {
		// GameOwner publishes the same authoritative failure for the shell UI.
	});
};

export namespace GameShell {
	export interface Props extends PropsWithChildren {
		readonly packageId: string;
	}
}

/** Renders the game selected declaratively by the stable root owner binding. */
export function GameShell({ children, packageId }: GameShell.Props) {
	const owner = useGameOwner();
	const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
	const readyGame =
		state.type === "ready" && state.game.arkpack.packageId === packageId
			? state.game
			: undefined;

	return (
		<main
			className="size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground"
			data-ui="GameShell"
		>
			{readyGame !== undefined ? (
				<GameProvider
					key={readyGame.instanceKey}
					game={readyGame}
				>
					<TileSystemProvider>{children}</TileSystemProvider>
				</GameProvider>
			) : state.type === "failed" && state.operation !== "shutdown" ? (
				<div className="flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center text-sm text-danger">
					<p>Game failed to start or close safely: {String(state.error)}</p>
					<div className="flex flex-wrap justify-center gap-2">
						{state.canRecoverSave ? (
							<button
								type="button"
								className="rounded-lg bg-danger px-3 py-2 font-semibold text-danger-contrast transition-opacity hover:opacity-90"
								onClick={() => runOwnerCommand(owner.clearFailedSaveAndRetryFx())}
							>
								Recover with a fresh save
							</button>
						) : null}
						<button
							type="button"
							className="rounded-lg bg-accent px-3 py-2 font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
							onClick={() => runOwnerCommand(owner.selectPackageFx(packageId))}
						>
							Retry without clearing
						</button>
						<Link
							to="/"
							className="rounded-lg border border-line px-3 py-2 text-foreground transition-colors hover:border-line-strong"
						>
							Back to packages
						</Link>
					</div>
				</div>
			) : (
				<div className="flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden text-sm text-muted">
					Loading game…
				</div>
			)}
		</main>
	);
}
