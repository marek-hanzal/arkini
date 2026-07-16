import type { CSSProperties } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import { BoardTile } from "~/ui/board/BoardTile";

/** Renders the current board directly from the bridge's live runtime projection. */
export const Board = () => {
	const board = useBoard();
	const cells = Array.from(
		{
			length: board.width * board.height,
		},
		(_, index) => index,
	);
	const gridStyle = {
		aspectRatio: `${board.width} / ${board.height}`,
		gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
		gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
	} satisfies CSSProperties;

	return (
		<section
			className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4"
			data-ui="Board"
		>
			<header className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
					Arkini
				</p>
				<h1 className="mt-1 text-xl font-semibold text-white">
					Board space {board.currentSpace}
				</h1>
			</header>
			<div
				className="grid w-[min(94vw,36rem)] rounded-3xl border border-white/10 bg-slate-900/70 p-1 shadow-2xl"
				style={gridStyle}
			>
				{cells.map((cell) => (
					<div
						key={cell}
						className="m-1 rounded-[22%] border border-white/5 bg-white/[0.035]"
						aria-hidden="true"
					/>
				))}
				{board.items.map((item) => (
					<BoardTile
						key={item.id}
						item={item}
					/>
				))}
			</div>
		</section>
	);
};
