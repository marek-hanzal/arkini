import type { CSSProperties } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import { BoardTile } from "~/ui/board/BoardTile";

type BoardGridStyle = CSSProperties & {
	readonly "--board-width-from-height": string;
	readonly "--board-height-from-width": string;
};

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
		"--board-width-from-height": `${(board.width / board.height) * 100}cqh`,
		"--board-height-from-width": `${(board.height / board.width) * 100}cqw`,
	} satisfies BoardGridStyle;

	return (
		<section
			className="size-full min-h-0 min-w-0 overflow-hidden p-[clamp(0.25rem,1.5vmin,1rem)]"
			data-ui="Board"
		>
			<h1 className="sr-only">
				{board.title}, board space {board.currentSpace}
			</h1>
			<div
				className="size-full min-h-0 min-w-0 overflow-hidden"
				data-ui="BoardViewport"
			>
				<div
					className="grid overflow-hidden rounded-[clamp(0.75rem,2.5vmin,1.75rem)] border border-line bg-surface/75 shadow-2xl"
					data-ui="BoardGrid"
					style={gridStyle}
				>
					{cells.map((cell) => (
						<div
							key={cell}
							className="min-h-0 min-w-0 rounded-[22%] border border-line/60 bg-surface-raised/45"
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
			</div>
		</section>
	);
};
