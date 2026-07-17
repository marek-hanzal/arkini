import { Effect } from "effect";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { createGameFx } from "~/bridge/game/createGameFx";
import {
	createGameOwnerFx,
	type createGameOwnerFx as GameOwner,
} from "~/bridge/game/createGameOwnerFx";
import { shutdownGameOwnerFx } from "~/bridge/game/shutdownGameOwnerFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";

export namespace GameOwnerProvider {
	export interface Props {
		readonly children: ReactNode;
	}
}

interface HotData {
	gameOwnerShutdown?: Promise<void>;
}

const previousHotShutdown = (import.meta.hot?.data as HotData | undefined)?.gameOwnerShutdown;
let activeHotOwner: GameOwner.Owner | undefined;

import.meta.hot?.dispose((data: HotData) => {
	data.gameOwnerShutdown =
		activeHotOwner === undefined
			? Promise.resolve()
			: RendererRuntime.runPromise(shutdownGameOwnerFx(activeHotOwner));
	activeHotOwner = undefined;
});

const GameShutdownFailure = ({ owner }: { readonly owner: GameOwner.Owner }) => (
	<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center text-sm text-red-200">
		<div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-red-300/20 bg-slate-900 p-6 shadow-2xl">
			<h2 className="text-lg font-semibold text-red-100">Final save failed</h2>
			<p>
				Arkini is still holding the current game so the same final save can be retried.
				Force exit discards that unsaved progress explicitly.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<button
					type="button"
					className="rounded-lg bg-amber-300 px-3 py-2 font-semibold text-slate-950"
					onClick={() => window.arkini?.lifecycle.requestClose()}
				>
					Retry safe exit
				</button>
				<button
					type="button"
					className="rounded-lg border border-red-300/40 px-3 py-2 font-semibold text-red-100"
					onClick={() => {
						void RendererRuntime.runPromise(owner.forceShutdownFx()).catch((error) => {
							console.error("Arkini force-shutdown cleanup failed.", error);
						});
						window.arkini?.lifecycle.forceClose();
					}}
				>
					Force exit without saving
				</button>
			</div>
		</div>
	</div>
);

/** Keeps one serialized game owner alive across launcher, route and desktop lifecycle changes. */
export const GameOwnerProvider = ({ children }: GameOwnerProvider.Props) => {
	const ownerRef = useRef<GameOwner.Owner | undefined>(undefined);
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
		const removeBeforeClose = window.arkini?.lifecycle.onBeforeClose(() =>
			RendererRuntime.runPromise(shutdownGameOwnerFx(owner)),
		);
		return () => {
			removeBeforeClose?.();
			void RendererRuntime.runPromise(shutdownGameOwnerFx(owner)).catch((error) => {
				console.error("Arkini game shutdown failed during renderer cleanup.", error);
			});
		};
	}, [
		owner,
	]);

	return (
		<GameOwnerContext.Provider value={owner}>
			{children}
			{state.type === "failed" && state.canForceShutdown ? (
				<GameShutdownFailure owner={owner} />
			) : null}
		</GameOwnerContext.Provider>
	);
};
