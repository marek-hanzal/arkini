import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import type { Game } from "~/bridge/game/Game";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { createGameResourceUrlsFx } from "~/bridge/game/createGameResourceUrlsFx";
import { discardGameBootstrapFx } from "~/bridge/game/discardGameBootstrapFx";
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
	const session = yield* createGameSessionFx({
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
