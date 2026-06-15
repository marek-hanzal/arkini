import { useMachine } from "@xstate/react";
import { motion as motionComponent, useMotionValue, type MotionValue } from "motion/react";
import React, {
	memo,
	type CSSProperties,
	forwardRef,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { useDropTargetRegistration } from "~/drag/hook/useDropTargetRegistration";
import { resolveDropTargetAtPoint } from "~/drag/logic/dropTargetRegistry";
import { cn } from "~/shared/cn";
import { waitForMs } from "~/shared/util/waitForMs";
import {
	tileEngineMotionDurationMs,
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
const dragActivationDistancePx = 4;
const doubleTapWindowMs = 260;
const longPressMs = 520;
const longPressMoveTolerancePx = 8;

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
		): void | Promise<void>;
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

const distance = (x: number, y: number) => Math.hypot(x, y);

namespace TileEngineSlotSurface {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		activeDropTargetNodeId?: string | null;
		className?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot, unknown, TDrop>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
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
	}: TileEngineSlotSurface.Props<TTile, TSlot, TDrop>) => {
		const binding = drag?.slot(slot, targetTile);
		const nodeId = binding?.nodeId ?? binding?.id;
		const disabled = !binding || binding.disabled || slot.disabled;
		useDropTargetRegistration({
			nodeId,
			payload: binding?.data,
			disabled,
		});

		return (
			<div
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
		settleMotion,
		renderTile,
	}: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>) => {
		const binding = drag?.tile(tile);
		const ref = useRef<HTMLDivElement | null>(null);
		const dragSessionRef = useRef<TileEngineActor.DragSession<TDrag> | null>(null);
		const lastTapRef = useRef<TileEngineActor.LastTap | null>(null);
		const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const dragX = useMotionValue(0);
		const dragY = useMotionValue(0);
		const [isDragging, setIsDragging] = React.useState(false);

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
				const resolved = resolveDropTargetAtPoint<TDrop>({
					x: clientX,
					y: clientY,
				});
				drag?.onDragOver?.(source, resolved?.payload ?? null, resolved?.nodeId ?? null);
				return resolved;
			},
			[
				drag,
			],
		);

		const startDrag = useCallback(
			(session: TileEngineActor.DragSession<TDrag>) => {
				if (session.started) return;
				session.started = true;
				clearLongTimer();
				setIsDragging(true);
				dragX.set(0);
				dragY.set(0);
				drag?.onDragStart?.(session.source, session.origin);
			},
			[
				clearLongTimer,
				drag,
				dragX,
				dragY,
			],
		);

		const resetDragVisual = useCallback(() => {
			setIsDragging(false);
			dragX.set(0);
			dragY.set(0);
		}, [
			dragX,
			dragY,
		]);

		const handleTap = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
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
				const element = ref.current;
				if (!element) return;

				event.preventDefault();
				clearSingleTimer();
				clearLongTimer();
				element.setPointerCapture(event.pointerId);

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

				if (binding.onLongActivate) {
					longTimerRef.current = setTimeout(() => {
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
				tile.disabled,
			],
		);

		const handlePointerMove = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;

				const nextX = event.clientX - session.startX;
				const nextY = event.clientY - session.startY;
				const moved = distance(nextX, nextY);
				if (session.longFired) return;
				if (!session.started && moved >= dragActivationDistancePx) startDrag(session);
				if (!session.started) {
					if (moved > longPressMoveTolerancePx) clearLongTimer();
					return;
				}

				event.preventDefault();
				dragX.set(nextX);
				dragY.set(nextY);
				updateHover(session.source, event.clientX, event.clientY);
			},
			[
				clearLongTimer,
				dragX,
				dragY,
				startDrag,
				updateHover,
			],
		);

		const handlePointerUp = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;
				const element = ref.current;
				if (element?.hasPointerCapture(event.pointerId))
					element.releasePointerCapture(event.pointerId);
				clearLongTimer();
				dragSessionRef.current = null;

				if (!session.started) {
					if (!session.longFired) handleTap(event);
					return;
				}

				event.preventDefault();
				const nextX = dragX.get();
				const nextY = dragY.get();
				const dragRect = translatedRect(session.origin, nextX, nextY);
				const resolved = updateHover(session.source, event.clientX, event.clientY);
				void drag?.onDrop?.(session.source, resolved?.payload ?? null, dragRect);
				finishHover(session.source);
				resetDragVisual();
			},
			[
				clearLongTimer,
				drag,
				dragX,
				dragY,
				finishHover,
				handleTap,
				resetDragVisual,
				updateHover,
			],
		);

		const handlePointerCancel = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				const session = dragSessionRef.current;
				if (!session || session.pointerId !== event.pointerId) return;
				const element = ref.current;
				if (element?.hasPointerCapture(event.pointerId))
					element.releasePointerCapture(event.pointerId);
				dragSessionRef.current = null;
				clearLongTimer();
				finishHover(session.source);
				resetDragVisual();
				drag?.onDragCancel?.();
			},
			[
				clearLongTimer,
				drag,
				finishHover,
				resetDragVisual,
			],
		);

		const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
			event.preventDefault();
		}, []);

		const handleSettle = useCallback(() => {
			if ("nonce" in (motion ?? {})) settleMotion(tile.id, motion?.nonce);
			tile.onMotionSettle?.();
		}, [
			motion,
			settleMotion,
			tile,
		]);

		useTileEngineMotionAnimation({
			ref,
			motion,
			onSettle: handleSettle,
		});

		const hidden = Boolean(!isDragging && !motion && (tile.hidden || binding?.hidden));
		const baseStyle = actorStyle({
			columns,
			rowCount,
			index,
			gapPx,
		});
		const dragStyle = dragSessionRef.current?.origin
			? {
					position: "fixed" as const,
					left: dragSessionRef.current.origin.left,
					top: dragSessionRef.current.origin.top,
					width: dragSessionRef.current.origin.width,
					height: dragSessionRef.current.origin.height,
					padding: 0,
					zIndex: 80,
					x: dragX as MotionValue<number>,
					y: dragY as MotionValue<number>,
				}
			: undefined;
		const style = {
			...(isDragging && dragStyle ? dragStyle : baseStyle),
			...webkitTouchCalloutNone,
		} as CSSProperties & {
			x?: MotionValue<number>;
			y?: MotionValue<number>;
		};

		return (
			<motionComponent.div
				ref={ref}
				data-drag-node-id={binding?.nodeId ?? binding?.id}
				data-tile-engine-tile-id={tile.id}
				data-tile-engine-slot-id={tile.slotId}
				className={cn(
					"pointer-events-auto absolute box-border origin-top-left touch-none select-none will-change-transform",
					isDragging && "cursor-grabbing",
					hidden && "pointer-events-none opacity-0",
				)}
				style={style}
				onContextMenu={handleContextMenu}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{renderTile({
					tile,
					isDragging,
				})}
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
		activeDropTargetNodeId,
		renderSlot,
		renderTile,
	}: TileEngine.Props<TTile, TSlot, TDrag, TDrop>,
	ref: React.ForwardedRef<TileEngine.Handle<TTile>>,
) {
	const [state, send] = useMachine(tileEngineMachine);
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
			data-tile-engine-id={id}
			className={cn("relative overflow-hidden", className)}
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
