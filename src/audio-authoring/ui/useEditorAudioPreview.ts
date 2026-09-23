import { useAtomValue } from "@effect/atom-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { useResourceUrls } from "~/authoring-session/ui/ResourceUrlSession";

interface ActiveAudio {
	readonly audio: HTMLAudioElement;
	readonly disposeFn: () => void;
	readonly resourceUid: string;
}

export namespace useEditorAudioPreview {
	export interface Props {
		readonly resourceUids: ReadonlyArray<string>;
		readonly type: "music" | "sfx";
	}
	export interface Output {
		readonly activeResourceUid?: string;
		readonly playbackError?: string;
		readonly playbackProgress: number;
		readonly playing: boolean;
		readonly setVolumeFn: (volume: number) => void;
		readonly seekPlaybackFn: (resourceUid: string, progress: number) => void;
		readonly togglePlaybackFn: (resourceUid: string) => void;
		readonly volume: number;
	}
}

/** Owns one lazy audio preview and disposes its media body when its surface leaves. */
export const useEditorAudioPreview = ({
	resourceUids,
	type,
}: useEditorAudioPreview.Props): useEditorAudioPreview.Output => {
	const sound = useAtomValue(SoundSettingsAtom);
	const urls = useResourceUrls(resourceUids);
	const activeAudioRef = useRef<ActiveAudio | undefined>(undefined);
	const [activeResourceUid, setActiveResourceUidFn] = useState<string>();
	const [playbackDuration, setPlaybackDurationFn] = useState(0);
	const [playbackTime, setPlaybackTimeFn] = useState(0);
	const [playing, setPlayingFn] = useState(false);
	const [playbackError, setPlaybackErrorFn] = useState<string>();
	const [volume, setVolumeStateFn] = useState(100);
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

	const startPlaybackFn = (resourceUid: string, initialProgress?: number) => {
		const url = urls.get(resourceUid);
		if (url === undefined) {
			setPlaybackErrorFn(`${resourceLabel} ${resourceUid} is unavailable.`);
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
			setPlaybackErrorFn(`${resourceLabel} ${resourceUid} could not be played.`);
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
			resourceUid,
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
		setActiveResourceUidFn(resourceUid);
		setPlayingFn(false);
		void audio.play().catch((cause) => {
			if (activeAudioRef.current?.audio !== audio) return;
			setPlaybackErrorFn(String(cause));
		});
	};
	const togglePlaybackFn = (resourceUid: string) => {
		setPlaybackErrorFn(undefined);
		const active = activeAudioRef.current;
		if (active?.resourceUid !== resourceUid) {
			startPlaybackFn(resourceUid);
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
	const seekPlaybackFn = (resourceUid: string, nextProgress: number) => {
		const progress = Math.min(1, Math.max(0, nextProgress));
		const active = activeAudioRef.current;
		if (active?.resourceUid !== resourceUid) {
			startPlaybackFn(resourceUid, progress);
			return;
		}
		if (!Number.isFinite(active.audio.duration) || active.audio.duration <= 0) return;
		active.audio.currentTime = active.audio.duration * progress;
		setPlaybackTimeFn(active.audio.currentTime);
	};

	return {
		activeResourceUid,
		playbackError,
		playbackProgress: playbackDuration > 0 ? Math.min(1, playbackTime / playbackDuration) : 0,
		playing,
		setVolumeFn,
		seekPlaybackFn,
		togglePlaybackFn,
		volume,
	};
};
