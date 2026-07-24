import { Cause, Effect, Exit } from "effect";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { createGameFx as createGameFromPackageFx } from "~/bridge/game/createGameFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { writeLastPackageIdFx } from "~/bridge/launcher/writeLastPackageIdFx";

export namespace acquireGameEngineResourceFx {
	export interface Props {
		readonly beforeCreateFx?: Effect.Effect<void, unknown>;
		readonly createGameFx?: (packageId: string) => Effect.Effect<Game, unknown>;
		readonly packageId: string;
		readonly rememberPackageFx?: (packageId: string) => Effect.Effect<void, unknown>;
	}
}

const discardFailedAcquisitionFx = Effect.fn("discardFailedAcquisitionFx")(
	(game: Game, acquisitionCause: Cause.Cause<unknown>): Effect.Effect<never, unknown> =>
		Effect.exit(game.disposeWithoutSaveFx).pipe(
			Effect.flatMap((disposeExit) => {
				if (Exit.isSuccess(disposeExit)) return Effect.failCause(acquisitionCause);
				const failure = readExactCauseFailure(disposeExit.cause);
				const cause = failure._tag === "Some" ? failure.value : disposeExit.cause;
				return Effect.fail(
					cause instanceof CriticalGameLifecycleError
						? cause
						: new CriticalGameLifecycleError({
								operation: "engine-ownership",
								cause,
							}),
				);
			}),
		),
);

/**
 * Owns the complete selected-package bootstrap transaction. Once a Game exists,
 * every failed or aborted validation/adoption path discards it before surfacing.
 */
export const acquireGameEngineResourceFx = Effect.fn("acquireGameEngineResourceFx")(
	({
		beforeCreateFx = Effect.void,
		createGameFx = (packageId) =>
			createGameFromPackageFx({
				packageId,
			}),
		packageId,
		rememberPackageFx = writeLastPackageIdFx,
	}: acquireGameEngineResourceFx.Props) =>
		beforeCreateFx.pipe(
			Effect.andThen(
				Effect.uninterruptibleMask((restore) =>
					Effect.gen(function* () {
						const game = yield* restore(createGameFx(packageId));
						const adoptionExit = yield* Effect.exit(
							restore(
								Effect.gen(function* () {
									if (game.arkpack.packageId !== packageId) {
										return yield* Effect.fail(
											new CriticalGameLifecycleError({
												operation: "engine-ownership",
												cause: new Error(
													`Game Engine creation returned package ${game.arkpack.packageId} for requested package ${packageId}.`,
												),
											}),
										);
									}
									yield* rememberPackageFx(packageId).pipe(
										Effect.catch(() => Effect.void),
									);
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
		) satisfies Effect.Effect<GameEngineResource, unknown>,
);
