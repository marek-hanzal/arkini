import { type MotionValue, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

const neighbourPositionTransition = {
	stiffness: 170,
	damping: 22,
	mass: 0.58,
};

const neighbourScaleTransition = {
	stiffness: 190,
	damping: 23,
	mass: 0.56,
};

interface ActorMetadata {
	readonly itemId: string;
	readonly source: TileDragSource;
	readonly enabled: boolean;
}

interface NeighbourSystemApi {
	readonly registerNeighbourActor: ReturnType<
		typeof useTileActorSystem
	>["registerNeighbourActor"];
	readonly updateNeighbourActor: ReturnType<typeof useTileActorSystem>["updateNeighbourActor"];
	readonly beginNeighbourTravel: ReturnType<typeof useTileActorSystem>["beginNeighbourTravel"];
}

interface ActiveRegistration {
	readonly itemId: string;
	readonly register: NeighbourSystemApi["registerNeighbourActor"];
	readonly unregister: () => void;
}

export namespace useTileActorNeighbourMotion {
	export interface Props {
		readonly itemId: string;
		readonly source: TileDragSource;
		readonly visible: boolean;
		readonly canonicalWidth: MotionValue<number>;
		readonly canonicalHeight: MotionValue<number>;
	}
}

/**
 * Owns one actor's neighbour response, stable DOM registration, and overlapping
 * crowd-travel lease. Canonical placement and cue motion remain separate owners.
 */
export const useTileActorNeighbourMotion = ({
	itemId,
	source,
	visible,
	canonicalWidth,
	canonicalHeight,
}: useTileActorNeighbourMotion.Props) => {
	const { registerNeighbourActor, updateNeighbourActor, beginNeighbourTravel } =
		useTileActorSystem();
	const reducedMotion = useReducedMotion();
	const targetX = useMotionValue(0);
	const targetY = useMotionValue(0);
	const x = useSpring(targetX, neighbourPositionTransition);
	const y = useSpring(targetY, neighbourPositionTransition);
	const targetScale = useMotionValue(1);
	const scale = useSpring(targetScale, neighbourScaleTransition);
	const nodeRef = useRef<HTMLElement | null>(null);
	const registrationRef = useRef<ActiveRegistration | null>(null);
	const travelOwners = useRef(new Set<symbol>());
	const stopTravel = useRef<(() => void) | null>(null);
	const reducedMotionRef = useRef(reducedMotion);
	const metadataRef = useRef<ActorMetadata>({
		itemId,
		source,
		enabled: visible && !reducedMotion,
	});
	const sizeRef = useRef({
		width: canonicalWidth,
		height: canonicalHeight,
	});
	const apiRef = useRef<NeighbourSystemApi>({
		registerNeighbourActor,
		updateNeighbourActor,
		beginNeighbourTravel,
	});
	metadataRef.current = {
		itemId,
		source,
		enabled: visible && !reducedMotion,
	};
	reducedMotionRef.current = reducedMotion;
	sizeRef.current = {
		width: canonicalWidth,
		height: canonicalHeight,
	};
	apiRef.current = {
		registerNeighbourActor,
		updateNeighbourActor,
		beginNeighbourTravel,
	};

	const resetValues = useCallback(() => {
		targetX.jump(0);
		targetY.jump(0);
		targetScale.jump(1);
		x.jump(0);
		y.jump(0);
		scale.jump(1);
	}, [
		scale,
		targetScale,
		targetX,
		targetY,
		x,
		y,
	]);

	const clearTravel = useCallback(() => {
		travelOwners.current.clear();
		stopTravel.current?.();
		stopTravel.current = null;
	}, []);

	const clearRegistration = useCallback(() => {
		registrationRef.current?.unregister();
		registrationRef.current = null;
	}, []);

	const registerActorNode = useCallback(
		(node: HTMLElement | null) => {
			if (nodeRef.current === node) return;
			clearRegistration();
			nodeRef.current = node;
			if (node === null) return;
			const metadata = metadataRef.current;
			const api = apiRef.current;
			const registration = {
				itemId: metadata.itemId,
				register: api.registerNeighbourActor,
				unregister: api.registerNeighbourActor({
					itemId: metadata.itemId,
					node,
					source: metadata.source,
					x: targetX,
					y: targetY,
					appliedX: x,
					appliedY: y,
					scale: targetScale,
					appliedScale: scale,
					canonicalWidth: sizeRef.current.width,
					canonicalHeight: sizeRef.current.height,
					enabled: metadata.enabled,
				}),
			};
			registrationRef.current = registration;
		},
		[
			clearRegistration,
			scale,
			targetScale,
			targetX,
			targetY,
			x,
			y,
		],
	);

	const retainTravel = useCallback(() => {
		const metadata = metadataRef.current;
		if (reducedMotionRef.current) return () => undefined;
		const token = Symbol("tile-neighbour-travel");
		travelOwners.current.add(token);
		if (travelOwners.current.size === 1) {
			stopTravel.current = apiRef.current.beginNeighbourTravel(metadata.itemId);
		}
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			if (!travelOwners.current.delete(token) || travelOwners.current.size !== 0) {
				return;
			}
			stopTravel.current?.();
			stopTravel.current = null;
		};
	}, []);

	useLayoutEffect(() => {
		const node = nodeRef.current;
		const registration = registrationRef.current;
		if (node === null || registration === null) return;
		const metadata = metadataRef.current;
		if (
			registration.itemId !== metadata.itemId ||
			registration.register !== registerNeighbourActor
		) {
			clearTravel();
			nodeRef.current = null;
			clearRegistration();
			registerActorNode(node);
			return;
		}
		updateNeighbourActor(metadata);
	}, [
		clearRegistration,
		clearTravel,
		itemId,
		reducedMotion,
		registerActorNode,
		registerNeighbourActor,
		source,
		updateNeighbourActor,
		visible,
	]);

	useLayoutEffect(() => {
		if (visible && !reducedMotion) return;
		clearTravel();
		resetValues();
	}, [
		clearTravel,
		reducedMotion,
		resetValues,
		visible,
	]);

	useEffect(
		() => () => {
			clearTravel();
			clearRegistration();
			nodeRef.current = null;
			resetValues();
		},
		[
			clearRegistration,
			clearTravel,
			resetValues,
		],
	);

	return {
		values: {
			x,
			y,
			scale,
		},
		registerActorNode,
		retainTravel,
	};
};
