import { Clock, Effect, Exit, Fiber } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { projectFn } from "./createProjectGraphFx.test/fixtures";

it("discovers indexed operations without a root, including owners with no relationship edges", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"C",
			"B",
		],
	]);
	project.config.items.A.lines = [
		LineSchema.parse({
			uid: "idle",
			title: "Idle",
			description: "Idle operation",
			runtimeMs: 0,
			input: [
				{
					type: "simple",
				},
			],
			rules: [],
		}),
	];
	project.config.items.A.clock = ItemScheduleSchema.parse({
		intervalMs: 1000,
	});
	project.config.items.A.units = {
		amount: 3,
	};
	const operations = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			owner: "item:A",
		}),
	);
	expect(operations.operations.map((operation) => operation.kind).sort()).toEqual([
		"clock",
		"depletion",
		"line",
		"merge",
	]);
	const targets = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			operationKinds: [
				"merge",
			],
			participant: "item:B",
			role: "target",
		}),
	);
	expect(targets.operations.map((operation) => operation.owner).sort()).toEqual([
		"item:A",
		"item:C",
	]);
	const owners = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			participant: "item:B",
			role: "owner",
		}),
	);
	expect(owners.status).toBe("no");
	expect(owners.truncated).toBe(false);
	const both = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "connections",
			from: "item:B",
		}),
	);
	expect(both.operations.map((operation) => operation.owner).sort()).toEqual([
		"item:A",
		"item:C",
	]);
	expect(both.nodes.every((node) => node.title.length > 0)).toBe(true);
});

it("continues operation listings without duplicates and binds cursors to filters and exact snapshots", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"A",
			"C",
		],
		[
			"D",
			"B",
		],
	]);
	const query = {
		kind: "operations",
		operationKinds: [
			"merge",
		],
		limit: 1,
	};
	const first = await Effect.runPromise(graph.discoveryFx(project, query));
	expect(first.reasons).toEqual([
		"limit",
	]);
	const second = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			cursor: first.nextCursor,
			limit: 2,
		}),
	);
	expect(second.truncated).toBe(false);
	expect(second.nextCursor).toBeUndefined();
	const all = [
		...first.operations,
		...second.operations,
	];
	expect(new Set(all.map((operation) => operation.id)).size).toBe(3);
	expect(second.snapshotId).toBe(first.snapshotId);
	const changedFilter = await Effect.runPromise(
		graph
			.discoveryFx(project, {
				...query,
				owner: "item:A",
				cursor: first.nextCursor,
			})
			.pipe(Effect.flip),
	);
	expect(changedFilter.reason).toBe("invalid-query");
	const malformed = await Effect.runPromise(
		graph
			.discoveryFx(project, {
				...query,
				cursor: "garbage",
			})
			.pipe(Effect.flip),
	);
	expect(malformed.reason).toBe("invalid-query");
	const refreshed = structuredClone(project);
	refreshed.config.items.A.title = "Fresh";
	const stale = await Effect.runPromise(
		graph
			.discoveryFx(refreshed, {
				...query,
				cursor: first.nextCursor,
			})
			.pipe(Effect.flip),
	);
	expect(stale.reason).toBe("stale-snapshot");
});

it("hydrates only selected canonical operations, deduplicates requests and rejects same-revision replacements", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"A",
			"C",
		],
	]);
	const discovery = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
		}),
	);
	const [first, second] = discovery.operations;
	const input = {
		revision: discovery.revision,
		snapshotId: discovery.snapshotId,
		operationIds: [
			second.id,
			first.id,
			second.id,
			"missing",
		],
	};
	const hydrated = await Effect.runPromise(graph.readOperationsFx(project, input));
	expect(hydrated.operations.map((operation) => operation.id)).toEqual([
		second.id,
		first.id,
	]);
	expect(hydrated.operations[0].data).toEqual(project.config.items.A.merge![1]);
	expect(hydrated.issues).toEqual([
		{
			operationId: "missing",
			reason: "missing-operation",
		},
	]);
	const original = structuredClone(hydrated.operations[0]);
	const selected = hydrated.operations[0];
	if (selected.kind !== "merge") throw new Error("Expected a hydrated merge.");
	selected.data.action = "consume";
	const reread = await Effect.runPromise(graph.readOperationsFx(structuredClone(project), input));
	expect(reread.operations[0]).toEqual(original);
	const unchanged = await Effect.runPromise(
		graph.discoveryFx(structuredClone(project), {
			kind: "connections",
			from: "item:A",
		}),
	);
	expect(unchanged.snapshotId).toBe(discovery.snapshotId);
	const revised = {
		...project,
		revision: 2,
	};
	expect(
		(await Effect.runPromise(graph.readOperationsFx(revised, input).pipe(Effect.flip))).reason,
	).toBe("stale-revision");
	const changed = structuredClone(project);
	changed.config.items.A.merge!.reverse();
	expect(
		(await Effect.runPromise(graph.readOperationsFx(changed, input).pipe(Effect.flip))).reason,
	).toBe("stale-snapshot");
});

it("keeps every batch query on one captured snapshot during interleaved revisions and isolates query admission failures", async () => {
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
	const next = {
		...structuredClone(project),
		revision: 2,
	};
	next.config.items.A.merge![0] = {
		target: {
			type: "item",
			itemUid: "C",
		},
		action: "use",
		effect: "keep",
	};
	const [batch, latest] = await Promise.all([
		Effect.runPromise(
			graph.batchFx(project, {
				queries: [
					{
						id: "first",
						query: {
							kind: "connections",
							from: "item:A",
						},
					},
					{
						id: "repeat",
						query: {
							kind: "connections",
							from: "item:A",
						},
					},
					{
						id: "missing",
						query: {
							kind: "connections",
							from: "item:absent",
						},
					},
					{
						id: "invalid",
						query: {
							kind: "path",
							from: "item:A",
						},
					},
				],
			}),
		),
		Effect.runPromise(
			graph.discoveryFx(next, {
				kind: "connections",
				from: "item:A",
			}),
		),
	]);
	expect(batch.revision).toBe(1);
	expect(latest.revision).toBe(2);
	expect(batch.snapshotId).not.toBe(latest.snapshotId);
	expect(batch.edges).toHaveLength(1);
	expect(batch.edges[0].to).toBe("item:B");
	expect(batch.queries[0].edgeIds).toEqual(batch.queries[1].edgeIds);
	expect(batch.queries[0].operationIds).toEqual(batch.queries[1].operationIds);
	expect(batch.operations).toHaveLength(1);
	expect(batch.queries[2].error?.reason).toBe("missing-node");
	expect(batch.queries[3].error?.reason).toBe("invalid-query");
	const failed = await Effect.runPromise(
		graph
			.batchFx(next, {
				snapshotId: batch.snapshotId,
				queries: [
					{
						id: "q",
						query: {
							kind: "operations",
						},
					},
				],
			})
			.pipe(Effect.flip),
	);
	expect(failed.reason).toBe("stale-snapshot");
});

it("returns resumable partial operation discovery when the expansion budget is exhausted", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = projectFn([
		[
			"A",
			"B",
		],
		[
			"A",
			"C",
		],
	]);
	const first = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			maxExpansions: 1,
		}),
	);
	expect(first.status).toBe("yes");
	expect(first.reasons).toEqual([
		"expansions",
	]);
	const second = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			cursor: first.nextCursor,
		}),
	);
	expect(second.truncated).toBe(false);
	expect(second.operations).toHaveLength(1);
	expect(first.operations[0].id).not.toBe(second.operations[0].id);
});

it("interrupts a batch without publishing partial results or poisoning the captured operation index", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const graph = yield* createProjectGraphFx();
			const project = projectFn(
				Array.from(
					{
						length: 130,
					},
					(_, index) =>
						[
							"A",
							`target-${index}`,
						] as const,
				),
			);
			const batch = yield* graph
				.batchFx(project, {
					queries: [
						{
							id: "operations",
							query: {
								kind: "operations",
								limit: 200,
							},
						},
					],
				})
				.pipe(Effect.forkChild);
			yield* Effect.yieldNow;
			yield* Fiber.interrupt(batch);
			expect(Exit.isFailure(yield* Fiber.await(batch))).toBe(true);
			const next = yield* graph.discoveryFx(project, {
				kind: "operations",
				limit: 200,
			});
			expect(next.operations).toHaveLength(130);
			expect(next.truncated).toBe(false);
		}),
	);
});

it("marks an operation timeout before any result as unknown and allows continuation", async () => {
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
			const timed = yield* graph
				.discoveryFx(project, {
					kind: "operations",
					timeoutMs: 1,
				})
				.pipe(
					Effect.provideService(Clock.Clock, {
						currentTimeMillis: Effect.sync(() => reads++ * 2),
						currentTimeMillisUnsafe: () => reads++ * 2,
						currentTimeNanos: clock.currentTimeNanos,
						currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
						monotonicTimeNanos: clock.monotonicTimeNanos,
						monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
						sleep: (duration) => clock.sleep(duration),
					}),
				);
			expect(timed.status).toBe("unknown");
			expect(timed.reasons).toEqual([
				"timeout",
			]);
			const resumed = yield* graph.discoveryFx(project, {
				kind: "operations",
				cursor: timed.nextCursor,
			});
			expect(resumed.status).toBe("yes");
			expect(resumed.operations).toHaveLength(1);
		}),
	);
});
