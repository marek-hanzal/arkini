import { Effect, Exit, Scope } from "effect";
import { expect, it, vi } from "vitest";
import { createEditorGraphWorkerFx } from "~/graph/worker/createEditorGraphWorkerFx";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphWorkerRequest, GraphWorkerResponse } from "~/graph/worker/GraphWorkerProtocol";
import type { Project } from "~/project-authoring/type/Project";

vi.mock("~/graph/worker/projectGraph.worker.ts?worker", () => ({
	default: vi.fn(),
}));
const project = {
	projectId: "project",
	revision: 3,
} as Project;
const resultFn = (revision = 3): GraphResult => ({
	projectId: "project",
	revision,
	status: "no",
	truncated: false,
	reasons: [],
	nodes: [],
	edges: [],
	operations: [],
	paths: [],
	expansions: 0,
});
const harnessFn = async () => {
	const target = new EventTarget();
	const sent: GraphWorkerRequest[] = [];
	const terminateFn = vi.fn();
	const worker = Object.assign(target, {
		postMessage: (request: GraphWorkerRequest) => sent.push(request),
		terminate: terminateFn,
	}) as unknown as Worker;
	const scope = Effect.runSync(Scope.make());
	const graph = await Effect.runPromise(
		createEditorGraphWorkerFx(() => worker).pipe(Effect.provideService(Scope.Scope, scope)),
	);
	return {
		graph,
		sent,
		terminateFn,
		replyFn: (response: GraphWorkerResponse) =>
			target.dispatchEvent(
				new MessageEvent("message", {
					data: response,
				}),
			),
		failFn: () => target.dispatchEvent(new Event("messageerror")),
		closeFn: () => Effect.runPromise(Scope.close(scope, Exit.void)),
	};
};

it("multiplexes out-of-order replies and cancels only the superseded request", async () => {
	const harness = await harnessFn();
	try {
		const controller = new AbortController();
		const cancelled = Effect.runPromise(
			harness.graph.queryFx(project, readItemConnectionQueryFn("A", "all")),
			{
				signal: controller.signal,
			},
		).catch(() => "cancelled");
		const sibling = Effect.runPromise(
			harness.graph.queryFx(project, readItemConnectionQueryFn("B", "all")),
		);
		await vi.waitFor(() => expect(harness.sent).toHaveLength(2));
		controller.abort();
		await expect(cancelled).resolves.toBe("cancelled");
		expect(harness.sent).toContainEqual({
			kind: "cancel",
			requestId: 1,
		});
		harness.replyFn({
			requestId: 2,
			status: "success",
			result: resultFn(),
		});
		await expect(sibling).resolves.toEqual(resultFn());
		// A late response for the cancelled request must not settle a newer request.
		const latest = Effect.runPromise(
			harness.graph.queryFx(project, readItemConnectionQueryFn("C", "all")),
		);
		await vi.waitFor(() => expect(harness.sent).toHaveLength(4));
		harness.replyFn({
			requestId: 1,
			status: "success",
			result: resultFn(1),
		});
		harness.replyFn({
			requestId: 3,
			status: "success",
			result: resultFn(),
		});
		await expect(latest).resolves.toEqual(resultFn());
		expect(harness.terminateFn).not.toHaveBeenCalled();
	} finally {
		await harness.closeFn();
	}
	expect(harness.terminateFn).toHaveBeenCalledTimes(1);
});

it("rejects wrong revisions and closes all pending and future requests after a terminal worker failure", async () => {
	const harness = await harnessFn();
	try {
		const mismatch = Effect.runPromise(
			harness.graph.queryFx(project, readItemConnectionQueryFn("A", "all")),
		).catch((error: unknown) => String(error));
		await vi.waitFor(() => expect(harness.sent).toHaveLength(1));
		harness.replyFn({
			requestId: 1,
			status: "success",
			result: resultFn(2),
		});
		expect(await mismatch).toContain("another project revision");
		const pending = Effect.runPromise(
			harness.graph.queryFx(project, readItemConnectionQueryFn("A", "all")),
		).catch((error: unknown) => String(error));
		await vi.waitFor(() => expect(harness.sent).toHaveLength(2));
		harness.failFn();
		expect(await pending).toContain("could not be decoded");
		await expect(
			Effect.runPromise(
				harness.graph.queryFx(project, readItemConnectionQueryFn("B", "all")),
			),
		).rejects.toThrow("could not be decoded");
		expect(harness.sent).toHaveLength(2);
	} finally {
		await harness.closeFn();
	}
});

it("settles pending callers when the owning project scope closes", async () => {
	const harness = await harnessFn();
	const pending = Effect.runPromise(
		harness.graph.queryFx(project, readItemConnectionQueryFn("A", "all")),
	).catch((error: unknown) => String(error));
	await vi.waitFor(() => expect(harness.sent).toHaveLength(1));
	await harness.closeFn();
	expect(await pending).toContain("session closed");
	expect(harness.terminateFn).toHaveBeenCalledTimes(1);
});
