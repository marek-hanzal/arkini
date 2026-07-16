import { describe, expect, it, vi } from "vitest";
import { preventNativeTileEngineContextMenu } from "~/tile-engine/preventNativeTileEngineContextMenu";

describe("preventNativeTileEngineContextMenu", () => {
	it("prevents native context menus on tile-engine surfaces", () => {
		const preventDefault = vi.fn();

		preventNativeTileEngineContextMenu({
			preventDefault,
		});

		expect(preventDefault).toHaveBeenCalledTimes(1);
	});
});
