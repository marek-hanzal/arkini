import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { FormSchema, type FormValues } from "~/item-authoring/schema/FormSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveFx } from "~/item-authoring/fx/saveFx";
import { useAppForm } from "~/authoring-form/ui/EditorForm";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionForPathFn } from "~/item-authoring/fn/readSectionForPathFn";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";

const saveCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((item: saveFx.Props["item"]) =>
				saveFx({
					item,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useFormController {
	export interface Props {
		readonly enableCapability?: OptionalCapability;
		readonly initialItem: ItemSchema.Type;
		readonly onInvalidSection: (section: SectionId) => void | Promise<void>;
		readonly onSaved?: (item: ItemSchema.Type) => void | Promise<void>;
	}

	export type Output = ReturnType<typeof useFormController>;
}

/** Owns the one local TanStack Form session shared by all item section leaves. */
export const useFormController = ({
	enableCapability,
	initialItem,
	onInvalidSection,
	onSaved,
}: useFormController.Props) => {
	const project = useEditorProject();
	const canonicalItem = useMemo<FormValues>(
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
	const saveItemAtom = saveCommandAtom(project.projectId);
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
			onDynamic: FormSchema,
		},
		onSubmit: async ({ formApi, value }) => {
			const item = FormSchema.parse(value);
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
						structuredClone(MergeDraftDefault),
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
		const parsed = FormSchema.safeParse(values);
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
				const result = FormSchema.safeParse(form.state.values);
				const issue = result.success ? undefined : result.error.issues[0];
				if (issue !== undefined) {
					await onInvalidSection(readSectionForPathFn(issue.path));
					const focusInvalidField = () =>
						document.querySelector<HTMLElement>("[data-ui-invalid='true']")?.focus();
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
		isValid: () => FormSchema.safeParse(form.state.values).success,
		ownsPathname: (pathname) =>
			pathname.startsWith(
				`/editor/${project.projectId}/editor/items/${initialItem.uid}/form`,
			),
		save: saveDraft,
	});
	const error =
		RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveItemResult)) ?? validationError;
	return useMemo(
		() => ({
			canonicalItem,
			compatibility,
			error,
			isDirty: dirty,
			isSaving: submitting,
			form,
			initialItem,
			itemId,
			project,
			save,
		}),
		[
			canonicalItem,
			compatibility,
			dirty,
			error,
			form,
			initialItem,
			itemId,
			project,
			save,
			submitting,
		],
	);
};
