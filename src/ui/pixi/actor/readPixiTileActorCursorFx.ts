import { Effect } from "effect";
import { match, P } from "ts-pattern";

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
			match({
				phase,
				previewKind,
				running,
			})
				.with(
					{
						phase: "pending",
					},
					() => "progress" as const,
				)
				.with(
					{
						phase: "dragging",
						previewKind: P.union(
							DropItemResultKindEnumSchema.enum.Reject,
							DropItemResultKindEnumSchema.enum.Ignored,
						),
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
						phase: "idle",
						running: true,
					},
					() => "progress" as const,
				)
				.with(
					{
						phase: "idle",
						running: false,
					},
					() => "grab" as const,
				)
				.exhaustive(),
		),
);
