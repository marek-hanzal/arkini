import { Effect } from "effect";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";

export namespace useTemplateFormController {
	export interface Props {
		readonly template?: TemplateSchema.Type;
		readonly onSavedFn: (uid: string) => void | Promise<void>;
	}
}

/** One revision-pinned template draft; admitted persistence outlives its mounted form. */
export const useTemplateFormController = ({
	template,
	onSavedFn,
}: useTemplateFormController.Props) => {
	const project = useEditorProject();
	const [initial] = useState(() => ({
		revision: project.revision,
		value: template ?? {
			uid: RendererRuntime.runSync(
				Effect.flatMap(RuntimeIdentityFx, (identityFx) => identityFx),
			),
			title: "",
			...project.config.meta.board,
			board: [],
		},
	}));
	const [value, setValueFn] = useState<TemplateSchema.Type>(initial.value);
	const [savedValue, setSavedValueFn] = useState(initial.value);
	const [error, setErrorFn] = useState<string>();
	const [attemptedSave, setAttemptedSaveFn] = useState(false);
	const [touchedFields, setTouchedFieldsFn] = useState<ReadonlySet<string>>(() => new Set());
	const [saving, setSavingFn] = useState(false);
	const pending = useRef(false);
	const generation = useRef(0);
	const revision = useRef(initial.revision);
	useLayoutEffect(
		() => () => {
			generation.current += 1;
		},
		[],
	);
	const dirty = JSON.stringify(value) !== JSON.stringify(savedValue);
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const validation = TemplateSchema.safeParse(value);
	const touchFieldFn = useCallback((field: string) => {
		setTouchedFieldsFn((current) => new Set(current).add(field));
		setErrorFn(undefined);
	}, []);
	const discardFn = useCallback(() => {
		dirtyRef.current = false;
		setValueFn(savedValue);
		setErrorFn(undefined);
		setAttemptedSaveFn(false);
		setTouchedFieldsFn(new Set());
	}, [
		savedValue,
	]);
	const saveDraftFn = useCallback(async () => {
		if (pending.current) return false;
		const parsed = TemplateSchema.safeParse(value);
		if (!parsed.success) {
			setAttemptedSaveFn(true);
			setErrorFn(parsed.error.issues[0]?.message);
			return false;
		}
		const ownGeneration = generation.current;
		pending.current = true;
		setSavingFn(true);
		setErrorFn(undefined);
		try {
			await RendererRuntime.runPromise(
				saveProjectConfigFx({
					projectId: project.projectId,
					expectedRevision: revision.current,
					config: {
						...project.config,
						templates: (project.config.templates ?? []).some(
							(entry) => entry.uid === value.uid,
						)
							? project.config.templates!.map((entry) =>
									entry.uid === value.uid ? parsed.data : entry,
								)
							: [
									...(project.config.templates ?? []),
									parsed.data,
								],
					},
				}),
			);
			if (generation.current !== ownGeneration) return false;
			// Navigation reads the unsaved owner before React necessarily commits these state updates.
			dirtyRef.current = false;
			setValueFn(parsed.data);
			setSavedValueFn(parsed.data);
			setAttemptedSaveFn(false);
			setTouchedFieldsFn(new Set());
			return true;
		} catch (cause) {
			if (generation.current === ownGeneration) setErrorFn(String(cause));
			return false;
		} finally {
			pending.current = false;
			if (generation.current === ownGeneration) setSavingFn(false);
		}
	}, [
		project,
		value,
	]);
	useLayoutEffect(() => {
		if (dirty || pending.current) return;
		revision.current = project.revision;
		if (template !== undefined && JSON.stringify(template) !== JSON.stringify(savedValue)) {
			setValueFn(template);
			setSavedValueFn(template);
		}
	}, [
		dirty,
		project.revision,
		template,
		savedValue,
	]);

	const saveFn = useCallback(async () => {
		const saved = await saveDraftFn();
		if (saved) await onSavedFn(value.uid);
		return saved;
	}, [
		saveDraftFn,
		onSavedFn,
		value.uid,
	]);
	useEditorUnsavedChangesRegistration({
		id: `template:${project.projectId}:${value.uid}`,
		discardFn,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: () => validation.success,
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(
				`/editor/${project.projectId}/templates/${template === undefined ? "new" : value.uid}/form/`,
			),
		saveFn: saveDraftFn,
	});
	return {
		project,
		value,
		setValueFn,
		touchFieldFn,
		dirty,
		saving,
		saveFn,
		discardFn,
		error,
		issues: validation.success
			? []
			: validation.error.issues.filter(
					(issue) => attemptedSave || touchedFields.has(String(issue.path[0])),
				),
	};
};
