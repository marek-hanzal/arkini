import { Clock, Effect, Exit, Fiber } from "effect";
import { expect, it, vi } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import datascript from "datascript";

it("uses the injected clock for timeout, leaving later queries and the snapshot usable", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const graph = yield* createProjectGraphFx();
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
			const live = yield* Clock.Clock;
			let reads = 0;
			const result = yield* graph
				.queryFx(project, {
					kind: "path",
					from: "item:A",
					to: "item:C",
					timeoutMs: 1,
				})
				.pipe(
					Effect.provideService(Clock.Clock, {
						currentTimeMillis: Effect.sync(() => reads++ * 2),
						currentTimeMillisUnsafe: () => reads++ * 2,
						currentTimeNanos: live.currentTimeNanos,
						currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
						monotonicTimeNanos: live.monotonicTimeNanos,
						monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
						sleep: (duration) => live.sleep(duration),
					}),
				);
			expect(result.status).toBe("unknown");
			expect(result.reasons).toEqual([
				"timeout",
			]);
			expect(
				(yield* graph.queryFx(project, {
					kind: "path",
					from: "item:A",
					to: "item:C",
				})).status,
			).toBe("yes");
		}),
	);
});
it("isolates captured revisions during overlapping requests and detaches result data", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const first = projectFn([
		[
			"A",
			"B",
		],
		[
			"B",
			"C",
		],
	]);
	const changed = structuredClone(first);
	changed.config.items.A.merge![0] = {
		action: "use",
		effect: "keep",
		target: {
			type: "item",
			itemUid: "C",
		},
	};
	const second = {
		...changed,
		revision: 2,
	};
	const query = {
		kind: "connections",
		from: "item:A",
	};
	const [old, next] = await Promise.all([
		Effect.runPromise(graph.queryFx(first, query)),
		Effect.runPromise(graph.queryFx(second, query)),
	]);
	expect(old.revision).toBe(1);
	expect(old.edges[0].to).toBe("item:B");
	expect(next.revision).toBe(2);
	expect(next.edges[0].to).toBe("item:C");
	(
		next.edges[0] as {
			to: string;
		}
	).to = "corrupted";
	expect((await Effect.runPromise(graph.queryFx(second, query))).edges[0].to).toBe("item:C");
	const stale = await Effect.runPromise(
		graph
			.queryFx(second, {
				...query,
				revision: 1,
			})
			.pipe(Effect.flip),
	);
	expect(stale.reason).toBe("stale-revision");
});
it("caches rematerialized unchanged revisions but invalidates same-marker file replacements", async () => {
	const init = vi.spyOn(datascript, "init_db");
	const graph = await Effect.runPromise(createProjectGraphFx());
	const first = projectFn([
		[
			"A",
			"B",
		],
	]);
	const query = {
		kind: "node",
		from: "item:A",
	};
	expect((await Effect.runPromise(graph.queryFx(first, query))).nodes[0].title).toBe("A");
	const rematerialized = structuredClone(first);
	expect((await Effect.runPromise(graph.queryFx(rematerialized, query))).nodes[0].title).toBe(
		"A",
	);
	expect(init).toHaveBeenCalledTimes(1);
	rematerialized.config.items.A.title = "Refreshed from disk";
	expect((await Effect.runPromise(graph.queryFx(rematerialized, query))).nodes[0].title).toBe(
		"Refreshed from disk",
	);
	expect(init).toHaveBeenCalledTimes(2);
	await Effect.runPromise(
		graph.queryFx(
			{
				...rematerialized,
				revision: 2,
			},
			query,
		),
	);
	expect(init).toHaveBeenCalledTimes(3);
});
it("interrupts exploration without poisoning the reusable revision snapshot", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const graph = yield* createProjectGraphFx();
			const project = projectFn(
				Array.from(
					{
						length: 200,
					},
					(_, i) =>
						[
							"A",
							`B${i}`,
						] as const,
				),
			);
			const fiber = yield* graph
				.queryFx(project, {
					kind: "traverse",
					from: "item:A",
				})
				.pipe(Effect.forkChild);
			yield* Effect.yieldNow;
			yield* Fiber.interrupt(fiber);
			const exit = yield* Fiber.await(fiber);
			expect(Exit.isFailure(exit)).toBe(true);
			const next = yield* graph.queryFx(project, {
				kind: "connections",
				from: "item:A",
				limit: 1000,
			});
			expect(next.edges).toHaveLength(200);
		}),
	);
});
