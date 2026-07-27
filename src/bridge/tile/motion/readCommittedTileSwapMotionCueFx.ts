import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { GameTransition } from "~/bridge/game/GameSession";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSwapMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readGridRuntimeItemFx } from "~/bridge/tile/motion/readGridRuntimeItemFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

interface CapturedTileSwapActor {
	readonly id: string;
	readonly revision: string;
	readonly location: TileLocation;
}

const readCapturedGridItemFx = Effect.fn("readCapturedCommittedTileSwapGridItemFx")(function* ({
	actor,
	runtime,
}: {
	readonly actor: CapturedTileSwapActor;
	readonly runtime: RuntimeSchema.Type | null;
}) {
	const item = yield* readGridRuntimeItemFx({
		itemId: actor.id,
		runtime,
	});
	return item?.revision === actor.revision ? item : null;
});

export namespace readCommittedTileSwapMotionCueFx {
	export interface Props {
		readonly source: CapturedTileSwapActor;
		readonly target: CapturedTileSwapActor;
		readonly transition: GameTransition;
	}
}

/** Compiles the exchanged target only when one transition exactly commits both captured actors. */
export const readCommittedTileSwapMotionCueFx = Effect.fn("readCommittedTileSwapMotionCueFx")(
	function* ({ source, target, transition }: readCommittedTileSwapMotionCueFx.Props) {
		const [previousSource, previousTarget, currentSource, currentTarget] = yield* Effect.all([
			readCapturedGridItemFx({
				actor: source,
				runtime: transition.previousRuntime,
			}),
			readCapturedGridItemFx({
				actor: target,
				runtime: transition.previousRuntime,
			}),
			readGridRuntimeItemFx({
				itemId: source.id,
				runtime: transition.runtime,
			}),
			readGridRuntimeItemFx({
				itemId: target.id,
				runtime: transition.runtime,
			}),
		]);
		return yield* match([
			previousSource,
			previousTarget,
			currentSource,
			currentTarget,
		] as const)
			.with(
				[
					P.nonNullable,
					P.nonNullable,
					P.nonNullable,
					P.nonNullable,
				],
				([
					exactPreviousSource,
					exactPreviousTarget,
					exactCurrentSource,
					exactCurrentTarget,
				]) =>
					Effect.all([
						isSameGridLocationFx({
							left: exactPreviousSource.location,
							right: source.location,
						}),
						isSameGridLocationFx({
							left: exactPreviousTarget.location,
							right: target.location,
						}),
						isSameGridLocationFx({
							left: exactCurrentSource.location,
							right: target.location,
						}),
						isSameGridLocationFx({
							left: exactCurrentTarget.location,
							right: source.location,
						}),
					]).pipe(
						Effect.map((exactExchange) =>
							match(exactExchange)
								.with(
									[
										true,
										true,
										true,
										true,
									],
									() =>
										({
											kind: "swap",
											sequence: transition.sequence,
											eventIndex: transition.events.length,
											staggerIndex: 0,
											actorId: exactCurrentTarget.id,
											counterpartActorId: exactCurrentSource.id,
											originActorId: exactPreviousTarget.id,
											originLocation: exactPreviousTarget.location,
											targetLocation: exactCurrentTarget.location,
										}) satisfies TileSwapMotionCue,
								)
								.otherwise(() => null),
						),
					),
			)
			.otherwise(() => Effect.succeed(null));
	},
);
