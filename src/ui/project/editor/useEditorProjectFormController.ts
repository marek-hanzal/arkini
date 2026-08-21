import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useCallback, useMemo, useRef } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { createEditorProjectConfigFx } from "~/bridge/project/editor/createEditorProjectConfigFx";
import { createEditorProjectFormSchemaFx } from "~/bridge/project/editor/createEditorProjectFormSchemaFx";
import { readEditorProjectFormValuesFx } from "~/bridge/project/editor/readEditorProjectFormValuesFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { saveEditorProjectConfigCommandAtom } from "~/bridge/project/editor/saveEditorProjectConfigCommandAtom";
import { useAppForm } from "~/ui/form/EditorForm";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { readEditorProjectSectionForPathFx } from "~/ui/project/editor/readEditorProjectSectionForPathFx";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultError";
import { useEditorUnsavedChangesRegistration } from "~/ui/editor/useEditorUnsavedChangesRegistration";

export const useEditorProjectFormController = ({
	onInvalidSection,
}: {
	readonly onInvalidSection: (section: EditorProjectSectionId) => void | Promise<void>;
}) => {
	const project = useEditorProject();
	const canonicalValues = useMemo(
		() => RendererRuntime.runSync(readEditorProjectFormValuesFx(project)),
		[
			project,
		],
	);
	const schema = useMemo(
		() => RendererRuntime.runSync(createEditorProjectFormSchemaFx(project)),
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
			const config = RendererRuntime.runSync(createEditorProjectConfigFx(project, parsed));
			await saveConfig({
				config,
				expectedRevision: project.revision,
			});
			submitSucceeded.current = true;
			formApi.reset(parsed);
		},
	});
	const dirty = useStore(form.store, (state) => state.isDirty);
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
	useEditorUnsavedChangesRegistration(`project:${project.projectId}`, {
		discard: () => form.reset(canonicalValues),
		isDirty: () => form.state.isDirty,
		isValid: () => schema.safeParse(form.state.values).success,
		ownsPathname: (pathname) => pathname.startsWith(`/editor/${project.projectId}/project`),
		save,
	});

	return {
		canonicalValues,
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
