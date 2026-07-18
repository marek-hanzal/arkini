import { Link } from "@tanstack/react-router";
import type { Effect } from "effect";
import { type PropsWithChildren, useRef, useSyncExternalStore } from "react";

import type { Game } from "~/bridge/game/Game";
import { GameProvider } from "~/bridge/game/GameProvider";
import { useGameOwner } from "~/bridge/game/useGameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { GameLoadingGate } from "~/ui/shell/GameLoadingGate";
import { GameLoadingScreen } from "~/ui/shell/GameLoadingScreen";
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
	const menuGameRef = useRef<Game | undefined>(undefined);
	const menuPackageIdRef = useRef(packageId);
	if (menuPackageIdRef.current !== packageId) {
		menuPackageIdRef.current = packageId;
		menuGameRef.current = undefined;
	}
	const ownedGame =
		state.type === "ready" ? state.game : state.type === "failed" ? state.game : null;
	const activeGame = ownedGame?.arkpack.packageId === packageId ? ownedGame : undefined;
	if (activeGame !== undefined) menuGameRef.current = activeGame;
	const menuGame = menuGameRef.current;
	const gameAvailable = activeGame?.instanceKey === menuGame?.instanceKey;

	const failure =
		state.type === "failed" && state.operation !== "shutdown" ? (
			<div
				className="flex size-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center text-sm text-danger"
				data-ui="GameShellFailure"
			>
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
						to="/arkpacks"
						className="rounded-lg border border-line px-3 py-2 text-foreground transition-colors hover:border-line-strong"
					>
						Back to Arkpacks
					</Link>
				</div>
			</div>
		) : null;

	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<GameLoadingGate
				key={packageId}
				ready={activeGame !== undefined}
				failure={menuGame === undefined ? failure : null}
			>
				{menuGame !== undefined ? (
					<GameMenuProvider key={packageId}>
						{activeGame !== undefined ? (
							<GameProvider game={activeGame}>
								<TileSystemProvider>{children}</TileSystemProvider>
							</GameProvider>
						) : (
							(failure ?? <GameLoadingScreen ready={false} />)
						)}
						<GameMenu
							game={menuGame}
							gameAvailable={gameAvailable}
						/>
					</GameMenuProvider>
				) : null}
			</GameLoadingGate>
		</main>
	);
}
