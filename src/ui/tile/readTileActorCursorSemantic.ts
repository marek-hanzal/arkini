import { match, P } from "ts-pattern";

import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import type { CursorSemantic } from "~/ui/cursor/CursorSemantic";

export namespace readTileActorCursorSemantic {
	export interface Props {
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
		readonly hovered: boolean;
		readonly live: boolean;
		readonly phase: TileActorPhaseSchema.Type;
		readonly running: boolean;
		readonly visible: boolean;
	}
}

/** Resolves the exact native cursor owned by one live tile actor presentation. */
export const readTileActorCursorSemantic = ({
	feedback,
	forbiddenDrop,
	hovered,
	live,
	phase,
	running,
	visible,
}: readTileActorCursorSemantic.Props): CursorSemantic => {
	if (!live || !visible) return "default";
	return match({
		feedback,
		forbiddenDrop,
		hovered,
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
				phase: P.union("settling", "impact", "targeted"),
			},
			() => "not-allowed" as const,
		)
		.with(
			{
				phase: P.union("settling", "impact", "targeted", "combining", "exiting"),
			},
			() => "default" as const,
		)
		.with(
			{
				hovered: true,
				phase: P.union("stable", "hovered"),
				running: true,
			},
			() => "progress" as const,
		)
		.with(
			{
				phase: P.union("stable", "hovered"),
			},
			() => "grab" as const,
		)
		.exhaustive();
};
