import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const toggleEditorMusicPlaylistAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn((props: saveProjectConfigFx.Props) =>
			saveProjectConfigFx(props).pipe(Effect.provideService(ProjectRepository, repository)),
		).pipe(Atom.withLabel("EditorMusicPlaylistToggle"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorMusicManagerController {
	export type View = "all" | "playlist" | "unused";

	export interface Output extends useEditorAudioResourceManagerController.Output {
		readonly music: ReadonlyArray<Project.Resource>;
		readonly playlistError?: unknown;
		readonly playlistPending: boolean;
		readonly playlistResourceIds: ReadonlySet<string>;
		readonly setViewFn: (view: View) => void;
		readonly togglePlaylistFn: (resourceId: string) => void;
		readonly togglingPlaylistResourceId?: string;
		readonly view: View;
	}
}

/** Adds authored random-playlist selection to the shared Music audio library. */
export const useEditorMusicManagerController = (): useEditorMusicManagerController.Output => {
	const project = useEditorProject();
	const audio = useEditorAudioResourceManagerController({
		type: "music",
	});
	const playlistResult = useAtomValue(toggleEditorMusicPlaylistAtom);
	const togglePlaylistCommandFn = useAtomSet(toggleEditorMusicPlaylistAtom);
	const [togglingPlaylistResourceId, setTogglingPlaylistResourceIdFn] = useState<string>();
	const [view, setViewFn] = useState<useEditorMusicManagerController.View>("all");
	const playlistResourceIds = useMemo(
		() => new Set(project.config.music?.playlist ?? []),
		[
			project.config.music?.playlist,
		],
	);
	const music = useMemo(
		() =>
			audio.resources.filter((resource) => {
				const inPlaylist = playlistResourceIds.has(resource.id);
				return view === "all" || (view === "playlist" ? inPlaylist : !inPlaylist);
			}),
		[
			audio.resources,
			playlistResourceIds,
			view,
		],
	);
	const playlistError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(playlistResult));
	const playlistPending = playlistResult.waiting;
	const togglePlaylistFn = (resourceId: string) => {
		if (playlistPending) return;
		setTogglingPlaylistResourceIdFn(resourceId);
		const playlist = playlistResourceIds.has(resourceId)
			? (project.config.music?.playlist ?? []).filter((id) => id !== resourceId)
			: [
					...(project.config.music?.playlist ?? []),
					resourceId,
				];
		togglePlaylistCommandFn({
			config: {
				...project.config,
				music: {
					playlist,
				},
			},
			expectedRevision: project.revision,
			projectId: project.projectId,
		});
	};

	return {
		activeResourceId: audio.activeResourceId,
		deleteError: audio.deleteError,
		deletePending: audio.deletePending,
		deleteResourceFn: audio.deleteResourceFn,
		deletingResourceId: audio.deletingResourceId,
		filesInputRef: audio.filesInputRef,
		importError: audio.importError,
		importPending: audio.importPending,
		music,
		onFilesChangeFn: audio.onFilesChangeFn,
		openFilesImportFn: audio.openFilesImportFn,
		playbackError: audio.playbackError,
		playbackProgress: audio.playbackProgress,
		playlistError,
		playlistPending,
		playlistResourceIds,
		playing: audio.playing,
		query: audio.query,
		resources: audio.resources,
		setQueryFn: audio.setQueryFn,
		setViewFn,
		setVolumeFn: audio.setVolumeFn,
		seekPlaybackFn: audio.seekPlaybackFn,
		togglePlaybackFn: audio.togglePlaybackFn,
		togglePlaylistFn,
		togglingPlaylistResourceId,
		totalResourceCount: audio.totalResourceCount,
		type: audio.type,
		view,
		volume: audio.volume,
	};
};
