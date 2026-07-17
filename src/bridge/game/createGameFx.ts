import { Effect, Exit, Scope } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import type { GameSession } from "~/bridge/game/GameSession";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { createGameSaveStorageFx } from "~/bridge/save/createGameSaveStorageFx";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { startFx } from "~/engine/start/write/startFx";

export namespace createGameFx {
	export interface Props {
		packageId: string;
		arkpackStorage?: ArkpackStorage;
		saveStorage?: GameSaveStorage;
	}
}

/** Loads one selected package, restores its exact save and returns one live game. */
export const createGameFx = Effect.fn("createGameFx")(function* ({
	packageId,
	arkpackStorage,
	saveStorage: providedSaveStorage,
}: createGameFx.Props) {
	const loaded = yield* loadArkpackFx({
		packageId,
		...(arkpackStorage === undefined
			? {}
			: {
					storage: arkpackStorage,
				}),
	});
	const saveStorage = providedSaveStorage ?? (yield* createGameSaveStorageFx());
	const resourceUrls = new Map<string, string>();
	const resourceScope = yield* Scope.make();
	let session: GameSession | undefined;

	yield* Scope.addFinalizer(
		resourceScope,
		Effect.sync(() => {
			for (const url of resourceUrls.values()) URL.revokeObjectURL(url);
			resourceUrls.clear();
		}),
	);
	const releaseResourcesFx = Scope.close(resourceScope, Exit.void);
	const discardFailedBootstrapFx = Effect.gen(function* () {
		if (session !== undefined) yield* session.disposeWithoutSaveFx.pipe(Effect.ignore);
		yield* releaseResourcesFx;
	}).pipe(Effect.ignore);

	return yield* Effect.gen(function* () {
		const saveKey: GameSaveStorage.Key = {
			packageId: loaded.descriptor.packageId,
			contentHash: loaded.descriptor.contentHash,
		};
		const savedBytes = yield* saveStorage.readFx(saveKey);
		const state =
			savedBytes === null
				? undefined
				: (yield* decodeArkiniSaveFx(savedBytes).pipe(
						Effect.mapError(
							(cause) =>
								new GameSaveBootstrapError({
									cause,
									saveKey,
								}),
						),
					)).state;
		session = yield* createGameSessionFx({
			config: loaded.payload.config,
			...(state === undefined
				? {}
				: {
						state,
					}),
			save: {
				write: (nextState) =>
					encodeArkiniSaveFx(nextState).pipe(
						Effect.flatMap((bytes) => saveStorage.writeFx(saveKey, bytes)),
					),
			},
		}).pipe(
			Effect.mapError((cause) =>
				savedBytes === null
					? cause
					: new GameSaveBootstrapError({
							cause,
							saveKey,
						}),
			),
		);
		yield* Effect.sync(() => {
			for (const resource of loaded.payload.resources) {
				resourceUrls.set(
					resource.id,
					URL.createObjectURL(
						new Blob(
							[
								resource.bytes.slice().buffer,
							],
							{
								type: resource.mime,
							},
						),
					),
				);
			}
		});
		if (state === undefined) {
			yield* Effect.tryPromise({
				try: () =>
					session?.run(startFx()) ?? Promise.reject(new Error("Game session missing.")),
				catch: (cause) => cause,
			});
		}

		const liveSession = session;
		return {
			...liveSession,
			arkpack: loaded.descriptor,
			config: loaded.payload.config,
			disposeFx: liveSession.disposeFx.pipe(Effect.zipRight(releaseResourcesFx)),
			disposeWithoutSaveFx: liveSession.disposeWithoutSaveFx.pipe(
				Effect.zipRight(releaseResourcesFx),
			),
			instanceKey: crypto.randomUUID(),
			saveKey,
			getResourceUrl: (resourceId) => {
				const url = resourceUrls.get(resourceId);
				if (url === undefined)
					throw new Error(`Game resource ${resourceId} is unavailable.`);
				return url;
			},
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
