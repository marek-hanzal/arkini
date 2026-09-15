import { copyItemSectionFn } from "~/item-authoring/fn/copyItemSectionFn";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { z } from "zod";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { type FormValues } from "~/item-authoring/schema/FormSchema";
import { createFormSchema } from "~/item-authoring/schema/createFormSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveFx } from "~/item-authoring/fx/saveFx";
import { useAppForm } from "~/authoring-form/ui/EditorForm";
import { useAuthoringFormValidation } from "~/authoring-form/ui/useAuthoringFormValidation";
import { useAuthoringDraftRevision } from "~/authoring-form/ui/useAuthoringDraftRevision";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionForPathFn } from "~/item-authoring/fn/readSectionForPathFn";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readEditorFormValidationMessageFn as readSharedValidationMessageFn } from "~/editor-control/fn/readEditorFormValidationMessageFn";
import { useTranslator } from "~/translation/ui/useTranslator";

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
		readonly isNew: boolean;
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
	description: item.description ?? "",
	artwork: {
		scale: item.artwork.scale,
		default: [
			item.artwork.default[0],
			item.artwork.default[1] ?? "",
		],
	},
	merge:
		item.merge === undefined
			? undefined
			: [
					...item.merge,
				],
});

const readFormValidationMessageFn = (issue: z.core.$ZodIssue, textFn: (key: string) => string) => {
	if (issue.path.at(-1) === "itemId" && issue.code === "too_small")
		return textFn("Select an item.");
	switch (issue.message) {
		case "This Item ID is already in use.":
			return textFn("This Item ID is already in use.");
		case "Enable Units on this item before selecting Spend.":
			return textFn("Enable Units on this item before selecting Spend.");
		case "Selected target must have Units enabled before choosing Spend.":
			return textFn("Selected target must have Units enabled before choosing Spend.");
		case "Enable Units on this item before selecting Self.":
			return textFn("Enable Units on this item before selecting Self.");
		case "Selected target must have Units enabled.":
			return textFn("Selected target must have Units enabled.");
		default:
			return readSharedValidationMessageFn(issue, textFn);
	}
};

/** Owns the one local TanStack Form session shared by all item section leaves. */
export const useFormController = ({
	enableCapability,
	initialItem,
	isNew,
	onInvalidSectionFn,
	onSavedFn,
}: useFormController.Props) => {
	const project = useEditorProject();
	const translator = useTranslator();
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
				expectedRevision: draftRevision.current,
				item,
			});
			submitSucceeded.current = true;
			formApi.reset(readFormValuesFn(saved));
			if (notifyOnSaved.current) await onSavedFn?.(saved);
		},
	});
	const copySectionFn = useCallback(
		(source: ItemSchema.Type, section: copyItemSectionFn.Section) => {
			if (form.state.isSubmitting || source.uid === initialItem.uid) return;
			const current = form.state.values;
			const next = copyItemSectionFn(current, source, section);
			if (current.title !== next.title) form.setFieldValue("title", next.title);
			if (current.description !== next.description)
				form.setFieldValue("description", next.description);
			if (current.control !== next.control) form.setFieldValue("control", next.control);
			if (current.scope !== next.scope) form.setFieldValue("scope", next.scope);
			if (current.maxStackSize !== next.maxStackSize)
				form.setFieldValue("maxStackSize", next.maxStackSize);
			if (current.maxCount !== next.maxCount) form.setFieldValue("maxCount", next.maxCount);
			if (current.artwork !== next.artwork) form.setFieldValue("artwork", next.artwork);
			if (current.lines !== next.lines) form.setFieldValue("lines", next.lines);
			if (current.maxQueueSize !== next.maxQueueSize)
				form.setFieldValue("maxQueueSize", next.maxQueueSize);
			if (current.merge !== next.merge) form.setFieldValue("merge", next.merge);
			if (current.units !== next.units) form.setFieldValue("units", next.units);
			if (current.clock !== next.clock) form.setFieldValue("clock", next.clock);
			if (current.action !== next.action) form.setFieldValue("action", next.action);
		},
		[
			form,
			initialItem.uid,
		],
	);
	const enableClockFn = useCallback(() => {
		if (form.state.values.clock !== undefined) return;
		form.setFieldValue("action", undefined);
		form.setFieldValue("maxStackSize", 1);
		form.setFieldValue("clock", {
			durationMs: 300_000,
			enable: true,
			rules: [],
		});
	}, [
		form,
	]);
	const enableActionFn = useCallback(() => {
		if (form.state.values.action !== undefined) return;
		form.setFieldValue("lines", []);
		form.setFieldValue("clock", undefined);
		form.setFieldValue("action", {
			type: "space",
			space: 0,
			input: [],
			rules: [],
		});
	}, [
		form,
	]);
	const enableProductionFn = useCallback(() => {
		if ((form.state.values.lines ?? []).length > 0) return;
		form.setFieldValue("action", undefined);
		form.setFieldValue("lines", [
			createLineFn([], "", ""),
		]);
	}, [
		form,
	]);
	const initializedCapability = useRef(false);
	useLayoutEffect(() => {
		if (initializedCapability.current || enableCapability === undefined) return;
		initializedCapability.current = true;
		switch (enableCapability) {
			case "action":
				enableActionFn();
				break;
			case "production":
				enableProductionFn();
				break;
			case "clock":
				enableClockFn();
				break;
			case "units":
				if (form.state.values.units === undefined) {
					form.setFieldValue("units", {
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
		enableActionFn,
		enableProductionFn,
		enableClockFn,
		form,
	]);
	const dirty = useStore(form.store, (state) => state.isDirty);
	const touched = useStore(form.store, (state) => state.isTouched);
	const draftRevision = useAuthoringDraftRevision(project.revision, touched);
	const itemId = useStore(form.store, (state) => state.values.id);
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const submissionAttempts = useStore(form.store, (state) => state.submissionAttempts);
	const currentValues = useStore(form.store, (state) => state.values);
	const readValidationMessageFn = useCallback(
		(issue: z.core.$ZodIssue) => readFormValidationMessageFn(issue, translator.textFn),
		[
			translator.textFn,
		],
	);
	const validationIssues = useAuthoringFormValidation({
		readMessageFn: readValidationMessageFn,
		schema,
		submissionAttempts,
		values: currentValues,
	});
	const runSaveFn = useCallback(
		async (notify: boolean) => {
			if (submitting || (!dirty && !isNew)) return false;
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
				document
					.querySelector<HTMLElement>(
						"input[data-ui-invalid='true'], textarea[data-ui-invalid='true'], [data-ui-invalid='true'] input, [data-ui-invalid='true'] textarea, [data-ui-invalid='true'] button",
					)
					?.focus();
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
			isNew,
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
	const persistenceError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveItemResult));
	return useMemo(
		() => ({
			canonicalItem: initialItem,
			copySectionFn,
			discardFn,
			enableClockFn,
			enableActionFn,
			enableProductionFn,
			error: persistenceError,
			isDirty: dirty,
			isSaving: submitting,
			form,
			initialItem,
			itemId,
			project,
			saveFn,
			validationIssues,
		}),
		[
			copySectionFn,
			discardFn,
			enableClockFn,
			enableActionFn,
			enableProductionFn,
			dirty,
			persistenceError,
			form,
			initialItem,
			itemId,
			project,
			saveFn,
			submitting,
			validationIssues,
		],
	);
};
