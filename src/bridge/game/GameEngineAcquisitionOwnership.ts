import type { QueryClient } from "@tanstack/react-query";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

export interface GameEngineAcquisitionConsumer {
	readonly abort: Promise<never>;
	readonly removeAbortListener: () => void;
}

/** The sole provisional owner record for one renderer QueryClient. */
export interface GameEngineAcquisitionOwner {
	readonly controller: AbortController;
	readonly consumers: Set<GameEngineAcquisitionConsumer>;
	readonly packageId: string;
	readonly queryClient: QueryClient;
	readonly result: Promise<GameEngineResource>;
	adopted: boolean;
	cancelling: Promise<void> | undefined;
}

const owners = new WeakMap<QueryClient, GameEngineAcquisitionOwner>();

export const readGameEngineAcquisitionOwner = (
	queryClient: QueryClient,
): GameEngineAcquisitionOwner | undefined => owners.get(queryClient);

export const claimGameEngineAcquisitionOwner = (
	queryClient: QueryClient,
	owner: GameEngineAcquisitionOwner,
): void => {
	owners.set(queryClient, owner);
};

/** Releases exactly the owner supplied, without disturbing a successor claim. */
export const releaseGameEngineAcquisitionOwner = (
	queryClient: QueryClient,
	owner: GameEngineAcquisitionOwner,
): boolean => {
	if (owners.get(queryClient) !== owner) return false;
	owners.delete(queryClient);
	return true;
};

/** Presence in the sole owner registry means query data is still provisional. */
export const isGameEngineAcquisitionPending = (queryClient: QueryClient): boolean =>
	owners.has(queryClient);
