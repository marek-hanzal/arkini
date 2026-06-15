import { useMachine } from "@xstate/react";
import { animate } from "motion";
import {
	motion as motionComponent,
	useDragControls,
	useMotionValue,
	type MotionValue,
} from "motion/react";
import React, {
	memo,
	type CSSProperties,
	forwardRef,
	type RefObject,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import { resolveDropTargetAtPoint as resolveExternalDropTargetAtPoint } from "~/drag/logic/dropTargetRegistry";
import { cn } from "~/shared/cn";
import { waitForMs } from "~/shared/util/waitForMs";
import {
	tileEngineMotionDurationMs,
	tileEngineMotionEase,
	useTileEngineMotionAnimation,
	type TileEngineExternalMotion,
} from "~/tile-engine/hook/useTileEngineMotionAnimation";
import {
	tileEngineMachine,
	type TileEngineMotion,
	type TileEnginePriority,
	type TileEngineRect,
} from "~/tile-engine/logic/tileEngineMachine";

const defaultGapPx = 0;
type TileEngineDropOutcome = "accept" | "reject" | "ignore";
const doubleTapWindowMs = 260;
const longPressMs = 520;
const longPressMoveTolerancePx = 8;
const dropSnapDurationSeconds = 0.16;

export namespace TileEngine {
	export type Id = string;

	export interface Slot<TSlot = unknown> {
		id: Id;
		data: TSlot;
		disabled?: boolean;
	}

	export interface Tile<TTile = unknown> {
		id: Id;
		slotId: Id;
		data: TTile;
		hidden?: boolean;
		disabled?: boolean;
		motion?: TileEngineExternalMotion;
		onMotionSettle?(): void;
	}

	export interface DragBinding<TDrag = unknown> {
		id: Id;
		nodeId?: Id;
		data: TDrag;
		hidden?: boolean;
		disabled?: boolean;
		hideWhenActive?: boolean;
		delaySingleWhenDouble?: boolean;
		onSingleActivate?(): void;
		onDoubleActivate?(): void;
		onLongActivate?(): void;
	}

	export interface DropBinding<TDrop = unknown> {
		id: Id;
		nodeId?: Id;
		data: TDrop;
		disabled?: boolean;
	}

	export interface DragConfig<
		TTile = unknown,
		TSlot = unknown,
		TDrag = unknown,
		TDrop = unknown,
	> {
		tile(tile: Tile<TTile>): DragBinding<TDrag> | undefined;
		slot(
			slot: Slot<TSlot>,
			targetTile: Tile<TTile> | undefined,
		): DropBinding<TDrop> | undefined;
		onDragStart?(source: TDrag, rect: TileEngineRect): void;
		onDragOver?(source: TDrag, target: TDrop | null, targetNodeId: string | null): void;
		onDrop?(
			source: TDrag,
			target: TDrop | null,
			dragRect: TileEngineRect,
		): TileEngineDropOutcome | void | Promise<TileEngineDropOutcome | void>;
		onDragCancel?(): void;
	}

	export interface SpawnEntry<TTile = unknown> {
		tileId: Id;
		slotId: Id;
		from: TileEngineRect;
		data?: TTile;
		priority?: TileEnginePriority;
	}

	export interface SpawnPlan<TTile = unknown> {
		mode?: "instant" | "stack";
		gapMs?: number;
		entries: readonly SpawnEntry<TTile>[];
		commit(entries: readonly SpawnEntry<TTile>[]): Promise<void> | void;
	}

	export interface Handle<TTile = unknown> {
		spawn(plan: SpawnPlan<TTile>): Promise<void>;
		stage(entries: readonly SpawnEntry<TTile>[]): void;
		clearMotions(): void;
	}

	export interface RenderSlotProps<TSlot = unknown> {
		slot: Slot<TSlot>;
		index: number;
		isOver: boolean;
	}

	export interface RenderTileProps<TTile = unknown> {
		tile: Tile<TTile>;
		isDragging: boolean;
	}

	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		id: Id;
		columns: number;
		slots: readonly Slot<TSlot>[];
		tiles: readonly Tile<TTile>[];
		className?: string;
		cellClassName?: string;
		itemLayerClassName?: string;
		gapPx?: number;
		drag?: DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		activeDropTargetNodeId?: string | null;
		renderSlot(props: RenderSlotProps<TSlot>): ReactNode;
		renderTile(props: RenderTileProps<TTile>): ReactNode;
	}
}

const actorStyle = ({
	columns,
	rowCount,
	index,
	gapPx,
}: {
	columns: number;
	rowCount: number;
	index: number;
	gapPx: number;
}): CSSProperties => {
	const column = index % columns;
	const row = Math.floor(index / columns);

	return {
		left: `${(column * 100) / columns}%`,
		top: `${(row * 100) / rowCount}%`,
		width: `${100 / columns}%`,
		height: `${100 / rowCount}%`,
		paddingRight: column === columns - 1 ? 0 : gapPx,
		paddingBottom: row === rowCount - 1 ? 0 : gapPx,
	};
};

const rectFromElement = (element: HTMLElement): TileEngineRect => {
	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
};

const translatedRect = (rect: TileEngineRect, x: number, y: number): TileEngineRect => ({
	left: rect.left + x,
	top: rect.top + y,
	width: rect.width,
	height: rect.height,
});

const rectCenter = (rect: Pick<TileEngineRect, "left" | "top" | "width" | "height">) => ({
	x: rect.left + rect.width / 2,
	y: rect.top + rect.height / 2,
});

const distance = (x: number, y: number) => Math.hypot(x, y);

interface TileEngineDropTargetEntry<TDrop = unknown> {
	element: HTMLElement;
	payload: TDrop;
}

interface TileEngineResolvedDropTarget<TDrop = unknown> {
	nodeId: string;
	payload: TDrop;
	element?: HTMLElement;
}

const containsPoint = (rect: DOMRect, x: number, y: number) =>
	x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

const resolveDropTargetFromEntries = <TDrop,>(
	entries: ReadonlyMap<string, TileEngineDropTargetEntry<TDrop>>,
	x: number,
	y: number,
): TileEngineResolvedDropTarget<TDrop> | null => {
	for (const [nodeId, entry] of entries) {
		if (!containsPoint(entry.element.getBoundingClientRect(), x, y)) continue;

		return {
			nodeId,
			payload: entry.payload,
			element: entry.element,
		};
	}

	return null;
};

const elementForDropTargetNodeId = (nodeId: string): HTMLElement | null =>
	document.querySelector<HTMLElement>(`[data-drag-node-id="${nodeId}"]`) ??
	document.querySelector<HTMLElement>(`[data-tile-engine-drop-target-id="${nodeId}"]`);

const rectForDropTarget = <TDrop,>(target: TileEngineResolvedDropTarget<TDrop> | null) => {
	const element = target?.element ?? (target ? elementForDropTargetNodeId(target.nodeId) : null);
	if (!element) return null;

	return rectFromElement(element);
};

const centeredActorRectInTarget = ({
	actorRect,
	targetRect,
}: {
	actorRect: TileEngineRect;
	targetRect: TileEngineRect;
}): TileEngineRect => ({
	left: targetRect.left + (targetRect.width - actorRect.width) / 2,
	top: targetRect.top + (targetRect.height - actorRect.height) / 2,
	width: actorRect.width,
	height: actorRect.height,
});

namespace TileEngineSlotSurface {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		activeDropTargetNodeId?: string | null;
		className?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot, unknown, TDrop>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
		registerDropTarget(nodeId: string, payload: TDrop, element: HTMLElement): () => void;
	}
}

const TileEngineSlotSurface = memo(
	<TTile, TSlot, TDrop>({
		slot,
		index,
		targetTile,
		activeDropTargetNodeId,
		className,
		drag,
		renderSlot,
		registerDropTarget,
	}: TileEngineSlotSurface.Props<TTile, TSlot, TDrop>) => {
		const ref = useRef<HTMLDivElement | null>(null);
		const binding = drag?.slot(slot, targetTile);
		const nodeId = binding?.nodeId ?? binding?.id;
		const disabled = !binding || binding.disabled || slot.disabled;
		useEffect(() => {
			if (disabled || !nodeId || !binding?.data || !ref.current) return;

			return registerDropTarget(nodeId, binding.data, ref.current);
		}, [
			binding?.data,
			disabled,
			nodeId,
			registerDropTarget,
		]);

		return (
			<div
				ref={ref}
				data-drag-node-id={nodeId}
				data-tile-engine-drop-target-id={disabled ? undefined : nodeId}
				data-tile-engine-slot-id={slot.id}
				className={className}
			>
				{renderSlot({
					slot,
					index,
					isOver: Boolean(!disabled && nodeId && activeDropTargetNodeId === nodeId),
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
		origin: TileEngineRect;
		source: TDrag;
		started: boolean;
		longFired: boolean;
	}

	export interface LastTap {
		time: number;
		x: number;
		y: number;
	}

	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		tile: TileEngine.Tile<TTile>;
		index: number;
		columns: number;
		rowCount: number;
		gapPx: number;
		motion?: TileEngineMotion | TileEngineExternalMotion;
		drag?: TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef: RefObject<HTMLElement | null>;
		resolveDropTargetAtPoint(
			x: number,
			y: number,
		): TileEngineResolvedDropTarget<TDrop> | null;
		settleMotion(tileId: string, nonce?: number): void;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}
}

const webkitTouchCalloutNone = {
	WebkitTouchCallout: "none",
} as CSSProperties;

const TileEngineActor = memo(
	<TTile, TSlot, TDrag, TDrop>({
		tile,
		index,
		columns,
		rowCount,
		gapPx,
		motion,
		drag,
		dragConstraintsRef,
		resolveDropTargetAtPoint,
		settleMotion,
		renderTile,
	}: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>) => {
		const binding = drag?.tile(tile);
		const actorRef = useRef<HTMLDivElement | null>(null);
		// Motion drag owns the outer actor transform. Drop/move animation owns this
		// inner wrapper so the two transform systems cannot desync slot placement.
		const animationRef = useRef<HTMLDivElement | null>(null);
		const dragSessionRef = useRef<TileEngineActor.DragSession<TDrag> | null>(null);
		const lastTapRef = useRef<TileEngineActor.LastTap | null>(null);
		const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const dragControls = useDragControls();
		const dragX = useMotionValue(0);
		const dragY = useMotionValue(0);
		const [isPointerActive, setIsPointerActive] = React.useState(false);
		const [isDragging, setIsDragging] = React.useState(false);
		const [isDropHandingOff, setIsDropHandingOff] = React.useState(false);

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

		useEffect(
			() => () => {
				clearSingleTimer();
				clearLongTimer();
			},
			[
				clearLongTimer,
				clearSingleTimer,
			],
		);

		const finishHover = useCallback(
			(source: TDrag) => drag?.onDragOver?.(source, null, null),
			[
				drag,
			],
		);

		const updateHover = useCallback(
			(source: TDrag, clientX: number, clientY: number) => {
				const resolved = resolveDropTargetAtPoint(clientX, clientY);
				drag?.onDragOver?.(source, resolved?.payload ?? null, resolved?.nodeId ?? null);
				return resolved;
			},
			[
				drag,
				resolveDropTargetAtPoint,
			],
		);

		const updateHoverFromActorRect = useCallback(
			(source: TDrag, actorRect: TileEngineRect) => {
				const center = rectCenter(actorRect);
				return updateHover(source, center.x, center.y);
			},
			[
				updateHover,
			],
		);

		const resetDragVisual = useCallback(() => {
			setIsDragging(false);
			setIsPointerActive(false);
			setIsDropHandingOff(false);
			dragX.stop();
			dragY.stop();
			dragX.set(0);
			dragY.set(0);
		}, [
			dragX,
			dragY,
		]);

		const releasePointerVisual = useCallback(() => {
			setIsDragging(false);
			setIsPointerActive(false);
		}, []);

		const animateDropSnap = useCallback(
			async ({
				origin,
				targetRect,
			}: {
				origin: TileEngineRect;
				targetRect: TileEngineRect | null;
			}): Promise<TileEngineRect> => {
				if (!targetRect) {
					const element = actorRef.current;
					return element
						? rectFromElement(element)
						: translatedRect(origin, dragX.get(), dragY.get());
				}

				const destination = centeredActorRectInTarget({
					actorRect: origin,
					targetRect,
				});
				const targetX = destination.left - origin.left;
				const targetY = destination.top - origin.top;

				dragX.stop();
				dragY.stop();

				const xControls = animate(dragX, targetX, {
					duration: dropSnapDurationSeconds,
					ease: tileEngineMotionEase,
				});
				const yControls = animate(dragY, targetY, {
					duration: dropSnapDurationSeconds,
					ease: tileEngineMotionEase,
				});

				await Promise.all([
					xControls.then(() => undefined),
					yControls.then(() => undefined),
				]);
				dragX.set(targetX);
				dragY.set(targetY);

				return destination;
			},
			[
				dragX,
				dragY,
			],
		);

		const cancelActiveSession = useCallback(() => {
			const session = dragSessionRef.current;
			if (!session) return;

			dragSessionRef.current = null;
			clearLongTimer();
			clearSingleTimer();
			if (session.started) {
				finishHover(session.source);
				drag?.onDragCancel?.();
			}
			resetDragVisual();
		}, [
			clearLongTimer,
			clearSingleTimer,
			drag,
			finishHover,
			resetDragVisual,
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
							longPressMoveTolerancePx,
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
				if (!binding || binding.disabled || tile.disabled || event.button !== 0) return;
				const element = actorRef.current;
				if (!element) return;

				clearSingleTimer();
				clearLongTimer();
				dragX.set(0);
				dragY.set(0);

				const session: TileEngineActor.DragSession<TDrag> = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					origin: rectFromElement(element),
					source: binding.data,
					started: false,
					longFired: false,
				};
				dragSessionRef.current = session;
				setIsPointerActive(true);
				dragControls.start(event, {
					distanceThreshold: longPressMoveTolerancePx,
					snapToCursor: true,
				});

				if (binding.onLongActivate) {
					longTimerRef.current = setTimeout(() => {
						longTimerRef.current = null;
						const current = dragSessionRef.current;
						if (!current || current.pointerId !== event.pointerId || current.started)
							return;
						current.longFired = true;
						binding.onLongActivate?.();
					}, longPressMs);
				}
			},
			[
				binding,
				clearLongTimer,
				clearSingleTimer,
				dragControls,
				dragX,
				dragY,
				tile.disabled,
			],
		);

		const handlePointerMove = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId || session.started) return;

				const moved = distance(
					event.clientX - session.startX,
					event.clientY - session.startY,
				);
				if (moved > longPressMoveTolerancePx) clearLongTimer();
			},
			[
				clearLongTimer,
			],
		);

		const handlePointerUp = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId || session.started) return;

				dragSessionRef.current = null;
				clearLongTimer();
				resetDragVisual();
				if (!session.longFired) handleTap(event);
			},
			[
				clearLongTimer,
				handleTap,
				resetDragVisual,
			],
		);

		const handleDragStart = useCallback(() => {
			const session = dragSessionRef.current;
			if (!session || session.started) return;

			session.started = true;
			clearLongTimer();
			clearSingleTimer();
			setIsDragging(true);
			dragX.set(0);
			dragY.set(0);
			drag?.onDragStart?.(session.source, session.origin);
		}, [
			clearLongTimer,
			clearSingleTimer,
			drag,
			dragX,
			dragY,
		]);

		const handleDrag = useCallback(
			(point: { x: number; y: number }) => {
				const session = dragSessionRef.current;
				if (!session || !session.started) return;

				const element = actorRef.current;
				if (element) {
					updateHoverFromActorRect(session.source, rectFromElement(element));
					return;
				}

				updateHover(session.source, point.x, point.y);
			},
			[
				updateHover,
				updateHoverFromActorRect,
			],
		);

		const handleDragEnd = useCallback(
			(point: { x: number; y: number }) => {
				const session = dragSessionRef.current;
				if (!session) return;

				dragSessionRef.current = null;
				clearLongTimer();

				if (!session.started) {
					resetDragVisual();
					return;
				}

				const element = actorRef.current;
				const releaseRect = element
					? rectFromElement(element)
					: translatedRect(session.origin, dragX.get(), dragY.get());
				const resolved = element
					? updateHoverFromActorRect(session.source, releaseRect)
					: updateHover(session.source, point.x, point.y);

				releasePointerVisual();

				void (async () => {
					const handoffRect = await animateDropSnap({
						origin: session.origin,
						targetRect: rectForDropTarget(resolved),
					});

					finishHover(session.source);
					setIsDropHandingOff(true);
					await drag?.onDrop?.(session.source, resolved?.payload ?? null, handoffRect);
				})()
					.catch(() => {
						// The app-level drag controller owns error feedback; TileEngine only restores
						// the local actor state.
					})
					.finally(() => {
						resetDragVisual();
					});
			},
			[
				animateDropSnap,
				clearLongTimer,
				drag,
				dragX,
				dragY,
				finishHover,
				releasePointerVisual,
				resetDragVisual,
				updateHover,
				updateHoverFromActorRect,
			],
		);

		const handlePointerCancel = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;
				cancelActiveSession();
			},
			[
				cancelActiveSession,
			],
		);

		const handleLostPointerCapture = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId || session.started) return;
				cancelActiveSession();
			},
			[
				cancelActiveSession,
			],
		);

		useEffect(() => {
			const cancel = () => cancelActiveSession();
			const cancelWhenHidden = () => {
				if (document.visibilityState !== "visible") cancelActiveSession();
			};

			window.addEventListener("blur", cancel);
			window.addEventListener("resize", cancel);
			window.addEventListener("orientationchange", cancel);
			document.addEventListener("visibilitychange", cancelWhenHidden);

			return () => {
				window.removeEventListener("blur", cancel);
				window.removeEventListener("resize", cancel);
				window.removeEventListener("orientationchange", cancel);
				document.removeEventListener("visibilitychange", cancelWhenHidden);
			};
		}, [
			cancelActiveSession,
		]);

		const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
			event.preventDefault();
		}, []);

		const handleSettle = useCallback(() => {
			if ("nonce" in (motion ?? {})) settleMotion(tile.id, motion?.nonce);
			tile.onMotionSettle?.();
		}, [
			motion,
			settleMotion,
			tile.id,
			tile.onMotionSettle,
		]);

		useLayoutEffect(() => {
			if (!motion || !isDropHandingOff) return;

			dragX.set(0);
			dragY.set(0);
			setIsDropHandingOff(false);
		}, [
			dragX,
			dragY,
			isDropHandingOff,
			motion,
		]);

		useTileEngineMotionAnimation({
			ref: animationRef,
			motion,
			onSettle: handleSettle,
		});

		const hidden = Boolean(
			!motion && (isDropHandingOff || tile.hidden || binding?.hidden),
		);
		const baseStyle = actorStyle({
			columns,
			rowCount,
			index,
			gapPx,
		});
		const style = {
			...baseStyle,
			zIndex: isPointerActive || isDragging || motion?.priority === "raised" ? 80 : undefined,
			x: dragX as MotionValue<number>,
			y: dragY as MotionValue<number>,
			...webkitTouchCalloutNone,
		} as CSSProperties & {
			x?: MotionValue<number>;
			y?: MotionValue<number>;
		};

		const canDrag = Boolean(binding && !binding.disabled && !tile.disabled);

		return (
			<motionComponent.div
				ref={actorRef}
				data-drag-node-id={binding?.nodeId ?? binding?.id}
				data-tile-engine-tile-id={tile.id}
				data-tile-engine-slot-id={tile.slotId}
				className={cn(
					"pointer-events-auto absolute box-border origin-top-left touch-none select-none will-change-transform",
					isDragging ? "cursor-grabbing" : canDrag && "cursor-grab",
					hidden && "pointer-events-none opacity-0",
				)}
				style={style}
				onContextMenu={handleContextMenu}
				drag={canDrag}
				dragControls={dragControls}
				dragListener={false}
				dragConstraints={dragConstraintsRef}
				dragElastic={0.08}
				dragMomentum={false}
				dragPropagation={false}
				dragTransition={{
					bounceDamping: 26,
					bounceStiffness: 640,
				}}
				whileTap={canDrag ? { scale: 0.97 } : undefined}
				whileDrag={{ scale: 1.055 }}
				onDragStart={handleDragStart}
				onDrag={(_event, info) => handleDrag(info.point)}
				onDragEnd={(_event, info) => handleDragEnd(info.point)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onLostPointerCapture={handleLostPointerCapture}
			>
				<div
					ref={animationRef}
					className="h-full w-full origin-top-left"
				>
					{renderTile({
						tile,
						isDragging,
					})}
				</div>
			</motionComponent.div>
		);
	},
);

function TileEngineInner<TTile, TSlot, TDrag, TDrop>(
	{
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
		activeDropTargetNodeId,
		renderSlot,
		renderTile,
	}: TileEngine.Props<TTile, TSlot, TDrag, TDrop>,
	ref: React.ForwardedRef<TileEngine.Handle<TTile>>,
) {
	const [state, send] = useMachine(tileEngineMachine);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const ownDragConstraintsRef = rootRef as RefObject<HTMLElement | null>;
	const activeDragConstraintsRef = dragConstraintsRef ?? ownDragConstraintsRef;
	const slotDropTargetsRef = useRef(new Map<string, TileEngineDropTargetEntry<TDrop>>());
	const rowCount = Math.max(1, Math.ceil(slots.length / columns));
	const slotIndexById = useMemo(() => {
		const index = new Map<string, number>();
		for (const [slotIndex, slot] of slots.entries()) index.set(slot.id, slotIndex);
		return index;
	}, [
		slots,
	]);
	const tileBySlotId = useMemo(() => {
		const index = new Map<string, TileEngine.Tile<TTile>>();
		for (const tile of tiles) index.set(tile.slotId, tile);
		return index;
	}, [
		tiles,
	]);

	const registerDropTarget = useCallback(
		(nodeId: string, payload: TDrop, element: HTMLElement) => {
			const entry: TileEngineDropTargetEntry<TDrop> = {
				element,
				payload,
			};
			slotDropTargetsRef.current.set(nodeId, entry);

			return () => {
				if (slotDropTargetsRef.current.get(nodeId) === entry) {
					slotDropTargetsRef.current.delete(nodeId);
				}
			};
		},
		[],
	);
	const resolveDropTarget = useCallback((x: number, y: number) => {
		return (
			resolveDropTargetFromEntries(slotDropTargetsRef.current, x, y) ??
			resolveExternalDropTargetAtPoint<TDrop>({
				x,
				y,
			})
		);
	}, []);

	const settleMotion = useCallback(
		(tileId: string, nonce?: number) => {
			if (nonce === undefined) return;
			send({
				type: "SETTLED",
				tileId,
				nonce,
			});
		},
		[
			send,
		],
	);
	const stage = useCallback(
		(entries: readonly TileEngine.SpawnEntry<TTile>[]) => {
			if (!entries.length) return;
			send({
				type: "STAGE",
				entries: entries.map((entry) => ({
					tileId: entry.tileId,
					from: entry.from,
					priority: entry.priority,
				})),
			});
		},
		[
			send,
		],
	);

	useImperativeHandle(
		ref,
		() => ({
			async spawn(plan) {
				const mode = plan.mode ?? "instant";
				if (mode === "instant") {
					stage(plan.entries);
					await plan.commit(plan.entries);
					await waitForMs(tileEngineMotionDurationMs);
					return;
				}

				const gapMs = plan.gapMs ?? 55;
				for (const entry of plan.entries) {
					stage([
						entry,
					]);
					await plan.commit([
						entry,
					]);
					await waitForMs(tileEngineMotionDurationMs + gapMs);
				}
			},
			stage,
			clearMotions() {
				send({
					type: "CLEAR",
				});
			},
		}),
		[
			send,
			stage,
		],
	);

	return (
		<div
			ref={rootRef}
			data-tile-engine-id={id}
			className={cn("relative", className)}
		>
			<div
				className="grid"
				style={{
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				}}
			>
				{slots.map((slot, index) => (
					<TileEngineSlotSurface
						key={slot.id}
						slot={slot}
						index={index}
						targetTile={tileBySlotId.get(slot.id)}
						activeDropTargetNodeId={activeDropTargetNodeId}
						className={cellClassName}
						drag={drag}
						renderSlot={renderSlot}
						registerDropTarget={registerDropTarget}
					/>
				))}
			</div>
			<div className={cn("pointer-events-none absolute inset-0", itemLayerClassName)}>
				{tiles.map((tile) => {
					const index = slotIndexById.get(tile.slotId);
					if (index === undefined) return null;

					const motion = tile.motion ?? state.context.motions[tile.id];

					return (
						<TileEngineActor
							key={tile.id}
							tile={tile}
							index={index}
							columns={columns}
							rowCount={rowCount}
							gapPx={gapPx}
							motion={motion}
							drag={drag}
							dragConstraintsRef={activeDragConstraintsRef}
							resolveDropTargetAtPoint={resolveDropTarget}
							settleMotion={settleMotion}
							renderTile={renderTile}
						/>
					);
				})}
			</div>
		</div>
	);
}

export const TileEngine = memo(forwardRef(TileEngineInner)) as <
	TTile = unknown,
	TSlot = unknown,
	TDrag = unknown,
	TDrop = unknown,
>(
	props: TileEngine.Props<TTile, TSlot, TDrag, TDrop> & {
		ref?: React.Ref<TileEngine.Handle<TTile>>;
	},
) => ReactNode;
