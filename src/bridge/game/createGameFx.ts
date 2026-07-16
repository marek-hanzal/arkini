import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import type { GameSession } from "~/bridge/game/GameSession";
import { createGameSession } from "~/bridge/game/createGameSession";
import { DexieGameSaveStorage } from "~/bridge/save/DexieGameSaveStorage";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { startFx } from "~/engine/start/write/startFx";

export namespace createGameFx {
	export interface Props {
		packageId: string;
		arkpackStorage?: ArkpackStorage;
		saveStorage?: GameSaveStorage;
	}
}

/** Loads one selected package, restores its namespaced save and returns one live game. */
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
	const saveStorage = providedSaveStorage ?? new DexieGameSaveStorage();
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
		const saveScope = {
			packageId: loaded.descriptor.packageId,
			contentHash: loaded.descriptor.contentHash,
		};
		const state = yield* Effect.tryPromise({
			try: () => saveStorage.read(saveScope),
			catch: (cause) => cause,
		});
		session = yield* Effect.tryPromise({
			try: () =>
				createGameSession({
					config: loaded.payload.config,
					...(state === null
						? {}
						: {
								state,
							}),
					save: {
						write: (nextState) =>
							Effect.tryPromise({
								try: () =>
									saveStorage.write({
										...saveScope,
										state: nextState,
									}),
								catch: (cause) => cause,
							}),
					},
				}),
			catch: (cause) => cause,
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
		if (state === null) {
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
			getResourceUrl: (resourceId) => {
				const url = resourceUrls.get(resourceId);
				if (url === undefined)
					throw new Error(`Game resource ${resourceId} is unavailable.`);
				return url;
			},
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrap));
});
