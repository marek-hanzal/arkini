import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import { searchProjectFn } from "./graphOperationIndex.test/fixtures";

it("keeps opaque references consistent across discovery, batch and hydration without accepting canonical operation IDs", async () => {
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = searchProjectFn();
	const internal = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "node",
			from: "item:A",
		}),
	);
	const discovered = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "node",
			from: "item:A",
		}),
	);
	const reference = discovered.operations[0].id;
	expect(reference.length).toBeLessThan(40);
	expect(reference).not.toBe(internal.operations[0].id);
	const batch = await Effect.runPromise(
		graph.batchFx(project, {
			queries: [
				{
					id: "out",
					query: {
						kind: "operations",
						participant: "item:B",
						role: "output",
					},
				},
				{
					id: "links",
					query: {
						kind: "connections",
						from: "item:A",
					},
				},
			],
		}),
	);
	expect(
		batch.queries[0].matches?.every((entry) =>
			batch.queries[0].operationIds.includes(entry.operationId),
		),
	).toBe(true);
	expect(
		batch.edges.every(
			(edge) =>
				edge.operationId === undefined ||
				batch.operations.some((operation) => operation.id === edge.operationId),
		),
	).toBe(true);
	const hydrated = await Effect.runPromise(
		graph.readOperationsFx(project, {
			revision: discovered.revision,
			snapshotId: discovered.snapshotId,
			operationIds: [
				reference,
				internal.operations[0].id,
			],
		}),
	);
	expect(hydrated.operations[0]).toEqual({
		...internal.operations[0],
		id: reference,
	});
	expect(hydrated.issues).toEqual([
		{
			operationId: internal.operations[0].id,
			reason: "missing-operation",
		},
	]);
	const other = await Effect.runPromise(createProjectGraphFx());
	const otherDiscovery = await Effect.runPromise(
		other.discoveryFx(project, {
			kind: "node",
			from: "item:A",
		}),
	);
	const wrongSession = await Effect.runPromise(
		other.readOperationsFx(project, {
			revision: otherDiscovery.revision,
			snapshotId: otherDiscovery.snapshotId,
			operationIds: [
				reference,
			],
		}),
	);
	expect(wrongSession.operations).toEqual([]);
	expect(wrongSession.issues[0].reason).toBe("missing-operation");
});

it("expires bounded continuation state without losing newer tokens or allowing filter changes", async () => {
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
	const input = {
		kind: "operations",
		limit: 1,
	};
	const first = await Effect.runPromise(graph.discoveryFx(project, input));
	let latest = first;
	for (let index = 0; index < 1024; index++)
		latest = await Effect.runPromise(graph.discoveryFx(project, input));
	expect(
		(
			await Effect.runPromise(
				graph
					.discoveryFx(project, {
						...input,
						cursor: first.nextCursor,
					})
					.pipe(Effect.flip),
			)
		).reason,
	).toBe("invalid-query");
	expect(
		(
			await Effect.runPromise(
				graph.discoveryFx(project, {
					...input,
					cursor: latest.nextCursor,
				}),
			)
		).operations,
	).toHaveLength(1);
});
