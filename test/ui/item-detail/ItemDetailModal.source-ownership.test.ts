// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { renderSourceDetail } from "./ItemDetailModal.source-ownership.test/fixture";

describe("ItemDetailModal source ownership", () => {
	it("falls back from Sources when the last owned source disappears", async () => {
		const detail = await renderSourceDetail();
		expect(detail.openItemDetail).not.toHaveBeenCalled();

		await detail.dropSources();

		expect(detail.openItemDetail).toHaveBeenCalledWith({
			itemId: "runtime:item",
		});
	});
});
