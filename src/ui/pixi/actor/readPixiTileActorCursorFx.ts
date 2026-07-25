import { Effect } from "effect";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";

export namespace readPixiTileActorCursorFx {
	export interface Props {
		readonly phase: "dragging" | "idle" | "pending";
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly running: boolean;
	}
}

/** Resolves native Pixi cursor feedback without introducing keyboard navigation state. */
export const readPixiTileActorCursorFx = Effect.fn("readPixiTileActorCursorFx")(
	({ phase, previewKind, running }: readPixiTileActorCursorFx.Props) =>
		Effect.sync(() =>
			match(phase)
				.with("pending", () => "progress" as const)
				.with("dragging", () =>
					previewKind === DropItemResultKindEnumSchema.enum.Reject ||
					previewKind === DropItemResultKindEnumSchema.enum.Ignored
						? ("not-allowed" as const)
						: ("grabbing" as const),
				)
				.with("idle", () => (running ? ("progress" as const) : ("grab" as const)))
				.exhaustive(),
		),
);
