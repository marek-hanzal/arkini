// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import {
	editorTestConfig,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

const state = vi.hoisted(() => ({
	project: undefined as unknown as EditorProject,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/item-authoring/ui/useEditorItemByUid", () => ({
	useEditorItemByUid: () => undefined,
}));

vi.mock("~/item-authoring/ui/EditorItemFormSession", () => ({
	EditorItemFormSession: ({ initialItem }: { readonly initialItem: ItemSchema.Type }) =>
		createElement("output", null, JSON.stringify(initialItem)),
}));

import { EditorItemForm } from "~/item-authoring/ui/EditorItemForm";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const project: EditorProject = {
	projectId: "editor-test",
	title: "Editor test",
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 0,
	config: editorTestConfig,
	resources: editorTestPayload.resources,
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorItemForm", () => {
	it("seeds a new form with the first project resource and preallocated UID", async () => {
		const uid = "draft-simple";
		state.project = project;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorItemForm, {
					itemType: "simple",
					uid,
				}),
			);
		});
		const draft = JSON.parse(
			container.querySelector("output")?.textContent ?? "null",
		) as ItemSchema.Type;
		expect(draft).toMatchObject({
			asset: {
				default: [
					project.resources[0]?.id,
				],
			},
			type: "simple",
			uid,
		});
	});
});
