import { useMemo, useState } from "react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import { tileSlotForLocation } from "~/ui/tile/tileSlotForLocation";
import { tileSurfaceForLocation } from "~/ui/tile/tileSurfaceForLocation";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

export namespace useTileActorPresentation {
	export type PositionCompletion =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "always";
				readonly generation: number;
		  }
		| {
				readonly kind: "location";
				readonly generation: number;
				readonly location: TileLocation;
		  };

	export interface Model {
		readonly canonicalSource: TileDragSource;
		readonly desiredSource: TileDragSource;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly zIndex: number;
		readonly placementFrozen: boolean;
		readonly positionCompletion: PositionCompletion;
		readonly visualCompletionGeneration: number | null;
		readonly hovered: boolean;
		readonly setHovered: (hovered: boolean) => void;
	}
}

const actorSource = (item: useTileActors.Item, location: TileLocation): TileDragSource => ({
	id: item.id,
	revision: item.revision,
	location,
	surface: tileSurfaceForLocation(location),
	slot: tileSlotForLocation(location),
});

const zIndexForPhase = (phase: TileActorPhaseSchema.Type) =>
	match(phase)
		.with("dragging", () => 40)
		.with("settling", "impact", "exiting", () => 30)
		.with("targeted", () => 25)
		.with("hovered", () => 20)
		.with("stable", () => 10)
		.exhaustive();

/** Derives one exhaustive actor-owned presentation view from the shared interaction vocabulary. */
export const useTileActorPresentation = ({
	item,
	live,
}: {
	readonly item: useTileActors.Item;
	readonly live: boolean;
}): useTileActorPresentation.Model => {
	const { active } = useTileActorSystem();
	const [hovered, setHovered] = useState(false);
	const canonicalSource = useMemo(
		() => actorSource(item, item.location),
		[
			item,
		],
	);

	const view = useMemo(() => {
		const passive = {
			desiredLocation: item.location,
			phase: live && hovered ? ("hovered" as const) : ("stable" as const),
			feedback: null,
			placementFrozen: false,
			positionCompletion: {
				kind: "none" as const,
			},
			visualCompletionGeneration: null,
		};

		return match(active)
			.with(null, () => passive)
			.with(
				{
					phase: "pressed",
				},
				(pressed) =>
					pressed.source.id === item.id
						? {
								...passive,
								placementFrozen: true,
							}
						: passive,
			)
			.with(
				{
					phase: "dragging",
				},
				(dragging) => {
					if (dragging.source.id === item.id) {
						return {
							...passive,
							phase: "dragging" as const,
							placementFrozen: true,
						};
					}
					if (
						dragging.target?.kind === "slot" &&
						dragging.target.occupant?.id === item.id
					) {
						return {
							...passive,
							phase: "targeted" as const,
						};
					}
					return passive;
				},
			)
			.with(
				{
					phase: "awaiting-outcome",
				},
				(awaiting) => {
					if (awaiting.source.id === item.id) {
						return {
							...passive,
							phase: "dragging" as const,
							placementFrozen: true,
						};
					}
					if (
						awaiting.target.kind === "slot" &&
						awaiting.target.occupant?.id === item.id
					) {
						return {
							...passive,
							phase: "targeted" as const,
							placementFrozen: true,
						};
					}
					return passive;
				},
			)
			.with(
				{
					phase: "settling",
				},
				(settling) =>
					match(settling.settlement)
						.with(
							{
								kind: "failed",
							},
							(settlement) =>
								settling.source.id === item.id
									? {
											...passive,
											phase: "settling" as const,
											feedback: settlement.feedback,
											positionCompletion: {
												kind: "location" as const,
												generation: settling.generation,
												location: item.location,
											},
										}
									: passive,
						)
						.with(
							{
								kind: "reject",
							},
							(settlement) =>
								settling.source.id === item.id
									? {
											...passive,
											phase: "settling" as const,
											feedback: settlement.feedback,
											positionCompletion: {
												kind: "location" as const,
												generation: settling.generation,
												location: item.location,
											},
										}
									: passive,
						)
						.with(
							{
								kind: "ignored",
							},
							(settlement) =>
								settling.source.id === item.id
									? {
											...passive,
											phase: "settling" as const,
											feedback: settlement.feedback,
											positionCompletion: {
												kind: "location" as const,
												generation: settling.generation,
												location: item.location,
											},
										}
									: passive,
						)
						.with(
							{
								kind: "move",
							},
							(settlement) =>
								settling.source.id === item.id
									? {
											...passive,
											desiredLocation: settlement.location,
											phase: "settling" as const,
											feedback: settlement.feedback,
											positionCompletion: {
												kind: "location" as const,
												generation: settling.generation,
												location: settlement.location,
											},
										}
									: passive,
						)
						.with(
							{
								kind: "swap",
							},
							(settlement) => {
								const location =
									settlement.outcome.source.itemId === item.id
										? settlement.sourceLocation
										: settlement.outcome.target.itemId === item.id
											? settlement.outcome.target.location
											: null;
								return location === null
									? passive
									: {
											...passive,
											desiredLocation: location,
											phase: "settling" as const,
											feedback: settlement.feedback,
											positionCompletion: {
												kind: "location" as const,
												generation: settling.generation,
												location,
											},
										};
							},
						)
						.with(
							{
								kind: "merge",
								stage: "approach",
							},
							(settlement) => {
								const targetLocation =
									settlement.outcome.target.current?.location ??
									settlement.outcome.target.previousLocation;
								if (settlement.outcome.source.itemId === item.id) {
									return {
										...passive,
										desiredLocation: targetLocation,
										phase: "settling" as const,
										feedback: settlement.feedback,
										positionCompletion: {
											kind: "always" as const,
											generation: settling.generation,
										},
									};
								}
								return settlement.outcome.target.itemId === item.id
									? {
											...passive,
											phase: "targeted" as const,
										}
									: passive;
							},
						)
						.with(
							{
								kind: "merge",
								stage: "resolve",
							},
							(settlement) => {
								if (!settlement.pendingActorIds.includes(item.id)) return passive;
								const targetLocation =
									settlement.outcome.target.current?.location ??
									settlement.outcome.target.previousLocation;
								if (settlement.outcome.source.itemId === item.id) {
									const current = settlement.outcome.source.current;
									return current === null
										? {
												...passive,
												desiredLocation: targetLocation,
												phase: "exiting" as const,
												feedback: settlement.feedback,
												visualCompletionGeneration: settling.generation,
											}
										: {
												...passive,
												desiredLocation: current.location,
												phase: "settling" as const,
												feedback: settlement.feedback,
												positionCompletion: {
													kind: "location" as const,
													generation: settling.generation,
													location: current.location,
												},
											};
								}
								if (settlement.outcome.target.itemId === item.id) {
									const current = settlement.outcome.target.current;
									return {
										...passive,
										desiredLocation: current?.location ?? targetLocation,
										phase:
											current === null
												? ("exiting" as const)
												: ("impact" as const),
										feedback: settlement.feedback,
										visualCompletionGeneration: settling.generation,
									};
								}
								return passive;
							},
						)
						.exhaustive(),
			)
			.exhaustive();
	}, [
		active,
		hovered,
		item.id,
		item.location,
		live,
	]);

	const desiredSource = useMemo(
		() => actorSource(item, view.desiredLocation),
		[
			item,
			view.desiredLocation,
		],
	);

	return {
		canonicalSource,
		desiredSource,
		phase: view.phase,
		feedback: view.feedback,
		zIndex: zIndexForPhase(view.phase),
		placementFrozen: view.placementFrozen,
		positionCompletion: view.positionCompletion,
		visualCompletionGeneration: view.visualCompletionGeneration,
		hovered,
		setHovered,
	};
};
