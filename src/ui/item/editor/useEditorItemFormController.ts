import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { EditorFormDirtyAtom } from "~/bridge/editor/EditorFormDirtyAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import {
	EditorItemFormSchema,
	type EditorItemFormValues,
} from "~/bridge/item/editor/EditorItemFormSchema";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemCommandAtom } from "~/bridge/item/editor/saveEditorItemCommandAtom";
import { useRegisterEditorFormActions } from "~/ui/editor/EditorFormActions";
import { useAppForm } from "~/ui/form/EditorForm";
import {
	readEditorItemSectionForPath,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

export namespace useEditorItemFormController {
	export interface Props {
		readonly initialItem: EditorItem;
		readonly onInvalidSection: (section: EditorItemSectionId) => void | Promise<void>;
		readonly onSaved?: (item: EditorItem) => void | Promise<void>;
	}
}

/** Owns the one local TanStack Form session shared by all item section leaves. */
export const useEditorItemFormController = ({
	initialItem,
	onInvalidSection,
	onSaved,
}: useEditorItemFormController.Props) => {
	const project = useEditorProject();
	const canonicalItem = useMemo<EditorItemFormValues>(
		() => ({
			...initialItem,
			tags: initialItem.tags.join(", "),
			merge:
				initialItem.merge === undefined
					? undefined
					: [
							...initialItem.merge,
						],
		}),
		[
			initialItem,
		],
	);
	const categoryOptions = Object.values(project.config.categories).map((category) => ({
		label: category.title,
		value: category.id,
	}));
	const setFormDirty = useAtomSet(EditorFormDirtyAtom);
	const ownerId = `item:${initialItem.uid}`;
	const saveItemAtom = saveEditorItemCommandAtom(project.projectId);
	const saveItemResult = useAtomValue(saveItemAtom);
	const saveItem = useAtomSet(saveItemAtom, {
		mode: "promise",
	});
	const resetSaveItem = useAtomSet(saveItemAtom);
	const submitSucceeded = useRef(false);
	const form = useAppForm({
		defaultValues: canonicalItem,
		validationLogic: revalidateLogic({
			mode: "submit",
			modeAfterSubmission: "change",
		}),
		validators: {
			onDynamic: EditorItemFormSchema,
		},
		onSubmit: async ({ formApi, value }) => {
			const item = EditorItemFormSchema.parse(value);
			const saved = await saveItem(item);
			submitSucceeded.current = true;
			setFormDirty({
				dirty: false,
				ownerId,
			});
			formApi.reset({
				...saved,
				tags: saved.tags.join(", "),
				merge:
					saved.merge === undefined
						? undefined
						: [
								...saved.merge,
							],
			});
			await onSaved?.(saved);
		},
	});
	const itemId = useStore(form.store, (state) => state.values.id);
	const dirty = useStore(form.store, (state) => state.isDirty);
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const validationError = useStore(form.store, (state) =>
		state.submissionAttempts > 0 && !state.isValid
			? "Fix the highlighted item fields before saving."
			: undefined,
	);
	useLayoutEffect(() => {
		setFormDirty({
			dirty,
			ownerId,
		});
		return () => {
			setFormDirty({
				dirty: false,
				ownerId,
			});
		};
	}, [
		dirty,
		ownerId,
		setFormDirty,
	]);
	const discard = useCallback(() => {
		resetSaveItem(Atom.Reset);
		setFormDirty({
			dirty: false,
			ownerId,
		});
		form.reset(canonicalItem);
	}, [
		canonicalItem,
		form,
		ownerId,
		resetSaveItem,
		setFormDirty,
	]);
	const save = useCallback(async () => {
		if (!dirty || submitting) return false;
		submitSucceeded.current = false;
		await form.handleSubmit();
		if (!submitSucceeded.current) {
			const result = EditorItemFormSchema.safeParse(form.state.values);
			const issue = result.success ? undefined : result.error.issues[0];
			if (issue !== undefined) {
				await onInvalidSection(readEditorItemSectionForPath(issue.path));
				const focusInvalidField = () =>
					document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
				if (typeof requestAnimationFrame === "function") {
					requestAnimationFrame(focusInvalidField);
				} else {
					setTimeout(focusInvalidField, 0);
				}
			}
		}
		return submitSucceeded.current;
	}, [
		dirty,
		form,
		onInvalidSection,
		submitting,
	]);
	const actions = useMemo(
		() => ({
			discard,
			error: readSettledAsyncResultError(saveItemResult) ?? validationError,
			isDirty: dirty,
			isSaving: submitting,
			save,
		}),
		[
			dirty,
			discard,
			saveItemResult,
			save,
			submitting,
			validationError,
		],
	);
	useRegisterEditorFormActions(actions);

	return {
		canonicalItem,
		categoryOptions,
		isDirty: dirty,
		isSaving: submitting,
		form,
		initialItem,
		itemId,
		project,
		save,
	} as const;
};

export type EditorItemFormController = ReturnType<typeof useEditorItemFormController>;
