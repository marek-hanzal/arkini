import { Effect } from "effect";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { loadArkpackFx } from "~/arkpack-catalog/fx/loadArkpackFx";
import type { Game } from "~/installed-game/type/Game";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import { createGameSessionFx } from "~/game-session/fx/createGameSessionFx";
import {
	createGameResourceUrlsFx,
	type GameResourceUrls,
} from "~/playable-game/fx/createGameResourceUrlsFx";
import { discardGameBootstrapFx } from "~/playable-game/fx/discardGameBootstrapFx";
import { installGameDiagnosticsFx } from "~/installed-game/fx/installGameDiagnosticsFx";
import { createElectronGameSaveStorageFx } from "~/game-persistence/fx/createElectronGameSaveStorageFx";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { decodeArkiniSaveFx } from "~/game-persistence/fx/decodeArkiniSaveFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { startFx } from "~/game-start/fx/startFx";
import { readMajorFn as readGameVersionMajorFn } from "~/game-version/fn/readMajorFn";

export namespace createGameFx {
	export interface Props {
		packageId: string;
		arkpackStorage?: ArkpackStorage;
		runRendererEffectFn: installGameDiagnosticsFx.Props["runRendererEffectFn"];
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
	runRendererEffectFn,
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
	const saveStorage = providedSaveStorage ?? (yield* createElectronGameSaveStorageFx());
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
		const arkpackVersion = readGameVersionMajorFn(loaded.payload.version);
		const saveVersion = readGameVersionMajorFn(saved.version);
		if (saveVersion.major !== arkpackVersion.major) {
			return yield* Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error(
						`Save version ${saved.version} is incompatible with arkpack version ${loaded.payload.version}.`,
					),
					saveKey,
				}),
			);
		}
		state = saved.state;
	}
	const session = yield* createGameSessionFx({
		config: loaded.payload.config,
		...(state === undefined
			? {}
			: {
					state,
				}),
		save: {
			writeFx: (nextState) =>
				saveStorage.writeFx(
					saveKey,
					encodeArkiniSaveFn({
						version: loaded.payload.version,
						state: nextState,
					}),
				),
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
	let resourceUrls: GameResourceUrls | undefined;
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
			runRendererEffectFn,
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
			getResourceUrlFn: liveResourceUrls.getFn,
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
