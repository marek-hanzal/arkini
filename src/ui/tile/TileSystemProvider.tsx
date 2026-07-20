import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { useDropItem } from "~/bridge/tile/useDropItem";
import type { TileActorPlacement } from "~/ui/tile/TileActorPlacement";
import { TileActorLayer } from "~/ui/tile/TileActorLayer";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemContext, type TileSystem } from "~/ui/tile/TileSystemContext";

interface TileSurfaceRegistration {
	readonly surface: TileSurface;
	readonly node: HTMLElement;
}

interface TileSlotRegistration {
	readonly surface: TileSurface;
	readonly slot: TileSlot;
	readonly occupant: TileIdentity | null;
	readonly node: HTMLElement;
}

const slotRegistrationKey = (surface: TileSurface, slot: TileSlot) =>
	`${surface.id}\u0000${slot.id}`;

const isPointInside = (rect: DOMRect, x: number, y: number) =>
	x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

const isSameTarget = (left: TileDropTarget | null, right: TileDropTarget | null) => {
	if (left === null || right === null) return left === right;
	if (left.kind !== right.kind) return false;
	if (left.kind === "outside" || right.kind === "outside") return true;
	if (left.surface.id !== right.surface.id) return false;
	if (left.kind === "surface" || right.kind === "surface") return true;
	return (
		left.slot.id === right.slot.id &&
		left.occupant?.id === right.occupant?.id &&
		left.occupant?.revision === right.occupant?.revision
	);
};

/** Owns Canvas-local tile geometry and the one Arkini-authored interaction state. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const surfaces = useRef(new Map<string, TileSurfaceRegistration>());
	const slots = useRef(new Map<string, TileSlotRegistration>());
	const actorLayer = useRef<HTMLElement | null>(null);
	const resizeObserver = useRef<ResizeObserver | null>(null);
	const nextGeneration = useRef(0);
	const activeRef = useRef<TileInteractionState | null>(null);
	const [geometryVersion, setGeometryVersion] = useState(0);
	const [active, setActive] = useState<TileInteractionState | null>(null);

	const publishActive = useCallback((next: TileInteractionState | null) => {
		activeRef.current = next;
		setActive(next);
	}, []);
	const readActive = useCallback(() => activeRef.current, []);

	const publishGeometry = useCallback(() => {
		setGeometryVersion((current) => current + 1);
	}, []);

	const observe = useCallback(
		(node: HTMLElement) => {
			if (typeof ResizeObserver === "undefined") return;
			resizeObserver.current ??= new ResizeObserver(publishGeometry);
			resizeObserver.current.observe(node);
		},
		[
			publishGeometry,
		],
	);

	const unobserve = useCallback((node: HTMLElement) => {
		resizeObserver.current?.unobserve(node);
	}, []);

	useEffect(() => {
		window.addEventListener("resize", publishGeometry);
		return () => {
			window.removeEventListener("resize", publishGeometry);
			resizeObserver.current?.disconnect();
			resizeObserver.current = null;
		};
	}, [
		publishGeometry,
	]);

	const registerActorLayer = useCallback(
		(node: HTMLElement | null) => {
			const previous = actorLayer.current;
			if (previous === node) return;
			if (previous !== null) unobserve(previous);
			actorLayer.current = node;
			if (node !== null) observe(node);
			publishGeometry();
		},
		[
			observe,
			publishGeometry,
			unobserve,
		],
	);

	const registerSurface = useCallback(
		(surface: TileSurface, node: HTMLElement | null) => {
			const previous = surfaces.current.get(surface.id);
			if (previous?.node === node) return;
			if (previous !== undefined) unobserve(previous.node);
			if (node === null) {
				surfaces.current.delete(surface.id);
			} else {
				surfaces.current.set(surface.id, {
					surface,
					node,
				});
				observe(node);
			}
			publishGeometry();
		},
		[
			observe,
			publishGeometry,
			unobserve,
		],
	);

	const registerSlot = useCallback(
		(
			registration: {
				readonly surface: TileSurface;
				readonly slot: TileSlot;
				readonly occupant: TileIdentity | null;
			},
			node: HTMLElement | null,
		) => {
			const key = slotRegistrationKey(registration.surface, registration.slot);
			const previous = slots.current.get(key);
			if (
				previous?.node === node &&
				previous.occupant?.id === registration.occupant?.id &&
				previous.occupant?.revision === registration.occupant?.revision
			) {
				return;
			}
			if (previous !== undefined && previous.node !== node) unobserve(previous.node);
			if (node === null) {
				slots.current.delete(key);
			} else {
				slots.current.set(key, {
					...registration,
					node,
				});
				if (previous?.node !== node) observe(node);
			}
			publishGeometry();
		},
		[
			observe,
			publishGeometry,
			unobserve,
		],
	);

	const readPlacement = useCallback((source: TileDragSource): TileActorPlacement | null => {
		const layer = actorLayer.current;
		const registration = slots.current.get(slotRegistrationKey(source.surface, source.slot));
		if (layer === null || registration === undefined) return null;
		const layerRect = layer.getBoundingClientRect();
		const slotRect = registration.node.getBoundingClientRect();
		if (slotRect.width <= 0 || slotRect.height <= 0) return null;
		return {
			x: slotRect.left - layerRect.left,
			y: slotRect.top - layerRect.top,
			width: slotRect.width,
			height: slotRect.height,
		};
	}, []);

	const registrationTarget = useCallback(
		(registration: TileSlotRegistration): TileDropTarget => ({
			kind: "slot",
			surface: registration.surface,
			slot: registration.slot,
			occupant: registration.occupant,
		}),
		[],
	);

	const resolveInsideSurface = useCallback(
		(surface: TileSurfaceRegistration, x: number, y: number): TileDropTarget => {
			for (const registration of slots.current.values()) {
				if (registration.surface.id !== surface.surface.id) continue;
				if (!isPointInside(registration.node.getBoundingClientRect(), x, y)) continue;
				return registrationTarget(registration);
			}
			return {
				kind: "surface",
				surface: surface.surface,
			};
		},
		[
			registrationTarget,
		],
	);

	const resolveTarget = useCallback(
		(x: number, y: number): TileDropTarget => {
			const topElements = document.elementsFromPoint?.(x, y) ?? [];
			for (const topElement of topElements) {
				if (topElement.closest('[data-tile-actor="true"]') !== null) continue;
				for (const registration of slots.current.values()) {
					if (
						registration.node === topElement ||
						registration.node.contains(topElement)
					) {
						return registrationTarget(registration);
					}
				}
				for (const surface of surfaces.current.values()) {
					if (surface.node === topElement || surface.node.contains(topElement)) {
						return resolveInsideSurface(surface, x, y);
					}
				}
				return {
					kind: "outside",
				};
			}

			for (const registration of slots.current.values()) {
				if (!isPointInside(registration.node.getBoundingClientRect(), x, y)) continue;
				return registrationTarget(registration);
			}
			for (const surface of surfaces.current.values()) {
				if (!isPointInside(surface.node.getBoundingClientRect(), x, y)) continue;
				return resolveInsideSurface(surface, x, y);
			}
			return {
				kind: "outside",
			};
		},
		[
			registrationTarget,
			resolveInsideSurface,
		],
	);

	const press = useCallback(
		(source: TileDragSource) => {
			if (activeRef.current !== null) return false;
			const generation = ++nextGeneration.current;
			publishActive({
				source,
				generation,
				phase: "pressed",
				target: null,
				settleLocation: null,
				feedback: null,
				outcome: null,
				mergeStage: null,
				pendingActorIds: [],
			});
			return true;
		},
		[
			publishActive,
		],
	);

	const startDrag = useCallback(
		(source: TileDragSource) => {
			const current = activeRef.current;
			if (current?.source.id !== source.id || current.phase !== "pressed") return;
			publishActive({
				...current,
				phase: "dragging",
			});
		},
		[
			publishActive,
		],
	);

	const moveDrag = useCallback(
		(source: TileDragSource, x: number, y: number) => {
			const current = activeRef.current;
			if (current?.source.id !== source.id || current.phase !== "dragging") return;
			const target = resolveTarget(x, y);
			if (isSameTarget(current.target, target)) return;
			publishActive({
				...current,
				target,
			});
		},
		[
			publishActive,
			resolveTarget,
		],
	);

	const release = useCallback(
		(itemId: string) => {
			const current = activeRef.current;
			if (current?.source.id !== itemId || current.phase !== "dragging") return null;
			const target = current.target ?? {
				kind: "outside" as const,
			};
			publishActive({
				...current,
				phase: "awaiting-outcome",
				target,
			});
			return {
				source: current.source,
				generation: current.generation,
				target,
			};
		},
		[
			publishActive,
		],
	);

	const settle = useCallback(
		(source: TileDragSource, generation: number, outcome: useDropItem.Result | null) => {
			const current = activeRef.current;
			if (
				current?.source.id !== source.id ||
				current.generation !== generation ||
				current.phase !== "awaiting-outcome"
			) {
				return;
			}
			const settleLocation =
				outcome?.kind === "move"
					? outcome.location
					: outcome?.kind === "swap"
						? outcome.source.location
						: outcome?.kind === "merge"
							? (outcome.target.current?.location ?? outcome.target.previousLocation)
							: null;
			const pendingActorIds =
				outcome?.kind === "swap"
					? [
							source.id,
							outcome.target.itemId,
						]
					: [
							source.id,
						];
			publishActive({
				...current,
				phase: "settling",
				settleLocation,
				feedback:
					outcome === null || outcome.kind === "reject"
						? "rejected"
						: outcome.kind === "ignored"
							? "ignored"
							: "accepted",
				outcome,
				mergeStage: outcome?.kind === "merge" ? "approach" : null,
				pendingActorIds,
			});
		},
		[
			publishActive,
		],
	);

	const complete = useCallback(
		(itemId: string, generation: number) => {
			const current = activeRef.current;
			if (current?.generation !== generation || current.phase !== "settling") return;
			if (!current.pendingActorIds.includes(itemId)) return;
			if (
				current.outcome?.kind === "merge" &&
				current.mergeStage === "approach" &&
				itemId === current.source.id
			) {
				publishActive({
					...current,
					mergeStage: "resolve",
					pendingActorIds: [
						current.outcome.source.itemId,
						current.outcome.target.itemId,
					],
				});
				return;
			}
			const pendingActorIds = current.pendingActorIds.filter(
				(pendingItemId) => pendingItemId !== itemId,
			);
			if (pendingActorIds.length === 0) {
				publishActive(null);
				return;
			}
			publishActive({
				...current,
				pendingActorIds,
			});
		},
		[
			publishActive,
		],
	);

	const cancel = useCallback(
		(itemId: string) => {
			if (activeRef.current?.source.id === itemId) publishActive(null);
		},
		[
			publishActive,
		],
	);

	const value = useMemo<TileSystem>(
		() => ({
			active,
			geometryVersion,
			registerActorLayer,
			registerSurface,
			registerSlot,
			readPlacement,
			press,
			startDrag,
			moveDrag,
			release,
			settle,
			complete,
			cancel,
		}),
		[
			active,
			cancel,
			complete,
			geometryVersion,
			moveDrag,
			press,
			readPlacement,
			registerActorLayer,
			registerSlot,
			registerSurface,
			release,
			settle,
			startDrag,
		],
	);

	return (
		<TileSystemContext.Provider value={value}>
			{children}
			<TileActorLayer readActive={readActive} />
		</TileSystemContext.Provider>
	);
};
