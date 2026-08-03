import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorLineSchema } from "~/bridge/item/editor/EditorLineSchema";
import { replaceEditorItemLineCommandAtom } from "~/bridge/item/editor/replaceEditorItemLineCommandAtom";
import type { EditorLineOwnerItem } from "~/bridge/item/editor/replaceEditorItemLineFx";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import {
	parseInlineLineDraft,
	type InlineLineDraft,
} from "~/ui/item/editor/EditorProductionLineInlineDraft";
import { useEditorProductionLineDraft } from "~/ui/item/editor/useEditorProductionLineDraft";

const readDraft = (line: EditorLine): InlineLineDraft => ({
	description: line.description,
	id: line.id,
	runtimeSeconds: String(line.runtimeMs / 1_000),
	title: line.title,
});

/** Owns one transient existing-line draft and its explicit atomic replace command. */
export const useEditorProductionLineInlineEdit = (item: EditorLineOwnerItem, line: EditorLine) => {
	const project = useEditorProject();
	const commandAtom = replaceEditorItemLineCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const replaceLine = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const { discard, draft, errors, setErrors, start, updateDraft } =
		useEditorProductionLineDraft();
	const save = useCallback(async () => {
		if (draft === undefined || result.waiting) return;
		const parsed = parseInlineLineDraft(draft, line.default);
		if (parsed.line === undefined) {
			setErrors(parsed.errors);
			return;
		}
		const candidate = EditorLineSchema.safeParse({
			...line,
			description: parsed.line.description,
			runtimeMs: parsed.line.runtimeMs,
			title: parsed.line.title,
		});
		if (!candidate.success) {
			setErrors({
				description: candidate.error.issues[0]?.message ?? "Invalid production line.",
			});
			return;
		}
		await replaceLine({
			item,
			line: candidate.data,
		});
		discard();
	}, [
		discard,
		draft,
		item,
		line,
		replaceLine,
		result.waiting,
	]);
	return {
		discard,
		draft,
		errors,
		mutationError: readSettledAsyncResultError(result),
		pending: result.waiting,
		save,
		start: () => start(readDraft(line)),
		updateDraft,
	} as const;
};
