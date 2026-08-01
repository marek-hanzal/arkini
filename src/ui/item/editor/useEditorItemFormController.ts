import { useAtomSet } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import {
	EditorItemFormSchema,
	type EditorItemFormValues,
} from "~/bridge/item/editor/EditorItemFormSchema";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { useRegisterEditorFormActions } from "~/ui/editor/EditorFormActions";
import { useAppForm } from "~/ui/form/EditorForm";
import {
	readEditorItemSectionForPath,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { useSaveEditorItemCommand } from "~/ui/item/editor/useSaveEditorItemCommand";

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
	const categoryOptions = Object.values(project.config?.categories ?? {}).map((category) => ({
		label: category.title,
		value: category.id,
	}));
	const setFormDirty = useAtomSet(EditorProjectFormDirtyAtom(project.projectId));
	const ownerId = `item:${initialItem.uid}`;
	const mutation = useSaveEditorItemCommand({
		expectedRevision: project.revision,
		itemUid: initialItem.uid,
		projectId: project.projectId,
	});
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
			const saved = await mutation.mutateAsync(item);
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
		mutation.reset();
		setFormDirty({
			dirty: false,
			ownerId,
		});
		form.reset(canonicalItem);
	}, [
		canonicalItem,
		form,
		mutation.reset,
		ownerId,
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
			error: mutation.error ?? validationError,
			isDirty: dirty,
			isSaving: submitting,
			save,
		}),
		[
			dirty,
			discard,
			mutation.error,
			save,
			submitting,
			validationError,
		],
	);
	useRegisterEditorFormActions(actions);

	return {
		canonicalItem,
		categoryOptions,
		form,
		initialItem,
		itemId,
		project,
		save,
	} as const;
};

export type EditorItemFormController = ReturnType<typeof useEditorItemFormController>;
