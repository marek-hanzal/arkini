// @vitest-environment jsdom
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Project } from "~/project-authoring/type/Project";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { EditorGraphWorker } from "~/graph/worker/createEditorGraphWorkerFx";

const state = vi.hoisted(() => ({
	project: {
		projectId: "project",
		revision: 1,
	} as Project,
	worker: undefined as unknown as EditorGraphWorker,
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("~/graph/ui/EditorGraphProvider", () => ({
	useEditorGraphSession: () => session,
}));
import { useEditorGraphQuery } from "~/graph/ui/useEditorGraphQuery";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";

const session = {
	status: "ready",
	get worker() {
		return state.worker;
	},
};
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Array<ReturnType<typeof createRoot>> = [];
afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Harness = ({ query }: { readonly query: GraphQuerySchema.Type }) => {
	const result = useEditorGraphQuery(query);
	return (
		<div
			data-status={result.status}
			data-revision={result.status === "ready" ? result.result.revision : undefined}
		/>
	);
};

it("hides a settled old revision immediately, aborts obsolete queries, and rejects their late completions", async () => {
	const pending: Array<{
		readonly signal: AbortSignal;
		readonly resolveFn: (result: GraphResult) => void;
		readonly project: Project;
		readonly query: GraphQuerySchema.Type;
	}> = [];
	state.worker = {
		queryFx: (project, query) =>
			Effect.promise(
				(signal) =>
					new Promise((resolveFn) => {
						pending.push({
							signal,
							resolveFn,
							project,
							query,
						});
					}),
			),
	};
	state.project = {
		projectId: "project",
		revision: 1,
	} as Project;
	const resultFn = (revision: number): GraphResult => ({
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
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const first = readItemConnectionQueryFn("A", "all");
	await act(async () => root.render(<Harness query={first} />));
	await act(async () => pending[0].resolveFn(resultFn(1)));
	expect(container.firstElementChild?.getAttribute("data-revision")).toBe("1");
	state.project = {
		...state.project,
		revision: 2,
	};
	await act(async () => root.render(<Harness query={first} />));
	expect(container.firstElementChild?.getAttribute("data-status")).toBe("loading");
	const latest = readItemConnectionQueryFn("B", "accepts-merge");
	await act(async () => root.render(<Harness query={latest} />));
	expect(pending[1].signal.aborted).toBe(true);
	await act(async () => pending[1].resolveFn(resultFn(2)));
	expect(container.firstElementChild?.getAttribute("data-status")).toBe("loading");
	await act(async () => pending[2].resolveFn(resultFn(2)));
	expect(container.firstElementChild?.getAttribute("data-revision")).toBe("2");
	expect(pending[2].query).toEqual(latest);
	await act(async () => root.render(<Harness query={first} />));
	await act(async () => root.unmount());
	roots.splice(roots.indexOf(root), 1);
	expect(pending[3].signal.aborted).toBe(true);
});
