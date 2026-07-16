import { type PropsWithChildren, useEffect, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";

import { GameProvider } from "~/bridge/game/GameProvider";
import { useGameOwner } from "~/bridge/game/useGameOwner";
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
		void owner.replace(packageId);
		return () => {
			void owner.replace(null);
		};
	}, [
		owner,
		packageId,
	]);

	return (
		<main
			className="size-full min-h-0 min-w-0 overflow-hidden bg-slate-950 text-slate-100"
			data-ui="GameShell"
		>
			{state.type === "loading" ? (
				<div className="flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden text-sm text-slate-300">
					Loading game…
				</div>
			) : state.type === "failed" ? (
				state.canForceShutdown ? null : (
					<div className="flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center text-sm text-red-300">
						<p>Game failed to start or close safely: {String(state.error)}</p>
						<div className="flex flex-wrap justify-center gap-2">
							{state.saveRecoveryKey === undefined ? null : (
								<button
									type="button"
									className="rounded-lg bg-red-300 px-3 py-2 font-semibold text-slate-950"
									onClick={() => void owner.clearFailedSaveAndRetry()}
								>
									Clear save and start fresh
								</button>
							)}
							{state.packageId === null ? null : (
								<button
									type="button"
									className="rounded-lg bg-amber-300 px-3 py-2 font-semibold text-slate-950"
									onClick={() => void owner.replace(state.packageId)}
								>
									Retry without clearing
								</button>
							)}
							<Link
								to="/"
								className="rounded-lg border border-white/15 px-3 py-2 text-slate-100"
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
