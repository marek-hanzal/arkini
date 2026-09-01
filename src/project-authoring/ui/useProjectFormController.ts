import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useRef } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { createProjectFormSchema } from "~/project-authoring/schema/createProjectFormSchema";
import type { Project } from "~/project-authoring/type/Project";
import {
	type ProjectFormSchema,
	ProjectAvatarKeys,
} from "~/project-authoring/schema/ProjectFormSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import { useAppForm } from "~/authoring-form/ui/EditorForm";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { analyzeProjectCompatibilityFn } from "~/project-version/fn/analyzeProjectCompatibilityFn";

const createProjectConfigFn = (
	project: Pick<Project, "config">,
	value: ProjectFormSchema.Type,
): GameConfigSchema.Type => {
	const avatarResources = Object.fromEntries(
		ProjectAvatarKeys.flatMap((key, index) => {
			const resourceId = value.avatars[index];
			return resourceId === undefined
				? []
				: [
						[
							key,
							resourceId,
						],
					];
		}),
	);
	return {
		...project.config,
		meta: {
			...project.config.meta,
			title: value.title,
			board: value.board,
			inventory: value.inventory,
			toolbarSize: value.toolbarSize,
		},
		resources: {
			hero: value.hero,
			...avatarResources,
		},
		start: value.start,
	};
};

const readProjectFormValuesFn = (project: Pick<Project, "config">): ProjectFormSchema.Type => ({
	title: project.config.meta.title,
	hero: project.config.resources.hero,
	avatars: ProjectAvatarKeys.flatMap((key) => {
		const resourceId = project.config.resources[key];
		return resourceId === undefined
			? []
			: [
					resourceId,
				];
	}),
	board: {
		...project.config.meta.board,
	},
	inventory: {
		...project.config.meta.inventory,
	},
	toolbarSize: project.config.meta.toolbarSize ?? 0,
	start: {
		currentSpace: project.config.start.currentSpace,
		board: project.config.start.board.map((entry) => ({
			...entry,
			quantity: entry.quantity ?? 1,
		})),
		inventory: project.config.start.inventory.map((entry) => ({
			...entry,
			position: {
				...entry.position,
			},
			quantity: entry.quantity ?? 1,
		})),
		toolbar: project.config.start.toolbar.map((entry) => ({
			...entry,
			position: {
				...entry.position,
			},
			quantity: entry.quantity ?? 1,
		})),
	},
});

const saveProjectConfigCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveProjectConfigFx.Props, "projectId">) =>
				saveProjectConfigFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

/** Preserves breaking size warnings when another draft invariant prevents full config parsing. */
const analyzeProjectStructuralCompatibilityFn = (
	project: Pick<Project, "config">,
	value: ProjectFormSchema.Type,
) => {
	const board = SizeSchema.safeParse(value.board);
	const inventory = SizeSchema.safeParse(value.inventory);
	const toolbarSize = ToolbarSizeSchema.safeParse(value.toolbarSize);
	if (!board.success || !inventory.success || !toolbarSize.success) return undefined;
	const compatibility = analyzeProjectCompatibilityFn(project.config, {
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

export namespace useProjectFormController {
	export interface Props {
		readonly onInvalidSectionFn: (section: ProjectSectionId) => void | Promise<void>;
		readonly onSavedFn?: () => void | Promise<void>;
	}

	/** Inferred to preserve TanStack Form's configured hook API without mirroring generics. */
	export type Output = ReturnType<typeof useProjectFormController>;
}

export const useProjectFormController = ({
	onInvalidSectionFn,
	onSavedFn,
}: useProjectFormController.Props) => {
	const project = useEditorProject();
	const canonicalValues = useMemo(
		() => readProjectFormValuesFn(project),
		[
			project,
		],
	);
	const schema = useMemo(
		() => createProjectFormSchema(project),
		[
			project,
		],
	);
	const saveConfigAtom = saveProjectConfigCommandAtom(project.projectId);
	const saveResult = useAtomValue(saveConfigAtom);
	const saveConfigFn = useAtomSet(saveConfigAtom, {
		mode: "promise",
	});
	const submitSucceeded = useRef(false);
	const notifyOnSaved = useRef(true);
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
			const config = createProjectConfigFn(project, parsed);
			await saveConfigFn({
				config,
				expectedRevision: project.revision,
			});
			submitSucceeded.current = true;
			formApi.reset(parsed);
			if (notifyOnSaved.current) await onSavedFn?.();
		},
	});
	const dirty = useStore(form.store, (state) => state.isDirty);
	const values = useStore(form.store, (state) => state.values);
	const compatibility = useMemo(() => {
		if (!dirty) return undefined;
		const parsed = schema.safeParse(values);
		if (!parsed.success) return analyzeProjectStructuralCompatibilityFn(project, values);
		const config = createProjectConfigFn(project, parsed.data);
		return analyzeProjectCompatibilityFn(project.config, config);
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
	const runSaveFn = useCallback(
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
				const result = schema.safeParse(form.state.values);
				const issue = result.success ? undefined : result.error.issues[0];
				if (issue !== undefined) {
					await onInvalidSectionFn(readProjectSectionForPathFn(issue.path));
					const focusInvalidFieldFn = () =>
						document.querySelector<HTMLElement>("[data-ui-invalid='true']")?.focus();
					if (typeof requestAnimationFrame === "function") {
						requestAnimationFrame(focusInvalidFieldFn);
					} else {
						setTimeout(focusInvalidFieldFn, 0);
					}
				}
			}
			return submitSucceeded.current;
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
		() => form.reset(canonicalValues),
		[
			canonicalValues,
			form,
		],
	);
	useEditorUnsavedChangesRegistration({
		discardFn,
		id: `project:${project.projectId}`,
		isDirtyFn: () => form.state.isDirty,
		isValidFn: () => schema.safeParse(form.state.values).success,
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/project/form`),
		saveFn: saveDraftFn,
	});
	const error =
		RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult)) ?? validationError;
	return useMemo(
		() => ({
			canonicalValues,
			compatibility,
			discardFn,
			error,
			form,
			isDirty: dirty,
			isSaving: submitting,
			project,
			saveFn,
		}),
		[
			canonicalValues,
			compatibility,
			discardFn,
			dirty,
			error,
			form,
			project,
			saveFn,
			submitting,
		],
	);
};
