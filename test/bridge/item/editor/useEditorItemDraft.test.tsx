// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import {
	type EditorItem,
	EditorItemTypes,
	type EditorItemType,
} from "~/bridge/item/editor/EditorItemModel";
import { useEditorItemDraft } from "~/bridge/item/editor/useEditorItemDraft";
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
	game: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: "a".repeat(64),
	fileIndex: {},
	itemSourcePaths: {},
	config: editorTestConfig,
	resources: editorTestPayload.resources,
	resourceSourcePaths: {},
	diagnostics: [],
};

const DraftProbe = ({ type, uid }: { readonly type: EditorItemType; readonly uid: string }) => {
	const draft = useEditorItemDraft(type, uid);
	return createElement("output", null, JSON.stringify(draft));
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("useEditorItemDraft", () => {
	it.each(
		EditorItemTypes,
	)("creates one schema-valid %s local form seed after required copy is entered", async (type) => {
		const uid = `draft-${type}`;
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
						type,
						uid,
					}),
				),
			);
		});
		const draft = JSON.parse(
			container.querySelector("output")?.textContent ?? "null",
		) as EditorItem;
		const parsed = ItemSchema.safeParse({
			...draft,
			title: `New ${type}`,
			description: `A new ${type} item.`,
		});

		expect(parsed.success).toBe(true);
		expect(draft.uid).toBe(uid);
		expect(draft.type).toBe(type);
	});
});
