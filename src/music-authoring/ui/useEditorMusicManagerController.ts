import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
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
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.fn((props: saveProjectConfigFx.Props) =>
				saveProjectConfigFx(props).pipe(
					Effect.provideService(ProjectRepository, repository),
					Effect.provideService(ProjectWriteAdmission, admission),
				),
			).pipe(Atom.withLabel("EditorMusicPlaylistToggle"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorMusicManagerController {
	export type View = "all" | "playlist" | "unused";

	export interface Output extends useEditorAudioResourceManagerController.Output {
		readonly music: ReadonlyArray<Project.Resource>;
		readonly playlistError?: unknown;
		readonly playlistPending: boolean;
		readonly playlistResourceUids: ReadonlySet<string>;
		readonly setViewFn: (view: View) => void;
		readonly togglePlaylistFn: (resourceUid: string) => void;
		readonly togglingPlaylistResourceUid?: string;
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
	const [togglingPlaylistResourceUid, setTogglingPlaylistResourceUidFn] = useState<string>();
	const [view, setViewFn] = useState<useEditorMusicManagerController.View>("all");
	const playlistResourceUids = useMemo(
		() => new Set(project.config.music?.playlist ?? []),
		[
			project.config.music?.playlist,
		],
	);
	const usedResourceUids = useMemo(
		() =>
			new Set(
				readGameResourceUsagesFn(project.config)
					.filter((usage) => usage.resourceType === "music")
					.map((usage) => usage.resourceUid),
			),
		[
			project.config,
		],
	);
	const music = useMemo(
		() =>
			audio.resources.filter((resource) => {
				const inPlaylist = playlistResourceUids.has(resource.uid);
				return (
					view === "all" ||
					(view === "playlist" ? inPlaylist : !usedResourceUids.has(resource.uid))
				);
			}),
		[
			audio.resources,
			playlistResourceUids,
			usedResourceUids,
			view,
		],
	);
	const playlistError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(playlistResult));
	const playlistPending = playlistResult.waiting;
	const togglePlaylistFn = (resourceUid: string) => {
		if (playlistPending) return;
		setTogglingPlaylistResourceUidFn(resourceUid);
		const playlist = playlistResourceUids.has(resourceUid)
			? (project.config.music?.playlist ?? []).filter((id) => id !== resourceUid)
			: [
					...(project.config.music?.playlist ?? []),
					resourceUid,
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
		activeResourceUid: audio.activeResourceUid,
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
		playlistResourceUids,
		playing: audio.playing,
		query: audio.query,
		resources: audio.resources,
		setQueryFn: audio.setQueryFn,
		setViewFn,
		setVolumeFn: audio.setVolumeFn,
		seekPlaybackFn: audio.seekPlaybackFn,
		togglePlaybackFn: audio.togglePlaybackFn,
		togglePlaylistFn,
		togglingPlaylistResourceUid,
		totalResourceCount: audio.totalResourceCount,
		type: audio.type,
		view,
		volume: audio.volume,
	};
};
