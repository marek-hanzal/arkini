import { Cause, Effect, Exit } from "effect";

import { toCriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { writeLastPackageIdFx } from "~/bridge/launcher/writeLastPackageIdFx";

export namespace acquireGameEngineResourceFx {
	export interface Props {
		readonly awaitPreviousShutdown: Promise<void>;
		readonly beforeCreate?: (signal: AbortSignal) => Promise<void>;
		readonly create?: (packageId: string, signal: AbortSignal) => Promise<Game>;
		readonly packageId: string;
		readonly rememberPackage?: (packageId: string) => Promise<void>;
		readonly signal: AbortSignal;
	}
}

const checkAcquisitionSignalFx = Effect.fn("checkAcquisitionSignalFx")((signal: AbortSignal) =>
	Effect.try({
		try: () => signal.throwIfAborted(),
		catch: (cause) => cause,
	}),
);

const discardFailedAcquisitionFx = Effect.fn("discardFailedAcquisitionFx")(
	(game: Game, acquisitionCause: Cause.Cause<unknown>): Effect.Effect<never, unknown> =>
		Effect.exit(game.disposeWithoutSaveFx).pipe(
			Effect.flatMap((disposeExit) =>
				Exit.isFailure(disposeExit)
					? Effect.fail(
							toCriticalGameLifecycleError({
								operation: "engine-ownership",
								cause: Cause.squash(disposeExit.cause),
							}),
						)
					: Effect.failCause(acquisitionCause),
			),
		),
);

/**
 * Owns the complete selected-package bootstrap transaction. Once a Game exists,
 * every failed or aborted validation/adoption path discards it before surfacing.
 */
export const acquireGameEngineResourceFx = Effect.fn("acquireGameEngineResourceFx")(
	({
		awaitPreviousShutdown,
		beforeCreate,
		create,
		packageId,
		rememberPackage,
		signal,
	}: acquireGameEngineResourceFx.Props) => {
		const awaitPreviousShutdownFx = Effect.tryPromise({
			try: () => awaitPreviousShutdown,
			catch: (cause) =>
				toCriticalGameLifecycleError({
					operation: "hmr-handoff",
					cause,
				}),
		});
		const beforeCreateFx =
			beforeCreate === undefined
				? Effect.void
				: Effect.tryPromise({
						try: () => beforeCreate(signal),
						catch: (cause) => cause,
					});
		const createSelectedGameFx =
			create === undefined
				? createGameFx({
						packageId,
					})
				: Effect.uninterruptible(
						Effect.tryPromise({
							try: () => create(packageId, signal),
							catch: (cause) => cause,
						}),
					);

		return awaitPreviousShutdownFx.pipe(
			Effect.zipRight(checkAcquisitionSignalFx(signal)),
			Effect.zipRight(beforeCreateFx),
			Effect.zipRight(checkAcquisitionSignalFx(signal)),
			Effect.zipRight(
				Effect.uninterruptibleMask((restore) =>
					Effect.gen(function* () {
						const game =
							create === undefined
								? yield* restore(createSelectedGameFx)
								: yield* createSelectedGameFx;
						const rememberPackageFx =
							rememberPackage === undefined
								? writeLastPackageIdFx(packageId)
								: Effect.tryPromise({
										try: () => rememberPackage(packageId),
										catch: (cause) => cause,
									});
						const adoptionExit = yield* Effect.exit(
							restore(
								Effect.gen(function* () {
									yield* checkAcquisitionSignalFx(signal);
									if (game.arkpack.packageId !== packageId) {
										return yield* Effect.fail(
											toCriticalGameLifecycleError({
												operation: "engine-ownership",
												cause: new Error(
													`Game Engine creation returned package ${game.arkpack.packageId} for requested package ${packageId}.`,
												),
											}),
										);
									}
									yield* rememberPackageFx.pipe(
										Effect.catchAll(() => Effect.void),
									);
									yield* checkAcquisitionSignalFx(signal);
									return yield* createGameEngineResourceFx(game);
								}),
							),
						);
						if (Exit.isFailure(adoptionExit)) {
							return yield* discardFailedAcquisitionFx(game, adoptionExit.cause);
						}
						return adoptionExit.value;
					}),
				),
			),
		) satisfies Effect.Effect<GameEngineResource, unknown>;
	},
);
