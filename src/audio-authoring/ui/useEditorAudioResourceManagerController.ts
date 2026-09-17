import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { type ChangeEventHandler, type RefObject, useMemo, useRef, useState } from "react";

import { useEditorAudioPreview } from "~/audio-authoring/ui/useEditorAudioPreview";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { Project } from "~/project-authoring/type/Project";
import { importEditorResourcesFx } from "~/resource-authoring/fx/importEditorResourcesFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useFuseSearch } from "~/ui/ui/useFuseSearch";

const importEditorAudioAtom = RendererRuntime.runSync(
	Effect.map(ProjectWriteAdmission, (admission) =>
		Atom.fn(
			({
				files,
				projectId,
				type,
			}: {
				readonly files: ReadonlyArray<File>;
				readonly projectId: string;
				readonly type: useEditorAudioResourceManagerController.ResourceType;
			}) =>
				importEditorResourcesFx({
					files,
					projectId,
					source: "files",
					type,
				}).pipe(Effect.provideService(ProjectWriteAdmission, admission)),
		).pipe(Atom.withLabel("EditorAudioImport"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorAudioResourceManagerController {
	export type ResourceType = "music" | "sfx";

	export interface Props {
		readonly type: ResourceType;
	}

	export interface Output extends useEditorAudioPreview.Output {
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importError?: unknown;
		readonly importPending: boolean;
		readonly onFilesChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly openFilesImportFn: () => void;
		readonly query: string;
		readonly resources: ReadonlyArray<Project.Resource>;
		readonly setQueryFn: (query: string) => void;
		readonly totalResourceCount: number;
		readonly type: ResourceType;
	}
}

/** Owns one typed audio library and one lazily loaded Editor preview player. */
export const useEditorAudioResourceManagerController = ({
	type,
}: useEditorAudioResourceManagerController.Props): useEditorAudioResourceManagerController.Output => {
	const project = useEditorProject();
	const filesInputRef = useRef<HTMLInputElement>(null);
	const importResult = useAtomValue(importEditorAudioAtom);
	const importResourcesFn = useAtomSet(importEditorAudioAtom);
	const [query, setQueryFn] = useState("");
	const allResources = useMemo(
		() => project.resources.filter((resource) => resource.type === type),
		[
			project.resources,
			type,
		],
	);
	const candidates = useMemo(
		() =>
			allResources.map(({ id, name }) => ({
				identity: id,
				terms: [
					id,
					name ?? "",
				],
			})),
		[
			allResources,
		],
	);
	const matchingIds = useFuseSearch(candidates, query);
	const resourcesById = useMemo(
		() =>
			new Map(
				allResources.map((resource) => [
					resource.id,
					resource,
				]),
			),
		[
			allResources,
		],
	);
	const resources = useMemo(
		() => matchingIds.flatMap((id) => resourcesById.get(id) ?? []),
		[
			matchingIds,
			resourcesById,
		],
	);
	const resourceIds = useMemo(
		() => allResources.map(({ id }) => id),
		[
			allResources,
		],
	);
	const importPending = importResult.waiting;
	const importError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(importResult));

	const preview = useEditorAudioPreview({
		resourceIds,
		type,
	});
	const onFilesChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = "";
		if (files.length === 0) return;
		importResourcesFn({
			files,
			projectId: project.projectId,
			type,
		});
	};

	return {
		activeResourceId: preview.activeResourceId,
		filesInputRef,
		importError,
		importPending,
		onFilesChangeFn,
		openFilesImportFn: () => filesInputRef.current?.click(),
		playbackError: preview.playbackError,
		playbackProgress: preview.playbackProgress,
		playing: preview.playing,
		query,
		resources,
		setQueryFn,
		setVolumeFn: preview.setVolumeFn,
		seekPlaybackFn: preview.seekPlaybackFn,
		togglePlaybackFn: preview.togglePlaybackFn,
		totalResourceCount: allResources.length,
		type,
		volume: preview.volume,
	};
};
