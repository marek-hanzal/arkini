import { describe, expect, it } from "vitest";

import { readArtworkCollectionFn } from "~/artwork-authoring/fn/readArtworkCollectionFn";
import {
	editorTestResources,
	editorTestConfig,
} from "~test/project-authoring/support/editorTestPayload";

describe("readArtworkCollectionFn", () => {
	it("applies the canonical usage filter before fuzzy search", () => {
		const resources = [
			...editorTestResources,
			{
				size: 0,
				version: "1",
				uid: "forge-image",
				title: "forge-image",
				type: "artwork" as const,
			},
		];

		expect(
			readArtworkCollectionFn({
				config: editorTestConfig,
				filter: "unused",
				query: "frge",
				resources,
			}).map(({ uid }) => uid),
		).toEqual([
			"forge-image",
		]);
		expect(
			readArtworkCollectionFn({
				config: editorTestConfig,
				filter: "unused",
				query: "hero",
				resources,
			}),
		).toEqual([]);
	});
});
