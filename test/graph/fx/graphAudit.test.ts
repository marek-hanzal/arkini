import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { auditProjectFn } from "./graphAudit.test/fixtures";

it("distinguishes disconnected items, rule references, authored sources and operation-aware sinks", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = auditProjectFn();
	const audited = async (audit: string) =>
		(
			await Effect.runPromise(
				graph.discoveryFx(project, {
					kind: "audit",
					audit,
				}),
			)
		).audit!.matches.map((m) => m.nodeId);
	expect(await audited("dangling")).toEqual([
		"item:forgotten",
		"item:forgottenOther",
	]);
	expect(await audited("reference-only")).toEqual([
		"item:reference",
	]);
	expect(await audited("no-producer")).toEqual([
		"item:forgotten",
		"item:forgottenOther",
		"item:material",
		"item:reference",
	]);
	expect(await audited("source-only")).toEqual([
		"item:factory",
		"item:root",
		"item:templateOnly",
	]);
	expect(await audited("dead-end")).toEqual([
		"item:finished",
		"item:product",
		"item:templateOnly",
	]);
	expect(await audited("no-consumer")).toContain("item:reference");
	expect(await audited("no-consumer")).not.toContain("item:material");
	expect(await audited("no-owned-operation")).toContain("item:material");
	expect(await audited("no-owned-operation")).not.toContain("item:root");
});

it("pins stable audit pages and detached counts to their mode and exact snapshot", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = auditProjectFn();
	const query = {
		kind: "audit",
		audit: "dangling",
		limit: 1,
	};
	const first = await Effect.runPromise(graph.discoveryFx(project, query));
	expect(first.audit).toMatchObject({
		count: 2,
		complete: true,
	});
	expect(first.audit!.matches).toHaveLength(1);
	expect(first.nextCursor).toBeDefined();
	// A caller cannot mutate the frozen analysis retained by its continuation.
	(first.audit!.matches as unknown[]).length = 0;
	const second = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			cursor: first.nextCursor,
			snapshotId: first.snapshotId,
			revision: first.revision,
		}),
	);
	expect(second.audit?.matches[0].nodeId).toBe("item:forgottenOther");
	expect(second.truncated).toBe(false);
	const count = await Effect.runPromise(
		graph.discoveryFx(project, {
			...query,
			mode: "count",
		}),
	);
	expect(count.audit).toEqual({
		matches: [],
		count: 2,
		complete: true,
	});
	expect(count.nodes).toEqual([]);
	for (const change of [
		{
			audit: "no-consumer",
		},
		{
			mode: "count",
		},
	]) {
		const failure = await Effect.runPromise(
			graph
				.discoveryFx(project, {
					...query,
					...change,
					cursor: first.nextCursor,
				})
				.pipe(Effect.flip),
		);
		expect(failure.reason).toBe("invalid-query");
	}
	project.config.items.forgotten.title = "Renamed orphan";
	const stale = await Effect.runPromise(
		graph
			.discoveryFx(project, {
				...query,
				cursor: first.nextCursor,
			})
			.pipe(Effect.flip),
	);
	expect(stale.reason).toBe("stale-snapshot");
});

it("never presents a safety-interrupted audit count as a complete total", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const result = await Effect.runPromise(
		graph.discoveryFx(auditProjectFn(), {
			kind: "audit",
			audit: "no-owned-operation",
			mode: "count",
			maxExpansions: 1,
		}),
	);
	expect(result.audit?.complete).toBe(false);
	expect(result.reasons).toContain("expansions");
	expect(result.truncated).toBe(true);
});

it("keeps audit producer eligibility independent of unfiltered authored flow and discovery", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = auditProjectFn();
	project.config.items.factory.lines[0].enable = false;
	const inspectFn = async () => {
		const results = await Effect.runPromise(
			graph.batchFx(project, {
				queries: [
					{
						id: "producers",
						query: {
							kind: "audit",
							audit: "no-producer",
						},
					},
					{
						id: "flow",
						query: {
							kind: "flow",
							from: "item:factory",
							to: "item:product",
						},
					},
					{
						id: "authored",
						query: {
							kind: "operations",
							participant: "item:product",
							role: "output",
						},
					},
				],
			}),
		);
		return results;
	};
	const disabled = await inspectFn();
	expect(disabled.queries[0].audit?.matches.map((entry) => entry.nodeId)).toContain(
		"item:product",
	);
	expect(disabled.queries[1].status).toBe("yes");
	expect(disabled.queries[2].operationIds).toHaveLength(1);
	project.config.items.factory.lines[0].enable = true;
	const enabled = await inspectFn();
	expect(enabled.queries[0].audit?.matches.map((entry) => entry.nodeId)).not.toContain(
		"item:product",
	);
	expect(enabled.queries[1].status).toBe("yes");
	expect(enabled.queries[2].operationIds).toHaveLength(1);
});
