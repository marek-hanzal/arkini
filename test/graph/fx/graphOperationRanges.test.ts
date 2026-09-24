import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { configFn, itemFn, lineFn } from "../fn/compileGraphFactsFn.test/fixtures";
import { projectFn } from "./createProjectGraphFx.test/fixtures";

it("applies inclusive and exclusive bounds at 30 to every numeric operation filter", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = {
		...projectFn([]),
		config: configFn(
			Object.fromEntries(
				[
					29,
					30,
					31,
				].map((value) => [
					String(value),
					itemFn(String(value), {
						clock: {
							intervalMs: value * 1000,
							durationMs: value * 1000,
						},
						lines: [
							lineFn(`line-${value}`, {
								runtimeMs: value * 1000,
								clock: true,
								clockWeight: value,
							}),
						],
					}),
				]),
			),
		),
	};
	for (const field of [
		"runtimeSeconds",
		"durationSeconds",
		"intervalSeconds",
		"clockWeight",
	]) {
		for (const [bounds, expected] of [
			[
				{
					gte: 30,
				},
				[
					"item:30",
					"item:31",
				],
			],
			[
				{
					gt: 30,
				},
				[
					"item:31",
				],
			],
			[
				{
					lte: 30,
				},
				[
					"item:29",
					"item:30",
				],
			],
			[
				{
					lt: 30,
				},
				[
					"item:29",
				],
			],
			[
				{
					gte: 30,
					lte: 30,
				},
				[
					"item:30",
				],
			],
		] as const) {
			const result = await Effect.runPromise(
				graph.discoveryFx(project, {
					kind: "operations",
					filter: {
						[field]: bounds,
					},
				}),
			);
			expect(
				result.operations.map((operation) => operation.owner).sort(),
				`${field} ${JSON.stringify(bounds)}`,
			).toEqual(expected);
		}
	}
});
