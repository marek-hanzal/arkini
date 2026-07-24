import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import type { CursorSemantic } from "~/ui/cursor/CursorSemantic";

export namespace readTileActorCursorSemanticFx {
	export interface Props {
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
		readonly live: boolean;
		readonly phase: TileActorPhaseSchema.Type;
		readonly running: boolean;
		readonly visible: boolean;
	}
}

/** Resolves the exact native cursor owned by one live tile actor presentation. */
export const readTileActorCursorSemanticFx = Effect.fn("readTileActorCursorSemanticFx")(
	({
		feedback,
		forbiddenDrop,
		live,
		phase,
		running,
		visible,
	}: readTileActorCursorSemanticFx.Props) =>
		Effect.sync((): CursorSemantic => {
			if (!live || !visible) return "default";
			return match({
				feedback,
				forbiddenDrop,
				phase,
				running,
			})
				.with(
					{
						forbiddenDrop: true,
						phase: "dragging",
					},
					() => "not-allowed" as const,
				)
				.with(
					{
						phase: "dragging",
					},
					() => "grabbing" as const,
				)
				.with(
					{
						feedback: "rejected",
						phase: "targeted",
					},
					() => "not-allowed" as const,
				)
				.with(
					{
						phase: "targeted",
					},
					() => "default" as const,
				)
				.with(
					{
						phase: "stable",
						running: true,
					},
					() => "progress" as const,
				)
				.with(
					{
						phase: "stable",
					},
					() => "grab" as const,
				)
				.exhaustive();
		}),
);
