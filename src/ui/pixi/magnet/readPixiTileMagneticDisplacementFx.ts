import { Effect } from "effect";

export namespace readPixiTileMagneticDisplacementFx {
	export interface Rect {
		readonly height: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	}

	export interface Props {
		readonly actorId: string;
		readonly actorRect: Rect;
		readonly attractedActorId: string | null;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly sourceActorId: string;
		readonly sourceDirection: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly sourceRect: Rect;
	}
}

const attractionDisplacementRatio = 0.045;
const influenceRadiusRatio = 1.5;
const minimumDirectionMagnitude = 0.001;
const repulsionDisplacementRatio = 0.14;

const readStableDirection = (actorId: string, sourceActorId: string) => {
	let hash = 2166136261;
	for (const character of `${sourceActorId}\u0000${actorId}`) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const angle = ((hash >>> 0) / 4_294_967_295) * Math.PI * 2;
	return {
		x: Math.cos(angle),
		y: Math.sin(angle),
	};
};

/** Projects the frozen magnetic field geometry; Motion owns interpolation and rest. */
export const readPixiTileMagneticDisplacementFx = Effect.fn("readPixiTileMagneticDisplacementFx")(
	({
		actorId,
		actorRect,
		attractedActorId,
		eligibleAttractionActorIds,
		sourceActorId,
		sourceDirection,
		sourceRect,
	}: readPixiTileMagneticDisplacementFx.Props) =>
		Effect.sync(() => {
			if (actorId === sourceActorId) {
				return {
					x: 0,
					y: 0,
				};
			}
			const attracted = attractedActorId === actorId;
			if (!attracted && eligibleAttractionActorIds.has(actorId)) {
				return {
					x: 0,
					y: 0,
				};
			}
			const relative = {
				x: actorRect.x + actorRect.width / 2 - (sourceRect.x + sourceRect.width / 2),
				y: actorRect.y + actorRect.height / 2 - (sourceRect.y + sourceRect.height / 2),
			};
			const distance = Math.hypot(relative.x, relative.y);
			const influenceRadius =
				Math.max(sourceRect.width, sourceRect.height, actorRect.width, actorRect.height) *
				influenceRadiusRatio;
			if (influenceRadius <= 0 || distance >= influenceRadius) {
				return {
					x: 0,
					y: 0,
				};
			}

			const direction =
				distance > minimumDirectionMagnitude
					? {
							x: relative.x / distance,
							y: relative.y / distance,
						}
					: attracted
						? {
								x: 0,
								y: 0,
							}
						: (sourceDirection ?? readStableDirection(actorId, sourceActorId));
			const proximity = 1 - distance / influenceRadius;
			const smoothProximity = proximity * proximity * (3 - 2 * proximity);
			const maximumDisplacement =
				Math.min(actorRect.width, actorRect.height) *
				(attracted ? attractionDisplacementRatio : repulsionDisplacementRatio);
			const polarity = attracted ? -1 : 1;
			const magnitude = maximumDisplacement * smoothProximity * polarity;
			return {
				x: direction.x * magnitude,
				y: direction.y * magnitude,
			};
		}),
);
