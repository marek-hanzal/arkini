import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { type FormValues } from "~/item-authoring/schema/FormSchema";
import { createFormSchema } from "~/item-authoring/schema/createFormSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveFx } from "~/item-authoring/fx/saveFx";
import { useAppForm } from "~/authoring-form/ui/EditorForm";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionForPathFn } from "~/item-authoring/fn/readSectionForPathFn";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";

const saveCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveFx.Props, "projectId">) =>
				saveFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useFormController {
	export interface Props {
		readonly enableCapability?: OptionalCapability;
		readonly initialItem: ItemSchema.Type;
		readonly onInvalidSectionFn: (
			section: SectionId,
			path: ReadonlyArray<PropertyKey>,
		) => void | Promise<void>;
		readonly onSavedFn?: (item: ItemSchema.Type) => void | Promise<void>;
	}

	/** Inferred to preserve TanStack Form's configured hook API without mirroring generics. */
	export type Output = ReturnType<typeof useFormController>;
}

const readFormValuesFn = (item: ItemSchema.Type): FormValues => ({
	...item,
	asset: {
		default: [
			item.asset.default[0],
			item.asset.default[1] ?? "",
		],
		sources:
			item.asset.sources === undefined
				? [
						"",
					]
				: [
						...item.asset.sources,
					],
	},
	merge:
		item.merge === undefined
			? undefined
			: [
					...item.merge,
				],
});

/** Owns the one local TanStack Form session shared by all item section leaves. */
export const useFormController = ({
	enableCapability,
	initialItem,
	onInvalidSectionFn,
	onSavedFn,
}: useFormController.Props) => {
	const project = useEditorProject();
	const formValues = useMemo<FormValues>(
		() => readFormValuesFn(initialItem),
		[
			initialItem,
		],
	);
	const schema = useMemo(
		() => createFormSchema(project, initialItem.uid),
		[
			initialItem.uid,
			project,
		],
	);
	const saveItemAtom = saveCommandAtom(project.projectId);
	const saveItemResult = useAtomValue(saveItemAtom);
	const saveItemFn = useAtomSet(saveItemAtom, {
		mode: "promise",
	});
	const submitSucceeded = useRef(false);
	const notifyOnSaved = useRef(true);
	const form = useAppForm({
		defaultValues: formValues,
		validationLogic: revalidateLogic({
			mode: "submit",
			modeAfterSubmission: "change",
		}),
		validators: {
			onDynamic: schema,
		},
		onSubmit: async ({ formApi, value }) => {
			const item = schema.parse(value);
			const saved = await saveItemFn({
				config: project.config,
				expectedRevision: project.revision,
				item,
			});
			submitSucceeded.current = true;
			formApi.reset(readFormValuesFn(saved));
			if (notifyOnSaved.current) await onSavedFn?.(saved);
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
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const validationError = useStore(form.store, (state) =>
		state.submissionAttempts > 0 && !state.isValid
			? "Fix the highlighted item fields before saving."
			: undefined,
	);
	const runSaveFn = useCallback(
		async (notify: boolean) => {
			if (submitting || !dirty) return false;
			notifyOnSaved.current = notify;
			submitSucceeded.current = false;
			try {
				await form.handleSubmit();
			} finally {
				notifyOnSaved.current = true;
			}
			if (submitSucceeded.current) return true;

			const result = schema.safeParse(form.state.values);
			if (result.success) return false;
			const issue = result.error.issues[0];
			if (issue === undefined) return false;

			await onInvalidSectionFn(readSectionForPathFn(issue.path), issue.path);
			const focusInvalidFieldFn = () =>
				document.querySelector<HTMLElement>("[data-ui-invalid='true']")?.focus();
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(focusInvalidFieldFn);
			} else {
				setTimeout(focusInvalidFieldFn, 0);
			}
			return false;
		},
		[
			dirty,
			form,
			onInvalidSectionFn,
			schema,
			submitting,
		],
	);
	const saveFn = useCallback(
		() => runSaveFn(true),
		[
			runSaveFn,
		],
	);
	const saveDraftFn = useCallback(
		() => runSaveFn(false),
		[
			runSaveFn,
		],
	);
	const discardFn = useCallback(
		() => form.reset(formValues),
		[
			form,
			formValues,
		],
	);
	useEditorUnsavedChangesRegistration({
		discardFn,
		id: `item:${project.projectId}:${initialItem.uid}`,
		isDirtyFn: () => form.state.isDirty,
		isValidFn: () => schema.safeParse(form.state.values).success,
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(
				`/editor/${project.projectId}/editor/items/${initialItem.uid}/form`,
			),
		saveFn: saveDraftFn,
	});
	const error =
		RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveItemResult)) ?? validationError;
	return useMemo(
		() => ({
			canonicalItem: initialItem,
			discardFn,
			error,
			isDirty: dirty,
			isSaving: submitting,
			form,
			initialItem,
			itemId,
			project,
			saveFn,
		}),
		[
			discardFn,
			dirty,
			error,
			form,
			initialItem,
			itemId,
			project,
			saveFn,
			submitting,
		],
	);
};
