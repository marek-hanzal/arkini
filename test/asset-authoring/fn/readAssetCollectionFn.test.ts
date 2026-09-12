import { describe, expect, it } from "vitest";

import { readAssetCollectionFn } from "~/asset-authoring/fn/readAssetCollectionFn";
import {
	editorTestResources,
	editorTestConfig,
} from "~test/project-authoring/support/editorTestPayload";

describe("readAssetCollectionFn", () => {
	it("applies the canonical usage filter before fuzzy search", () => {
		const resources = [
			...editorTestResources,
			{
				size: 0,
				version: "1",
				id: "forge-image",
				mime: "image/png" as const,
			},
		];

		expect(
			readAssetCollectionFn({
				config: editorTestConfig,
				filter: "unused",
				query: "frge",
				resources,
			}).map(({ id }) => id),
		).toEqual([
			"forge-image",
		]);
		expect(
			readAssetCollectionFn({
				config: editorTestConfig,
				filter: "unused",
				query: "hero",
				resources,
			}),
		).toEqual([]);
	});
});
