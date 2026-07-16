import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import type { GameSession } from "~/bridge/game/GameSession";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameSession } from "~/bridge/game/createGameSession";
import { createGameSaveStorage } from "~/bridge/save/createGameSaveStorage";
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
	const saveStorage = providedSaveStorage ?? createGameSaveStorage();
	const resourceUrls = new Map<string, string>();
	let session: GameSession | undefined;

	const revokeResources = () => {
		for (const url of resourceUrls.values()) URL.revokeObjectURL(url);
		resourceUrls.clear();
	};
	const closeSaveStorage = () => {
		if (providedSaveStorage === undefined) saveStorage.close();
	};
	const discardFailedBootstrap = Effect.tryPromise({
		try: async () => {
			if (session !== undefined) await session.disposeWithoutSave();
		},
		catch: () => undefined,
	}).pipe(
		Effect.ensuring(
			Effect.sync(() => {
				revokeResources();
				closeSaveStorage();
			}),
		),
		Effect.ignore,
	);

	return yield* Effect.gen(function* () {
		const saveKey: GameSaveStorage.Key = {
			packageId: loaded.descriptor.packageId,
			contentHash: loaded.descriptor.contentHash,
		};
		const savedBytes = yield* Effect.tryPromise({
			try: () => saveStorage.read(saveKey),
			catch: (cause) => cause,
		});
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
		session = yield* Effect.tryPromise({
			try: () =>
				createGameSession({
					config: loaded.payload.config,
					...(state === undefined
						? {}
						: {
								state,
							}),
					save: {
						write: (nextState) =>
							encodeArkiniSaveFx(nextState).pipe(
								Effect.flatMap((bytes) =>
									Effect.tryPromise({
										try: () => saveStorage.write(saveKey, bytes),
										catch: (cause) => cause,
									}),
								),
							),
					},
				}),
			catch: (cause) =>
				savedBytes === null
					? cause
					: new GameSaveBootstrapError({
							cause,
							saveKey,
						}),
		});
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
		let disposePromise: Promise<void> | undefined;
		const disposeWith = (mode: "save" | "discard") => {
			disposePromise ??= (
				mode === "save" ? liveSession.dispose() : liveSession.disposeWithoutSave()
			).finally(() => {
				revokeResources();
				closeSaveStorage();
			});
			return disposePromise;
		};

		return {
			...liveSession,
			arkpack: loaded.descriptor,
			config: loaded.payload.config,
			dispose: () => disposeWith("save"),
			disposeWithoutSave: () => disposeWith("discard"),
			instanceKey: crypto.randomUUID(),
			saveKey,
			getResourceUrl: (resourceId) => {
				const url = resourceUrls.get(resourceId);
				if (url === undefined)
					throw new Error(`Game resource ${resourceId} is unavailable.`);
				return url;
			},
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrap));
});
