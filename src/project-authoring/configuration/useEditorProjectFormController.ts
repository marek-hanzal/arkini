import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useRef } from "react";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import { createEditorProjectConfigFn } from "~/project-authoring/configuration/fn/createEditorProjectConfigFn";
import { createEditorProjectFormSchema } from "~/project-authoring/configuration/createEditorProjectFormSchema";
import { readEditorProjectFormValuesFn } from "~/project-authoring/configuration/fn/readEditorProjectFormValuesFn";
import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorProjectFormSchema } from "~/project-authoring/configuration/EditorProjectFormSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import { saveEditorProjectConfigFx } from "~/project-authoring/configuration/saveEditorProjectConfigFx";
import { useAppForm } from "~/ui/form/EditorForm";
import type { EditorProjectSectionId } from "~/project-authoring/configuration/EditorProjectSections";
import { readEditorProjectSectionForPathFn } from "~/project-authoring/configuration/fn/readEditorProjectSectionForPathFn";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/useEditorUnsavedChangesRegistration";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";

const saveEditorProjectConfigCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveEditorProjectConfigFx.Props, "projectId">) =>
				saveEditorProjectConfigFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

/** Preserves breaking size warnings when another draft invariant prevents full config parsing. */
const analyzeEditorProjectStructuralCompatibilityFn = (
	project: Pick<EditorProject, "config">,
	value: EditorProjectFormSchema.Type,
) => {
	const board = SizeSchema.safeParse(value.board);
	const inventory = SizeSchema.safeParse(value.inventory);
	const toolbarSize = ToolbarSizeSchema.safeParse(value.toolbarSize);
	if (!board.success || !inventory.success || !toolbarSize.success) return undefined;
	const compatibility = analyzeEditorProjectCompatibilityFn(project.config, {
		...project.config,
		meta: {
			...project.config.meta,
			board: board.data,
			inventory: inventory.data,
			toolbarSize: toolbarSize.data,
		},
	});
	return compatibility.result === "major" ? compatibility : undefined;
};

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
		if (!parsed.success) return analyzeEditorProjectStructuralCompatibilityFn(project, values);
		const config = createEditorProjectConfigFn(project, parsed.data);
		return analyzeEditorProjectCompatibilityFn(project.config, config);
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
				await onInvalidSection(readEditorProjectSectionForPathFn(issue.path));
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
