import { Effect } from "effect";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

import { createGameFx } from "~/bridge/game/createGameFx";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { createGameOwnerFx } from "~/bridge/game/createGameOwnerFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";
import { GameOwnerRouteBinding } from "~/ui/shell/GameOwnerRouteBinding";

export namespace GameOwnerProvider {
	export interface Props {
		readonly children: ReactNode;
	}
}

interface HotData {
	gameOwnerShutdown?: Promise<void>;
}

const previousHotShutdown = (import.meta.hot?.data as HotData | undefined)?.gameOwnerShutdown;
let activeHotOwner: GameOwner | undefined;

import.meta.hot?.dispose((data: HotData) => {
	data.gameOwnerShutdown =
		activeHotOwner === undefined
			? Promise.resolve()
			: RendererRuntime.runPromise(activeHotOwner.shutdownFx());
	activeHotOwner = undefined;
});

const GameShutdownFailure = () => (
	<div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/95 p-6 text-center text-sm text-danger">
		<div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-danger/25 bg-surface-raised p-6 shadow-2xl">
			<h2 className="text-lg font-semibold text-danger">Final save failed</h2>
			<p>
				Arkini is still holding the current game so the same final save can be retried.
				Force exit discards that unsaved progress through native process shutdown.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<button
					type="button"
					className="rounded-lg bg-accent px-3 py-2 font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
					onClick={() =>
						void window.arkini.lifecycle.requestClose().catch(() => undefined)
					}
				>
					Retry safe exit
				</button>
				<button
					type="button"
					className="rounded-lg border border-danger/45 px-3 py-2 font-semibold text-danger transition-colors hover:bg-danger/10"
					onClick={() => window.arkini.lifecycle.forceClose()}
				>
					Force exit without saving
				</button>
			</div>
		</div>
	</div>
);

/** Keeps one serialized game owner bound declaratively to the stable route root. */
export const GameOwnerProvider = ({ children }: GameOwnerProvider.Props) => {
	const ownerRef = useRef<GameOwner | undefined>(undefined);
	if (ownerRef.current === undefined) {
		ownerRef.current = RendererRuntime.runSync(
			createGameOwnerFx({
				createFx: (packageId) =>
					Effect.tryPromise({
						try: () => previousHotShutdown ?? Promise.resolve(),
						catch: (cause) => cause,
					}).pipe(
						Effect.zipRight(
							createGameFx({
								packageId,
							}),
						),
					),
				clearSaveFx: (key) =>
					deleteGameSaveFx({
						key,
					}),
			}),
		);
	}
	const owner = ownerRef.current;
	const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
	activeHotOwner = owner;

	useEffect(() => {
		const removeBeforeClose = window.arkini.lifecycle.onBeforeClose(() =>
			RendererRuntime.runPromise(owner.shutdownFx()),
		);
		return removeBeforeClose;
	}, [
		owner,
	]);

	return (
		<GameOwnerContext.Provider value={owner}>
			<GameOwnerRouteBinding owner={owner} />
			{children}
			{state.type === "failed" && state.operation === "shutdown" ? (
				<GameShutdownFailure />
			) : null}
		</GameOwnerContext.Provider>
	);
};
