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
			className={`relative isolate m-1 touch-none overflow-hidden rounded-[22%] border bg-slate-800/95 shadow-lg transition-[transform,border-color,filter] duration-100 ${
				tile.pressed
					? "scale-95 border-amber-300 brightness-110"
					: "border-white/15 hover:border-white/35"
			}`}
			style={style}
			aria-label={item.title}
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
			<span className="absolute inset-x-1 bottom-1 truncate rounded-md bg-slate-950/70 px-1 py-0.5 text-[0.55rem] font-medium text-white backdrop-blur-sm">
				{item.title}
			</span>
			{item.quantity > 1 ? (
				<span className="absolute right-1 top-1 min-w-5 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[0.65rem] font-bold text-white shadow">
					{item.quantity}
				</span>
			) : null}
		</button>
	);
};
