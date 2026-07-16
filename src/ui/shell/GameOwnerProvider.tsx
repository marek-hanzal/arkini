import { Effect } from "effect";
import { type ReactNode, useEffect, useRef } from "react";
import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { createGameFx } from "~/bridge/game/createGameFx";
import { createGameOwner, type createGameOwner as GameOwner } from "~/bridge/game/createGameOwner";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";
import { shutdownGameOwner } from "~/bridge/game/shutdownGameOwner";

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
		activeHotOwner === undefined ? Promise.resolve() : shutdownGameOwner(activeHotOwner);
	activeHotOwner = undefined;
});

/** Keeps one serialized game owner alive across launcher, route and desktop lifecycle changes. */
export const GameOwnerProvider = ({ children }: GameOwnerProvider.Props) => {
	const ownerRef = useRef<GameOwner.Owner | undefined>(undefined);
	if (ownerRef.current === undefined) {
		ownerRef.current = createGameOwner({
			create: async (packageId) => {
				await previousHotShutdown;
				return Effect.runPromise(
					createGameFx({
						packageId,
					}),
				);
			},
			clearSave: (game) =>
				Effect.runPromise(
					deleteGameSaveFx({
						key: game.saveKey,
					}),
				),
		});
	}
	const owner = ownerRef.current;
	activeHotOwner = owner;

	useEffect(() => {
		const removeBeforeClose = window.arkini?.lifecycle.onBeforeClose(() =>
			shutdownGameOwner(owner),
		);
		return () => {
			removeBeforeClose?.();
			void shutdownGameOwner(owner).catch((error) => {
				console.error("Arkini game shutdown failed during renderer cleanup.", error);
			});
		};
	}, [
		owner,
	]);

	return <GameOwnerContext.Provider value={owner}>{children}</GameOwnerContext.Provider>;
};
