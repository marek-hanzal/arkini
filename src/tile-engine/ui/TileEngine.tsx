import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
	type Data,
} from "@dnd-kit/core";
import { useMachine } from "@xstate/react";
import React, {
	memo,
	type CSSProperties,
	type FC,
	forwardRef,
	type ReactNode,
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	tileEngineMachine,
	type TileEngineMotion,
	type TileEnginePriority,
	type TileEngineRect,
} from "~/tile-engine/logic/tileEngineMachine";
import {
	tileEngineMotionDurationMs,
	useTileEngineMotionAnimation,
	type TileEngineExternalMotion,
} from "~/tile-engine/hook/useTileEngineMotionAnimation";
import { cn } from "~/shared/cn";
import { waitForMs } from "~/shared/util/waitForMs";

const defaultGapPx = 0;

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

	export interface DropContext<TTile = unknown, TSlot = unknown> {
		tile: Tile<TTile>;
		fromSlot: Slot<TSlot>;
		toSlot: Slot<TSlot>;
		targetTile?: Tile<TTile>;
		dragRect: TileEngineRect;
	}

	export type ActionPlan =
		| {
				type: "ignore" | "reject";
		  }
		| {
				type: "move";
		  }
		| {
				type: "swap";
		  }
		| {
				type: "remove";
		  }
		| {
				type: "replace";
				replaceTileId: Id;
		  };

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

	export interface Actions<TTile = unknown, TSlot = unknown> {
		resolveDrop?(context: DropContext<TTile, TSlot>): ActionPlan | Promise<ActionPlan>;
		onMove?(context: DropContext<TTile, TSlot>): Promise<void> | void;
		onSwap?(context: DropContext<TTile, TSlot>): Promise<void> | void;
		onRemove?(context: DropContext<TTile, TSlot>): Promise<void> | void;
		onReplace?(
			context: DropContext<TTile, TSlot> & {
				replaceTileId: Id;
			},
		): Promise<void> | void;
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

	export interface Props<TTile = unknown, TSlot = unknown> {
		id: Id;
		columns: number;
		slots: readonly Slot<TSlot>[];
		tiles: readonly Tile<TTile>[];
		className?: string;
		cellClassName?: string;
		itemLayerClassName?: string;
		gapPx?: number;
		confinement?: HTMLElement | null;
		actions?: Actions<TTile, TSlot>;
		renderSlot(props: RenderSlotProps<TSlot>): ReactNode;
		renderTile(props: RenderTileProps<TTile>): ReactNode;
		renderDragOverlay?(tile: Tile<TTile>): ReactNode;
	}
}

const rectFromClientRect = (
	rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): TileEngineRect => ({
	left: rect.left,
	top: rect.top,
	width: rect.width,
	height: rect.height,
});

const querySlotRect = (engineId: string, slotId: string): TileEngineRect | undefined => {
	const element = document.querySelector<HTMLElement>(
		`[data-tile-engine-id="${CSS.escape(engineId)}"] [data-tile-engine-slot-id="${CSS.escape(slotId)}"]`,
	);
	if (!element) return undefined;

	return rectFromClientRect(element.getBoundingClientRect());
};

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

namespace TileEngineSlotSurface {
	export interface Props<TSlot = unknown> {
		engineId: string;
		slot: TileEngine.Slot<TSlot>;
		index: number;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
	}
}

const TileEngineSlotSurface = memo(
	<TSlot,>({ engineId, slot, index, renderSlot }: TileEngineSlotSurface.Props<TSlot>) => {
		const { setNodeRef, isOver } = useDroppable({
			id: `${engineId}:slot:${slot.id}`,
			data: {
				kind: "tile-engine-slot",
				engineId,
				slotId: slot.id,
			} satisfies Record<string, unknown> as Data,
			disabled: slot.disabled,
		});

		return (
			<div
				ref={setNodeRef}
				data-tile-engine-slot-id={slot.id}
			>
				{renderSlot({
					slot,
					index,
					isOver,
				})}
			</div>
		);
	},
);

namespace TileEngineActor {
	export interface Props<TTile = unknown> {
		engineId: string;
		tile: TileEngine.Tile<TTile>;
		index: number;
		columns: number;
		rowCount: number;
		gapPx: number;
		motion?: TileEngineMotion | TileEngineExternalMotion;
		dndEnabled: boolean;
		activeTileId: string | null;
		settleMotion(tileId: string, nonce?: number): void;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}
}

const TileEngineActor = memo(
	<TTile,>({
		engineId,
		tile,
		index,
		columns,
		rowCount,
		gapPx,
		motion,
		dndEnabled,
		activeTileId,
		settleMotion,
		renderTile,
	}: TileEngineActor.Props<TTile>) => {
		const ref = useRef<HTMLDivElement | null>(null);
		const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
			id: `${engineId}:tile:${tile.id}`,
			data: {
				kind: "tile-engine-tile",
				engineId,
				tileId: tile.id,
			} satisfies Record<string, unknown> as Data,
			disabled: !dndEnabled || tile.disabled,
		});
		const setRefs = useCallback(
			(node: HTMLDivElement | null) => {
				ref.current = node;
				setNodeRef(node);
			},
			[
				setNodeRef,
			],
		);
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

		return (
			<div
				ref={setRefs}
				data-tile-engine-tile-id={tile.id}
				data-tile-engine-slot-id={tile.slotId}
				{...attributes}
				{...listeners}
				className={cn(
					"pointer-events-auto absolute box-border origin-top-left touch-none will-change-transform",
					(tile.hidden || (dndEnabled && (isDragging || activeTileId === tile.id))) &&
						"pointer-events-none opacity-0",
					motion?.priority === "raised" && "pointer-events-auto",
				)}
				style={actorStyle({
					columns,
					rowCount,
					index,
					gapPx,
				})}
			>
				{renderTile({
					tile,
					isDragging: dndEnabled && isDragging,
				})}
			</div>
		);
	},
);

function TileEngineInner<TTile, TSlot>(
	{
		id,
		columns,
		slots,
		tiles,
		className,
		cellClassName,
		itemLayerClassName,
		gapPx = defaultGapPx,
		actions,
		renderSlot,
		renderTile,
		renderDragOverlay,
	}: TileEngine.Props<TTile, TSlot>,
	ref: React.ForwardedRef<TileEngine.Handle<TTile>>,
) {
	const [state, send] = useMachine(tileEngineMachine);
	const [activeTileId, setActiveTileId] = useState<string | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 2,
			},
		}),
	);
	const rowCount = Math.max(1, Math.ceil(slots.length / columns));
	const slotIndexById = useMemo(() => {
		const index = new Map<string, number>();
		for (const [slotIndex, slot] of slots.entries()) index.set(slot.id, slotIndex);
		return index;
	}, [
		slots,
	]);
	const slotById = useMemo(() => {
		const index = new Map<string, TileEngine.Slot<TSlot>>();
		for (const slot of slots) index.set(slot.id, slot);
		return index;
	}, [
		slots,
	]);
	const tileById = useMemo(() => {
		const index = new Map<string, TileEngine.Tile<TTile>>();
		for (const tile of tiles) index.set(tile.id, tile);
		return index;
	}, [
		tiles,
	]);
	const tileBySlotId = useMemo(() => {
		const index = new Map<string, TileEngine.Tile<TTile>>();
		for (const tile of tiles) index.set(tile.slotId, tile);
		return index;
	}, [
		tiles,
	]);
	const activeTile = activeTileId ? tileById.get(activeTileId) : undefined;

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
					await plan.commit(plan.entries);
					stage(plan.entries);
					await waitForMs(tileEngineMotionDurationMs);
					return;
				}

				const gapMs = plan.gapMs ?? 55;
				for (const entry of plan.entries) {
					await plan.commit([
						entry,
					]);
					stage([
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

	const handleDragStart = useCallback((event: DragStartEvent) => {
		const data = event.active.data.current as
			| {
					tileId?: string;
			  }
			| undefined;
		setActiveTileId(data?.tileId ?? null);
	}, []);
	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const activeData = event.active.data.current as
				| {
						tileId?: string;
				  }
				| undefined;
			const overData = event.over?.data.current as
				| {
						slotId?: string;
				  }
				| undefined;
			const tile = activeData?.tileId ? tileById.get(activeData.tileId) : undefined;
			const toSlot = overData?.slotId ? slotById.get(overData.slotId) : undefined;
			const fromSlot = tile ? slotById.get(tile.slotId) : undefined;

			if (!tile || !fromSlot || !toSlot) {
				setActiveTileId(null);
				return;
			}

			const dragRect = rectFromClientRect(
				event.active.rect.current.translated ??
					event.active.rect.current.initial ??
					new DOMRect(),
			);
			const targetTile = tileBySlotId.get(toSlot.id);
			const context: TileEngine.DropContext<TTile, TSlot> = {
				tile,
				fromSlot,
				toSlot,
				targetTile,
				dragRect,
			};
			const resolved = await actions?.resolveDrop?.(context);
			const plan =
				resolved ??
				(targetTile
					? {
							type: "swap" as const,
						}
					: {
							type: "move" as const,
						});

			if (plan.type === "ignore" || plan.type === "reject") {
				setActiveTileId(null);
				return;
			}

			const stageEntries: TileEngine.SpawnEntry<TTile>[] = [
				{
					tileId: tile.id,
					slotId: toSlot.id,
					from: dragRect,
					priority: "raised",
				},
			];

			if (plan.type === "swap" && targetTile) {
				const targetRect = querySlotRect(id, toSlot.id);
				if (targetRect) {
					stageEntries.push({
						tileId: targetTile.id,
						slotId: fromSlot.id,
						from: targetRect,
						priority: "raised",
					});
				}
			}

			if (plan.type === "move") await actions?.onMove?.(context);
			if (plan.type === "swap") await actions?.onSwap?.(context);
			if (plan.type === "remove") await actions?.onRemove?.(context);
			if (plan.type === "replace")
				await actions?.onReplace?.({
					...context,
					replaceTileId: plan.replaceTileId,
				});

			stage(stageEntries);
			await waitForMs(tileEngineMotionDurationMs);
			setActiveTileId(null);
		},
		[
			actions,
			slotById,
			stage,
			tileById,
			tileBySlotId,
		],
	);

	const content = (
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
				{slots.map((slot, index) =>
					actions ? (
						<div
							key={slot.id}
							className={cellClassName}
						>
							<TileEngineSlotSurface
								engineId={id}
								slot={slot}
								index={index}
								renderSlot={renderSlot}
							/>
						</div>
					) : (
						<React.Fragment key={slot.id}>
							{renderSlot({
								slot,
								index,
								isOver: false,
							})}
						</React.Fragment>
					),
				)}
			</div>
			<div className={cn("pointer-events-none absolute inset-0", itemLayerClassName)}>
				{tiles.map((tile) => {
					const index = slotIndexById.get(tile.slotId);
					if (index === undefined) return null;

					const motion = tile.motion ?? state.context.motions[tile.id];

					return (
						<TileEngineActor
							key={tile.id}
							engineId={id}
							tile={tile}
							index={index}
							columns={columns}
							rowCount={rowCount}
							gapPx={gapPx}
							motion={motion}
							dndEnabled={Boolean(actions)}
							activeTileId={activeTileId}
							settleMotion={settleMotion}
							renderTile={renderTile}
						/>
					);
				})}
			</div>
		</div>
	);

	if (!actions) return content;

	return (
		<DndContext
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setActiveTileId(null)}
		>
			{content}
			<DragOverlay
				adjustScale={false}
				dropAnimation={null}
			>
				{activeTile
					? (renderDragOverlay?.(activeTile) ??
						renderTile({
							tile: activeTile,
							isDragging: true,
						}))
					: null}
			</DragOverlay>
		</DndContext>
	);
}

export const TileEngine = memo(forwardRef(TileEngineInner)) as <TTile = unknown, TSlot = unknown>(
	props: TileEngine.Props<TTile, TSlot> & {
		ref?: React.Ref<TileEngine.Handle<TTile>>;
	},
) => ReactNode;
