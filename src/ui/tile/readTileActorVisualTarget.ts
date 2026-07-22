import { match, P } from "ts-pattern";

import { TileActorBaseScale } from "~/ui/tile/TileActorBaseScale";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";

export namespace readTileActorVisualTarget {
	export interface Props {
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
	}

	export interface Result {
		readonly scale: number;
		readonly opacity: number;
		readonly filter: string;
	}
}

const settledVisualTarget = {
	scale: TileActorBaseScale,
	opacity: 1,
	filter:
		"brightness(1) drop-shadow(0 0.45rem 0.65rem color-mix(in srgb, var(--ak-overlay) 34%, transparent))",
} satisfies readTileActorVisualTarget.Result;

/** Resolves the one interaction-owned visual pose inside the full canonical slot. */
export const readTileActorVisualTarget = ({
	phase,
	feedback,
	forbiddenDrop,
}: readTileActorVisualTarget.Props): readTileActorVisualTarget.Result =>
	match({
		phase,
		feedback,
		forbiddenDrop,
	})
		.with(
			{
				phase: "exiting",
			},
			() => ({
				scale: 0.54,
				opacity: 0,
				filter:
					"brightness(1.14) drop-shadow(0 0.4rem 0.55rem color-mix(in srgb, var(--ak-overlay) 18%, transparent))",
			}),
		)
		.with(
			{
				phase: "impact",
			},
			() => ({
				scale: 0.91,
				opacity: 1,
				filter:
					"brightness(1.12) drop-shadow(0 0.8rem 1rem color-mix(in srgb, var(--ak-accent) 30%, transparent))",
			}),
		)
		.with(
			{
				phase: "dragging",
				feedback: "accepted",
			},
			() => ({
				scale: 0.75,
				opacity: 1,
				filter:
					"brightness(1.08) drop-shadow(0 0.7rem 1rem color-mix(in srgb, var(--ak-accent) 30%, transparent))",
			}),
		)
		.with(
			{
				phase: "dragging",
				feedback: "ignored",
			},
			() => ({
				scale: 0.84,
				opacity: 0.76,
				filter:
					"brightness(0.98) drop-shadow(0 0.7rem 1rem color-mix(in srgb, var(--ak-overlay) 42%, transparent))",
			}),
		)
		.with(
			{
				phase: "dragging",
				feedback: "rejected",
			},
			{
				phase: "dragging",
				forbiddenDrop: true,
			},
			() => ({
				scale: 0.8,
				opacity: 0.6,
				filter:
					"brightness(0.94) drop-shadow(0 0.55rem 0.8rem color-mix(in srgb, var(--ak-danger) 28%, transparent))",
			}),
		)
		.with(
			{
				phase: "dragging",
			},
			() => ({
				scale: 0.9,
				opacity: 0.8,
				filter:
					"brightness(1.08) drop-shadow(0 1rem 1.35rem color-mix(in srgb, var(--ak-overlay) 58%, transparent))",
			}),
		)
		.with(
			{
				phase: "hovered",
			},
			() => ({
				scale: 0.9,
				opacity: 1,
				filter:
					"brightness(1.06) drop-shadow(0 0.8rem 1rem color-mix(in srgb, var(--ak-overlay) 48%, transparent))",
			}),
		)
		.with(
			{
				phase: "combining",
			},
			() => ({
				scale: 0.75,
				opacity: 1,
				filter:
					"brightness(1.08) drop-shadow(0 0.65rem 0.9rem color-mix(in srgb, var(--ak-accent) 30%, transparent))",
			}),
		)
		.with(
			{
				phase: "targeted",
				feedback: "rejected",
			},
			() => ({
				scale: 0.78,
				opacity: 1,
				filter:
					"brightness(0.96) drop-shadow(0 0.55rem 0.75rem color-mix(in srgb, var(--ak-danger) 28%, transparent))",
			}),
		)
		.with(
			{
				phase: "targeted",
			},
			() => ({
				scale: 0.96,
				opacity: 1,
				filter:
					"brightness(1.08) drop-shadow(0 0.7rem 0.9rem color-mix(in srgb, var(--ak-accent) 24%, transparent))",
			}),
		)
		.with(
			{
				phase: "settling",
				feedback: "rejected",
			},
			() => ({
				scale: 0.84,
				opacity: 1,
				filter:
					"brightness(1.05) drop-shadow(0 0.65rem 0.85rem color-mix(in srgb, var(--ak-danger) 36%, transparent))",
			}),
		)
		.with(
			{
				phase: "settling",
				feedback: "accepted",
			},
			() => ({
				scale: 0.86,
				opacity: 1,
				filter:
					"brightness(1.06) drop-shadow(0 0.65rem 0.85rem color-mix(in srgb, var(--ak-accent) 24%, transparent))",
			}),
		)
		.with(
			{
				phase: P.union("settling", "stable"),
			},
			() => settledVisualTarget,
		)
		.exhaustive();
