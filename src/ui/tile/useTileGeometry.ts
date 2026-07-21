import { useCallback, useEffect, useRef, useState } from "react";

import type { TileActorPlacement } from "~/ui/tile/TileActorPlacement";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

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

const isPointInsideSlot = ({
	lastColumn,
	lastRow,
	rect,
	x,
	y,
}: {
	readonly lastColumn: boolean;
	readonly lastRow: boolean;
	readonly rect: DOMRect;
	readonly x: number;
	readonly y: number;
}) =>
	x >= rect.left &&
	(lastColumn ? x <= rect.right : x < rect.right) &&
	y >= rect.top &&
	(lastRow ? y <= rect.bottom : y < rect.bottom);

/** Owns Canvas-local tile surface registration, measurement, and topmost hit testing. */
export const useTileGeometry = () => {
	const surfaces = useRef(new Map<string, TileSurfaceRegistration>());
	const slots = useRef(new Map<string, TileSlotRegistration>());
	const actorLayer = useRef<HTMLElement | null>(null);
	const resizeObserver = useRef<ResizeObserver | null>(null);
	const [geometryVersion, setGeometryVersion] = useState(0);

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

	const readSurfaceSlotLimits = useCallback((surfaceId: string) => {
		let maxX = -1;
		let maxY = -1;
		for (const registration of slots.current.values()) {
			if (registration.surface.id !== surfaceId) continue;
			maxX = Math.max(maxX, registration.slot.x);
			maxY = Math.max(maxY, registration.slot.y);
		}
		return {
			maxX,
			maxY,
		} as const;
	}, []);

	const resolveInsideSurface = useCallback(
		(surface: TileSurfaceRegistration, x: number, y: number): TileDropTarget => {
			const limits = readSurfaceSlotLimits(surface.surface.id);
			for (const registration of slots.current.values()) {
				if (registration.surface.id !== surface.surface.id) continue;
				if (
					!isPointInsideSlot({
						lastColumn: registration.slot.x === limits.maxX,
						lastRow: registration.slot.y === limits.maxY,
						rect: registration.node.getBoundingClientRect(),
						x,
						y,
					})
				) {
					continue;
				}
				return registrationTarget(registration);
			}
			return {
				kind: "surface",
				surface: surface.surface,
			};
		},
		[
			readSurfaceSlotLimits,
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
						registration.node !== topElement &&
						!registration.node.contains(topElement)
					) {
						continue;
					}
					const surface = surfaces.current.get(registration.surface.id);
					return surface === undefined
						? registrationTarget(registration)
						: resolveInsideSurface(surface, x, y);
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

	return {
		geometryVersion,
		registerActorLayer,
		registerSurface,
		registerSlot,
		readPlacement,
		resolveTarget,
	};
};
