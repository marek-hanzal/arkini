import type { CSSProperties } from "react";

import type { useBoard } from "~/bridge/board/useBoard";
import { useTile } from "~/ui/tile/useTile";

export namespace BoardTile {
	export interface Props {
		item: useBoard.Item;
	}
}

/** Renders one board-specific tile while delegating shared interaction state to useTile. */
export const BoardTile = ({ item }: BoardTile.Props) => {
	const tile = useTile({
		id: item.id,
		revision: item.revision,
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
					: "border-line-strong/60 hover:border-line-strong"
			}`}
			style={style}
			aria-label={item.title}
			data-ui="BoardTile"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
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
