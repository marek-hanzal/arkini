import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardCell, readBoardCellBackgroundClassName } from "~/board/BoardCell";

describe("BoardCell", () => {
	it("alternates subtle background colors without using root opacity", () => {
		const first = readBoardCellBackgroundClassName({
			key: "0:0",
			x: 0,
			y: 0,
		});
		const next = readBoardCellBackgroundClassName({
			key: "1:0",
			x: 1,
			y: 0,
		});

		expect(first).not.toBe(next);
		expect(first).toContain("rgba");
		expect(next).toContain("rgba");
		expect(first).not.toContain("opacity");
		expect(next).not.toContain("opacity");
	});

	it("renders the chessboard tone on the cell background, not as wrapper opacity", () => {
		const html = renderToStaticMarkup(
			<BoardCell
				cell={{
					key: "1:0",
					x: 1,
					y: 0,
				}}
				invalid={false}
			/>,
		);

		expect(html).toContain("bg-[rgba(255,229,247,0.46)]");
		expect(html).toContain('data-ui="board cell"');
		expect(html).not.toContain('data-ui="board cell" class="opacity-');
	});
});
