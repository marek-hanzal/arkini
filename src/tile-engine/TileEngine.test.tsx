import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TileEngine } from "~/tile-engine/TileEngine";

describe("TileEngine", () => {
	it("applies root chrome classes separately from the grid classes", () => {
		const html = renderToStaticMarkup(
			<TileEngine
				id="test"
				columns={1}
				slots={[]}
				tiles={[]}
				rootClassName="rounded-test p-2"
				className="grid-test"
				renderSlot={() => null}
				renderTile={() => null}
			/>,
		);

		expect(html).toContain('data-ui="tile engine"');
		expect(html).toContain("rounded-test");
		expect(html).toContain("p-2");
		expect(html).toContain('data-ui="tile engine grid"');
		expect(html).toContain("grid-test");
	});
});
