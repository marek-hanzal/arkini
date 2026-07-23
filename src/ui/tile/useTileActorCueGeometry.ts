import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useState } from "react";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { readTileDeliveryOriginOffset } from "~/ui/tile/readTileDeliveryOriginOffset";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

interface CueOffset {
	readonly x: number;
	readonly y: number;
}

type CueGeometryState =
	| {
			readonly generation: number;
			readonly kind: "origin";
			readonly offset: CueOffset;
	  }
	| {
			readonly generation: number;
			readonly kind: "target";
			readonly offset: CueOffset;
	  }
	| null;

const publishGeometry = (
	setState: (update: (current: CueGeometryState) => CueGeometryState) => void,
	next: CueGeometryState,
) => {
	setState((current) => {
		if (current === next) return current;
		if (current === null || next === null) return next;
		return current.generation === next.generation &&
			current.kind === next.kind &&
			current.offset.x === next.offset.x &&
			current.offset.y === next.offset.y
			? current
			: next;
	});
};

export namespace useTileActorCueGeometry {
	export interface Props {
		readonly itemId: string;
		readonly placementSource: TileDragSource;
		readonly cue: TileMotionCueSchema.Type | null;
	}

	export interface Result {
		readonly originOffset: CueOffset | null;
		readonly targetOffset: CueOffset | null;
	}
}

/** Owns generation-safe, presentation-only actor cue geometry. */
export const useTileActorCueGeometry = ({
	itemId,
	placementSource,
	cue,
}: useTileActorCueGeometry.Props): useTileActorCueGeometry.Result => {
	const { geometryVersion, readActorLayerRect, readActorRect, readActorSource, readPlacement } =
		useTileActorSystem();
	const reducedMotion = useReducedMotion();
	const [state, setState] = useState<CueGeometryState>(null);

	useLayoutEffect(() => {
		void geometryVersion;
		if (reducedMotion || cue === null) {
			publishGeometry(setState, null);
			return;
		}

		try {
			if (cue.kind === "consume" || cue.kind === "consume-exit") {
				if (cue.targetItemId === undefined || cue.targetItemId === itemId) {
					publishGeometry(setState, null);
					return;
				}
				const sourceRect = readActorRect(itemId);
				const targetRect = readActorRect(cue.targetItemId);
				if (sourceRect === null || targetRect === null) {
					publishGeometry(setState, null);
					return;
				}
				publishGeometry(setState, {
					generation: cue.generation,
					kind: "target",
					offset: {
						x:
							targetRect.left +
							targetRect.width / 2 -
							(sourceRect.left + sourceRect.width / 2),
						y:
							targetRect.top +
							targetRect.height / 2 -
							(sourceRect.top + sourceRect.height / 2),
					},
				});
				return;
			}

			if (cue.kind === "absorb") {
				if (cue.originItemId === undefined || cue.originItemId === itemId) {
					publishGeometry(setState, null);
					return;
				}
				const actorLayerRect = readActorLayerRect();
				const originRect = readActorRect(cue.originItemId);
				const targetPlacement = readPlacement(placementSource);
				if (actorLayerRect === null || originRect === null || targetPlacement === null) {
					publishGeometry(setState, null);
					return;
				}
				publishGeometry(setState, {
					generation: cue.generation,
					kind: "origin",
					offset: readTileDeliveryOriginOffset({
						actorLayerRect,
						originRect,
						targetPlacement,
						originAnchor:
							cue.producerEmissionId === undefined ||
							cue.emissionFromCollapse === true
								? "center"
								: "directional-edge",
					}),
				});
				return;
			}

			if (cue.kind === "complete" && cue.emissionTargetItemIds !== undefined) {
				const actorLayerRect = readActorLayerRect();
				const sourcePlacement = readPlacement(placementSource);
				if (actorLayerRect === null || sourcePlacement === null) {
					publishGeometry(setState, null);
					return;
				}
				const targetPlacements: NonNullable<ReturnType<typeof readPlacement>>[] = [];
				let missingTarget = false;
				for (const targetItemId of cue.emissionTargetItemIds) {
					if (targetItemId === itemId) continue;
					const targetSource = readActorSource(targetItemId);
					const targetPlacement =
						targetSource === null ? null : readPlacement(targetSource);
					if (targetPlacement === null) {
						missingTarget = true;
						break;
					}
					targetPlacements.push(targetPlacement);
				}
				if (targetPlacements.length === 0 || missingTarget) {
					publishGeometry(setState, null);
					return;
				}
				const targetCenter = targetPlacements.reduce(
					(center, targetPlacement) => ({
						x: center.x + targetPlacement.x + targetPlacement.width / 2,
						y: center.y + targetPlacement.y + targetPlacement.height / 2,
					}),
					{
						x: 0,
						y: 0,
					},
				);
				publishGeometry(setState, {
					generation: cue.generation,
					kind: "target",
					offset: {
						x:
							targetCenter.x / targetPlacements.length -
							(sourcePlacement.x + sourcePlacement.width / 2),
						y:
							targetCenter.y / targetPlacements.length -
							(sourcePlacement.y + sourcePlacement.height / 2),
					},
				});
				return;
			}

			publishGeometry(setState, null);
		} catch (error) {
			console.error(
				"Tile cue geometry measurement failed; using local feedback only.",
				error,
			);
			publishGeometry(setState, null);
		}
	}, [
		cue,
		geometryVersion,
		itemId,
		placementSource,
		readActorLayerRect,
		readActorRect,
		readActorSource,
		readPlacement,
		reducedMotion,
	]);

	const current =
		state !== null && cue !== null && state.generation === cue.generation ? state : null;
	return {
		originOffset: current?.kind === "origin" && cue?.kind === "absorb" ? current.offset : null,
		targetOffset:
			current?.kind === "target" &&
			(cue?.kind === "consume" || cue?.kind === "consume-exit" || cue?.kind === "complete")
				? current.offset
				: null,
	};
};
