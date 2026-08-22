import { Effect, Exit, Scope } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import type { GameSession } from "~/bridge/game/GameSession";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { installGameDiagnosticsFx } from "~/bridge/game/installGameDiagnosticsFx";
import { createGameSaveStorageFx } from "~/bridge/save/createGameSaveStorageFx";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
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
			contentHash: loaded.descriptor.hash,
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
			// A restored save is already started; only a new state receives the initial command.
			yield* session.runFx(startFx());
		}

		const liveSession = session;
		const diagnostics = yield* installGameDiagnosticsFx({
			arkpack: loaded.descriptor,
			restored: state !== undefined,
			runRendererEffect,
			session: liveSession,
		});
		const closeDiagnosticsFx = (reason: "discarded" | "saved") =>
			Effect.sync(() => diagnostics.close(reason)).pipe(Effect.catchCause(() => Effect.void));
		return {
			...liveSession,
			arkpack: loaded.descriptor,
			config: loaded.payload.config,
			diagnosticSessionId: diagnostics.sessionId,
			disposeFx: liveSession.disposeFx.pipe(
				Effect.tap(() => closeDiagnosticsFx("saved")),
				Effect.andThen(releaseResourcesFx),
			),
			disposeWithoutSaveFx: liveSession.disposeWithoutSaveFx.pipe(
				Effect.tap(() => closeDiagnosticsFx("discarded")),
				Effect.andThen(releaseResourcesFx),
			),
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
