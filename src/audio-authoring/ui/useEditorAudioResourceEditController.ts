import { useNavigate } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveEditorAudioMetadataFx } from "~/audio-authoring/fx/saveEditorAudioMetadataFx";
import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { Project } from "~/project-authoring/type/Project";

export namespace useEditorAudioResourceEditController {
	export interface Props {
		readonly resource: Project.Resource;
		readonly type: "music" | "sfx";
	}
	export interface Output {
		readonly name: string;
		readonly setNameFn: (name: string) => void;
		readonly nameError?: string;
		readonly error: unknown;
		readonly dirty: boolean;
		readonly saving: boolean;
		readonly saveFn: () => Promise<boolean>;
		readonly discardFn: () => Promise<void>;
	}
}

/** Owns a mounted audio-name draft; its original revision prevents overwriting a later metadata edit. */
export const useEditorAudioResourceEditController = ({
	resource,
	type,
}: useEditorAudioResourceEditController.Props): useEditorAudioResourceEditController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const admission = RendererRuntime.runSync(ProjectWriteAdmission);
	const [baseline, setBaselineFn] = useState({
		name: resource.name ?? "",
		revision: project.revision,
	});
	const [name, setNameStateFn] = useState(baseline.name);
	const [nameError, setNameErrorFn] = useState<string>();
	const [error, setErrorFn] = useState<unknown>();
	const [saving, setSavingFn] = useState(false);
	const pendingRef = useRef(false);
	const mountedRef = useRef(false);
	const epochRef = useRef(0);
	const dirty = name.trim() !== baseline.name;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	useLayoutEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			epochRef.current += 1;
		};
	}, [
		project.projectId,
		resource.id,
	]);
	// Pristine forms follow canonical metadata; an authored draft keeps its original CAS revision.
	useLayoutEffect(() => {
		if (
			dirty ||
			pendingRef.current ||
			(baseline.name === (resource.name ?? "") && baseline.revision === project.revision)
		)
			return;
		setNameStateFn(resource.name ?? "");
		setBaselineFn({
			name: resource.name ?? "",
			revision: project.revision,
		});
	}, [
		baseline.name,
		baseline.revision,
		dirty,
		project.revision,
		resource.name,
		saving,
	]);
	const setNameFn = useCallback((value: string) => {
		if (pendingRef.current) return;
		epochRef.current += 1;
		setNameStateFn(value);
		setNameErrorFn(undefined);
		setErrorFn(undefined);
	}, []);
	const resetFn = useCallback(() => {
		epochRef.current += 1;
		dirtyRef.current = false;
		setNameStateFn(resource.name ?? "");
		setBaselineFn({
			name: resource.name ?? "",
			revision: project.revision,
		});
		setNameErrorFn(undefined);
		setErrorFn(undefined);
	}, [
		project.revision,
		resource.name,
	]);
	const persistFn = useCallback(async () => {
		if (!mountedRef.current || !dirtyRef.current || pendingRef.current) return false;
		const parsed = AudioResourceMetadataSchema.safeParse({
			name,
		});
		if (!parsed.success) {
			setNameErrorFn(parsed.error.issues[0]?.message);
			return false;
		}
		const epoch = epochRef.current;
		const isCurrentFn = () => mountedRef.current && epochRef.current === epoch;
		pendingRef.current = true;
		setSavingFn(true);
		setErrorFn(undefined);
		setNameErrorFn(undefined);
		try {
			const saved = await RendererRuntime.runPromise(
				saveEditorAudioMetadataFx({
					projectId: project.projectId,
					expectedRevision: baseline.revision,
					resourceId: resource.id,
					name: parsed.data.name,
				}),
			);
			if (!isCurrentFn()) return false;
			dirtyRef.current = false;
			setBaselineFn({
				name: parsed.data.name,
				revision: saved.revision,
			});
			setNameStateFn(parsed.data.name);
			return true;
		} catch (cause) {
			if (isCurrentFn()) setErrorFn(cause);
			return false;
		} finally {
			pendingRef.current = false;
			if (mountedRef.current) setSavingFn(false);
		}
	}, [
		baseline.revision,
		name,
		project.projectId,
		resource.id,
	]);
	const leaveFn = useCallback(async () => {
		if (admission.isNavigationBlockedFn()) return;
		await navigateFn({
			to:
				type === "music"
					? "/editor/$projectId/music/$resourceId/$sectionId"
					: "/editor/$projectId/sfx/$resourceId/$sectionId",
			params: {
				projectId: project.projectId,
				resourceId: resource.id,
				sectionId: "view",
			},
			replace: true,
		});
	}, [
		admission,
		navigateFn,
		project.projectId,
		resource.id,
		type,
	]);
	const saveFn = useCallback(async () => {
		const epoch = epochRef.current;
		if (
			!(await persistFn()) ||
			!mountedRef.current ||
			epochRef.current !== epoch ||
			admission.isNavigationBlockedFn()
		)
			return false;
		await leaveFn();
		return true;
	}, [
		admission,
		leaveFn,
		persistFn,
	]);
	const discardFn = useCallback(async () => {
		if (pendingRef.current) return;
		resetFn();
		await leaveFn();
	}, [
		leaveFn,
		resetFn,
	]);
	useEditorUnsavedChangesRegistration({
		id: `audio:${project.projectId}:${resource.id}`,
		discardFn: resetFn,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: () =>
			AudioResourceMetadataSchema.safeParse({
				name,
			}).success,
		ownsPathnameFn: (pathname) =>
			pathname ===
			`/editor/${encodeURIComponent(project.projectId)}/${type}/${encodeURIComponent(resource.id)}/edit`,
		saveFn: persistFn,
	});
	return {
		name,
		setNameFn,
		nameError,
		error,
		dirty,
		saving,
		saveFn,
		discardFn,
	};
};
