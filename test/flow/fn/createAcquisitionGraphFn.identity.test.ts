import { Effect } from "effect";
import { expect, it } from "vitest";

import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";

it.each([
	[
		[
			"a",
			"b:line:c",
		],
		[
			"a:line:b",
			"c",
		],
	],
	[
		[
			"a",
			"b:c",
		],
		[
			"a:b",
			"c",
		],
	],
] as const)(
	"keeps distinct authored operations and their acquisition routes when IDs contain separators: %j",
	async (first, second) => {
		const owners = [
			first,
			second,
		];
		const compiled = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						product: createSimpleItem("product"),
						...Object.fromEntries(
							owners.map(([id, lineId]) => [
								id,
								createProducerItem({
									id,
									lines: [
										createLine({
											id: lineId,
											outcome: createOutput([
												{
													itemId: "product",
												},
											]),
										}),
									],
								}),
							]),
						),
					},
				}),
			]),
		);
		expect(compiled.diagnostics).toEqual([]);
		if (compiled.config === undefined) throw new Error("Expected valid authored identifiers.");
		const graph = createAcquisitionGraphFn(compiled.config);
		const sources = readItemOriginSourcesFn(graph);
		expect(sources.map((source) => source.ownerItemId).sort()).toEqual(
			owners.map(([id]) => id).sort(),
		);
		expect(
			new Set(sources.flatMap((source) => source.outputs.map((output) => output.routeId)))
				.size,
		).toBe(2);
	},
);
