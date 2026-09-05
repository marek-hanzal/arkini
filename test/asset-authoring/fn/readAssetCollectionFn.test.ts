import { describe, expect, it } from "vitest";

import { readAssetCollectionFn } from "~/asset-authoring/fn/readAssetCollectionFn";
import {
	editorTestConfig,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

describe("readAssetCollectionFn", () => {
	it("applies the canonical usage filter before fuzzy search", () => {
		const resources = [
			...editorTestPayload.resources,
			{
				bytes: new Uint8Array(),
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
