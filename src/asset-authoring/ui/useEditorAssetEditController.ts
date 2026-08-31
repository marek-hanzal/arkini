import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useRef, useState } from "react";

import { editEditorAssetFx } from "~/asset-authoring/fx/editEditorAssetFx";
import { validateEditorAssetFileFx } from "~/asset-authoring/fx/validateEditorAssetFileFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { IdSchema } from "~/game-config/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

interface EditEditorAssetCommandProps {
	readonly currentId: string;
	readonly file?: File;
	readonly resourceId: string;
}

const validateEditorAssetDraftFx = Effect.fn("validateEditorAssetDraftFx")(function* ({
	file,
	resourceId: candidateId,
}: {
	readonly file?: File;
	readonly resourceId: string;
}) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: "Asset ID must not be empty.",
				cause,
			}),
	});
	if (file !== undefined) yield* validateEditorAssetFileFx(file, resourceId);
});

const editEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: EditEditorAssetCommandProps) =>
				editEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
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
		readonly saveFn: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setFileFn: (file: File | undefined) => void;
		readonly setNextIdFn: (resourceId: string) => void;
	}
}

export const useEditorAssetEditController = ({
	filter,
	query,
	resourceId,
}: useEditorAssetEditController.Props): useEditorAssetEditController.Output => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	const currentUrl = useResourceUrl(resourceId);
	const navigateFn = useNavigate();
	const commandAtom = editEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutateFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [nextId, setNextIdFn] = useState(resourceId);
	const [file, setFileFn] = useState<File>();
	const dirty = nextId.trim() !== resourceId || file !== undefined;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const persistFn = useCallback(async () => {
		if (!dirty || result.waiting) return false;
		const id = nextId.trim();
		await mutateFn({
			currentId: resourceId,
			file,
			resourceId: id,
		});
		dirtyRef.current = false;
		setNextIdFn(id);
		setFileFn(undefined);
		return true;
	}, [
		dirty,
		file,
		mutateFn,
		nextId,
		resourceId,
		result.waiting,
	]);
	const saveFn = useCallback(async () => {
		if (!(await persistFn())) return false;
		const id = nextId.trim();
		await navigateFn({
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
		navigateFn,
		nextId,
		persistFn,
		project.projectId,
		query,
	]);
	useEditorUnsavedChangesRegistration({
		discardFn: () => {
			dirtyRef.current = false;
			setNextIdFn(resourceId);
			setFileFn(undefined);
		},
		id: `asset:${project.projectId}:${resourceId}`,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorAssetDraftFx({
						file,
						resourceId: nextId,
					}),
				),
			),
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/assets/${resourceId}/edit`),
		saveFn: persistFn,
	});
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const resourceFound = resource !== undefined;

	return {
		currentUrl,
		dirty,
		error,
		file,
		nextId,
		projectId: project.projectId,
		resourceFound,
		saveFn,
		saving: result.waiting,
		setFileFn,
		setNextIdFn,
	};
};
