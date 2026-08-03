import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { appendEditorItemLineCommandAtom } from "~/bridge/item/editor/appendEditorItemLineCommandAtom";
import type { EditorLineCollectionItem } from "~/bridge/item/editor/appendEditorItemLineFx";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import {
	parseInlineLineDraft,
	type InlineLineDraft,
} from "~/ui/item/editor/EditorProductionLineInlineDraft";
import { useEditorProductionLineDraft } from "~/ui/item/editor/useEditorProductionLineDraft";

const createLineId = (item: EditorLineCollectionItem) => {
	const ownerId = item.id.replace(/^(?:item|producer):/, "") || "new-item";
	const prefix = `line:${ownerId}`;
	const existingIds = new Set((item.lines ?? []).map((line) => line.id));
	let suffix = (item.lines?.length ?? 0) + 1;
	let id = `${prefix}:${suffix}`;
	while (existingIds.has(id)) {
		suffix += 1;
		id = `${prefix}:${suffix}`;
	}
	return id;
};

const createLineDraft = (item: EditorLineCollectionItem): InlineLineDraft => ({
	description: "",
	id: createLineId(item),
	runtimeSeconds: "0",
	title: "",
});

/** Owns one transient inline line draft and its explicit atomic save command. */
export const useEditorProductionLineInlineCreate = (item: EditorLineCollectionItem) => {
	const project = useEditorProject();
	const commandAtom = appendEditorItemLineCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const appendLine = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const { discard, draft, errors, setErrors, start, updateDraft } =
		useEditorProductionLineDraft();
	const save = useCallback(async () => {
		if (draft === undefined || result.waiting) return;
		const parsed = parseInlineLineDraft(draft, (item.lines?.length ?? 0) === 0);
		if (parsed.line === undefined) {
			setErrors(parsed.errors);
			return;
		}
		await appendLine({
			item,
			line: parsed.line,
		});
		discard();
	}, [
		appendLine,
		discard,
		draft,
		item,
		result.waiting,
	]);
	return {
		discard,
		draft,
		errors,
		mutationError: readSettledAsyncResultError(result),
		pending: result.waiting,
		save,
		start: () => start(createLineDraft(item)),
		updateDraft,
	} as const;
};
