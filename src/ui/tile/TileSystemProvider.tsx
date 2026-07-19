import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropIntent } from "~/ui/tile/TileDropIntent";
import type { TileDropOutcome } from "~/ui/tile/TileDropOutcome";
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

interface ResolvedTileDrop {
	readonly target: TileDropTarget;
	readonly node: HTMLElement | null;
}

interface TileDragSession {
	readonly source: TileDragSource;
	readonly sourceNode: HTMLElement;
	readonly pointerId: number;
	readonly startX: number;
	readonly startY: number;
	readonly originRect: DOMRect;
	readonly onDrop: (intent: TileDropIntent) => Promise<TileDropOutcome> | TileDropOutcome;
	readonly previousVisibility: string;
	readonly animations: Set<Animation>;
	phase: TileInteractionState["phase"];
	currentX: number;
	currentY: number;
	released: boolean;
	frame: number | null;
	ghost: HTMLElement | null;
	resolved: ResolvedTileDrop;
}

const dragThresholdPx = 6;
const acceptedDurationMs = 180;
const rejectedDurationMs = 210;

const isSameIdentity = (left: TileIdentity, right: TileIdentity) =>
	left.id === right.id && left.revision === right.revision;

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

const slotRegistrationKey = (surface: TileSurface, slot: TileSlot) =>
	`${surface.id}\u0000${slot.id}`;

const removeElementIds = (element: HTMLElement) => {
	element.removeAttribute("id");
	for (const child of element.querySelectorAll<HTMLElement>("[id]")) {
		child.removeAttribute("id");
	}
};

/** Owns one unrestricted pointer drag session and registered Board/inventory/toolbar geometry. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const mounted = useRef(true);
	const surfaces = useRef(new Map<string, TileSurfaceRegistration>());
	const slots = useRef(new Map<string, TileSlotRegistration>());
	const session = useRef<TileDragSession | null>(null);
	const [active, setActive] = useState<TileInteractionState | null>(null);

	const publish = useCallback((next: TileInteractionState | null) => {
		if (mounted.current) setActive(next);
	}, []);

	const cancelAnimations = useCallback((current: TileDragSession) => {
		for (const animation of current.animations) animation.cancel();
		current.animations.clear();
	}, []);

	const cleanup = useCallback(
		(current: TileDragSession) => {
			if (current.frame !== null) cancelAnimationFrame(current.frame);
			cancelAnimations(current);
			current.sourceNode.style.visibility = current.previousVisibility;
			current.ghost?.remove();
			if (session.current === current) session.current = null;
			publish(null);
		},
		[
			cancelAnimations,
			publish,
		],
	);

	const runAnimation = useCallback(
		async (
			current: TileDragSession,
			node: HTMLElement,
			keyframes: Keyframe[] | PropertyIndexedKeyframes,
			options: KeyframeAnimationOptions,
		) => {
			if (typeof node.animate !== "function") return;
			const animation = node.animate(keyframes, options);
			current.animations.add(animation);
			try {
				await animation.finished;
			} catch {
				// Cancellation is expected when the complete Game tree is replaced.
			} finally {
				current.animations.delete(animation);
			}
		},
		[],
	);

	const createGhost = useCallback(
		(current: TileDragSession) => {
			const ghost = current.sourceNode.cloneNode(true) as HTMLElement;
			removeElementIds(ghost);
			ghost.dataset.ui = "TileDragGhost";
			ghost.setAttribute("aria-hidden", "true");
			ghost.removeAttribute("aria-label");
			ghost.style.position = "fixed";
			ghost.style.left = `${current.originRect.left}px`;
			ghost.style.top = `${current.originRect.top}px`;
			ghost.style.width = `${current.originRect.width}px`;
			ghost.style.height = `${current.originRect.height}px`;
			ghost.style.margin = "0";
			ghost.style.pointerEvents = "none";
			ghost.style.transform = "translate3d(0px, 0px, 0px)";
			ghost.style.transformOrigin = "center";
			ghost.style.willChange = "transform, opacity, filter";
			ghost.style.zIndex = "2147483000";
			document.body.append(ghost);
			current.sourceNode.style.visibility = "hidden";
			current.ghost = ghost;

			void runAnimation(
				current,
				ghost,
				[
					{
						opacity: 0.72,
						filter: "brightness(1)",
					},
					{
						opacity: 1,
						filter: "brightness(1.12)",
					},
				],
				{
					duration: 110,
					easing: "ease-out",
					fill: "forwards",
				},
			);
		},
		[
			runAnimation,
		],
	);

	const registrationTarget = useCallback((registration: TileSlotRegistration): TileDropTarget => {
		return {
			kind: "slot",
			surface: registration.surface,
			slot: registration.slot,
			occupant: registration.occupant,
		};
	}, []);

	const resolveInsideSurface = useCallback(
		(surface: TileSurfaceRegistration, x: number, y: number): ResolvedTileDrop => {
			for (const registration of slots.current.values()) {
				if (registration.surface.id !== surface.surface.id) continue;
				if (!isPointInside(registration.node.getBoundingClientRect(), x, y)) continue;
				return {
					target: registrationTarget(registration),
					node: registration.node,
				};
			}

			return {
				target: {
					kind: "surface",
					surface: surface.surface,
				},
				node: surface.node,
			};
		},
		[
			registrationTarget,
		],
	);

	const resolve = useCallback(
		(x: number, y: number): ResolvedTileDrop => {
			const topElements = document.elementsFromPoint?.(x, y) ?? [];
			if (topElements.length > 0) {
				const topElement = topElements[0];
				for (const registration of slots.current.values()) {
					if (
						registration.node !== topElement &&
						!registration.node.contains(topElement)
					) {
						continue;
					}
					return {
						target: registrationTarget(registration),
						node: registration.node,
					};
				}

				for (const surface of surfaces.current.values()) {
					if (surface.node !== topElement && !surface.node.contains(topElement)) continue;
					return resolveInsideSurface(surface, x, y);
				}

				return {
					target: {
						kind: "outside",
					},
					node: null,
				};
			}

			for (const registration of slots.current.values()) {
				if (!isPointInside(registration.node.getBoundingClientRect(), x, y)) continue;
				return {
					target: registrationTarget(registration),
					node: registration.node,
				};
			}
			for (const surface of surfaces.current.values()) {
				if (!isPointInside(surface.node.getBoundingClientRect(), x, y)) continue;
				return resolveInsideSurface(surface, x, y);
			}

			return {
				target: {
					kind: "outside",
				},
				node: null,
			};
		},
		[
			registrationTarget,
			resolveInsideSurface,
		],
	);

	const publishSession = useCallback(
		(current: TileDragSession) => {
			publish({
				source: current.source,
				phase: current.phase,
				target: current.phase === "pressed" ? null : current.resolved.target,
			});
		},
		[
			publish,
		],
	);

	const writeGhostPosition = useCallback((current: TileDragSession) => {
		current.frame = null;
		if (session.current !== current || current.ghost === null) return;
		const x = current.currentX - current.startX;
		const y = current.currentY - current.startY;
		current.ghost.style.transform = `translate3d(${x}px, ${y}px, 0px)`;
	}, []);

	const scheduleGhostPosition = useCallback(
		(current: TileDragSession) => {
			if (current.frame !== null) return;
			current.frame = requestAnimationFrame(() => writeGhostPosition(current));
		},
		[
			writeGhostPosition,
		],
	);

	const animateBack = useCallback(
		async (current: TileDragSession) => {
			const ghost = current.ghost;
			if (ghost === null) return;
			const x = current.currentX - current.startX;
			const y = current.currentY - current.startY;
			await runAnimation(
				current,
				ghost,
				[
					{
						transform: `translate3d(${x}px, ${y}px, 0px)`,
					},
					{
						transform: "translate3d(0px, 0px, 0px)",
					},
				],
				{
					duration: rejectedDurationMs,
					easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
					fill: "forwards",
				},
			);
		},
		[
			runAnimation,
		],
	);

	const animateAccepted = useCallback(
		async (current: TileDragSession) => {
			const ghost = current.ghost;
			const targetNode = current.resolved.node;
			if (ghost === null || targetNode === null) return;
			const targetRect = targetNode.getBoundingClientRect();
			const currentX = current.currentX - current.startX;
			const currentY = current.currentY - current.startY;
			const targetX =
				targetRect.left -
				current.originRect.left +
				(targetRect.width - current.originRect.width) / 2;
			const targetY =
				targetRect.top -
				current.originRect.top +
				(targetRect.height - current.originRect.height) / 2;

			await runAnimation(
				current,
				ghost,
				[
					{
						transform: `translate3d(${currentX}px, ${currentY}px, 0px)`,
						opacity: 1,
					},
					{
						transform: `translate3d(${targetX}px, ${targetY}px, 0px)`,
						opacity: 0.88,
					},
				],
				{
					duration: acceptedDurationMs,
					easing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
					fill: "forwards",
				},
			);
		},
		[
			runAnimation,
		],
	);

	const settle = useCallback(
		async (current: TileDragSession) => {
			let outcome: TileDropOutcome = {
				kind: "rejected",
			};
			try {
				outcome = await current.onDrop({
					source: current.source,
					target: current.resolved.target,
					pointer: {
						x: current.currentX,
						y: current.currentY,
					},
				});
			} catch {
				outcome = {
					kind: "rejected",
				};
			}
			if (session.current !== current) return;
			cancelAnimations(current);

			if (outcome.kind === "accepted") {
				await animateAccepted(current);
			} else {
				await animateBack(current);
			}
			if (session.current === current) cleanup(current);
		},
		[
			animateAccepted,
			animateBack,
			cancelAnimations,
			cleanup,
		],
	);

	const registerSurface = useCallback((surface: TileSurface, node: HTMLElement | null) => {
		if (node === null) {
			surfaces.current.delete(surface.id);
			return;
		}
		surfaces.current.set(surface.id, {
			surface,
			node,
		});
	}, []);

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
			if (node === null) {
				slots.current.delete(key);
				return;
			}
			slots.current.set(key, {
				...registration,
				node,
			});
		},
		[],
	);

	const press = useCallback<TileSystem["press"]>(
		({ source, node, pointerId, x, y, onDrop }) => {
			const previous = session.current;
			if (previous !== null) cleanup(previous);
			const current: TileDragSession = {
				source,
				sourceNode: node,
				pointerId,
				startX: x,
				startY: y,
				originRect: node.getBoundingClientRect(),
				onDrop,
				previousVisibility: node.style.visibility,
				animations: new Set(),
				phase: "pressed",
				currentX: x,
				currentY: y,
				released: false,
				frame: null,
				ghost: null,
				resolved: {
					target: {
						kind: "outside",
					},
					node: null,
				},
			};
			session.current = current;
			publishSession(current);
		},
		[
			cleanup,
			publishSession,
		],
	);

	const move = useCallback(
		({
			pointerId,
			x,
			y,
		}: {
			readonly pointerId: number;
			readonly x: number;
			readonly y: number;
		}) => {
			const current = session.current;
			if (current === null || current.pointerId !== pointerId || current.released) return;
			current.currentX = x;
			current.currentY = y;

			if (current.phase === "pressed") {
				const distance = Math.hypot(x - current.startX, y - current.startY);
				if (distance <= dragThresholdPx) return;
				current.phase = "dragging";
				createGhost(current);
			}
			if (current.phase !== "dragging") return;

			scheduleGhostPosition(current);
			const resolved = resolve(x, y);
			if (!isSameTarget(current.resolved.target, resolved.target)) {
				current.resolved = resolved;
				publishSession(current);
			} else {
				current.resolved = resolved;
			}
		},
		[
			createGhost,
			publishSession,
			resolve,
			scheduleGhostPosition,
		],
	);

	const release = useCallback(
		({
			pointerId,
			x,
			y,
		}: {
			readonly pointerId: number;
			readonly x: number;
			readonly y: number;
		}) => {
			const current = session.current;
			if (current === null || current.pointerId !== pointerId || current.released) return;
			current.released = true;
			current.currentX = x;
			current.currentY = y;

			if (current.phase === "pressed") {
				cleanup(current);
				return;
			}
			if (current.phase !== "dragging") return;

			if (current.frame !== null) {
				cancelAnimationFrame(current.frame);
				current.frame = null;
			}
			writeGhostPosition(current);
			current.resolved = resolve(x, y);
			current.phase = "settling";
			publishSession(current);
			void settle(current);
		},
		[
			cleanup,
			publishSession,
			resolve,
			settle,
			writeGhostPosition,
		],
	);

	const cancel = useCallback(
		(identity: TileIdentity) => {
			const current = session.current;
			if (current === null || !isSameIdentity(current.source, identity)) return;
			if (current.phase === "settling") return;
			cleanup(current);
		},
		[
			cleanup,
		],
	);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			const current = session.current;
			if (current !== null) cleanup(current);
			surfaces.current.clear();
			slots.current.clear();
		};
	}, [
		cleanup,
	]);

	const value = useMemo(
		() => ({
			active,
			registerSurface,
			registerSlot,
			press,
			move,
			release,
			cancel,
		}),
		[
			active,
			cancel,
			move,
			press,
			registerSlot,
			registerSurface,
			release,
		],
	);

	return <TileSystemContext.Provider value={value}>{children}</TileSystemContext.Provider>;
};
