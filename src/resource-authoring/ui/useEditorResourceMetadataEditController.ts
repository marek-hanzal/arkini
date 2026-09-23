import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveEditorResourceMetadataFx } from "~/game-config-resource/fx/saveEditorResourceMetadataFx";
import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { Project } from "~/project-authoring/type/Project";

export namespace useEditorResourceMetadataEditController {
	export interface Props {
		readonly resource: Project.Resource;
		readonly type: "music" | "sfx" | "image";
		readonly closeFn?: () => void;
	}
	export interface Output {
		readonly title: string;
		readonly setTitleFn: (title: string) => void;
		readonly titleError?: string;
		readonly error: unknown;
		readonly dirty: boolean;
		readonly saving: boolean;
		readonly saveFn: () => Promise<boolean>;
		readonly discardFn: () => Promise<void>;
		readonly requestCloseFn: () => Promise<void>;
	}
}

/** Owns a mounted resource-title draft; its original revision prevents overwriting a later metadata edit. */
export const useEditorResourceMetadataEditController = ({
	resource,
	type,
	closeFn,
}: useEditorResourceMetadataEditController.Props): useEditorResourceMetadataEditController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const admission = RendererRuntime.runSync(ProjectWriteAdmission);
	const unsavedChanges = RendererRuntime.runSync(EditorUnsavedChanges);
	const [baseline, setBaselineFn] = useState({
		title: resource.title ?? "",
		revision: project.revision,
	});
	const [title, setTitleStateFn] = useState(baseline.title);
	const [titleError, setTitleErrorFn] = useState<string>();
	const [error, setErrorFn] = useState<unknown>();
	const [saving, setSavingFn] = useState(false);
	const pendingRef = useRef(false);
	const mountedRef = useRef(false);
	const epochRef = useRef(0);
	const dirty = title.trim() !== baseline.title;
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
		resource.uid,
	]);
	// Pristine forms follow canonical metadata; an authored draft keeps its original CAS revision.
	useLayoutEffect(() => {
		if (
			dirty ||
			pendingRef.current ||
			(baseline.title === (resource.title ?? "") && baseline.revision === project.revision)
		)
			return;
		setTitleStateFn(resource.title ?? "");
		setBaselineFn({
			title: resource.title ?? "",
			revision: project.revision,
		});
	}, [
		baseline.title,
		baseline.revision,
		dirty,
		project.revision,
		resource.title,
		saving,
	]);
	const setTitleFn = useCallback((value: string) => {
		if (pendingRef.current) return;
		epochRef.current += 1;
		setTitleStateFn(value);
		setTitleErrorFn(undefined);
		setErrorFn(undefined);
	}, []);
	const resetFn = useCallback(() => {
		epochRef.current += 1;
		dirtyRef.current = false;
		setTitleStateFn(resource.title ?? "");
		setBaselineFn({
			title: resource.title ?? "",
			revision: project.revision,
		});
		setTitleErrorFn(undefined);
		setErrorFn(undefined);
	}, [
		project.revision,
		resource.title,
	]);
	const persistFn = useCallback(async () => {
		if (!mountedRef.current || !dirtyRef.current || pendingRef.current) return false;
		const parsed = ResourceMetadataSchema.safeParse({
			title,
		});
		if (!parsed.success) {
			setTitleErrorFn(parsed.error.issues[0]?.message);
			return false;
		}
		const epoch = epochRef.current;
		const isCurrentFn = () => mountedRef.current && epochRef.current === epoch;
		pendingRef.current = true;
		setSavingFn(true);
		setErrorFn(undefined);
		setTitleErrorFn(undefined);
		try {
			const saved = await RendererRuntime.runPromise(
				saveEditorResourceMetadataFx({
					projectId: project.projectId,
					expectedRevision: baseline.revision,
					resourceUid: resource.uid,
					title: parsed.data.title,
				}),
			);
			if (!isCurrentFn()) return false;
			dirtyRef.current = false;
			setBaselineFn({
				title: parsed.data.title,
				revision: saved.revision,
			});
			setTitleStateFn(parsed.data.title);
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
		title,
		project.projectId,
		resource.uid,
	]);
	const leaveFn = useCallback(async () => {
		if (admission.isNavigationBlockedFn()) return;
		if (type === "image") {
			closeFn?.();
			return;
		}
		await navigateFn({
			to:
				type === "music"
					? "/editor/$projectId/music/$resourceUid/$sectionId"
					: "/editor/$projectId/sfx/$resourceUid/$sectionId",
			params: {
				projectId: project.projectId,
				resourceUid: resource.uid,
				sectionId: "view",
			},
			replace: true,
		});
	}, [
		admission,
		closeFn,
		navigateFn,
		project.projectId,
		resource.uid,
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
	const requestCloseFn = useCallback(async () => {
		if (pendingRef.current || !(await unsavedChanges.requestLeaveFn()) || !mountedRef.current)
			return;
		await leaveFn();
	}, [
		unsavedChanges,
		leaveFn,
	]);
	useEditorUnsavedChangesRegistration({
		id: `resource:${project.projectId}:${resource.uid}`,
		discardFn: resetFn,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: () =>
			ResourceMetadataSchema.safeParse({
				title,
			}).success,
		ownsPathnameFn: (pathname) =>
			type === "image"
				? pathname.startsWith(`/editor/${encodeURIComponent(project.projectId)}/project/`)
				: pathname ===
					`/editor/${encodeURIComponent(project.projectId)}/${type}/${encodeURIComponent(resource.uid)}/edit`,
		saveFn: persistFn,
	});
	return {
		title,
		setTitleFn,
		titleError,
		error,
		dirty,
		saving,
		saveFn,
		discardFn,
		requestCloseFn,
	};
};
