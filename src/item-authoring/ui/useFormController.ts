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
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { readSectionForPathFn } from "~/item-authoring/fn/readSectionForPathFn";
import { MergeDraftDefault } from "~/item-authoring/ui/MergeDraftDefault";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readEditorFormValidationMessageFn as readSharedValidationMessageFn } from "~/editor-control/fn/readEditorFormValidationMessageFn";

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

const FormPathLabelBySegment = {
	action: "Source action",
	adjustMs: "Runtime adjustment",
	amount: "Amount",
	asset: "Artwork",
	capacity: "Buffer",
	chance: "Chance",
	charges: "Charges",
	cost: "Cost",
	default: "Default",
	description: "Description",
	distance: "Board distance",
	durationMs: "Duration",
	effect: "Target effect",
	enable: "Enabled",
	from: "Paid by",
	hint: "Hint",
	id: "ID",
	max: "Maximum",
	maxCount: "Maximum global count",
	maxQueueSize: "Maximum parallel jobs",
	maxStackSize: "Maximum stack size",
	min: "Minimum",
	mode: "Material mode",
	multiplier: "Runtime multiplier",
	output: "Output",
	placement: "Board placement",
	quantity: "Quantity",
	result: "Replacement item",
	runtimeMs: "Runtime",
	selector: "Selected item",
	show: "Visible",
	space: "Space",
	target: "Target item",
	title: "Title",
	type: "Type",
	weight: "Weight",
} as const satisfies Partial<Record<string, string>>;

const FormIndexedPathLabelBySegment = {
	input: "Input",
	lines: "Production line",
	merge: "Merge",
	roll: "Roll",
	rules: "Rule",
	set: "Output set",
	sources: "Alternate artwork",
	when: "Condition",
} as const satisfies Partial<Record<string, string>>;

const readFormValidationLocationFn = (path: ReadonlyArray<PropertyKey>) => {
	const labels: string[] = [];
	const dropCollectionCount = path.filter(
		(segment, index) => segment === "drop" && typeof path[index + 1] === "number",
	).length;
	let dropCollectionIndex = 0;
	for (let index = 0; index < path.length; index += 1) {
		const segment = path[index];
		const nestedIndex = path[index + 1];
		const indexedLabel =
			typeof segment === "string" && typeof nestedIndex === "number"
				? FormIndexedPathLabelBySegment[
						segment as keyof typeof FormIndexedPathLabelBySegment
					]
				: undefined;
		if (indexedLabel !== undefined && typeof nestedIndex === "number") {
			labels.push(`${indexedLabel} ${nestedIndex + 1}`);
			index += 1;
			continue;
		}
		if (segment === "line") {
			labels.push("Product line");
			continue;
		}
		if (segment === "drop" && typeof nestedIndex === "number") {
			labels.push(
				dropCollectionCount > 1 && dropCollectionIndex === 0
					? `Weighted candidate ${nestedIndex + 1}`
					: `Drop ${nestedIndex + 1}`,
			);
			dropCollectionIndex += 1;
			index += 1;
			continue;
		}
		if (segment === "query") continue;
		if (segment === "itemId") {
			if (path[index - 1] === "selector") continue;
			if (path.includes("drop")) labels.push("Dropped item");
			else if (labels.at(-1) !== "Target item") labels.push("Item");
			continue;
		}
		if (typeof segment !== "string") continue;
		const label = FormPathLabelBySegment[segment as keyof typeof FormPathLabelBySegment];
		if (label !== undefined && labels.at(-1) !== label) labels.push(label);
	}
	return labels.length === 0 ? "Item" : labels.join(" → ");
};

const readFormValidationMessageFn = (issue: z.core.$ZodIssue) =>
	issue.path.at(-1) === "itemId" && issue.code === "too_small"
		? "Select an item."
		: readSharedValidationMessageFn(issue);

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
	const submissionAttempts = useStore(form.store, (state) => state.submissionAttempts);
	const currentValues = useStore(form.store, (state) => state.values);
	const validationIssues = useAuthoringFormValidation({
		readMessageFn: readFormValidationMessageFn,
		schema,
		submissionAttempts,
		values: currentValues,
	});
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
	const firstValidationIssue = validationIssues[0];
	const error =
		persistenceError ??
		(firstValidationIssue === undefined
			? undefined
			: `${readFormValidationLocationFn(firstValidationIssue.path)}: ${firstValidationIssue.message}`);
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
			validationIssues,
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
			validationIssues,
		],
	);
};
