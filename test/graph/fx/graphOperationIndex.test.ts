import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";
import { searchProjectFn } from "./graphOperationIndex.test/fixtures";

it("uses canonical Editor relevance for each operation search scope and pins search continuations", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = searchProjectFn();
	const lines = project.config.items.A.lines!;
	const searchFn = createFuzzySearchFn({
		candidates: lines.map((line) => ({
			terms: [
				line.title,
			],
			value: line.uid,
		})),
	});
	const input = {
		kind: "operations",
		operationKinds: [
			"line",
		],
		search: {
			text: "Digest",
			scope: "title",
		},
		limit: 1,
	};
	const first = await Effect.runPromise(graph.discoveryFx(project, input));
	const second = await Effect.runPromise(
		graph.discoveryFx(project, {
			...input,
			cursor: first.nextCursor,
		}),
	);
	expect(
		[
			...first.operations,
			...second.operations,
		].map((operation) => operation.kind === "line" && operation.lineUid),
	).toEqual(searchFn("Digest"));
	expect(first.operations[0].title).toBe("Digest");
	expect(first.nextCursor!.length).toBeLessThan(40);
	expect(second.nextCursor).toBeUndefined();
	const mismatched = await Effect.runPromise(
		graph
			.discoveryFx(project, {
				...input,
				search: {
					text: "Food",
					scope: "title",
				},
				cursor: first.nextCursor,
			})
			.pipe(Effect.flip),
	);
	expect(mismatched.reason).toBe("invalid-query");
	const owner = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			operationKinds: [
				"line",
			],
			search: {
				text: "Beagle Puppy",
				scope: "owner",
			},
		}),
	);
	expect(owner.operations).toHaveLength(3);
	const participant = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			operationKinds: [
				"line",
			],
			search: {
				text: "Bio-Waste",
				scope: "participant",
			},
		}),
	);
	expect(participant.operations.map((operation) => operation.title)).toEqual([
		"Digest",
		"Plague Exposure",
	]);
	const all = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			operationKinds: [
				"line",
			],
			search: {
				text: "Plague Exposure",
			},
		}),
	);
	expect(all.operations[0].title).toBe("Plague Exposure");
	const refreshed = structuredClone(project);
	refreshed.config.items.A.lines![2].title = "Rest";
	const changed = await Effect.runPromise(
		graph.discoveryFx(refreshed, {
			kind: "operations",
			search: {
				text: "Plague Exposure",
				scope: "title",
			},
		}),
	);
	expect(changed.operations).toHaveLength(0);
	expect(changed.snapshotId).not.toBe(first.snapshotId);
});

it("combines scalar filters without treating missing fields as false and applies exclusive numeric bounds", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = searchProjectFn();
	const hidden = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				clock: true,
				show: false,
				enable: true,
				clockWeight: {
					gt: 15,
				},
				runtimeMs: {
					min: 2000,
					max: 2000,
				},
				hasOutcomes: true,
				default: true,
			},
		}),
	);
	expect(hidden.operations.map((operation) => operation.title)).toEqual([
		"Digest",
	]);
	const manual = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				clock: false,
				hasOutcomes: false,
			},
		}),
	);
	expect(manual.operations.map((operation) => operation.title)).toEqual([
		"Plague Exposure",
	]);
	const merge = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				action: "spend",
				effect: "keep",
				ownership: "source",
				hasOutcomes: false,
			},
		}),
	);
	expect(merge.operations.map((operation) => operation.kind)).toEqual([
		"merge",
	]);
	const clock = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				enable: false,
				intervalMs: {
					min: 1000,
				},
				durationMs: {
					gt: 4999,
					lt: 5001,
				},
			},
		}),
	);
	expect(clock.operations.map((operation) => operation.kind)).toEqual([
		"clock",
	]);
	const excluded = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				runtimeMs: {
					lt: 1000,
				},
			},
		}),
	);
	expect(excluded.status).toBe("no");
	for (const input of [
		{
			kind: "operations",
			filter: {
				runtimeMs: {
					min: 4,
					max: 2,
				},
			},
		},
		{
			kind: "operations",
			filter: {
				runtimeMs: {
					min: 4,
					lt: 4,
				},
			},
		},
		{
			kind: "operations",
			filter: {
				runtimeMs: {},
			},
		},
		{
			kind: "connections",
			from: "item:A",
			filter: {
				enable: true,
			},
		},
		{
			kind: "connections",
			from: "item:A",
			search: {
				text: "Digest",
			},
		},
	])
		expect(
			(await Effect.runPromise(graph.discoveryFx(project, input).pipe(Effect.flip))).reason,
		).toBe("invalid-query");
	const page = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			filter: {
				clock: true,
			},
			limit: 1,
		}),
	);
	expect(
		(
			await Effect.runPromise(
				graph
					.discoveryFx(project, {
						kind: "operations",
						filter: {
							clock: true,
							show: false,
						},
						cursor: page.nextCursor,
					})
					.pipe(Effect.flip),
			)
		).reason,
	).toBe("invalid-query");
});
