// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	projectChangedFn: undefined as ((projectId: string) => void) | undefined,
	runPromiseFn: vi.fn(),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
	}),
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: state.runPromiseFn,
	},
}));
vi.mock("~/project-version/ui/useVersionCheckout", () => ({
	useVersionCheckout: () => ({}),
}));
vi.mock("~/project-version/ui/useVersionTag", () => ({
	useVersionTag: () => ({}),
}));

import { useVersionHistoryController } from "~/project-version/ui/useVersionHistoryController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
	state.runPromiseFn.mockReset();
	state.projectChangedFn = undefined;
});

describe("useVersionHistoryController", () => {
	it.each([
		"success",
		"failure",
	])("ignores an older history %s after a newer MCP refresh", async (completion) => {
		let completeOldFn: ((value: unknown) => void) | undefined;
		let failOldFn: ((error: Error) => void) | undefined;
		const oldRequest = new Promise((resolveFn, rejectFn) => {
			completeOldFn = resolveFn;
			failOldFn = rejectFn;
		});
		const latest = {
			status: {
				canCommit: true,
				currentBaseVersionId: "latest",
				currentFingerprint: "b".repeat(64),
				dirty: true,
				versionCount: 0,
			},
			versions: [],
		};
		state.runPromiseFn
			.mockReturnValueOnce(oldRequest)
			.mockResolvedValueOnce(latest)
			.mockResolvedValue({
				from: {
					type: "version",
					versionId: "latest",
				},
				to: {
					type: "current",
				},
				hasChanges: true,
				project: [],
				items: [],
				resources: [],
				scenarios: [],
			});
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					onProjectChangedFn: (listenerFn: (projectId: string) => void) => {
						state.projectChangedFn = listenerFn;
						return () => {
							state.projectChangedFn = undefined;
						};
					},
				},
			},
		});
		let controller: useVersionHistoryController.Output | undefined;
		const Probe = () => {
			controller = useVersionHistoryController();
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root?.render(createElement(Probe)));
		await act(async () => state.projectChangedFn?.("project-one"));
		expect(controller?.history).toEqual(latest);
		await act(async () => {
			if (completion === "failure") failOldFn?.(new Error("Obsolete history read failed"));
			else
				completeOldFn?.({
					...latest,
					status: {
						...latest.status,
						currentBaseVersionId: "old",
						currentFingerprint: "a".repeat(64),
						dirty: false,
					},
				});
		});
		expect(controller?.history).toEqual(latest);
		expect(controller?.compareFrom).toBe("latest");
		expect(controller?.error).toBeUndefined();
	});

	it("rereads the current diff when MCP changes saved content without changing Version HEAD", async () => {
		const history = {
			status: {
				canCommit: true,
				currentBaseVersionId: "version-one",
				currentFingerprint: "a".repeat(64),
				dirty: false,
				versionCount: 0,
			},
			versions: [],
		};
		const initialDiff = {
			from: {
				type: "version",
				versionId: "version-one",
			},
			to: {
				type: "current",
			},
			hasChanges: false,
			project: [],
			items: [],
			resources: [],
			scenarios: [],
		};
		const changedDiff = {
			...initialDiff,
			hasChanges: true,
			project: [
				{
					path: "meta.title",
					before: "Before",
					after: "After",
				},
			],
		};
		state.runPromiseFn
			.mockResolvedValueOnce(history)
			.mockResolvedValueOnce(initialDiff)
			.mockResolvedValueOnce({
				...history,
				status: {
					...history.status,
					currentFingerprint: "b".repeat(64),
					dirty: true,
				},
			})
			.mockResolvedValueOnce(changedDiff);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					onProjectChangedFn: (listenerFn: (projectId: string) => void) => {
						state.projectChangedFn = listenerFn;
						return () => {
							state.projectChangedFn = undefined;
						};
					},
				},
			},
		});
		let controller: useVersionHistoryController.Output | undefined;
		const Probe = () => {
			controller = useVersionHistoryController();
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root?.render(createElement(Probe)));
		expect(controller?.diff).toEqual(initialDiff);

		await act(async () => state.projectChangedFn?.("project-one"));

		expect(controller?.history?.status.dirty).toBe(true);
		expect(controller?.compareFrom).toBe("version-one");
		expect(controller?.compareTo).toBe("current");
		expect(controller?.diff).toEqual(changedDiff);
	});
});
