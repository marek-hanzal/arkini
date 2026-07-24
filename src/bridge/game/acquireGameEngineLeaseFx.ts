import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { gameEngineAcquisitionOwners } from "~/bridge/game/gameEngineAcquisitionOwners";
import type { GameEngineAcquisitionOwner } from "~/bridge/game/GameEngineAcquisitionOwner";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export interface GameEngineAcquisition {
	readonly resource: GameEngineResource;
	readonly adoptFx: Effect.Effect<GameEngineResource, unknown>;
}

export namespace acquireGameEngineLeaseFx {
	export interface Props extends gameEngineQueryOptions.Props {
		readonly queryClient: QueryClient;
		readonly signal?: AbortSignal;
	}
}

const readOwner = (queryClient: QueryClient): GameEngineAcquisitionOwner | undefined =>
	gameEngineAcquisitionOwners.get(queryClient);

const claimOwner = (queryClient: QueryClient, owner: GameEngineAcquisitionOwner): void => {
	gameEngineAcquisitionOwners.set(queryClient, owner);
};

const releaseOwner = (queryClient: QueryClient, owner: GameEngineAcquisitionOwner): boolean => {
	if (gameEngineAcquisitionOwners.get(queryClient) !== owner) return false;
	gameEngineAcquisitionOwners.delete(queryClient);
	return true;
};

const readQueryResource = (queryClient: QueryClient): GameEngineResource | null =>
	queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey) ?? null;

const abortReason = (signal: AbortSignal): unknown =>
	signal.reason ?? new DOMException("Game Engine acquisition was aborted.", "AbortError");

const finalizeOwner = (owner: GameEngineAcquisitionOwner) => {
	releaseOwner(owner.queryClient, owner);
	for (const consumer of owner.consumers) consumer.removeAbortListener();
	owner.consumers.clear();
};

const observeOwnerFailure = (owner: GameEngineAcquisitionOwner, cause: unknown) => {
	if (cause instanceof CriticalGameLifecycleError) {
		owner.criticalFailure ??= cause;
		return;
	}
	if (!owner.controller.signal.aborted) finalizeOwner(owner);
};

const discardPublishedResource = async (
	owner: GameEngineAcquisitionOwner,
	resource: GameEngineResource,
) => {
	if (readQueryResource(owner.queryClient) !== resource) return;
	try {
		await RendererRuntime.runPromise(
			resource.withLifecycleLockFx(resource.game.disposeWithoutSaveFx),
		);
	} catch (cause) {
		throw resource.markCriticalFailure("engine-ownership", cause);
	}
	if (readQueryResource(owner.queryClient) !== resource) return;
	owner.queryClient.removeQueries({
		exact: true,
		queryKey: gameEngineQueryKey,
	});
};

const cancelOwner = (owner: GameEngineAcquisitionOwner): Promise<void> => {
	if (owner.criticalFailure !== undefined) return Promise.reject(owner.criticalFailure);
	if (owner.adopted) return Promise.resolve();
	if (owner.cancelling !== undefined) return owner.cancelling;
	owner.controller.abort(
		new DOMException("Game Engine acquisition ownership changed.", "AbortError"),
	);
	owner.cancelling = (async () => {
		let criticalFailure: CriticalGameLifecycleError | undefined;
		try {
			let resource: GameEngineResource | undefined;
			try {
				resource = await owner.result;
			} catch (cause) {
				if (cause instanceof CriticalGameLifecycleError) criticalFailure = cause;
			}
			if (!owner.adopted && resource !== undefined) {
				try {
					await discardPublishedResource(owner, resource);
				} catch (cause) {
					if (cause instanceof CriticalGameLifecycleError) {
						criticalFailure = cause;
					} else {
						throw cause;
					}
				}
			}
		} finally {
			if (criticalFailure === undefined) {
				const query = owner.queryClient.getQueryCache().find({
					exact: true,
					queryKey: gameEngineQueryKey,
				});
				if (
					!owner.adopted &&
					query?.meta?.packageId === owner.packageId &&
					query.state.data === undefined
				) {
					owner.queryClient.removeQueries({
						exact: true,
						queryKey: gameEngineQueryKey,
					});
				}
				finalizeOwner(owner);
			}
		}
		if (criticalFailure !== undefined) {
			owner.criticalFailure ??= criticalFailure;
			throw owner.criticalFailure;
		}
	})();
	return owner.cancelling;
};

const registerConsumer = (
	owner: GameEngineAcquisitionOwner,
	signal: AbortSignal | undefined,
): GameEngineAcquisitionOwner.Consumer => {
	let removeAbortListener: () => void = () => undefined;
	const abort =
		signal === undefined
			? new Promise<never>(() => undefined)
			: new Promise<never>((_resolve, reject) => {
					const onAbort = () => {
						owner.consumers.delete(consumer);
						removeAbortListener();
						reject(abortReason(signal));
						if (!owner.adopted && owner.consumers.size === 0) {
							void cancelOwner(owner).catch(() => undefined);
						}
					};
					removeAbortListener = () => signal.removeEventListener("abort", onAbort);
					signal.addEventListener("abort", onAbort, {
						once: true,
					});
				});
	const consumer = {
		abort,
		removeAbortListener,
	} satisfies GameEngineAcquisitionOwner.Consumer;
	owner.consumers.add(consumer);
	return consumer;
};

const leaseOwner = async (
	owner: GameEngineAcquisitionOwner,
	signal: AbortSignal | undefined,
): Promise<GameEngineAcquisition> => {
	signal?.throwIfAborted();
	const consumer = registerConsumer(owner, signal);
	let resource: GameEngineResource;
	try {
		resource = await Promise.race([
			owner.result,
			consumer.abort,
		]);
	} catch (cause) {
		observeOwnerFailure(owner, cause);
		throw cause;
	}
	return {
		resource,
		adoptFx: Effect.try({
			try: () => {
				signal?.throwIfAborted();
				if (owner.criticalFailure !== undefined) throw owner.criticalFailure;
				if (owner.cancelling !== undefined) throw abortReason(owner.controller.signal);
				if (readQueryResource(owner.queryClient) !== resource) {
					throw new Error(
						"Game Engine acquisition can only adopt its exact singleton resource.",
					);
				}
				if (readOwner(owner.queryClient) === owner) {
					owner.adopted = true;
					finalizeOwner(owner);
				}
				return resource;
			},
			catch: (cause) => cause,
		}),
	};
};

const leasePublishedResource = (
	queryClient: QueryClient,
	resource: GameEngineResource,
	signal: AbortSignal | undefined,
): GameEngineAcquisition => ({
	resource,
	adoptFx: Effect.try({
		try: () => {
			signal?.throwIfAborted();
			if (readQueryResource(queryClient) !== resource) {
				throw new Error("Game Engine acquisition lost its published singleton resource.");
			}
			return resource;
		},
		catch: (cause) => cause,
	}),
});

/** Claims the singleton creation slot and keeps the result provisional until its route adopts it. */
const acquireGameEngineLease = async ({
	queryClient,
	signal,
	...options
}: acquireGameEngineLeaseFx.Props): Promise<GameEngineAcquisition> => {
	signal?.throwIfAborted();
	const current = readOwner(queryClient);
	if (current !== undefined) {
		if (current.criticalFailure !== undefined) throw current.criticalFailure;
		if (current.cancelling !== undefined) {
			await current.cancelling;
			signal?.throwIfAborted();
			return acquireGameEngineLease({
				...options,
				queryClient,
				signal,
			});
		}
		if (current.packageId === options.packageId) return leaseOwner(current, signal);
		await cancelOwner(current);
		signal?.throwIfAborted();
		return acquireGameEngineLease({
			...options,
			queryClient,
			signal,
		});
	}
	const published = readQueryResource(queryClient);
	if (published !== null) return leasePublishedResource(queryClient, published, signal);

	const staleQuery = queryClient.getQueryCache().find({
		exact: true,
		queryKey: gameEngineQueryKey,
	});
	if (
		staleQuery !== undefined &&
		staleQuery.state.fetchStatus === "idle" &&
		staleQuery.state.data === undefined &&
		staleQuery.meta?.packageId !== options.packageId
	) {
		queryClient.removeQueries({
			exact: true,
			queryKey: gameEngineQueryKey,
		});
	}

	const controller = new AbortController();
	const result = queryClient.ensureQueryData(
		gameEngineQueryOptions({
			...options,
			acquisitionSignal: controller.signal,
		}),
	);
	const owner = {
		adopted: false,
		cancelling: undefined,
		controller,
		consumers: new Set(),
		criticalFailure: undefined,
		packageId: options.packageId,
		queryClient,
		result,
	} satisfies GameEngineAcquisitionOwner;
	claimOwner(queryClient, owner);
	void result.catch((cause) => observeOwnerFailure(owner, cause));
	return leaseOwner(owner, signal);
};

/** Acquires one route-owned renderer Game Engine lease. */
export const acquireGameEngineLeaseFx = Effect.fn("acquireGameEngineLeaseFx")(
	(props: acquireGameEngineLeaseFx.Props) =>
		Effect.tryPromise({
			try: () => acquireGameEngineLease(props),
			catch: (cause) => cause,
		}),
);
