import { GameplaySpeedUpMultiplier } from "~/game-cheat/constant/GameplaySpeedUpMultiplier";
import { Effect, Semaphore } from "effect";
import { TickFx } from "~/game-tick/service/TickFx";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { loadSerapackFx } from "~/serapack-catalog/fx/loadSerapackFx";
import type { Game } from "~/installed-game/type/Game";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import { createGameSessionFx } from "~/game-session/fx/createGameSessionFx";
import { discardGameBootstrapFx } from "~/playable-game/fx/discardGameBootstrapFx";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";
import { createElectronGameSaveStorageFx } from "~/game-persistence/fx/createElectronGameSaveStorageFx";
import { RuntimeSaveFx } from "~/game-persistence/service/RuntimeSaveFx";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { encodeSerakkiSaveFn } from "~/game-persistence/fn/encodeSerakkiSaveFn";
import { decodeSerakkiSaveFx } from "~/game-persistence/fx/decodeSerakkiSaveFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { startFx } from "~/game-start/fx/startFx";
import { readMajorFn as readGameVersionMajorFn } from "~/game-version/fn/readMajorFn";

interface GameResourceUrls {
	readonly getFn: (resourceId: string) => string;
	readonly releaseFx: Effect.Effect<void, never, never>;
}

export namespace createGameFx {
	export interface Props {
		packageId: string;
		serapackStorage?: SerapackStorage;
		runRendererEffectFn: installGameDiagnosticsFx.Props["runRendererEffectFn"];
		saveStorage?: GameSaveStorage;
	}
}

/**
 * Loads one package into a jointly owned session/resource aggregate.
 *
 * No partially bootstrapped Game escapes: every failure discards the session
 * without writing a save and revokes all object URLs allocated so far.
 */
export const createGameFx = Effect.fn("createGameFx")(function* ({
	packageId,
	serapackStorage,
	runRendererEffectFn,
	saveStorage: providedSaveStorage,
}: createGameFx.Props) {
	const loaded = yield* loadSerapackFx({
		packageId,
		...(serapackStorage === undefined
			? {}
			: {
					storage: serapackStorage,
				}),
	});
	const saveStorage = providedSaveStorage ?? (yield* createElectronGameSaveStorageFx());
	const saveKey: GameSaveStorage.Key = {
		packageId: loaded.descriptor.packageId,
	};
	const savedBytes = yield* saveStorage.readFx(saveKey);
	let state: StateSchema.Type | undefined;
	if (savedBytes !== null) {
		const saved = yield* decodeSerakkiSaveFx(savedBytes).pipe(
			Effect.mapError(
				(cause) =>
					new GameSaveBootstrapError({
						cause,
						saveKey,
					}),
			),
		);
		const serapackVersion = readGameVersionMajorFn(loaded.payload.version);
		const saveVersion = readGameVersionMajorFn(saved.version);
		if (saveVersion.major !== serapackVersion.major) {
			return yield* Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error(
						`Save version ${saved.version} is incompatible with serapack version ${loaded.payload.version}.`,
					),
					saveKey,
				}),
			);
		}
		state = saved.state;
	}
	const introduction = state === undefined ? loaded.payload.config.meta.introduction : undefined;
	let introductionPending = (introduction?.trim().length ?? 0) > 0;
	const introductionMutex = yield* Semaphore.make(1);
	const session = yield* createGameSessionFx({
		speedUpMultiplier: GameplaySpeedUpMultiplier,
		config: loaded.payload.config,
		...(state === undefined
			? {}
			: {
					state,
				}),
		save: {
			// An unacknowledged welcome is not a started game, including on native close.
			isEnabledFn: () => !introductionPending,
			writeFx: (nextState) =>
				saveStorage.writeFx(
					saveKey,
					encodeSerakkiSaveFn({
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
		const urls = new Map(
			loaded.payload.resources.map((resource) => [
				resource.id,
				resource.url,
			]),
		);
		resourceUrls = {
			getFn: (resourceId) => {
				const url = urls.get(resourceId);
				if (url === undefined)
					throw new Error(`Game resource ${resourceId} is unavailable.`);
				return url;
			},
			releaseFx: Effect.sync(() => urls.clear()),
		};
		const liveResourceUrls = resourceUrls;
		if (state === undefined && !introductionPending) {
			// A restored save is already started; only a new state receives the initial command.
			yield* session.runFx(startFx());
		}

		const diagnostics = yield* installGameDiagnosticsFx({
			serapack: loaded.descriptor,
			config: loaded.payload.config,
			restored: state !== undefined,
			runRendererEffectFn,
			session,
		});
		const closeDiagnosticsFx = (reason: "discarded" | "saved") =>
			Effect.sync(() => diagnostics.close(reason)).pipe(Effect.catchCause(() => Effect.void));
		return {
			...session,
			serapack: loaded.descriptor,
			config: loaded.payload.config,
			resources: loaded.payload.resources.map(({ id, type }) => ({
				id,
				type,
			})),
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
			...(introductionPending
				? {
						introduction: {
							readFn: () => (introductionPending ? introduction : undefined),
							continueFx: session.runFx(
								introductionMutex.withPermits(1)(
									Effect.uninterruptible(
										Effect.gen(function* () {
											if (!introductionPending) return;
											// Drain time spent reading (or asleep) before any initial items can age.
											const tick = yield* TickFx;
											yield* tick.advanceRuntime;
											yield* startFx();
											// Keep save admission in the same joined command lifetime as world creation.
											introductionPending = false;
											const save = yield* RuntimeSaveFx;
											yield* save.flush;
										}),
									),
								),
							),
						},
					}
				: {}),
			getResourceUrlFn: liveResourceUrls.getFn,
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
