import { animate } from "motion";
import {
	memo,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "~/shared/cn";
import { actorStyle } from "~/v0/tile-engine/actorStyle";
import {
	registerTileEngineDrop,
	readTileEngineDrops,
	type TileEngineDropRegistration,
} from "~/v0/tile-engine/dropRegistry";
import { containsPoint, rectCenter, rectFromElement } from "~/v0/tile-engine/rect";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

export type { TileEngine as TileEngineNamespace } from "~/v0/tile-engine/TileEngine.types";

const defaultGapPx = 0;
const doubleTapWindowMs = 260;
const longPressMs = 520;
const dragThresholdPx = 8;
const moveDurationSeconds = 0.28;
const snapDurationSeconds = 0.16;
const rejectDurationSeconds = 0.18;
const moveEase = [
	0.22,
	1,
	0.36,
	1,
] as const;
const rejectEase = [
	0.65,
	0,
	0.35,
	1,
] as const;

type DropRegistration<
	TSlot = unknown,
	TTile = unknown,
	TDrop = unknown,
> = TileEngineDropRegistration<TSlot, TTile, TDrop>;

interface ResolvedDrop<TSlot = unknown, TTile = unknown, TDrop = unknown> {
	dropId: string;
	slot: TileEngineType.Slot<TSlot> | null;
	targetTile: TileEngineType.Tile<TTile> | undefined;
	payload: TDrop;
	element: HTMLElement;
}

const distance = (x: number, y: number) => Math.hypot(x, y);

const dropOutcomeKind = (outcome: TileEngineType.DropOutcome | undefined) =>
	typeof outcome === "string" ? outcome : (outcome?.type ?? "reject");

const dropOutcomeCommit = (outcome: TileEngineType.DropOutcome | undefined) => {
	if (typeof outcome === "string" || outcome?.type !== "accept") return undefined;
	return outcome.commit;
};

const resetElementTransform = (element: HTMLElement | null) => {
	if (!element) return;
	element.style.transform = "translate3d(0px, 0px, 0px)";
};

const translateElement = (element: HTMLElement | null, x: number, y: number) => {
	if (!element) return;
	element.style.transform = `translate3d(${x}px, ${y}px, 0px)`;
};

const targetDelta = ({
	origin,
	target,
}: {
	origin: TileEngineType.Rect;
	target: TileEngineType.Rect;
}) => {
	const originCenter = rectCenter(origin);
	const targetCenter = rectCenter(target);

	return {
		x: targetCenter.x - originCenter.x,
		y: targetCenter.y - originCenter.y,
	};
};

const resolveDropAtPoint = <TSlot, TTile, TDrop>(
	drops: ReadonlyMap<string, DropRegistration<TSlot, TTile, TDrop>>,
	x: number,
	y: number,
): ResolvedDrop<TSlot, TTile, TDrop> | null => {
	for (const entry of drops.values()) {
		if (!containsPoint(entry.element.getBoundingClientRect(), x, y)) continue;

		return entry;
	}

	return null;
};

const resolveDropAtRect = <TSlot, TTile, TDrop>(
	drops: ReadonlyMap<string, DropRegistration<TSlot, TTile, TDrop>>,
	rect: TileEngineType.Rect,
): ResolvedDrop<TSlot, TTile, TDrop> | null => {
	const center = rectCenter(rect);
	return resolveDropAtPoint(drops, center.x, center.y);
};

namespace TileEngineSlot {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngineType.Slot<TSlot>;
		index: number;
		targetTile?: TileEngineType.Tile<TTile>;
		activeDropId: string | null;
		className?: string;
		drag?: TileEngineType.DragConfig<TTile, TSlot, unknown, TDrop>;
		renderSlot(props: TileEngineType.RenderSlotProps<TSlot>): ReactNode;
		registerDrop(entry: DropRegistration<TSlot, TTile, TDrop>): () => void;
	}
}

const TileEngineSlot = memo(
	<TTile, TSlot, TDrop>({
		slot,
		index,
		targetTile,
		activeDropId,
		className,
		drag,
		renderSlot,
		registerDrop,
	}: TileEngineSlot.Props<TTile, TSlot, TDrop>) => {
		const ref = useRef<HTMLDivElement | null>(null);
		const binding = drag?.slot(slot, targetTile);
		const dropId = binding?.id ?? slot.id;
		const disabled = !binding || binding.disabled || slot.disabled;

		useEffect(() => {
			if (disabled || !ref.current) return;

			return registerDrop({
				dropId,
				slot,
				targetTile,
				payload: binding.data,
				element: ref.current,
			});
		}, [
			binding,
			disabled,
			dropId,
			registerDrop,
			slot,
			targetTile,
		]);

		return (
			<div
				ref={ref}
				data-ak-tile-engine-slot-id={slot.id}
				data-ak-tile-engine-drop-id={disabled ? undefined : dropId}
				className={className}
			>
				{renderSlot({
					slot,
					index,
					isOver: !disabled && activeDropId === dropId,
				})}
			</div>
		);
	},
);

namespace TileEngineActor {
	export interface DragSession<TDrag = unknown> {
		pointerId: number;
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
		origin: TileEngineType.Rect;
		source: TDrag;
		started: boolean;
		longFired: boolean;
	}

	export interface LastTap {
		time: number;
		x: number;
		y: number;
	}

	export interface Handoff {
		tileId: string;
		targetSlotId: string;
	}

	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		tile: TileEngineType.Tile<TTile>;
		index: number;
		columns: number;
		rowCount: number;
		gapPx: number;
		drag?: TileEngineType.DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		resolveDrop(rect: TileEngineType.Rect): ResolvedDrop<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
		setHandoff(handoff: Handoff | null): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
		renderTile(props: TileEngineType.RenderTileProps<TTile>): ReactNode;
	}
}

const TileEngineActor = memo(
	<TTile, TSlot, TDrag, TDrop>({
		tile,
		index,
		columns,
		rowCount,
		gapPx,
		drag,
		dragConstraintsRef,
		resolveDrop,
		setActiveDropId,
		setHandoff,
		consumeHandoff,
		renderTile,
	}: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>) => {
		const actorRef = useRef<HTMLDivElement | null>(null);
		const dragSessionRef = useRef<TileEngineActor.DragSession<TDrag> | null>(null);
		const lastTapRef = useRef<TileEngineActor.LastTap | null>(null);
		const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const previousRectRef = useRef<TileEngineType.Rect | null>(null);
		const previousSlotIdRef = useRef(tile.slotId);
		const [dragging, setDragging] = useState(false);
		const binding = drag?.tile(tile);
		const disabled = tile.disabled || tile.hidden || binding?.disabled || !binding;

		const clearSingleTimer = useCallback(() => {
			if (!singleTimerRef.current) return;
			clearTimeout(singleTimerRef.current);
			singleTimerRef.current = null;
		}, []);

		const clearLongTimer = useCallback(() => {
			if (!longTimerRef.current) return;
			clearTimeout(longTimerRef.current);
			longTimerRef.current = null;
		}, []);

		const clearTimers = useCallback(() => {
			clearSingleTimer();
			clearLongTimer();
		}, [
			clearLongTimer,
			clearSingleTimer,
		]);

		useEffect(
			() => () => {
				clearTimers();
			},
			[
				clearTimers,
			],
		);

		useLayoutEffect(() => {
			const element = actorRef.current;
			if (!element) return;

			if (consumeHandoff(tile.id, tile.slotId)) {
				resetElementTransform(element);
				previousRectRef.current = rectFromElement(element);
				previousSlotIdRef.current = tile.slotId;
				return;
			}

			const current = rectFromElement(element);
			const previous = previousRectRef.current;
			const previousSlotId = previousSlotIdRef.current;
			previousRectRef.current = current;
			previousSlotIdRef.current = tile.slotId;

			if (!previous || previousSlotId === tile.slotId || dragging) return;

			const deltaX = previous.left - current.left;
			const deltaY = previous.top - current.top;
			if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

			void animate(
				element,
				{
					transform: [
						`translate3d(${deltaX}px, ${deltaY}px, 0px)`,
						"translate3d(0px, 0px, 0px)",
					],
				},
				{
					duration: moveDurationSeconds,
					ease: moveEase,
				},
			);
		}, [
			consumeHandoff,
			dragging,
			tile.id,
			tile.slotId,
		]);

		const finishDrag = useCallback(() => {
			dragSessionRef.current = null;
			setDragging(false);
			setActiveDropId(null);
		}, [
			setActiveDropId,
		]);

		const updateHover = useCallback(() => {
			const session = dragSessionRef.current;
			if (!session || !session.started) return null;

			const element = actorRef.current;
			const rect = element
				? rectFromElement(element)
				: {
						...session.origin,
						left: session.origin.left + session.currentX,
						top: session.origin.top + session.currentY,
					};
			const resolved = resolveDrop(rect);
			setActiveDropId(resolved?.dropId ?? null);
			drag?.onDragOver?.({
				source: session.source,
				target: resolved?.payload ?? null,
				targetSlot: resolved?.slot ?? null,
				targetTile: resolved?.targetTile ?? null,
				dropId: resolved?.dropId ?? null,
			});
			return resolved;
		}, [
			drag,
			resolveDrop,
			setActiveDropId,
		]);

		const cancelDrag = useCallback(() => {
			const session = dragSessionRef.current;
			if (session?.started) {
				drag?.onDragCancel?.({
					source: session.source,
					tile,
				});
			}
			clearTimers();
			setHandoff(null);
			finishDrag();
			resetElementTransform(actorRef.current);
		}, [
			clearTimers,
			drag,
			finishDrag,
			setHandoff,
			tile,
		]);

		const animateBack = useCallback(async () => {
			const session = dragSessionRef.current;
			const element = actorRef.current;
			if (!session || !element) return;
			await animate(
				element,
				{
					transform: [
						`translate3d(${session.currentX}px, ${session.currentY}px, 0px)`,
						"translate3d(0px, 0px, 0px)",
					],
				},
				{
					duration: rejectDurationSeconds,
					ease: rejectEase,
				},
			);
		}, []);

		const animateToTarget = useCallback(async (targetRect: TileEngineType.Rect | null) => {
			const session = dragSessionRef.current;
			const element = actorRef.current;
			if (!session || !element || !targetRect) return;

			const target = targetDelta({
				origin: session.origin,
				target: targetRect,
			});

			await animate(
				element,
				{
					transform: [
						`translate3d(${session.currentX}px, ${session.currentY}px, 0px)`,
						`translate3d(${target.x}px, ${target.y}px, 0px)`,
					],
				},
				{
					duration: snapDurationSeconds,
					ease: moveEase,
				},
			);
			session.currentX = target.x;
			session.currentY = target.y;
		}, []);

		const startActualDrag = useCallback(() => {
			const session = dragSessionRef.current;
			if (!session || session.started) return;
			session.started = true;
			clearTimers();
			setDragging(true);
			drag?.onDragStart?.({
				source: session.source,
				tile,
				rect: session.origin,
			});
		}, [
			clearTimers,
			drag,
			tile,
		]);

		const handleTap = useCallback(
			(event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">) => {
				if (!binding) return;
				if (!binding.onDoubleActivate) {
					binding.onSingleActivate?.();
					return;
				}

				const now = Date.now();
				const lastTap = lastTapRef.current;
				const isDouble = Boolean(
					lastTap &&
						now - lastTap.time <= doubleTapWindowMs &&
						distance(event.clientX - lastTap.x, event.clientY - lastTap.y) <=
							dragThresholdPx,
				);

				if (isDouble) {
					lastTapRef.current = null;
					clearSingleTimer();
					binding.onDoubleActivate();
					return;
				}

				lastTapRef.current = {
					time: now,
					x: event.clientX,
					y: event.clientY,
				};

				if (!binding.onSingleActivate) return;
				if (!binding.delaySingleWhenDouble) {
					binding.onSingleActivate();
					return;
				}

				clearSingleTimer();
				singleTimerRef.current = setTimeout(() => {
					singleTimerRef.current = null;
					binding.onSingleActivate?.();
				}, doubleTapWindowMs);
			},
			[
				binding,
				clearSingleTimer,
			],
		);

		const handlePointerDown = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				if (disabled || event.button !== 0) return;
				const element = actorRef.current;
				if (!element || !binding) return;

				const constraints = dragConstraintsRef?.current;
				if (constraints && !constraints.contains(event.currentTarget)) return;

				clearTimers();
				setHandoff(null);
				resetElementTransform(element);
				element.setPointerCapture(event.pointerId);

				dragSessionRef.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					currentX: 0,
					currentY: 0,
					origin: rectFromElement(element),
					source: binding.data,
					started: false,
					longFired: false,
				};

				if (binding.onLongActivate) {
					longTimerRef.current = setTimeout(() => {
						const session = dragSessionRef.current;
						if (!session || session.pointerId !== event.pointerId || session.started)
							return;
						session.longFired = true;
						longTimerRef.current = null;
						binding.onLongActivate?.();
					}, longPressMs);
				}
			},
			[
				disabled,
				binding,
				dragConstraintsRef,
				clearTimers,
				setHandoff,
			],
		);

		const handlePointerMove = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;

				const x = event.clientX - session.startX;
				const y = event.clientY - session.startY;
				session.currentX = x;
				session.currentY = y;

				if (!session.started) {
					const moved = distance(x, y);
					if (moved <= dragThresholdPx) return;
					startActualDrag();
				}

				if (!dragSessionRef.current?.started) return;
				clearLongTimer();
				translateElement(actorRef.current, x, y);
				updateHover();
			},
			[
				clearLongTimer,
				startActualDrag,
				updateHover,
			],
		);

		const handlePointerUp = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;

				const element = actorRef.current;
				if (element?.hasPointerCapture(event.pointerId)) {
					element.releasePointerCapture(event.pointerId);
				}

				clearLongTimer();

				if (!session.started) {
					const longFired = session.longFired;
					dragSessionRef.current = null;
					resetElementTransform(element);
					if (!longFired) handleTap(event);
					return;
				}

				const releaseRect = element
					? rectFromElement(element)
					: {
							...session.origin,
							left: session.origin.left + session.currentX,
							top: session.origin.top + session.currentY,
						};
				const resolved = resolveDrop(releaseRect);
				setActiveDropId(null);

				void (async () => {
					try {
						const outcome = await drag?.onDrop?.({
							source: session.source,
							target: resolved?.payload ?? null,
							sourceTile: tile,
							targetSlot: resolved?.slot ?? null,
							targetTile: resolved?.targetTile ?? null,
							dragRect: releaseRect,
							targetRect: resolved?.element
								? rectFromElement(resolved.element)
								: null,
						});
						const kind = dropOutcomeKind(outcome);
						const commit = dropOutcomeCommit(outcome);

						if (kind === "accept" && resolved?.element) {
							await animateToTarget(rectFromElement(resolved.element));
							if (resolved.slot) {
								setHandoff({
									tileId: tile.id,
									targetSlotId: resolved.slot.id,
								});
							}
							try {
								await commit?.();
								return;
							} catch {
								setHandoff(null);
								await animateBack();
								return;
							}
						}

						setHandoff(null);
						if (kind === "ignore") {
							await animateBack();
							return;
						}

						await animateBack();
					} catch {
						setHandoff(null);
						await animateBack();
					} finally {
						finishDrag();
						resetElementTransform(actorRef.current);
					}
				})();
			},
			[
				animateBack,
				animateToTarget,
				clearLongTimer,
				drag,
				finishDrag,
				handleTap,
				resolveDrop,
				setActiveDropId,
				setHandoff,
				tile,
			],
		);

		const handlePointerCancel = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;
				cancelDrag();
			},
			[
				cancelDrag,
			],
		);

		return (
			<div
				ref={actorRef}
				data-ak-tile-engine-tile-id={tile.id}
				data-ak-tile-engine-slot-id={tile.slotId}
				data-ak-tile-engine-dragging={dragging ? "true" : undefined}
				className={cn(
					"pointer-events-auto absolute touch-none select-none will-change-transform",
					tile.hidden && "pointer-events-none opacity-0",
					disabled && "pointer-events-none",
				)}
				style={{
					...actorStyle({
						columns,
						rowCount,
						index,
						gapPx,
					}),
					zIndex: dragging ? 30 : 10,
					...tile.style,
				}}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{renderTile({
					tile,
					isDragging: dragging,
				})}
			</div>
		);
	},
);

const TileEngineComponent = <TTile, TSlot, TDrag, TDrop>({
	id,
	columns,
	slots,
	tiles,
	className,
	cellClassName,
	itemLayerClassName,
	gapPx = defaultGapPx,
	drag,
	dragConstraintsRef,
	renderSlot,
	renderTile,
}: TileEngineType.Props<TTile, TSlot, TDrag, TDrop>) => {
	const handoffRef = useRef<TileEngineActor.Handoff | null>(null);
	const [activeDropId, setActiveDropId] = useState<string | null>(null);
	const rowCount = Math.max(1, Math.ceil(slots.length / columns));
	const tileBySlotId = useMemo(() => {
		const map = new Map<string, TileEngineType.Tile<TTile>>();
		for (const tile of tiles) map.set(tile.slotId, tile);
		return map;
	}, [
		tiles,
	]);
	const slotIndexById = useMemo(() => {
		const map = new Map<string, number>();
		slots.forEach((slot, index) => map.set(slot.id, index));
		return map;
	}, [
		slots,
	]);
	const registerDrop = useCallback(
		(entry: DropRegistration<TSlot, TTile, TDrop>) => registerTileEngineDrop(entry),
		[],
	);
	const resolveDrop = useCallback(
		(rect: TileEngineType.Rect) =>
			resolveDropAtRect(
				readTileEngineDrops() as ReadonlyMap<string, DropRegistration<TSlot, TTile, TDrop>>,
				rect,
			),
		[],
	);
	const setHandoff = useCallback((handoff: TileEngineActor.Handoff | null) => {
		handoffRef.current = handoff;
	}, []);
	const consumeHandoff = useCallback((tileId: string, slotId: string) => {
		const handoff = handoffRef.current;
		if (!handoff || handoff.tileId !== tileId || handoff.targetSlotId !== slotId) return false;
		handoffRef.current = null;
		return true;
	}, []);

	return (
		<div
			data-ak-tile-engine-id={id}
			className={cn("relative overflow-hidden", className)}
		>
			<div
				data-ak-tile-engine-slots=""
				className="grid h-full w-full"
				style={{
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
					gap: gapPx,
				}}
			>
				{slots.map((slot, index) => (
					<TileEngineSlot
						key={slot.id}
						slot={slot}
						index={index}
						targetTile={tileBySlotId.get(slot.id)}
						activeDropId={activeDropId}
						className={cellClassName}
						drag={drag}
						renderSlot={renderSlot}
						registerDrop={registerDrop}
					/>
				))}
			</div>

			<div className={cn("pointer-events-none absolute inset-0", itemLayerClassName)}>
				{tiles.map((tile) => {
					const index = slotIndexById.get(tile.slotId);
					if (index === undefined) return null;

					return (
						<TileEngineActor
							key={tile.id}
							tile={tile}
							index={index}
							columns={columns}
							rowCount={rowCount}
							gapPx={gapPx}
							drag={drag}
							dragConstraintsRef={dragConstraintsRef}
							resolveDrop={resolveDrop}
							setActiveDropId={setActiveDropId}
							setHandoff={setHandoff}
							consumeHandoff={consumeHandoff}
							renderTile={renderTile}
						/>
					);
				})}
			</div>
		</div>
	);
};

export const TileEngine = memo(TileEngineComponent) as typeof TileEngineComponent;
