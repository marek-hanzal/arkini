// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	historyPushFn: vi.fn(),
	navigateFn: vi.fn(),
	projectChangedFn: undefined as ((projectId: string) => void) | undefined,
	runPromiseFn: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		history: {
			push: state.historyPushFn,
		},
		navigate: state.navigateFn,
	}),
	useSearch: () => ({}),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
	}),
}));

vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: state.runPromiseFn,
	},
}));

import { useVersionCommitController } from "~/project-version/ui/useVersionCommitController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
let controller: ReturnType<typeof useVersionCommitController> | undefined;

beforeEach(() => {
	controller = undefined;
	state.projectChangedFn = undefined;
	state.runPromiseFn.mockReset();
	state.historyPushFn.mockReset();
	state.navigateFn.mockReset();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChangedFn: (listener: (projectId: string) => void) => {
					state.projectChangedFn = listener;
					return () => {
						state.projectChangedFn = undefined;
					};
				},
			},
		},
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
});

describe("useVersionCommitController", () => {
	it("clears a failed preview after a project change reload succeeds", async () => {
		const preview = {
			bump: "minor" as const,
			canCommit: true,
			currentFingerprint: "a".repeat(64),
			initial: false,
			nextArkpackVersion: "1.1",
			scenariosToDelete: [],
		};
		state.runPromiseFn
			.mockRejectedValueOnce(new Error("Preview failed."))
			.mockResolvedValueOnce(preview);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const Probe = () => {
			controller = useVersionCommitController();
			return null;
		};

		await act(async () => root.render(createElement(Probe)));

		expect(controller?.error).toBe("Preview failed.");
		expect(controller?.preview).toBeUndefined();

		await act(async () => state.projectChangedFn?.("editor-test"));

		expect(controller?.error).toBeUndefined();
		expect(controller?.preview).toEqual(preview);
	});
});
