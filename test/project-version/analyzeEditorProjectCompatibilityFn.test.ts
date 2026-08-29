import { describe, expect, it } from "vitest";

import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import type { EditorProjectCompatibility } from "~/project-version/EditorProjectCompatibility";
import { TemporarySchema } from "~/item-definition/schema/TemporarySchema";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config/validation/support/gameValidationTestSource";

const analyze = (
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
): EditorProjectCompatibility => analyzeEditorProjectCompatibilityFn(previous, next);

const withProducer = () => {
	const producer = createProducerItem({
		id: "producer",
		lines: [
			createLine({
				id: "line:first",
			}),
			createLine({
				id: "line:second",
			}),
		],
	});
	return GameConfigSchema.parse({
		...editorTestConfig,
		items: {
			...editorTestConfig.items,
			producer,
		},
	});
};

describe("analyzeEditorProjectCompatibilityFn", () => {
	it("reports every explicitly whitelisted copy and timing change as minor", () => {
		const previous = withProducer();
		const producer = previous.items.producer;
		if (producer?.type !== "producer") throw new Error("Missing producer fixture.");
		const next = GameConfigSchema.parse({
			...previous,
			meta: {
				...previous.meta,
				title: "Renamed game",
			},
			items: {
				...previous.items,
				producer: {
					...producer,
					title: "Renamed producer",
					description: "Rewritten producer",
					lines: producer.lines.map((line, index) =>
						index === 0
							? {
									...line,
									title: "Renamed line",
									description: "Rewritten line",
									runtimeMs: 500,
								}
							: line,
					),
				},
			},
		});

		const compatibility = analyze(previous, next);

		expect(compatibility.result).toBe("minor");
		expect(compatibility.context.map(({ rule }) => rule)).toEqual([
			"game-title",
			"item-description",
			"item-title",
			"line-description",
			"line-runtime",
			"line-title",
		]);
		expect(compatibility.context.at(3)?.path).toEqual([
			"items",
			"producer",
			"lines",
			"line:first",
			"description",
		]);
	});

	it("keeps Temporary lifetime changes minor in either direction", () => {
		const temporary = TemporarySchema.parse({
			...createSimpleItem("temporary"),
			type: "temporary",
			scope: "board",
			maxStackSize: 1,
			durationMs: 2_000,
		});
		const previous = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				temporary,
			},
		});
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				temporary: {
					...temporary,
					durationMs: 1_000,
				},
			},
		});

		expect(analyze(previous, next)).toMatchObject({
			result: "minor",
			context: [
				{
					path: [
						"items",
						"temporary",
						"durationMs",
					],
					result: "minor",
					rule: "temporary-duration",
				},
			],
		});
	});

	it("allows surfaces to grow but marks shrinking persisted locations major", () => {
		const grown = GameConfigSchema.parse({
			...editorTestConfig,
			meta: {
				...editorTestConfig.meta,
				board: {
					width: 3,
					height: 2,
				},
				inventory: {
					width: 1,
					height: 2,
				},
				toolbarSize: 1,
			},
		});

		expect(analyze(editorTestConfig, grown).context).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					result: "minor",
					rule: "surface-grown",
				}),
			]),
		);
		const shrunk = analyze(grown, editorTestConfig);
		expect(shrunk.result).toBe("major");
		expect(shrunk.context).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					result: "major",
					rule: "surface-shrunk",
				}),
			]),
		);
	});

	it("defaults unlisted gameplay changes to major and retains mixed context", () => {
		const charged = GameConfigSchema.parse({
			...editorTestConfig,
			meta: {
				...editorTestConfig.meta,
				title: "Renamed game",
			},
			items: {
				water: {
					...editorTestConfig.items.water,
					charges: {
						amount: 3,
					},
				},
			},
		});

		const compatibility = analyze(editorTestConfig, charged);

		expect(compatibility.result).toBe("major");
		expect(compatibility.context).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					result: "minor",
					rule: "game-title",
				}),
				expect.objectContaining({
					path: [
						"items",
						"water",
						"charges",
					],
					result: "major",
					rule: "unclassified-change",
				}),
			]),
		);
	});
});
