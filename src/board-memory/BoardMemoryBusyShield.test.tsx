import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardMemoryBusyShield } from "~/board-memory/BoardMemoryBusyShield";

const operation = {
	boardItemId: "board-item:memory",
	readyAtMs: 1_900,
	startedAtMs: 1_000,
	type: "restore",
} as const;

describe("BoardMemoryBusyShield", () => {
	it("renders an animatable hidden start state before the browser fades it in", () => {
		const html = renderToStaticMarkup(<BoardMemoryBusyShield operation={operation} />);

		expect(html).toContain('data-ui="board memory busy shield"');
		expect(html).toContain('data-state="hidden"');
		expect(html).toContain("transition-[opacity,backdrop-filter,background-color]");
		expect(html).toContain("bg-[#10051a]/0");
		expect(html).toContain("opacity-0");
		expect(html).toContain("pointer-events-auto");
	});

	it("stays absent while memory is idle", () => {
		const html = renderToStaticMarkup(<BoardMemoryBusyShield operation={undefined} />);

		expect(html).toBe("");
	});
});
