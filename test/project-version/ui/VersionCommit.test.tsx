// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as EditorVersionCommitRouteDefinition } from "~/@routes/editor/$projectId/versions/commit";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

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
	preview: {
		bump: "noop" as "noop" | "minor" | "major",
		canCommit: false,
		currentFingerprint: "a".repeat(64),
		initial: false,
		nextArkpackVersion: "1.0",
		scenariosToDelete: [] as Array<string>,
	},
}));

vi.mock("~/project-version/ui/useVersionCommitController", () => ({
	useVersionCommitController: () => ({
		body: "",
		canCommit: state.canCommit,
		commitFn: vi.fn(),
		pending: false,
		preview: {
			...state.preview,
			canCommit: state.canCommit,
		},
		projectId: "editor-test",
		setBodyFn: vi.fn(),
		setSubjectFn: vi.fn(),
		setTagFn: vi.fn(),
		subject: "",
		tag: "",
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.canCommit = false;
	state.preview = {
		bump: "noop",
		canCommit: false,
		currentFingerprint: "a".repeat(64),
		initial: false,
		nextArkpackVersion: "1.0",
		scenariosToDelete: [],
	};
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
			await act(async () =>
				root.render(
					<TranslationTestProvider>
						<EditorVersionCommit />
					</TranslationTestProvider>,
				),
			);
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

	it("shows the resulting bump and destructive scenario consequence before commit", async () => {
		state.canCommit = true;
		state.preview = {
			bump: "major",
			canCommit: true,
			currentFingerprint: "b".repeat(64),
			initial: false,
			nextArkpackVersion: "2.0",
			scenariosToDelete: [
				"Opening",
				"Variant",
			],
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<EditorVersionCommit />
				</TranslationTestProvider>,
			),
		);

		expect(container.textContent).toContain("Resulting Arkpack · v2.0");
		expect(
			container
				.querySelector('[data-ui="EditorVersionCommitBump"]')
				?.getAttribute("data-ui-bump"),
		).toBe("major");
		expect(
			container.querySelector('[data-ui="EditorVersionCommitScenarioDeletion"]')?.textContent,
		).toContain("delete 2 Board scenarios: Opening, Variant");
	});
});
