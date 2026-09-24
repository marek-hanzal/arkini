import { Clock, Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { lineFn } from "../fn/compileGraphFactsFn.test/fixtures";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import { searchProjectFn } from "./graphOperationIndex.test/fixtures";

it("counts the whole filtered operation index rather than the listing limit, preserving all filter combinations", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = searchProjectFn();
	const filters = [
		{},
		{
			operationKinds: [
				"merge",
			],
			filter: {
				action: "spend",
			},
		},
		{
			operationKinds: [
				"line",
			],
			filter: {
				clock: true,
				show: false,
				enable: true,
			},
		},
		{
			owner: "item:A",
			participant: "item:B",
			role: "output",
			search: {
				text: "Digest",
				scope: "title",
			},
			filter: {
				clockWeight: {
					gt: 15,
				},
			},
		},
		{
			participant: "item:B",
			role: "input",
		},
		{
			search: {
				text: "Beagle Puppy",
				scope: "owner",
			},
		},
		{
			search: {
				text: "Bio-Waste",
				scope: "participant",
			},
		},
		{
			operationKinds: [],
		},
	];
	for (const filter of filters) {
		const listed = await Effect.runPromise(
			graph.discoveryFx(project, {
				kind: "operations",
				...filter,
			}),
		);
		const counted = await Effect.runPromise(
			graph.discoveryFx(project, {
				kind: "operations",
				...filter,
				limit: 1,
				aggregate: {
					mode: "count",
				},
			}),
		);
		expect(counted.aggregation).toEqual({
			mode: "count",
			count: listed.operations.length,
			complete: true,
		});
		expect(counted.operations).toEqual([]);
		expect(counted.nodes).toEqual([]);
		expect(counted.truncated).toBe(false);
		expect(counted.snapshotId).toBe(listed.snapshotId);
	}
});

it("pages groups by descending whole-scope counts and binds continuation to aggregation and snapshot", async () => {
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
		[
			"B",
			"A",
		],
		[
			"C",
			"A",
		],
	]);
	project.config.items.B.title = "Compost";
	const query = {
		kind: "operations",
		operationKinds: [
			"merge",
		],
		aggregate: {
			mode: "group",
			by: "owner",
		},
		limit: 1,
	};
	const first = await Effect.runPromise(graph.discoveryFx(project, query));
	expect(first.aggregation).toEqual({
		mode: "group",
		by: "owner",
		count: 4,
		complete: true,
		groups: [
			{
				key: "item:B",
				label: "Compost",
				count: 2,
			},
		],
	});
	expect(first.reasons).toEqual([
		"limit",
	]);
	expect(first.nextCursor).toBeDefined();
	const nextQuery = {
		...query,
		cursor: first.nextCursor,
		snapshotId: first.snapshotId,
		revision: first.revision,
	};
	const second = await Effect.runPromise(graph.discoveryFx(project, nextQuery));
	expect(second.aggregation).toMatchObject({
		count: 4,
		groups: [
			{
				key: "item:A",
				count: 1,
			},
		],
	});
	const last = await Effect.runPromise(
		graph.discoveryFx(project, {
			...nextQuery,
			cursor: second.nextCursor,
		}),
	);
	expect(last.aggregation).toMatchObject({
		groups: [
			{
				key: "item:C",
				count: 1,
			},
		],
	});
	expect(last.truncated).toBe(false);
	expect(last.nextCursor).toBeUndefined();
	for (const change of [
		{
			aggregate: {
				mode: "count",
			},
		},
		{
			aggregate: {
				mode: "group",
				by: "action",
			},
		},
		{
			aggregate: undefined,
		},
		{
			filter: {
				action: "use",
			},
		},
	]) {
		const failure = await Effect.runPromise(
			graph
				.discoveryFx(project, {
					...nextQuery,
					...change,
				})
				.pipe(Effect.flip),
		);
		expect(failure.reason).toBe("invalid-query");
	}
	const changed = structuredClone(project);
	changed.config.items.B.title = "New title";
	const stale = await Effect.runPromise(graph.discoveryFx(changed, nextQuery).pipe(Effect.flip));
	expect(stale.reason).toBe("stale-snapshot");
});

it("groups repeated line titles and keeps inapplicable properties distinct without dropping authored operations", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = searchProjectFn();
	project.config.items.B.lines = [
		LineSchema.parse(
			lineFn("digest-b", {
				title: "Digest",
			}),
		),
	];
	const titles = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			operationKinds: [
				"line",
			],
			aggregate: {
				mode: "group",
				by: "lineTitle",
			},
		}),
	);
	expect(titles.aggregation).toMatchObject({
		count: 4,
		groups: [
			{
				key: "Digest",
				label: "Digest",
				count: 2,
			},
			{
				key: "Digest Food",
				count: 1,
			},
			{
				key: "Plague Exposure",
				count: 1,
			},
		],
	});
	const action = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			aggregate: {
				mode: "group",
				by: "action",
			},
		}),
	);
	expect(action.aggregation).toMatchObject({
		count: 6,
		groups: [
			{
				key: null,
				count: 5,
			},
			{
				key: "spend",
				count: 1,
			},
		],
	});
});

it("reports partial aggregates as lower bounds and never issues unstable ranked-group continuation", async () => {
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
		[
			"B",
			"A",
		],
	]);
	for (const aggregate of [
		{
			mode: "count",
		},
		{
			mode: "group",
			by: "owner",
		},
	]) {
		const result = await Effect.runPromise(
			graph.discoveryFx(project, {
				kind: "operations",
				aggregate,
				maxExpansions: 1,
				limit: 1,
			}),
		);
		expect(result.aggregation).toMatchObject({
			count: 1,
			complete: false,
		});
		expect(result.truncated).toBe(true);
		expect(result.reasons).toContain("expansions");
		expect(result.nextCursor).toBeUndefined();
	}
});

it("does not turn an aggregation timeout before the first row into an exact zero", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const graph = yield* createProjectGraphFx();
			const project = projectFn([
				[
					"A",
					"B",
				],
			]);
			const clock = yield* Clock.Clock;
			let reads = 0;
			const query = {
				kind: "operations",
				aggregate: {
					mode: "count",
				},
				timeoutMs: 1,
			};
			const timed = yield* graph.discoveryFx(project, query).pipe(
				Effect.provideService(Clock.Clock, {
					currentTimeNanos: clock.currentTimeNanos,
					currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
					monotonicTimeNanos: clock.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
					sleep: (duration) => clock.sleep(duration),
					currentTimeMillis: Effect.sync(() => reads++ * 2),
					currentTimeMillisUnsafe: () => reads++ * 2,
				}),
			);
			expect(timed.status).toBe("unknown");
			expect(timed.aggregation).toEqual({
				mode: "count",
				count: 0,
				complete: false,
			});
			expect(timed.reasons).toEqual([
				"timeout",
			]);
			expect(timed.nextCursor).toBeUndefined();
			const retried = yield* graph.discoveryFx(project, {
				...query,
				timeoutMs: 1000,
			});
			expect(retried.aggregation).toEqual({
				mode: "count",
				count: 1,
				complete: true,
			});
		}),
	);
});
