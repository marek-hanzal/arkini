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
			match({
				phase,
				previewKind,
				running,
			})
				.with(
					{
						phase: "pending",
						previewKind: DropItemResultKindEnumSchema.enum.Swap,
					},
					() => "grab" as const,
				)
				.with(
					{
						phase: "pending",
					},
					() => "progress" as const,
				)
				.with(
					{
						phase: "dragging",
						previewKind: DropItemResultKindEnumSchema.enum.Reject,
					},
					() => "not-allowed" as const,
				)
				.with(
					{
						phase: "dragging",
						previewKind: DropItemResultKindEnumSchema.enum.Ignored,
					},
					() => "grab" as const,
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
