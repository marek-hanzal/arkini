import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useCallback, useMemo, useRef } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { createEditorProjectConfigFn } from "~/ui/project/editor/fn/createEditorProjectConfigFn";
import { createEditorProjectFormSchema } from "~/ui/project/editor/createEditorProjectFormSchema";
import { analyzeEditorProjectStructuralCompatibilityFx } from "~/ui/project/editor/analyzeEditorProjectStructuralCompatibilityFx";
import { readEditorProjectFormValuesFn } from "~/ui/project/editor/fn/readEditorProjectFormValuesFn";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { saveEditorProjectConfigCommandAtom } from "~/ui/project/editor/saveEditorProjectConfigCommandAtom";
import { useAppForm } from "~/ui/form/EditorForm";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { readEditorProjectSectionForPathFx } from "~/ui/project/editor/readEditorProjectSectionForPathFx";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/ui/editor/useEditorUnsavedChangesRegistration";
import { analyzeEditorProjectCompatibilityFx } from "~/editor/version/analyzeEditorProjectCompatibilityFx";

export const useEditorProjectFormController = ({
	onInvalidSection,
}: {
	readonly onInvalidSection: (section: EditorProjectSectionId) => void | Promise<void>;
}) => {
	const project = useEditorProject();
	const canonicalValues = useMemo(
		() => readEditorProjectFormValuesFn(project),
		[
			project,
		],
	);
	const schema = useMemo(
		() => createEditorProjectFormSchema(project),
		[
			project,
		],
	);
	const saveConfigAtom = saveEditorProjectConfigCommandAtom(project.projectId);
	const saveResult = useAtomValue(saveConfigAtom);
	const saveConfig = useAtomSet(saveConfigAtom, {
		mode: "promise",
	});
	const submitSucceeded = useRef(false);
	const form = useAppForm({
		defaultValues: canonicalValues,
		validationLogic: revalidateLogic({
			mode: "submit",
			modeAfterSubmission: "change",
		}),
		validators: {
			onDynamic: schema,
		},
		onSubmit: async ({ formApi, value }) => {
			const parsed = schema.parse(value);
			const config = createEditorProjectConfigFn(project, parsed);
			await saveConfig({
				config,
				expectedRevision: project.revision,
			});
			submitSucceeded.current = true;
			formApi.reset(parsed);
		},
	});
	const dirty = useStore(form.store, (state) => state.isDirty);
	const values = useStore(form.store, (state) => state.values);
	const compatibility = useMemo(() => {
		if (!dirty) return undefined;
		const parsed = schema.safeParse(values);
		if (!parsed.success)
			return RendererRuntime.runSync(
				analyzeEditorProjectStructuralCompatibilityFx(project, values),
			);
		const config = createEditorProjectConfigFn(project, parsed.data);
		return RendererRuntime.runSync(analyzeEditorProjectCompatibilityFx(project.config, config));
	}, [
		dirty,
		project,
		schema,
		values,
	]);
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const validationError = useStore(form.store, (state) =>
		state.submissionAttempts > 0 && !state.isValid
			? "Fix the highlighted project fields before saving."
			: undefined,
	);
	const save = useCallback(async () => {
		if (!dirty || submitting) return false;
		submitSucceeded.current = false;
		await form.handleSubmit();
		if (!submitSucceeded.current) {
			const result = schema.safeParse(form.state.values);
			const issue = result.success ? undefined : result.error.issues[0];
			if (issue !== undefined) {
				await onInvalidSection(
					RendererRuntime.runSync(readEditorProjectSectionForPathFx(issue.path)),
				);
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
		schema,
		submitting,
	]);
	useEditorUnsavedChangesRegistration({
		discard: () => form.reset(canonicalValues),
		id: `project:${project.projectId}`,
		isDirty: () => form.state.isDirty,
		isValid: () => schema.safeParse(form.state.values).success,
		ownsPathname: (pathname) => pathname.startsWith(`/editor/${project.projectId}/project`),
		save,
	});

	return {
		canonicalValues,
		compatibility,
		error:
			RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult)) ?? validationError,
		form,
		isDirty: dirty,
		isSaving: submitting,
		project,
		save,
	} as const;
};

export type EditorProjectFormController = ReturnType<typeof useEditorProjectFormController>;
