// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as EditorVersionCommitRouteDefinition } from "~/@routes/editor/$projectId/versions/commit";

const EditorVersionCommit = EditorVersionCommitRouteDefinition.options.component;
if (EditorVersionCommit === undefined)
	throw new Error("Editor version Commit route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	canCommit: false,
}));

vi.mock("~/project-version/workspace/useEditorVersionCommitController", () => ({
	useEditorVersionCommitController: () => ({
		body: "",
		canCommit: state.canCommit,
		commit: vi.fn(),
		pending: false,
		projectId: "editor-test",
		setBody: vi.fn(),
		setSubject: vi.fn(),
		setTag: vi.fn(),
		status: {
			canCommit: state.canCommit,
			currentBaseVersionId: "version-one",
			currentFingerprint: "a".repeat(64),
			dirty: state.canCommit,
			versionCount: 1,
		},
		subject: "",
		tag: "",
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.canCommit = false;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorVersionCommit", () => {
	it("replaces the commit controls while the working copy is clean", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const render = async () => {
			await act(async () => root.render(<EditorVersionCommit />));
		};

		await render();
		expect(container.querySelector('[data-ui="EditorVersionCommitClean"]')).not.toBeNull();
		expect(container.querySelector("input, textarea")).toBeNull();

		state.canCommit = true;
		await render();
		expect(container.querySelector('[data-ui="EditorVersionCommitClean"]')).toBeNull();
		expect(container.querySelector("input")).not.toBeNull();
		expect(container.querySelector("textarea")).not.toBeNull();
	});
});
