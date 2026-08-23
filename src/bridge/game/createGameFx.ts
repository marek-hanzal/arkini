import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { createGameResourceUrlsFx } from "~/bridge/game/createGameResourceUrlsFx";
import { discardGameBootstrapFx } from "~/bridge/game/discardGameBootstrapFx";
import { installGameDiagnosticsFx } from "~/bridge/game/installGameDiagnosticsFx";
import {
	assertSupportedGameVersionFx,
	readArkpackVersionFx,
} from "~/bridge/game/GameVersionCompatibility";
import { createGameSaveStorageFx } from "~/bridge/save/createGameSaveStorageFx";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { startFx } from "~/engine/start/write/startFx";

export namespace createGameFx {
	export interface Props {
		packageId: string;
		arkpackStorage?: ArkpackStorage;
		runRendererEffect: installGameDiagnosticsFx.Props["runRendererEffect"];
		saveStorage?: GameSaveStorage;
	}
}

/**
 * Loads one package into a jointly owned session/resource-URL aggregate.
 *
 * No partially bootstrapped Game escapes: every failure discards the session
 * without writing a save and revokes all object URLs allocated so far.
 */
export const createGameFx = Effect.fn("createGameFx")(function* ({
	packageId,
	arkpackStorage,
	runRendererEffect,
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
	yield* assertSupportedGameVersionFx(loaded.payload.game);
	const saveStorage = providedSaveStorage ?? (yield* createGameSaveStorageFx());
	const saveKey: GameSaveStorage.Key = {
		packageId: loaded.descriptor.packageId,
	};
	const savedBytes = yield* saveStorage.readFx(saveKey);
	let state: StateSchema.Type | undefined;
	if (savedBytes !== null) {
		const saved = yield* decodeArkiniSaveFx(savedBytes).pipe(
			Effect.mapError(
				(cause) =>
					new GameSaveBootstrapError({
						cause,
						saveKey,
					}),
			),
		);
		const arkpackVersion = yield* readArkpackVersionFx(loaded.payload.version);
		const saveVersion = yield* readArkpackVersionFx(saved.version);
		if (saveVersion.major !== arkpackVersion.major) {
			yield* saveStorage.clearFx(saveKey).pipe(
				Effect.mapError(
					(cause) =>
						new GameSaveBootstrapError({
							cause,
							saveKey,
						}),
				),
			);
		} else {
			yield* assertSupportedGameVersionFx(saved.game).pipe(
				Effect.mapError(
					(cause) =>
						new GameSaveBootstrapError({
							cause,
							saveKey,
						}),
				),
			);
			if (saveVersion.minor > arkpackVersion.minor) {
				return yield* Effect.fail(
					new GameSaveBootstrapError({
						cause: new Error(
							`Save version ${saved.version} is newer than arkpack version ${loaded.payload.version}.`,
						),
						saveKey,
					}),
				);
			}
			state = saved.state;
		}
	}
	const session = yield* createGameSessionFx({
		config: loaded.payload.config,
		...(state === undefined
			? {}
			: {
					state,
				}),
		save: {
			write: (nextState) =>
				encodeArkiniSaveFx({
					version: loaded.payload.version,
					state: nextState,
				}).pipe(Effect.flatMap((bytes) => saveStorage.writeFx(saveKey, bytes))),
		},
	}).pipe(
		Effect.mapError((cause) =>
			state === undefined
				? cause
				: new GameSaveBootstrapError({
						cause,
						saveKey,
					}),
		),
	);
	let resourceUrls: Effect.Success<ReturnType<typeof createGameResourceUrlsFx>> | undefined;
	const discardFailedBootstrapFx = discardGameBootstrapFx(
		session,
		Effect.suspend(() => resourceUrls?.releaseFx ?? Effect.void),
	);

	return yield* Effect.gen(function* () {
		resourceUrls = yield* createGameResourceUrlsFx({
			owner: "Game",
			resources: loaded.payload.resources,
		});
		if (state === undefined) {
			// A restored save is already started; only a new state receives the initial command.
			yield* session.runFx(startFx());
		}

		const liveResourceUrls = resourceUrls;
		const diagnostics = yield* installGameDiagnosticsFx({
			arkpack: loaded.descriptor,
			restored: state !== undefined,
			runRendererEffect,
			session,
		});
		const closeDiagnosticsFx = (reason: "discarded" | "saved") =>
			Effect.sync(() => diagnostics.close(reason)).pipe(Effect.catchCause(() => Effect.void));
		return {
			...session,
			arkpack: loaded.descriptor,
			config: loaded.payload.config,
			diagnosticSessionId: diagnostics.sessionId,
			disposeFx: session.disposeFx.pipe(
				Effect.tap(() => closeDiagnosticsFx("saved")),
				Effect.andThen(liveResourceUrls.releaseFx),
			),
			disposeWithoutSaveFx: session.disposeWithoutSaveFx.pipe(
				Effect.tap(() => closeDiagnosticsFx("discarded")),
				Effect.andThen(liveResourceUrls.releaseFx),
			),
			saveKey,
			getResourceUrl: liveResourceUrls.get,
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
