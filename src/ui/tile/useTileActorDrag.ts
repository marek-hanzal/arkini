import { useAtom } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type PanInfo, useDragControls, useMotionValue } from "motion/react";
import { type PointerEventHandler, useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { dropItemAtom } from "~/bridge/tile/dropItemAtom";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";
import { useTileActorInteraction } from "~/ui/tile/useTileActorInteraction";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

const reportDropFailure = (cause: Cause.Cause<unknown>) => {
	if (Cause.hasInterruptsOnly(cause)) return;
	const failure = readExactCauseFailure(cause);
	console.error("Tile drop failed.", Option.isSome(failure) ? failure.value : cause);
};

/** Owns direct pointer dragging and one authoritative drop outcome through settlement. */
export const useTileActorDrag = ({
	canonicalSource,
	live,
}: {
	readonly canonicalSource: TileDragSource;
	readonly live: boolean;
}) => {
	const game = useGameEngine();
	const active = useTileActorInteraction(canonicalSource.id);
	const { press, startDrag, moveDrag, release, completeDrop, cancel } = useTileActorSystem();
	const commandAtom = dropItemAtom(game);
	const [dropResult, dropItem] = useAtom(commandAtom);
	const dragControls = useDragControls();
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const dragStarted = useRef(false);
	const dropOwned = useRef<{
		readonly generation: number;
		readonly resultBeforeCommand: typeof dropResult;
		readonly source: TileDragSource;
	} | null>(null);
	const pointerOwned = useRef(false);
	const suppressClick = useRef(false);

	const resetOffset = useCallback(() => {
		x.set(0);
		y.set(0);
	}, [
		x,
		y,
	]);

	const updateDrag = useCallback(
		(info: PanInfo) => {
			moveDrag(canonicalSource, info.point.x, info.point.y);
		},
		[
			canonicalSource,
			moveDrag,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>(
		(event) => {
			if (!live || !event.isPrimary || event.button !== 0) return;
			if (!press(canonicalSource)) return;
			pointerOwned.current = true;
			dragStarted.current = false;
			suppressClick.current = false;
			resetOffset();
			dragControls.start(event, {
				distanceThreshold: 6,
			});
		},
		[
			canonicalSource,
			dragControls,
			live,
			press,
			resetOffset,
		],
	);

	const onPointerUp = useCallback(() => {
		if (!pointerOwned.current || dragStarted.current) return;
		pointerOwned.current = false;
		cancel(canonicalSource.id);
		resetOffset();
	}, [
		cancel,
		canonicalSource.id,
		resetOffset,
	]);

	const onPointerCancel = useCallback(() => {
		if (!pointerOwned.current) return;
		pointerOwned.current = false;
		dragStarted.current = false;
		dragControls.cancel();
		cancel(canonicalSource.id);
		resetOffset();
	}, [
		cancel,
		canonicalSource.id,
		dragControls,
		resetOffset,
	]);

	const onDragStart = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (!pointerOwned.current) return;
			dragStarted.current = true;
			suppressClick.current = true;
			startDrag(canonicalSource);
			updateDrag(info);
		},
		[
			canonicalSource,
			startDrag,
			updateDrag,
		],
	);

	const onDrag = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (!pointerOwned.current) return;
			updateDrag(info);
		},
		[
			updateDrag,
		],
	);

	const onDragEnd = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
			if (!pointerOwned.current) return;
			pointerOwned.current = false;
			dragStarted.current = false;
			resetOffset();
			const released = release(canonicalSource.id);
			if (released === null) {
				cancel(canonicalSource.id);
				return;
			}
			const target = match(released.target)
				.with(
					{
						kind: "slot",
					},
					(slot) => {
						const location = tileLocationForTarget(slot);
						return location === null
							? {
									kind: "unsupported" as const,
								}
							: {
									kind: "slot" as const,
									location,
									occupant:
										slot.occupant === null
											? null
											: {
													itemId: slot.occupant.id,
													revision: slot.occupant.revision,
												},
								};
					},
				)
				.with(
					{
						kind: "surface",
					},
					{
						kind: "outside",
					},
					() => ({
						kind: "unsupported" as const,
					}),
				)
				.exhaustive();
			dropOwned.current = {
				generation: released.generation,
				resultBeforeCommand: dropResult,
				source: released.source,
			};
			dropItem({
				sourceItemId: released.source.id,
				sourceRevision: released.source.revision,
				sourceLocation: released.source.location,
				target,
			});
		},
		[
			cancel,
			canonicalSource.id,
			dropResult,
			dropItem,
			release,
			resetOffset,
		],
	);

	useEffect(() => {
		const owned = dropOwned.current;
		if (
			owned === null ||
			dropResult === owned.resultBeforeCommand ||
			dropResult.waiting ||
			AsyncResult.isInitial(dropResult)
		) {
			return;
		}
		dropOwned.current = null;
		if (AsyncResult.isFailure(dropResult)) reportDropFailure(dropResult.cause);
		completeDrop(owned.source, owned.generation);
	}, [
		completeDrop,
		dropResult,
	]);

	useEffect(() => {
		if (!pointerOwned.current) return;
		if (live && active?.source.id === canonicalSource.id) return;
		pointerOwned.current = false;
		dragStarted.current = false;
		dragControls.cancel();
		cancel(canonicalSource.id);
		resetOffset();
	}, [
		active,
		cancel,
		canonicalSource.id,
		dragControls,
		live,
		resetOffset,
	]);

	const consumeClickSuppression = useCallback(() => {
		const suppressed = suppressClick.current;
		suppressClick.current = false;
		return suppressed;
	}, []);

	useEffect(
		() => () => {
			const owned = dropOwned.current;
			dropOwned.current = null;
			if (owned !== null) completeDrop(owned.source, owned.generation);
		},
		[
			commandAtom,
			completeDrop,
		],
	);

	useEffect(
		() => () => {
			pointerOwned.current = false;
			dragStarted.current = false;
			dragControls.cancel();
			cancel(canonicalSource.id);
			resetOffset();
		},
		[
			cancel,
			canonicalSource.id,
			dragControls,
			resetOffset,
		],
	);

	return {
		dragControls,
		x,
		y,
		onPointerDown,
		onPointerUp,
		onPointerCancel,
		onDragStart,
		onDrag,
		onDragEnd,
		consumeClickSuppression,
	};
};
