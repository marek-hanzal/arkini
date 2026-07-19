import { type CSSProperties, useCallback, useMemo } from "react";

import type { useBoard } from "~/bridge/board/useBoard";
import { useMoveBoardItem } from "~/bridge/board/useMoveBoardItem";
import type { TileDropIntent } from "~/ui/tile/TileDropIntent";
import type { TileDropOutcome } from "~/ui/tile/TileDropOutcome";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTile } from "~/ui/tile/useTile";

export namespace BoardTile {
	export interface Props {
		readonly item: useBoard.Item;
		readonly surface: Extract<
			TileSurface,
			{
				readonly kind: "board";
			}
		>;
	}
}

/** Renders one Board tile and adapts universal drop facts to the atomic move command. */
export const BoardTile = ({ item, surface }: BoardTile.Props) => {
	const moveItem = useMoveBoardItem();
	const source = useMemo(
		() => ({
			id: item.id,
			revision: item.revision,
			surface,
			slot: {
				id: `${item.x}:${item.y}`,
				x: item.x,
				y: item.y,
			},
		}),
		[
			item.id,
			item.revision,
			item.x,
			item.y,
			surface,
		],
	);
	const onDrop = useCallback(
		async (intent: TileDropIntent): Promise<TileDropOutcome> => {
			const target = intent.target;
			if (
				target.kind !== "slot" ||
				target.surface.kind !== "board" ||
				target.surface.id !== surface.id ||
				target.occupant !== null
			) {
				return {
					kind: "rejected",
				};
			}
			if (target.slot.id === intent.source.slot.id) {
				return {
					kind: "ignored",
				};
			}

			try {
				await moveItem({
					itemId: item.id,
					revision: item.revision,
					space: target.surface.space,
					x: target.slot.x,
					y: target.slot.y,
				});
				return {
					kind: "accepted",
				};
			} catch {
				return {
					kind: "rejected",
				};
			}
		},
		[
			item.id,
			item.revision,
			moveItem,
			surface.id,
		],
	);
	const tile = useTile({
		source,
		onDrop,
	});
	const style = {
		gridColumnStart: item.x + 1,
		gridRowStart: item.y + 1,
	} satisfies CSSProperties;

	return (
		<button
			ref={tile.ref}
			type="button"
			className={`relative isolate min-h-0 min-w-0 touch-none overflow-hidden rounded-[22%] border bg-surface-raised/95 shadow-lg transition-[transform,border-color,filter] duration-100 ${
				tile.pressed
					? "scale-95 border-accent brightness-110"
					: tile.dragging
						? "border-accent"
						: "border-line-strong/60 hover:border-line-strong"
			}`}
			style={style}
			aria-label={item.title}
			data-ui="BoardTile"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
			data-board-x={item.x}
			data-board-y={item.y}
			data-dragging={tile.dragging ? "true" : "false"}
			{...tile.pointerProps}
		>
			<img
				className="absolute inset-0 size-full object-cover"
				src={item.sourceUrl}
				alt=""
				draggable={false}
			/>
			{item.compositeUrl === undefined ? null : (
				<img
					className="absolute inset-0 size-full object-cover"
					src={item.compositeUrl}
					alt=""
					draggable={false}
				/>
			)}
			<span
				className="absolute inset-x-[6%] bottom-[6%] truncate rounded-md bg-overlay/75 px-[6%] py-[2%] font-medium text-overlay-foreground backdrop-blur-sm"
				data-ui="BoardTileTitle"
			>
				{item.title}
			</span>
			{item.quantity > 1 ? (
				<span
					className="absolute right-[6%] top-[6%] rounded-full bg-overlay/85 px-[8%] py-[2%] font-bold text-overlay-foreground shadow"
					data-ui="BoardTileQuantity"
				>
					{item.quantity}
				</span>
			) : null}
		</button>
	);
};
