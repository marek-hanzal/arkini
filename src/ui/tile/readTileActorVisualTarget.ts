import { match, P } from "ts-pattern";

import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";

export namespace readTileActorVisualTarget {
	export interface Props {
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
	}

	export interface Result {
		readonly scale: number;
		readonly opacity: number;
		readonly filter: string;
	}
}

const settledVisualTarget = {
	scale: 1,
	opacity: 1,
	filter:
		"brightness(1) drop-shadow(0 0.45rem 0.65rem color-mix(in srgb, var(--ak-overlay) 34%, transparent))",
} satisfies readTileActorVisualTarget.Result;

/** Resolves the one interaction-owned visual pose for an exact tile actor. */
export const readTileActorVisualTarget = ({
	phase,
	feedback,
}: readTileActorVisualTarget.Props): readTileActorVisualTarget.Result =>
	match({
		phase,
		feedback,
	})
		.with(
			{
				phase: "exiting",
			},
			() => ({
				scale: 0.68,
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
				scale: 1.14,
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
				feedback: P.union("ignored", "rejected"),
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
			},
			() => ({
				scale: 1.18,
				opacity: 1,
				filter:
					"brightness(1.08) drop-shadow(0 1rem 1.35rem color-mix(in srgb, var(--ak-overlay) 58%, transparent))",
			}),
		)
		.with(
			{
				phase: "hovered",
			},
			() => ({
				scale: 1.15,
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
			},
			() => ({
				scale: 1.1,
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
				scale: 1.055,
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
				scale: 1.08,
				opacity: 1,
				filter:
					"brightness(1.06) drop-shadow(0 0.65rem 0.85rem color-mix(in srgb, var(--ak-accent) 24%, transparent))",
			}),
		)
		.with(
			{
				phase: "settling",
			},
			() => settledVisualTarget,
		)
		.with(
			{
				phase: "stable",
			},
			() => settledVisualTarget,
		)
		.exhaustive();
