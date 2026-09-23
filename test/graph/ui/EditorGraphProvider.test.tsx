// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { EditorGraphWorker } from "~/graph/worker/createEditorGraphWorkerFx";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
		revision: 1,
	}),
}));

const state = vi.hoisted(() => ({
	spawnFn: vi.fn(),
	releaseFn: vi.fn(),
}));
vi.mock("~/graph/worker/createEditorGraphWorkerFx", () => ({
	createEditorGraphWorkerFx: () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				state.spawnFn();
				return {
					queryFx: () => Effect.never,
				} satisfies EditorGraphWorker;
			}),
			() =>
				Effect.sync(() => {
					state.releaseFn();
				}),
		),
}));
import { EditorGraphProvider, useEditorGraphSession } from "~/graph/ui/EditorGraphProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const observed: EditorGraphWorker[] = [];
const Surface = () => {
	const session = useEditorGraphSession();
	if (session.status === "ready") observed.push(session.worker);
	return null;
};

it("shares one scoped worker across mounted graph views and releases it when the project closes", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<EditorGraphProvider>
					<Surface />
					<Surface />
				</EditorGraphProvider>,
			),
		);
		expect(state.spawnFn).toHaveBeenCalledTimes(1);
		expect(new Set(observed).size).toBe(1);
		await act(async () =>
			root.render(
				<EditorGraphProvider>
					<Surface key="replacement-view" />
				</EditorGraphProvider>,
			),
		);
		expect(state.spawnFn).toHaveBeenCalledTimes(1);
		expect(new Set(observed).size).toBe(1);
		expect(state.releaseFn).not.toHaveBeenCalled();
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
	expect(state.releaseFn).toHaveBeenCalledTimes(1);
});

it("recreates the worker for a replacement epoch even when project identity and revision stay equal", async () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	state.spawnFn.mockClear();
	state.releaseFn.mockClear();
	observed.splice(0);
	const view = (
		<RegistryContext.Provider value={registry}>
			<EditorProjectReplacementBoundary>
				<EditorGraphProvider>
					<Surface />
				</EditorGraphProvider>
			</EditorProjectReplacementBoundary>
		</RegistryContext.Provider>
	);
	try {
		await act(async () => root.render(view));
		expect(state.spawnFn).toHaveBeenCalledTimes(1);
		const originalWorker = observed.at(-1);
		await act(async () => registry.set(EditorProjectReplacementEpochAtom("project"), 1));
		expect(state.releaseFn).toHaveBeenCalledTimes(1);
		expect(state.spawnFn).toHaveBeenCalledTimes(2);
		expect(observed.at(-1)).not.toBe(originalWorker);
	} finally {
		await act(async () => root.unmount());
		container.remove();
		registry.dispose();
	}
	expect(state.releaseFn).toHaveBeenCalledTimes(2);
});
