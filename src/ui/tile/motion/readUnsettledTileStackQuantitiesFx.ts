import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export namespace readUnsettledTileStackQuantitiesFx {
	export interface Props {
		readonly cues: ReadonlyArray<TileMotionCue>;
	}

	export type Result = ReadonlyMap<string, number>;
}

/** Sums every stack payload whose exact motion cue has not completed yet. */
export const readUnsettledTileStackQuantitiesFx = Effect.fn("readUnsettledTileStackQuantitiesFx")(
	({ cues }: readUnsettledTileStackQuantitiesFx.Props) =>
		Effect.reduce(
			cues,
			() => new Map<string, number>() as readUnsettledTileStackQuantitiesFx.Result,
			(quantities, cue) =>
				match(cue)
					.with(
						{
							kind: "spawn",
						},
						() => Effect.succeed(quantities),
					)
					.with(
						{
							kind: "stack",
						},
						(stack) =>
							Effect.succeed(
								new Map([
									...quantities,
									[
										stack.targetActorId,
										(quantities.get(stack.targetActorId) ?? 0) + stack.quantity,
									],
								]),
							),
					)
					.with(
						{
							kind: "input",
						},
						() => Effect.succeed(quantities),
					)
					.with(
						{
							kind: "swap",
						},
						() => Effect.succeed(quantities),
					)
					.exhaustive(),
		),
);
