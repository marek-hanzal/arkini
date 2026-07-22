import { useCallback, useEffect, useRef } from "react";

interface TileNeighbourMotionValue {
	readonly set: (value: number) => void;
}

interface TileNeighbourActorRegistration {
	readonly itemId: string;
	readonly node: HTMLElement;
	readonly x: TileNeighbourMotionValue;
	readonly y: TileNeighbourMotionValue;
	readonly enabled: boolean;
}

/** Owns the one Canvas-local, pointer-frequency neighbour displacement field. */
export const useTileNeighbourField = () => {
	const actors = useRef(new Map<string, TileNeighbourActorRegistration>());

	const reset = useCallback((registration: TileNeighbourActorRegistration) => {
		registration.x.set(0);
		registration.y.set(0);
	}, []);

	const clearNeighbourField = useCallback(() => {
		for (const registration of actors.current.values()) reset(registration);
	}, [reset]);

	const registerNeighbourActor = useCallback(
		(registration: TileNeighbourActorRegistration) => {
			const previous = actors.current.get(registration.itemId);
			if (previous !== undefined && previous !== registration) reset(previous);
			actors.current.set(registration.itemId, registration);
			return () => {
				if (actors.current.get(registration.itemId) !== registration) return;
				reset(registration);
				actors.current.delete(registration.itemId);
			};
		},
		[reset],
	);

	const moveNeighbourField = useCallback(
		({
			sourceItemId,
			targetItemId,
			x,
			y,
		}: {
			readonly sourceItemId: string;
			readonly targetItemId: string | null;
			readonly x: number;
			readonly y: number;
		}) => {
			const source = actors.current.get(sourceItemId);
			if (source === undefined || !source.enabled) {
				clearNeighbourField();
				return;
			}
			const sourceSurfaceId = source.node.dataset.surfaceId;
			const sourceRect = source.node.getBoundingClientRect();
			const sourceSize = Math.max(sourceRect.width, sourceRect.height);
			for (const registration of actors.current.values()) {
				if (
					registration.itemId === sourceItemId ||
					registration.itemId === targetItemId ||
					!registration.enabled ||
					registration.node.dataset.live !== "true" ||
					registration.node.dataset.surfaceId !== sourceSurfaceId ||
					registration.node.dataset.motionPhase === "exiting"
				) {
					reset(registration);
					continue;
				}
				const rect = registration.node.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) {
					reset(registration);
					continue;
				}
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;
				const deltaX = centerX - x;
				const deltaY = centerY - y;
				const distance = Math.hypot(deltaX, deltaY);
				const neighbourSize = Math.max(rect.width, rect.height);
				const radius = Math.max(96, Math.max(sourceSize, neighbourSize) * 2.25);
				if (distance === 0 || distance >= radius) {
					reset(registration);
					continue;
				}
				const maximum = Math.min(12, neighbourSize * 0.11);
				const strength = (1 - distance / radius) * maximum;
				registration.x.set((deltaX / distance) * strength);
				registration.y.set((deltaY / distance) * strength);
			}
		},
		[clearNeighbourField, reset],
	);

	useEffect(
		() => () => {
			clearNeighbourField();
			actors.current.clear();
		},
		[clearNeighbourField],
	);

	return {
		registerNeighbourActor,
		moveNeighbourField,
		clearNeighbourField,
	};
};
