import {
	createAlternateTestPngBytes,
	createTestPngBytes,
} from "~/../test/serapack-support/fn/createTestPngBytes";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { TestSerapackPayload } from "~test/serapack-support/fx/testSerapackCodecFx";

export const editorTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "editor-test",
		title: "Editor test",
		board: {
			width: 2,
			height: 2,
		},
	},
	templates: [
		{
			uid: "initial",
			title: "Initial",
			width: 2,
			height: 2,
			board: [
				{
					itemUid: "water",
					x: 0,
					y: 0,
				},
			],
		},
	],
	start: {
		currentSpace: 0,
		spaces: [
			{
				space: 0,
				templateUid: "initial",
			},
		],
	},

	items: {
		water: {
			maxQueueSize: 1,
			lines: [],

			uid: "water",

			title: "Water",
			description: "Water",
			artwork: {
				scale: 0.8,
				default: [
					"item-water",
				],
			},
		},
	},
});

export const editorTestPayload: TestSerapackPayload = {
	version: "1.0",
	serakki: SerakkiAppVersion,
	config: editorTestConfig,
	resources: [
		{
			id: "hero",
			type: "image",
			bytes: createTestPngBytes(),
		},
		{
			id: "item-water",
			type: "artwork",
			bytes: createAlternateTestPngBytes(),
		},
	],
};

/** Renderer/repository projection of the same fixture's disk-backed PNG files. */
export const editorTestResources = editorTestPayload.resources.map(({ id, type, bytes }) => ({
	id,
	type,
	size: bytes.byteLength,
	version: "1",
}));
