import { Effect } from "effect";
import { type ReactNode, useEffect, useRef } from "react";

import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { createGameFx } from "~/bridge/game/createGameFx";
import { createGameOwner, type createGameOwner as GameOwner } from "~/bridge/game/createGameOwner";

export namespace GameOwnerProvider {
	export interface Props {
		readonly children: ReactNode;
	}
}

/** Keeps one serialized game owner alive across launcher and game route transitions. */
export const GameOwnerProvider = ({ children }: GameOwnerProvider.Props) => {
	const ownerRef = useRef<GameOwner.Owner | undefined>(undefined);
	if (ownerRef.current === undefined) {
		ownerRef.current = createGameOwner({
			create: (packageId) =>
				Effect.runPromise(
					createGameFx({
						packageId,
					}),
				),
		});
	}
	const owner = ownerRef.current;

	useEffect(
		() => () => {
			void owner.replace(null);
		},
		[
			owner,
		],
	);

	return <GameOwnerContext.Provider value={owner}>{children}</GameOwnerContext.Provider>;
};
