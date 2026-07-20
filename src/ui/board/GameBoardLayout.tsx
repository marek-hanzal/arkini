import type { CSSProperties } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { Board } from "~/ui/board/Board";
import { Toolbar } from "~/ui/toolbar/Toolbar";

type GameBoardLayoutStyle = CSSProperties & {
	readonly "--game-board-columns": number;
	readonly "--game-board-width-from-height": string;
	readonly "--game-board-height-from-width": string;
	readonly gridTemplateRows: string;
};

/** Fits the active Board and optional one-row Toolbar into one Canvas-local tile scene. */
export const GameBoardLayout = () => {
	const game = useGameEngine();
	const board = game.config.meta.board;
	const toolbarEnabled = (game.config.meta.toolbarSize ?? 0) > 0;
	const rows = board.height + (toolbarEnabled ? 1 : 0);
	const style = {
		"--game-board-columns": board.width,
		"--game-board-width-from-height": `${(board.width / rows) * 100}cqh`,
		"--game-board-height-from-width": `${(rows / board.width) * 100}cqw`,
		gridTemplateRows: toolbarEnabled
			? `minmax(0, ${board.height}fr) minmax(0, 1fr)`
			: "minmax(0, 1fr)",
	} satisfies GameBoardLayoutStyle;

	return (
		<div
			className="size-full min-h-0 min-w-0"
			data-ui="GameBoardLayout"
		>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="GameBoardViewport"
			>
				<div
					className="grid min-h-0 min-w-0"
					data-ui="GameBoardStack"
					data-toolbar-enabled={toolbarEnabled ? "true" : "false"}
					style={style}
				>
					<Board />
					<Toolbar />
				</div>
			</div>
		</div>
	);
};
