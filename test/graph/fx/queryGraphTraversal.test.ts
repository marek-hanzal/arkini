import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";

it("bounds chains at depths 1/2/3 while retaining cycles and stable ordering", async () => {
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"B",
			"C",
		],
		[
			"C",
			"A",
		],
		[
			"C",
			"D",
		],
		[
			"D",
			"D",
		],
	]);
	const graph = await Effect.runPromise(createProjectGraphFx());
	for (const [maxDepth, expected] of [
		[
			1,
			[
				"item:A",
				"item:B",
			],
		],
		[
			2,
			[
				"item:A",
				"item:B",
				"item:C",
			],
		],
		[
			3,
			[
				"item:A",
				"item:B",
				"item:C",
				"item:D",
			],
		],
	] as const) {
		const query = {
			kind: "traverse",
			from: "item:A",
			maxDepth,
		};
		const result = await Effect.runPromise(graph.queryFx(project, query));
		expect(result.nodes.map((node) => node.id)).toEqual(expected);
		expect(await Effect.runPromise(graph.queryFx(project, query))).toEqual(result);
	}
	const complete = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "traverse",
			from: "item:A",
			maxDepth: 12,
		}),
	);
	expect(complete.edges).toHaveLength(5);
	expect(complete.truncated).toBe(false);
});
it("returns every simple path with its own operation rather than losing diamond alternatives", async () => {
	const project = projectFn(
		[
			[
				"A",
				"B",
			],
			[
				"A",
				"C",
			],
			[
				"B",
				"D",
			],
			[
				"C",
				"D",
			],
			[
				"D",
				"A",
			],
		],
		[
			"Z",
		],
	);
	const graph = await Effect.runPromise(createProjectGraphFx());
	const query = {
		kind: "path",
		from: "item:A",
		to: "item:D",
	};
	const result = await Effect.runPromise(graph.queryFx(project, query));
	expect(result.paths.map((path) => path.nodes)).toEqual([
		[
			"item:A",
			"item:B",
			"item:D",
		],
		[
			"item:A",
			"item:C",
			"item:D",
		],
	]);
	expect(result.operations).toHaveLength(4);
	expect(result.status).toBe("yes");
	const limited = await Effect.runPromise(
		graph.queryFx(project, {
			...query,
			limit: 1,
		}),
	);
	expect(limited.status).toBe("yes");
	expect(limited.reasons).toContain("limit");
	const compact = await Effect.runPromise(
		graph.queryFx(project, {
			...query,
			detail: "summary",
		}),
	);
	expect(compact.status).toBe("yes");
	expect(compact.paths).toEqual([]);
	const absent = await Effect.runPromise(
		graph.queryFx(project, {
			...query,
			to: "item:Z",
			maxDepth: 12,
		}),
	);
	expect(absent.status).toBe("no");
	expect(absent.truncated).toBe(false);
});
it("never reports absence after a depth/expansion budget cut and distinguishes a complete negative", async () => {
	const project = projectFn(
		[
			[
				"A",
				"B",
			],
			[
				"B",
				"C",
			],
			[
				"C",
				"D",
			],
		],
		[
			"Z",
		],
	);
	const graph = await Effect.runPromise(createProjectGraphFx());
	for (const limits of [
		{
			maxDepth: 1,
		},
		{
			maxExpansions: 1,
		},
	]) {
		const result = await Effect.runPromise(
			graph.queryFx(project, {
				kind: "path",
				from: "item:A",
				to: "item:D",
				...limits,
			}),
		);
		expect(result.status).toBe("unknown");
		expect(result.truncated).toBe(true);
	}
	expect(
		(
			await Effect.runPromise(
				graph.queryFx(project, {
					kind: "path",
					from: "item:A",
					to: "item:Z",
					maxDepth: 3,
				}),
			)
		).status,
	).toBe("no");
});
it("keeps shared templates, receiver transport and disconnected spaces distinct", async () => {
	const project = projectFn(
		[],
		[
			"portal",
			"B",
			"C",
		],
	);
	project.config.templates = [
		{
			uid: "first",
			title: "First",
			width: 2,
			height: 1,
			board: [
				{
					x: 0,
					y: 0,
					itemUid: "portal",
				},
			],
		},
		{
			uid: "second",
			title: "Second",
			width: 2,
			height: 1,
			board: [
				{
					x: 0,
					y: 0,
					itemUid: "B",
				},
			],
		},
		{
			uid: "isolated",
			title: "Isolated",
			width: 2,
			height: 1,
			board: [
				{
					x: 0,
					y: 0,
					itemUid: "C",
				},
			],
		},
	];
	project.config.start.spaces = [
		{
			space: 0,
			templateUid: "first",
		},
		{
			space: 7,
			templateUid: "second",
		},
		{
			space: 8,
			templateUid: "isolated",
		},
	];
	project.config.items.portal.merge = [
		{
			action: "space",
			space: 7,
			effect: "keep",
		},
	];
	const graph = await Effect.runPromise(createProjectGraphFx());
	const connected = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "path",
			from: "space:0",
			to: "item:B",
			maxDepth: 6,
		}),
	);
	expect(connected.paths[0].nodes).toEqual([
		"space:0",
		"template:first",
		"item:portal",
		"space:7",
		"template:second",
		"item:B",
	]);
	expect(connected.operations[0]).toMatchObject({
		kind: "merge",
		owner: "item:portal",
		data: {
			action: "space",
		},
	});
	expect(
		(
			await Effect.runPromise(
				graph.queryFx(project, {
					kind: "path",
					from: "space:0",
					to: "item:C",
					maxDepth: 12,
				}),
			)
		).status,
	).toBe("no");
	expect(
		(
			await Effect.runPromise(
				graph.queryFx(project, {
					kind: "path",
					from: "start",
					to: "item:C",
					maxDepth: 12,
				}),
			)
		).status,
	).toBe("yes");
});
