import { Effect } from "effect";
import { match } from "ts-pattern";

import { DropItemResultKind } from "~/bridge/tile/DropItemResultKind";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";

export namespace readActorCursorFx {
	export interface Props {
		readonly dragPolicy?: "main-target-presence" | "preview-result";
		readonly hasDropTarget?: boolean;
		readonly phase: "dragging" | "idle" | "pending";
		/** Drop semantics are intentionally ignored while dragging. */
		readonly previewKind?: readTileDropPreviewFx.Result["kind"] | null;
		readonly running: boolean;
	}
}

/** Resolves native Pixi cursor feedback without introducing keyboard navigation state. */
export const readActorCursorFx = Effect.fn("readActorCursorFx")(
	({
		dragPolicy = "preview-result",
		hasDropTarget,
		phase,
		previewKind,
		running,
	}: readActorCursorFx.Props) =>
		Effect.sync(() =>
			match({
				dragPolicy,
				hasDropTarget,
				phase,
				previewKind,
				running,
			})
				.with(
					{
						phase: "pending",
						running: true,
					},
					() => "progress" as const,
				)
				.with(
					{
						phase: "pending",
						running: false,
					},
					() => "grab" as const,
				)
				.with(
					{
						dragPolicy: "main-target-presence",
						phase: "dragging",
						hasDropTarget: false,
					},
					() => "not-allowed" as const,
				)
				.with(
					{
						dragPolicy: "preview-result",
						phase: "dragging",
						previewKind: DropItemResultKind.Reject,
					},
					() => "not-allowed" as const,
				)
				.with(
					{
						dragPolicy: "preview-result",
						phase: "dragging",
						previewKind: DropItemResultKind.Ignored,
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
