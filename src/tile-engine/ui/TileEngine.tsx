import { useDraggable, useDroppable, type Data } from "@dnd-kit/core";
import { useMachine } from "@xstate/react";
import React, {
	memo,
	type CSSProperties,
	type FC,
	forwardRef,
	type HTMLAttributes,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
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
import { usePressActions } from "~/shared/hook/usePressActions";
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

	export interface DragBinding {
		id: Id;
		nodeId?: Id;
		data: Data;
		hidden?: boolean;
		disabled?: boolean;
		hideWhenActive?: boolean;
		delaySingleWhenDouble?: boolean;
		onSingleActivate?(): void;
		onDoubleActivate?(): void;
		onLongActivate?(): void;
	}

	export interface DropBinding {
		id: Id;
		nodeId?: Id;
		data: Data;
		disabled?: boolean;
	}

	export interface DragConfig<TTile = unknown, TSlot = unknown> {
		tile(tile: Tile<TTile>): DragBinding | undefined;
		slot(slot: Slot<TSlot>, targetTile: Tile<TTile> | undefined): DropBinding | undefined;
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
		drag?: DragConfig<TTile, TSlot>;
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

namespace TileEngineSlotSurface {
	export interface Props<TTile = unknown, TSlot = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		className?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
	}
}

const TileEngineSlotSurface = memo(
	<TTile, TSlot>({
		slot,
		index,
		targetTile,
		className,
		drag,
		renderSlot,
	}: TileEngineSlotSurface.Props<TTile, TSlot>) => {
		const binding = drag?.slot(slot, targetTile);
		const { setNodeRef, isOver } = useDroppable({
			id: binding?.id ?? `tile-engine-disabled-slot:${slot.id}`,
			data: binding?.data ?? ({} as Data),
			disabled: !binding || binding.disabled || slot.disabled,
		});

		return (
			<div
				ref={setNodeRef}
				data-drag-node-id={binding?.nodeId ?? binding?.id}
				data-tile-engine-slot-id={slot.id}
				className={className}
			>
				{renderSlot({
					slot,
					index,
					isOver: Boolean(binding && isOver),
				})}
			</div>
		);
	},
);

namespace TileEngineActor {
	export interface Props<TTile = unknown, TSlot = unknown> {
		tile: TileEngine.Tile<TTile>;
		index: number;
		columns: number;
		rowCount: number;
		gapPx: number;
		motion?: TileEngineMotion | TileEngineExternalMotion;
		drag?: TileEngine.DragConfig<TTile, TSlot>;
		settleMotion(tileId: string, nonce?: number): void;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}
}

const TileEngineActor = memo(
	<TTile, TSlot>({
		tile,
		index,
		columns,
		rowCount,
		gapPx,
		motion,
		drag,
		settleMotion,
		renderTile,
	}: TileEngineActor.Props<TTile, TSlot>) => {
		const binding = drag?.tile(tile);
		const ref = useRef<HTMLDivElement | null>(null);
		const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
			id: binding?.id ?? `tile-engine-disabled-tile:${tile.id}`,
			data: binding?.data ?? ({} as Data),
			disabled: !binding || binding.disabled || tile.disabled,
		});
		const press = usePressActions({
			onSingle: binding?.onSingleActivate,
			onDouble: binding?.onDoubleActivate,
			onLong: binding?.onLongActivate,
			delaySingleWhenDouble: binding?.delaySingleWhenDouble,
			isDisabled: !binding || binding.disabled || tile.disabled,
		});
		const pressProps = press.pressProps as HTMLAttributes<HTMLDivElement>;
		const setRefs = useCallback(
			(node: HTMLDivElement | null) => {
				ref.current = node;
				setNodeRef(node);
			},
			[
				setNodeRef,
			],
		);
		const handlePointerDown = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				pressProps.onPointerDown?.(event);
				listeners?.onPointerDown?.(event);
			},
			[
				listeners,
				pressProps,
			],
		);
		const handleKeyDown = useCallback(
			(event: ReactKeyboardEvent<HTMLDivElement>) => {
				pressProps.onKeyDown?.(event);
				listeners?.onKeyDown?.(event);
			},
			[
				listeners,
				pressProps,
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

		const hidden = Boolean(
			!motion &&
				(tile.hidden ||
					binding?.hidden ||
					(isDragging && binding?.hideWhenActive !== false)),
		);

		return (
			<div
				ref={setRefs}
				data-drag-node-id={binding?.nodeId ?? binding?.id}
				data-tile-engine-tile-id={tile.id}
				data-tile-engine-slot-id={tile.slotId}
				{...attributes}
				{...pressProps}
				className={cn(
					"pointer-events-auto absolute box-border origin-top-left touch-none will-change-transform",
					hidden && "pointer-events-none opacity-0",
				)}
				style={actorStyle({
					columns,
					rowCount,
					index,
					gapPx,
				})}
				onKeyDown={handleKeyDown}
				onPointerDown={handlePointerDown}
			>
				{renderTile({
					tile,
					isDragging,
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
		drag,
		renderSlot,
		renderTile,
	}: TileEngine.Props<TTile, TSlot>,
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

export const TileEngine = memo(forwardRef(TileEngineInner)) as <TTile = unknown, TSlot = unknown>(
	props: TileEngine.Props<TTile, TSlot> & {
		ref?: React.Ref<TileEngine.Handle<TTile>>;
	},
) => ReactNode;
