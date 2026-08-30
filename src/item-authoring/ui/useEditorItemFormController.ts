import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import {
	EditorItemFormSchema,
	type EditorItemFormValues,
} from "~/item-authoring/schema/EditorItemFormSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveEditorItemFx } from "~/item-authoring/fx/saveEditorItemFx";
import { useAppForm } from "~/ui/form/EditorForm";
import type {
	EditorItemOptionalCapability,
	EditorItemSectionId,
} from "~/item-authoring/type/EditorItemSection";
import { readEditorItemSectionForPathFn } from "~/item-authoring/fn/readEditorItemSectionForPathFn";
import { EditorItemDraftDefaults } from "~/item-authoring/ui/EditorItemDraftDefaults";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";

const saveEditorItemCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((item: saveEditorItemFx.Props["item"]) =>
				saveEditorItemFx({
					item,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

interface UseEditorItemFormControllerProps {
	readonly enableCapability?: EditorItemOptionalCapability;
	readonly initialItem: ItemSchema.Type;
	readonly onInvalidSection: (section: EditorItemSectionId) => void | Promise<void>;
	readonly onSaved?: (item: ItemSchema.Type) => void | Promise<void>;
}

/** Owns the one local TanStack Form session shared by all item section leaves. */
export const useEditorItemFormController = ({
	enableCapability,
	initialItem,
	onInvalidSection,
	onSaved,
}: UseEditorItemFormControllerProps) => {
	const project = useEditorProject();
	const canonicalItem = useMemo<EditorItemFormValues>(
		() => ({
			...initialItem,
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
	const saveItemAtom = saveEditorItemCommandAtom(project.projectId);
	const saveItemResult = useAtomValue(saveItemAtom);
	const saveItem = useAtomSet(saveItemAtom, {
		mode: "promise",
	});
	const submitSucceeded = useRef(false);
	const notifyOnSaved = useRef(true);
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
			formApi.reset({
				...saved,
				merge:
					saved.merge === undefined
						? undefined
						: [
								...saved.merge,
							],
			});
			if (notifyOnSaved.current) await onSaved?.(saved);
		},
	});
	const initializedCapability = useRef(false);
	useLayoutEffect(() => {
		if (initializedCapability.current || enableCapability === undefined) return;
		initializedCapability.current = true;
		switch (enableCapability) {
			case "charges":
				if (form.state.values.charges === undefined) {
					form.setFieldValue("charges", {
						amount: 1,
					});
				}
				break;
			case "merges":
				if (form.state.values.merge === undefined || form.state.values.merge.length === 0) {
					form.setFieldValue("merge", [
						structuredClone(EditorItemDraftDefaults.merge),
					]);
				}
				break;
		}
	}, [
		enableCapability,
		form,
	]);
	const itemId = useStore(form.store, (state) => state.values.id);
	const dirty = useStore(form.store, (state) => state.isDirty);
	const values = useStore(form.store, (state) => state.values);
	const compatibility = useMemo(() => {
		if (!dirty) return undefined;
		const parsed = EditorItemFormSchema.safeParse(values);
		if (!parsed.success) return undefined;
		const items = {
			...project.config.items,
		};
		if (initialItem.id !== parsed.data.id) delete items[initialItem.id];
		items[parsed.data.id] = parsed.data;
		return analyzeEditorProjectCompatibilityFn(project.config, {
			...project.config,
			items,
		});
	}, [
		dirty,
		initialItem.id,
		project,
		values,
	]);
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const validationError = useStore(form.store, (state) =>
		state.submissionAttempts > 0 && !state.isValid
			? "Fix the highlighted item fields before saving."
			: undefined,
	);
	const runSave = useCallback(
		async (notify: boolean) => {
			if (!dirty || submitting) return false;
			submitSucceeded.current = false;
			notifyOnSaved.current = notify;
			try {
				await form.handleSubmit();
			} finally {
				notifyOnSaved.current = true;
			}
			if (!submitSucceeded.current) {
				const result = EditorItemFormSchema.safeParse(form.state.values);
				const issue = result.success ? undefined : result.error.issues[0];
				if (issue !== undefined) {
					await onInvalidSection(readEditorItemSectionForPathFn(issue.path));
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
		},
		[
			dirty,
			form,
			onInvalidSection,
			submitting,
		],
	);
	const save = useCallback(
		() => runSave(true),
		[
			runSave,
		],
	);
	const saveDraft = useCallback(
		() => runSave(false),
		[
			runSave,
		],
	);
	useEditorUnsavedChangesRegistration({
		discard: () => form.reset(canonicalItem),
		id: `item:${project.projectId}:${initialItem.uid}`,
		isDirty: () => form.state.isDirty,
		isValid: () => EditorItemFormSchema.safeParse(form.state.values).success,
		ownsPathname: (pathname) =>
			pathname.startsWith(
				`/editor/${project.projectId}/editor/items/${initialItem.uid}/form`,
			),
		save: saveDraft,
	});
	return {
		canonicalItem,
		compatibility,
		error:
			RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveItemResult)) ??
			validationError,
		isDirty: dirty,
		isSaving: submitting,
		form,
		initialItem,
		itemId,
		project,
		save,
	} as const;
};
