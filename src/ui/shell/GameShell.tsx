import { Link } from "@tanstack/react-router";
import { type PropsWithChildren, useEffect, useSyncExternalStore } from "react";

import { GameProvider } from "~/bridge/game/GameProvider";
import { useGameOwner } from "~/bridge/game/useGameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

export namespace GameShell {
	export interface Props extends PropsWithChildren {
		packageId: string;
	}
}

/** Requests one package from the root serialized game owner for this route subtree. */
export function GameShell({ children, packageId }: GameShell.Props) {
	const owner = useGameOwner();
	const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);

	useEffect(() => {
		void RendererRuntime.runPromise(owner.replaceFx(packageId));
		return () => {
			void RendererRuntime.runPromise(owner.replaceFx(null));
		};
	}, [
		owner,
		packageId,
	]);

	return (
		<main
			className="size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground"
			data-ui="GameShell"
		>
			{state.type === "loading" ? (
				<div className="flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden text-sm text-muted">
					Loading game…
				</div>
			) : state.type === "failed" ? (
				state.canForceShutdown ? null : (
					<div className="flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center text-sm text-danger">
						<p>Game failed to start or close safely: {String(state.error)}</p>
						<div className="flex flex-wrap justify-center gap-2">
							{state.saveRecoveryKey === undefined ? null : (
								<button
									type="button"
									className="rounded-lg bg-danger px-3 py-2 font-semibold text-danger-contrast transition-opacity hover:opacity-90"
									onClick={() =>
										void RendererRuntime.runPromise(
											owner.clearFailedSaveAndRetryFx(),
										)
									}
								>
									Clear save and start fresh
								</button>
							)}
							{state.packageId === null ? null : (
								<button
									type="button"
									className="rounded-lg bg-accent px-3 py-2 font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
									onClick={() =>
										void RendererRuntime.runPromise(
											owner.replaceFx(state.packageId),
										)
									}
								>
									Retry without clearing
								</button>
							)}
							<Link
								to="/"
								className="rounded-lg border border-line px-3 py-2 text-foreground transition-colors hover:border-line-strong"
							>
								Back to packages
							</Link>
						</div>
					</div>
				)
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
