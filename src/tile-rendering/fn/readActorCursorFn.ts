import { match } from "ts-pattern";

import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";

export namespace readActorCursorFn {
	export interface Props {
		readonly dragPolicy?: "main-target-presence" | "preview-result";
		readonly hasDropTarget?: boolean;
		readonly phase: "dragging" | "idle" | "pending";
		/** Drop semantics are intentionally ignored while dragging. */
		readonly previewKind?: readDropItemPreviewFx.Result["kind"] | null;
		readonly running: boolean;
	}
}

/** Resolves native Pixi cursor feedback without introducing keyboard navigation state. */
export const readActorCursorFn = ({
	dragPolicy = "preview-result",
	hasDropTarget,
	phase,
	previewKind,
	running,
}: readActorCursorFn.Props) =>
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
		.exhaustive();
