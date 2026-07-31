import { describe, expect, it } from "vitest";

import { EditorItemTypes, validateEditorItem } from "~/bridge/editor/EditorItemModel";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { createEditorItemDraft } from "~/bridge/editor/createEditorItemDraft";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

const project: EditorProject = {
	projectId: "editor-test",
	title: "Editor test",
	game: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: "a".repeat(64),
	config: editorTestConfig,
	resources: editorTestPayload.resources,
	resourceSourcePaths: {},
	diagnostics: [],
};

describe("createEditorItemDraft", () => {
	it.each(
		EditorItemTypes,
	)("creates a schema-valid %s form value after required copy is entered", (type) => {
		const uid = `draft-${type}`;
		const draft = createEditorItemDraft(type, project, uid);
		const parsed = validateEditorItem({
			...draft,
			title: `New ${type}`,
			description: `A new ${type} item.`,
		});

		expect(parsed.success).toBe(true);
		expect(draft.uid).toBe(uid);
		expect(draft.type).toBe(type);
	});
});
