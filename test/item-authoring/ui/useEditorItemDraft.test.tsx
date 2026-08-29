// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorProjectContext } from "~/ui/editor/useEditorProject";
import { useEditorItemDraft } from "~/item-authoring/ui/useEditorItemDraft";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

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

const DraftProbe = ({ uid }: { readonly uid: string }) => {
	const draft = useEditorItemDraft("simple", uid);
	return createElement("output", null, JSON.stringify(draft));
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("useEditorItemDraft", () => {
	it("binds the first project resource and preallocated UID into the local draft", async () => {
		const uid = "draft-simple";
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					EditorProjectContext.Provider,
					{
						value: project,
					},
					createElement(DraftProbe, {
						uid,
					}),
				),
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
