import { useCallback, useRef } from "react";
import { match } from "ts-pattern";

import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";

const sameTarget = (left: TileDropTarget | null, right: TileDropTarget | null) => {
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

/** Owns valid transitions for the one Canvas-local tile interaction generation. */
export const useTileInteractionController = ({
	readPreview,
	resolveTarget,
}: {
	readonly readPreview: (
		source: TileDragSource,
		target: TileDropTarget,
	) => useDropItemPreview.Result | null;
	readonly resolveTarget: (x: number, y: number) => TileDropTarget;
}) => {
	const nextGeneration = useRef(0);
	const activeRef = useRef<TileInteractionState | null>(null);
	const activeListeners = useRef(new Set<() => void>());

	const publishActive = useCallback((next: TileInteractionState | null) => {
		activeRef.current = next;
		for (const listener of activeListeners.current) listener();
	}, []);
	const readActive = useCallback(() => activeRef.current, []);
	const subscribeActive = useCallback((listener: () => void) => {
		activeListeners.current.add(listener);
		return () => activeListeners.current.delete(listener);
	}, []);

	const press = useCallback(
		(source: TileDragSource) =>
			match(activeRef.current)
				.with(null, () => {
					publishActive({
						source,
						generation: ++nextGeneration.current,
						phase: "pressed",
					});
					return true;
				})
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => false,
				)
				.exhaustive(),
		[
			publishActive,
		],
	);

	const startDrag = useCallback(
		(source: TileDragSource) => {
			const current = activeRef.current;
			if (current?.source.id !== source.id) return;
			match(current)
				.with(
					{
						phase: "pressed",
					},
					(pressed) => {
						publishActive({
							...pressed,
							phase: "dragging",
							target: null,
							previewKind: null,
						});
					},
				)
				.with(
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const moveDrag = useCallback(
		(
			source: TileDragSource,
			x: number,
			y: number,
		): {
			readonly target: TileDropTarget;
			readonly previewKind: useDropItemPreview.Result["kind"] | null;
		} | null => {
			const current = activeRef.current;
			if (current?.source.id !== source.id) return null;
			return match(current)
				.with(
					{
						phase: "dragging",
					},
					(dragging) => {
						const target = resolveTarget(x, y);
						let previewKind = dragging.previewKind;
						if (!sameTarget(dragging.target, target)) {
							previewKind = null;
							try {
								previewKind = readPreview(source, target)?.kind ?? null;
							} catch (error) {
								console.error(
									"Tile drop preview failed; using neutral drag feedback.",
									error,
								);
							}
							publishActive({
								...dragging,
								target,
								previewKind,
							});
						}
						return {
							target,
							previewKind,
						};
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "awaiting-outcome",
					},
					() => null,
				)
				.exhaustive();
		},
		[
			publishActive,
			readPreview,
			resolveTarget,
		],
	);

	const refreshSlotTarget = useCallback(
		(
			target: Extract<
				TileDropTarget,
				{
					readonly kind: "slot";
				}
			>,
		) => {
			const current = activeRef.current;
			if (
				current?.phase !== "dragging" ||
				current.target?.kind !== "slot" ||
				current.target.surface.id !== target.surface.id ||
				current.target.slot.id !== target.slot.id ||
				sameTarget(current.target, target)
			) {
				return;
			}
			let previewKind: useDropItemPreview.Result["kind"] | null = null;
			try {
				previewKind = readPreview(current.source, target)?.kind ?? null;
			} catch (error) {
				console.error(
					"Tile drop preview target refresh failed; using neutral drag feedback.",
					error,
				);
			}
			publishActive({
				...current,
				target,
				previewKind,
			});
		},
		[
			publishActive,
			readPreview,
		],
	);

	const release = useCallback(
		(itemId: string) => {
			const current = activeRef.current;
			if (current?.source.id !== itemId) return null;
			return match(current)
				.with(
					{
						phase: "dragging",
					},
					(dragging) => {
						const target = dragging.target ?? {
							kind: "outside" as const,
						};
						const awaiting = {
							...dragging,
							phase: "awaiting-outcome" as const,
							target,
						};
						publishActive(awaiting);
						return {
							source: awaiting.source,
							generation: awaiting.generation,
							target: awaiting.target,
						};
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "awaiting-outcome",
					},
					() => null,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const completeDrop = useCallback(
		(source: TileDragSource, generation: number) => {
			const current = activeRef.current;
			if (
				current?.phase !== "awaiting-outcome" ||
				current.source.id !== source.id ||
				current.generation !== generation
			) {
				return;
			}
			publishActive(null);
		},
		[
			publishActive,
		],
	);

	const resetInteraction = useCallback(() => {
		if (activeRef.current === null) return;
		nextGeneration.current += 1;
		publishActive(null);
	}, [
		publishActive,
	]);

	const cancel = useCallback(
		(itemId: string) => {
			const current = activeRef.current;
			if (current?.source.id !== itemId) return;
			match(current)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => publishActive(null),
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	return {
		get active() {
			return activeRef.current;
		},
		readActive,
		subscribeActive,
		press,
		startDrag,
		moveDrag,
		refreshSlotTarget,
		release,
		completeDrop,
		cancel,
		resetInteraction,
	};
};
