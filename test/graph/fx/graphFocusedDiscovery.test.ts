import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import { configFn, itemFn } from "../fn/compileGraphFactsFn.test/fixtures";

it("searches canonical node names and identities across kinds and rebuilds after same-revision edits", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = {
		...projectFn([]),
		config: configFn(
			{
				A: itemFn("A", {
					title: "Candle",
				}),
				B: itemFn("B", {
					title: "Candle Wick",
				}),
			},
			{
				templates: [
					{
						uid: "farmland",
						title: "Farmland",
						width: 4,
						height: 2,
						board: [],
					},
				],
				start: {
					currentSpace: 0,
					spaces: [
						{
							space: 0,
							templateUid: "farmland",
						},
					],
				},
			},
		),
	};
	const candle = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "Candle",
			limit: 1,
		}),
	);
	expect(candle.nodes).toEqual([
		{
			id: "item:A",
			kind: "item",
			title: "Candle",
		},
	]);
	expect(candle.truncated).toBe(true);
	for (const [query, kind, id] of [
		[
			"item:B",
			"item",
			"item:B",
		],
		[
			"Farmland",
			"template",
			"template:farmland",
		],
		[
			"space:0",
			"space",
			"space:0",
		],
		[
			"start",
			"start",
			"start",
		],
	]) {
		const result = await Effect.runPromise(
			graph.discoveryFx(project, {
				kind: "search",
				query,
				nodeKinds: [
					kind,
				],
			}),
		);
		expect(result.nodes[0].id).toBe(id);
		expect(result.operations).toEqual([]);
	}
	const wrongKind = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "Candle",
			nodeKinds: [
				"template",
			],
		}),
	);
	expect(wrongKind.status).toBe("no");
	project.config.items.A.title = "Lantern";
	const refreshed = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: "Lantern",
		}),
	);
	expect(refreshed.nodes[0].id).toBe("item:A");
	expect(refreshed.snapshotId).not.toBe(candle.snapshotId);
});

it("pages direct occurrences without duplicates and binds connections cursors to scope and snapshot", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"A",
		],
		[
			"A",
			"B",
		],
		[
			"A",
			"C",
		],
	]);
	const query = {
		kind: "connections",
		from: "item:A",
		direction: "both",
		kinds: [
			"merge-target",
		],
		limit: 1,
	};
	const complete = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			limit: 50,
		}),
	);
	const first = await Effect.runPromise(graph.discoveryFx(project, query));
	const ids = first.edges.map((edge) => edge.id);
	let cursor = first.nextCursor;
	while (cursor !== undefined) {
		const page = await Effect.runPromise(
			graph.discoveryFx(project, {
				...query,
				revision: first.revision,
				snapshotId: first.snapshotId,
				cursor,
			}),
		);
		ids.push(...page.edges.map((edge) => edge.id));
		cursor = page.nextCursor;
	}
	expect(ids).toEqual(complete.edges.map((edge) => edge.id));
	expect(ids).toHaveLength(3);
	expect(new Set(ids).size).toBe(3);
	for (const changed of [
		{
			...query,
			direction: "in",
		},
		{
			...query,
			to: "item:B",
		},
		{
			kind: "operations",
		},
	]) {
		const error = await Effect.runPromise(
			graph
				.discoveryFx(project, {
					...changed,
					cursor: first.nextCursor,
				})
				.pipe(Effect.flip),
		);
		expect(error.reason).toBe("invalid-query");
	}
	const bounded = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			limit: 50,
			maxExpansions: 1,
		}),
	);
	expect(bounded.reasons).toContain("expansions");
	expect(bounded.nextCursor).toBeDefined();
	const counterpart = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			to: "item:B",
		}),
	);
	expect(counterpart.edges.map((edge) => edge.to)).toEqual([
		"item:B",
	]);
	expect(counterpart.truncated).toBe(false);
	const revised = {
		...project,
		revision: project.revision + 1,
	};
	expect(
		(
			await Effect.runPromise(
				graph
					.discoveryFx(revised, {
						...query,
						cursor: first.nextCursor,
					})
					.pipe(Effect.flip),
			)
		).reason,
	).toBe("stale-revision");
});

it("requires explicit edge scope for deep discovery without restricting the internal Editor traversal", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"B",
			"C",
		],
	]);
	const query = {
		kind: "traverse",
		from: "item:A",
		maxDepth: 2,
	};
	expect(
		(await Effect.runPromise(graph.discoveryFx(project, query).pipe(Effect.flip))).reason,
	).toBe("invalid-query");
	expect((await Effect.runPromise(graph.queryFx(project, query))).status).toBe("yes");
	expect(
		(
			await Effect.runPromise(
				graph.discoveryFx(project, {
					...query,
					kinds: [
						"merge-target",
					],
				}),
			)
		).nodes.map((node) => node.id),
	).toContain("item:C");
});
