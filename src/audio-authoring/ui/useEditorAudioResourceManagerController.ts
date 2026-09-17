import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
	type ChangeEventHandler,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useResourceUrls } from "~/authoring-session/ui/ResourceUrlSession";
import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { deleteEditorResourceFx } from "~/resource-authoring/fx/deleteEditorResourceFx";
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

const deleteEditorAudioAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn(
			(props: {
				readonly expectedRevision: number;
				readonly projectId: string;
				readonly resourceId: string;
			}) =>
				deleteEditorResourceFx(props).pipe(
					Effect.provideService(ProjectRepository, repository),
				),
		).pipe(Atom.withLabel("EditorAudioDelete"), Atom.setIdleTTL(0)),
	),
);

interface ActiveAudio {
	readonly audio: HTMLAudioElement;
	readonly disposeFn: () => void;
	readonly resourceId: string;
}

export namespace useEditorAudioResourceManagerController {
	export type ResourceType = "music" | "sfx";

	export interface Props {
		readonly type: ResourceType;
	}

	export interface Output {
		readonly activeResourceId?: string;
		readonly deleteError?: unknown;
		readonly deletePending: boolean;
		readonly deleteResourceFn: (resourceId: string) => void;
		readonly deletingResourceId?: string;
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importError?: unknown;
		readonly importPending: boolean;
		readonly onFilesChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly openFilesImportFn: () => void;
		readonly playbackError?: string;
		readonly playbackProgress: number;
		readonly playing: boolean;
		readonly query: string;
		readonly resources: ReadonlyArray<Project.Resource>;
		readonly setQueryFn: (query: string) => void;
		readonly setVolumeFn: (volume: number) => void;
		readonly seekPlaybackFn: (resourceId: string, progress: number) => void;
		readonly togglePlaybackFn: (resourceId: string) => void;
		readonly totalResourceCount: number;
		readonly type: ResourceType;
		readonly volume: number;
	}
}

/** Owns one typed audio library and one lazily loaded Editor preview player. */
export const useEditorAudioResourceManagerController = ({
	type,
}: useEditorAudioResourceManagerController.Props): useEditorAudioResourceManagerController.Output => {
	const project = useEditorProject();
	const sound = useAtomValue(SoundSettingsAtom);
	const filesInputRef = useRef<HTMLInputElement>(null);
	const activeAudioRef = useRef<ActiveAudio | undefined>(undefined);
	const importResult = useAtomValue(importEditorAudioAtom);
	const importResourcesFn = useAtomSet(importEditorAudioAtom);
	const deleteResult = useAtomValue(deleteEditorAudioAtom);
	const deleteResourceCommandFn = useAtomSet(deleteEditorAudioAtom);
	const [activeResourceId, setActiveResourceIdFn] = useState<string>();
	const [deletingResourceId, setDeletingResourceIdFn] = useState<string>();
	const [playbackDuration, setPlaybackDurationFn] = useState(0);
	const [playbackTime, setPlaybackTimeFn] = useState(0);
	const [playing, setPlayingFn] = useState(false);
	const [playbackError, setPlaybackErrorFn] = useState<string>();
	const [query, setQueryFn] = useState("");
	const [volume, setVolumeStateFn] = useState(100);
	const allResources = useMemo(
		() => project.resources.filter((resource) => resource.type === type),
		[
			project.resources,
			type,
		],
	);
	const candidates = useMemo(
		() =>
			allResources.map(({ id }) => ({
				identity: id,
				terms: [
					id,
					readResourceNameFn(id),
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
	const urls = useResourceUrls(resourceIds);
	const importPending = importResult.waiting;
	const importError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(importResult));
	const deleteError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(deleteResult));
	const deletePending = deleteResult.waiting;
	const resourceLabel = type === "music" ? "Music" : "SFX";

	const disposeActiveFn = useCallback(() => {
		const active = activeAudioRef.current;
		if (active === undefined) return;
		activeAudioRef.current = undefined;
		active.disposeFn();
		active.audio.pause();
		active.audio.removeAttribute("src");
		active.audio.load();
	}, []);

	useEffect(
		() => () => {
			disposeActiveFn();
		},
		[
			disposeActiveFn,
		],
	);

	const setVolumeFn = (nextVolume: number) => {
		const boundedVolume = Math.min(100, Math.max(0, nextVolume));
		setVolumeStateFn(boundedVolume);
		if (activeAudioRef.current !== undefined)
			activeAudioRef.current.audio.volume = (boundedVolume / 100) * (sound.master / 100);
	};

	useEffect(() => {
		if (activeAudioRef.current !== undefined)
			activeAudioRef.current.audio.volume = (volume / 100) * (sound.master / 100);
	}, [
		sound.master,
		volume,
	]);

	const startPlaybackFn = (resourceId: string, initialProgress?: number) => {
		const url = urls.get(resourceId);
		if (url === undefined) {
			setPlaybackErrorFn(`${resourceLabel} ${resourceId} is unavailable.`);
			return;
		}
		setPlaybackErrorFn(undefined);
		disposeActiveFn();
		setPlaybackDurationFn(0);
		setPlaybackTimeFn(0);
		const audio = new Audio(url);
		let pendingInitialProgress = initialProgress;
		audio.volume = (volume / 100) * (sound.master / 100);
		const updateTimeFn = () => {
			if (activeAudioRef.current?.audio === audio) setPlaybackTimeFn(audio.currentTime);
		};
		const updateDurationFn = () => {
			if (activeAudioRef.current?.audio !== audio) return;
			const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
			setPlaybackDurationFn(duration);
			if (pendingInitialProgress !== undefined && duration > 0) {
				audio.currentTime = duration * pendingInitialProgress;
				pendingInitialProgress = undefined;
				setPlaybackTimeFn(audio.currentTime);
			}
		};
		const onPlayFn = () => {
			if (activeAudioRef.current?.audio === audio) setPlayingFn(true);
		};
		const onPauseFn = () => {
			if (activeAudioRef.current?.audio !== audio) return;
			setPlayingFn(false);
			setPlaybackTimeFn(audio.currentTime);
		};
		const onErrorFn = () => {
			if (activeAudioRef.current?.audio !== audio) return;
			setPlayingFn(false);
			setPlaybackErrorFn(`${resourceLabel} ${resourceId} could not be played.`);
		};
		audio.addEventListener("play", onPlayFn);
		audio.addEventListener("pause", onPauseFn);
		audio.addEventListener("ended", onPauseFn);
		audio.addEventListener("error", onErrorFn);
		audio.addEventListener("durationchange", updateDurationFn);
		audio.addEventListener("loadedmetadata", updateDurationFn);
		audio.addEventListener("timeupdate", updateTimeFn);
		activeAudioRef.current = {
			audio,
			resourceId,
			disposeFn: () => {
				audio.removeEventListener("play", onPlayFn);
				audio.removeEventListener("pause", onPauseFn);
				audio.removeEventListener("ended", onPauseFn);
				audio.removeEventListener("error", onErrorFn);
				audio.removeEventListener("durationchange", updateDurationFn);
				audio.removeEventListener("loadedmetadata", updateDurationFn);
				audio.removeEventListener("timeupdate", updateTimeFn);
			},
		};
		setActiveResourceIdFn(resourceId);
		setPlayingFn(false);
		void audio.play().catch((cause) => {
			if (activeAudioRef.current?.audio !== audio) return;
			setPlaybackErrorFn(String(cause));
		});
	};
	const togglePlaybackFn = (resourceId: string) => {
		setPlaybackErrorFn(undefined);
		const active = activeAudioRef.current;
		if (active?.resourceId !== resourceId) {
			startPlaybackFn(resourceId);
			return;
		}
		if (active.audio.paused) {
			void active.audio.play().catch((cause) => {
				setPlayingFn(false);
				setPlaybackErrorFn(String(cause));
			});
		} else {
			active.audio.pause();
		}
	};
	const seekPlaybackFn = (resourceId: string, nextProgress: number) => {
		const progress = Math.min(1, Math.max(0, nextProgress));
		const active = activeAudioRef.current;
		if (active?.resourceId !== resourceId) {
			startPlaybackFn(resourceId, progress);
			return;
		}
		if (!Number.isFinite(active.audio.duration) || active.audio.duration <= 0) return;
		active.audio.currentTime = active.audio.duration * progress;
		setPlaybackTimeFn(active.audio.currentTime);
	};

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
	const deleteResourceFn = (resourceId: string) => {
		if (deletePending) return;
		if (activeAudioRef.current?.resourceId === resourceId) {
			disposeActiveFn();
			setActiveResourceIdFn(undefined);
			setPlaybackDurationFn(0);
			setPlaybackTimeFn(0);
			setPlayingFn(false);
		}
		setDeletingResourceIdFn(resourceId);
		deleteResourceCommandFn({
			expectedRevision: project.revision,
			projectId: project.projectId,
			resourceId,
		});
	};

	return {
		activeResourceId,
		deleteError,
		deletePending,
		deleteResourceFn,
		deletingResourceId,
		filesInputRef,
		importError,
		importPending,
		onFilesChangeFn,
		openFilesImportFn: () => filesInputRef.current?.click(),
		playbackError,
		playbackProgress: playbackDuration > 0 ? Math.min(1, playbackTime / playbackDuration) : 0,
		playing,
		query,
		resources,
		setQueryFn,
		setVolumeFn,
		seekPlaybackFn,
		togglePlaybackFn,
		totalResourceCount: allResources.length,
		type,
		volume,
	};
};
