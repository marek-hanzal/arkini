import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { auditProjectFn, factualAuditProjectFn } from "./graphAudit.test/fixtures";

it("distinguishes disconnected items, rule references, authored sources, usage and behavior", async () => {
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
		"item:factory",
		"item:forgotten",
		"item:forgottenOther",
		"item:material",
		"item:reference",
		"item:root",
		"item:templateOnly",
	]);
	expect(await audited("source-only")).toEqual([
		"item:factory",
		"item:root",
		"item:templateOnly",
	]);
	expect(await audited("no-usage")).toContain("item:reference");
	expect(await audited("no-usage")).not.toContain("item:material");
	expect(await audited("no-behavior")).toContain("item:material");
	expect(await audited("no-behavior")).not.toContain("item:root");
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
			audit: "no-usage",
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
			audit: "no-behavior",
			mode: "count",
			maxExpansions: 1,
		}),
	);
	expect(result.audit?.complete).toBe(false);
	expect(result.reasons).toContain("expansions");
	expect(result.truncated).toBe(true);
});

it("keeps configuration-only items visible while separating production, usage and behavior", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = factualAuditProjectFn();
	const inspectFn = async (audit: string) =>
		(
			await Effect.runPromise(
				graph.discoveryFx(project, {
					kind: "audit",
					audit,
					limit: 100,
				}),
			)
		).audit!;
	const dangling = await inspectFn("dangling");
	expect(dangling.matches.map(({ nodeId }) => nodeId)).toEqual([
		"item:emptyClock",
		"item:emptyLine",
		"item:emptyUnits",
	]);
	const usage = await inspectFn("no-usage");
	const behavior = await inspectFn("no-behavior");
	for (const id of [
		"item:activeClock",
		"item:battery",
	])
		expect(usage.matches.map(({ nodeId }) => nodeId)).toContain(id);
	expect(behavior.matches.map(({ nodeId }) => nodeId)).toContain("item:battery");
	expect(behavior.matches.map(({ nodeId }) => nodeId)).not.toContain("item:activeClock");
	const battery = behavior.matches.find(({ nodeId }) => nodeId === "item:battery")!;
	expect(battery.facts).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "producer",
				count: 4,
			}),
			expect.objectContaining({
				kind: "configuration-only",
				count: 1,
			}),
		]),
	);
	const producers = battery.facts.find((fact) => fact.kind === "producer")!;
	if (producers.kind !== "template") expect(producers.operationIds).toHaveLength(3);
	const unproduced = await inspectFn("no-producer");
	expect(unproduced.matches.map(({ nodeId }) => nodeId)).not.toContain("item:battery");
	const templateOnly = unproduced.matches.find(({ nodeId }) => nodeId === "item:templateOnly")!;
	expect(templateOnly.facts).toContainEqual({
		kind: "template",
		count: 1,
		nodeIds: [
			"template:Unused",
		],
	});
	expect((await inspectFn("reference-only")).matches.map(({ nodeId }) => nodeId)).toEqual([
		"item:reference",
	]);
});

it("counts explicit unit payers and merge participants without counting mere operation ownership as usage", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = factualAuditProjectFn();
	const result = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "audit",
			audit: "no-usage",
			limit: 100,
		}),
	);
	const unused = result.audit!.matches.map(({ nodeId }) => nodeId);
	for (const item of [
		"payer",
		"mergeSource",
		"mergeTarget",
		"receiver",
	])
		expect(unused).not.toContain(`item:${item}`);
	expect(unused).toContain("item:factory");
});
