import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export namespace readPixiTileMotionAnimationKeysFx {
	export interface Props {
		readonly cue: TileMotionCue;
		readonly cueKey: string;
	}
}

/** Returns every animator key owned by one started motion cue. */
export const readPixiTileMotionAnimationKeysFx = Effect.fn("readPixiTileMotionAnimationKeysFx")(
	({ cue, cueKey }: readPixiTileMotionAnimationKeysFx.Props) =>
		Effect.succeed(
			match(cue)
				.with(
					{
						kind: "spawn",
					},
					() => [
						`motion:${cueKey}`,
					],
				)
				.with(
					{
						kind: "stack",
					},
					() => [
						`motion:${cueKey}`,
					],
				)
				.with(
					{
						kind: "input",
					},
					() => [
						`motion:${cueKey}:consume`,
						`motion:${cueKey}`,
					],
				)
				.with(
					{
						kind: "swap",
					},
					(swap) => [
						`motion:${cueKey}:${swap.actorId}`,
						`motion:${cueKey}:${swap.counterpartActorId}`,
					],
				)
				.with(
					{
						kind: "relocation",
					},
					(relocation) => [
						`motion:${cueKey}:${relocation.actorId}`,
					],
				)
				.exhaustive(),
		),
);
