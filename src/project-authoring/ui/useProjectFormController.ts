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
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import { useAppForm } from "~/authoring-form/ui/EditorForm";
import { useAuthoringFormValidation } from "~/authoring-form/ui/useAuthoringFormValidation";
import { useAuthoringDraftRevision } from "~/authoring-form/ui/useAuthoringDraftRevision";
import {
	readProjectFormDestinationForPathFn,
	type ProjectFormDestination,
} from "~/project-authoring/fn/readProjectFormDestinationForPathFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";

const ProjectFormPathLabelBySegment = {
	avatars: "About avatars",
	board: "Board",
	height: "Height",
	hero: "Hero asset",
	inventory: "Inventory",
	quantity: "Quantity",
	start: "Initial layout",
	title: "Title",
	toolbar: "Toolbar",
	toolbarSize: "Toolbar slots",
	width: "Width",
} as const satisfies Partial<Record<string, string>>;

const readProjectFormValidationLocationFn = (
	path: ReadonlyArray<PropertyKey>,
	values: ProjectFormSchema.Type,
) => {
	const [head, second, third] = path;
	if (head === "avatars" && typeof second === "number") return `About avatar ${second + 1}`;
	if (head === "start" && second === "board" && typeof third === "number") {
		const entry = values.start.board[third];
		return entry === undefined
			? `Initial board item ${third + 1}`
			: `Initial board → space ${entry.space} → slot ${entry.x + 1}, ${entry.y + 1}`;
	}
	if (head === "start" && second === "inventory" && typeof third === "number") {
		const entry = values.start.inventory[third];
		return entry === undefined
			? `Initial inventory item ${third + 1}`
			: `Initial inventory → slot ${entry.position.x + 1}, ${entry.position.y + 1}`;
	}
	if (head === "start" && second === "toolbar" && typeof third === "number") {
		const entry = values.start.toolbar[third];
		return entry === undefined
			? `Initial toolbar item ${third + 1}`
			: `Initial toolbar → slot ${entry.position.x + 1}`;
	}
	const labels = path.flatMap((segment) => {
		if (typeof segment !== "string") return [];
		const label =
			ProjectFormPathLabelBySegment[segment as keyof typeof ProjectFormPathLabelBySegment];
		return label === undefined
			? []
			: [
					label,
				];
	});
	return labels.length === 0 ? "Project" : labels.join(" → ");
};

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

export namespace useProjectFormController {
	export interface Props {
		readonly onInvalidDestinationFn: (
			destination: ProjectFormDestination,
		) => void | Promise<void>;
		readonly onSavedFn?: () => void | Promise<void>;
	}

	/** Inferred to preserve TanStack Form's configured hook API without mirroring generics. */
	export type Output = ReturnType<typeof useProjectFormController>;
}

export const useProjectFormController = ({
	onInvalidDestinationFn,
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
				expectedRevision: draftRevision.current,
			});
			submitSucceeded.current = true;
			formApi.reset(parsed);
			if (notifyOnSaved.current) await onSavedFn?.();
		},
	});
	const dirty = useStore(form.store, (state) => state.isDirty);
	const touched = useStore(form.store, (state) => state.isTouched);
	const draftRevision = useAuthoringDraftRevision(project.revision, touched);
	const submitting = useStore(form.store, (state) => state.isSubmitting);
	const submissionAttempts = useStore(form.store, (state) => state.submissionAttempts);
	const currentValues = useStore(form.store, (state) => state.values);
	const validationIssues = useAuthoringFormValidation({
		schema,
		submissionAttempts,
		values: currentValues,
	});
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
					await onInvalidDestinationFn(readProjectFormDestinationForPathFn(issue.path));
					const focusInvalidFieldFn = () =>
						document
							.querySelector<HTMLElement>(
								"input[data-ui-invalid='true'], textarea[data-ui-invalid='true'], button[data-ui-invalid='true'], [data-ui-invalid='true'] input, [data-ui-invalid='true'] textarea, [data-ui-invalid='true'] button",
							)
							?.focus();
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
			onInvalidDestinationFn,
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
	const firstValidationIssue = validationIssues[0];
	const error =
		RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult)) ??
		(firstValidationIssue === undefined
			? undefined
			: `${readProjectFormValidationLocationFn(firstValidationIssue.path, currentValues)}: ${firstValidationIssue.message}`);
	return useMemo(
		() => ({
			canonicalValues,
			discardFn,
			error,
			form,
			isDirty: dirty,
			isSaving: submitting,
			project,
			saveFn,
			validationIssues,
		}),
		[
			canonicalValues,
			discardFn,
			dirty,
			error,
			form,
			project,
			saveFn,
			submitting,
			validationIssues,
		],
	);
};
