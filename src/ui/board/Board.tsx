import { type CSSProperties, useMemo } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import { BoardCell } from "~/ui/board/BoardCell";
import { BoardTile } from "~/ui/board/BoardTile";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSurface } from "~/ui/tile/useTileSurface";

type BoardFrameStyle = CSSProperties & {
	readonly "--board-width-from-height": string;
	readonly "--board-height-from-width": string;
};

type BoardGridStyle = CSSProperties;

/** Renders the current board directly from the bridge's live runtime projection. */
export const Board = () => {
	const board = useBoard();
	const surface = useMemo(
		() =>
			({
				id: `board:${board.currentSpace}`,
				kind: "board",
				space: board.currentSpace,
			}) satisfies Extract<
				TileSurface,
				{
					readonly kind: "board";
				}
			>,
		[
			board.currentSpace,
		],
	);
	const surfaceRef = useTileSurface(surface);
	// Runtime tiles occupy explicit grid cells, so backing cells must overlap them explicitly
	// rather than auto-flowing around them into implicit rows.
	const cells = Array.from(
		{
			length: board.width * board.height,
		},
		(_, index) => ({
			index,
			x: index % board.width,
			y: Math.floor(index / board.width),
		}),
	);
	const occupants = new Map(
		board.items.map(
			(item) =>
				[
					`${item.x}:${item.y}`,
					item,
				] as const,
		),
	);
	const frameStyle = {
		aspectRatio: `${board.width} / ${board.height}`,
		"--board-width-from-height": `${(board.width / board.height) * 100}cqh`,
		"--board-height-from-width": `${(board.height / board.width) * 100}cqw`,
	} satisfies BoardFrameStyle;
	const gridStyle = {
		gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
		gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
	} satisfies BoardGridStyle;

	return (
		<section
			className="size-full min-h-0 min-w-0"
			data-ui="Board"
			style={{
				viewTransitionName: gameBoardViewTransitionName,
			}}
		>
			<h1 className="sr-only">
				{board.title}, board space {board.currentSpace}
			</h1>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="BoardViewport"
			>
				<div
					className="rounded-[clamp(0.75rem,2.5vmin,1.75rem)] border border-line bg-surface/75"
					data-ui="BoardFrame"
					style={frameStyle}
				>
					<div
						ref={surfaceRef}
						className="grid size-full overflow-hidden rounded-[inherit]"
						data-ui="BoardGrid"
						data-tile-surface="board"
						data-tile-surface-id={surface.id}
						style={gridStyle}
					>
						{cells.map((cell) => (
							<BoardCell
								key={cell.index}
								surface={surface}
								x={cell.x}
								y={cell.y}
								occupant={occupants.get(`${cell.x}:${cell.y}`) ?? null}
							/>
						))}
						{board.items.map((item) => (
							<BoardTile
								key={item.id}
								item={item}
								surface={surface}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
