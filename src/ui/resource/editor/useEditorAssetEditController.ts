import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useRef, useState } from "react";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import { validateEditorAssetDraftFx } from "~/renderer/editor/resource/validateEditorAssetDraftFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { editEditorAssetFx } from "~/ui/resource/editor/editEditorAssetFx";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

const editEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<editEditorAssetFx.Props, "projectId">) =>
				editEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useEditorAssetEditController {
	export interface Props {
		readonly filter: "all" | "unused";
		readonly query: string;
		readonly resourceId: string;
	}

	export interface Output {
		readonly currentUrl?: string;
		readonly dirty: boolean;
		readonly error: unknown;
		readonly file?: File;
		readonly nextId: string;
		readonly projectId: string;
		readonly resourceFound: boolean;
		readonly save: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setFile: (file: File | undefined) => void;
		readonly setNextId: (resourceId: string) => void;
	}
}

export const useEditorAssetEditController = ({
	filter,
	query,
	resourceId,
}: useEditorAssetEditController.Props): useEditorAssetEditController.Output => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	const currentUrl = useEditorResourceUrl(resourceId);
	const navigate = useNavigate();
	const commandAtom = editEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutate = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [nextId, setNextId] = useState(resourceId);
	const [file, setFile] = useState<File>();
	const dirty = nextId.trim() !== resourceId || file !== undefined;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const persist = useCallback(async () => {
		if (!dirty || result.waiting) return false;
		const id = nextId.trim();
		await mutate({
			currentId: resourceId,
			file,
			resourceId: id,
		});
		dirtyRef.current = false;
		setNextId(id);
		setFile(undefined);
		return true;
	}, [
		dirty,
		file,
		mutate,
		nextId,
		resourceId,
		result.waiting,
	]);
	const save = useCallback(async () => {
		if (!(await persist())) return false;
		const id = nextId.trim();
		await navigate({
			to: "/editor/$projectId/assets/$resourceId/detail/overview",
			params: {
				projectId: project.projectId,
				resourceId: id,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
		return true;
	}, [
		filter,
		navigate,
		nextId,
		persist,
		project.projectId,
		query,
	]);
	useEditorUnsavedChangesRegistration({
		discard: () => {
			dirtyRef.current = false;
			setNextId(resourceId);
			setFile(undefined);
		},
		id: `asset:${project.projectId}:${resourceId}`,
		isDirty: () => dirtyRef.current,
		isValid: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorAssetDraftFx({
						file,
						resourceId: nextId,
					}),
				),
			),
		ownsPathname: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/assets/${resourceId}/edit`),
		save: persist,
	});
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const resourceFound = resource !== undefined;

	return useMemo(
		() => ({
			currentUrl,
			dirty,
			error,
			file,
			nextId,
			projectId: project.projectId,
			resourceFound,
			save,
			saving: result.waiting,
			setFile,
			setNextId,
		}),
		[
			currentUrl,
			dirty,
			error,
			file,
			nextId,
			project.projectId,
			resourceFound,
			result.waiting,
			save,
		],
	);
};
