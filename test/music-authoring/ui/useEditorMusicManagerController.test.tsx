// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	importMusicFn: vi.fn(),
	playlistMusicFn: vi.fn(),
	setCall: 0,
	valueCall: 0,
	detailMusic: undefined as string | undefined,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importMusicFn,
			state.playlistMusicFn,
		][state.setCall++ % 2],
	useAtomValue: () =>
		state.valueCall++ % 3 === 1
			? {
					master: 80,
					music: 100,
					sfx: 100,
				}
			: AsyncResult.initial(),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			resources: {},
			items:
				state.detailMusic === undefined
					? {}
					: {
							tavern: {
								uid: "tavern-uid",
								title: "Tavern",
								music: state.detailMusic,
								lines: [],
								artwork: {
									default: [],
								},
							},
						},
			music: {
				playlist: [
					"opening-theme",
				],
			},
		},
		projectId: "project-one",
		revision: 7,
		resources: [
			{
				uid: "opening-theme",
				title: "opening-theme",
				size: 47,
				type: "music",
				version: "1",
			},
			{
				uid: "battle-march",
				title: "battle-march",
				size: 47,
				type: "music",
				version: "1",
			},
		],
	}),
}));

vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrls: () =>
		new Map([
			[
				"opening-theme",
				"serakki://app/editor/resource?resourceUid=opening-theme",
			],
			[
				"battle-march",
				"serakki://app/editor/resource?resourceUid=battle-march",
			],
		]),
}));

import { useEditorMusicManagerController } from "~/music-authoring/ui/useEditorMusicManagerController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

class AudioStub extends EventTarget {
	static instances: AudioStub[] = [];
	readonly src: string;
	paused = true;
	currentTime = 0;
	duration = 120;
	volume = 1;
	readonly load = vi.fn();
	readonly removeAttribute = vi.fn();

	constructor(src: string) {
		super();
		this.src = src;
		AudioStub.instances.push(this);
	}

	readonly play = vi.fn(async () => {
		this.paused = false;
		this.dispatchEvent(new Event("play"));
	});

	readonly pause = vi.fn(() => {
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	});
}

let root: ReturnType<typeof createRoot> | undefined;
let controller: ReturnType<typeof useEditorMusicManagerController> | undefined;

const Probe = () => {
	controller = useEditorMusicManagerController();
	return null;
};

beforeEach(async () => {
	state.importMusicFn.mockReset();
	state.playlistMusicFn.mockReset();
	state.setCall = 0;
	state.valueCall = 0;
	state.detailMusic = undefined;
	AudioStub.instances = [];
	vi.stubGlobal("Audio", AudioStub);
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root?.render(<Probe />));
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	controller = undefined;
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

describe("useEditorMusicManagerController", () => {
	it("searches Music and plays one lazy URL at the selected volume", async () => {
		await act(async () => controller?.setQueryFn("battle"));
		expect(controller?.music.map(({ uid }) => uid)).toEqual([
			"battle-march",
		]);

		await act(async () => controller?.togglePlaybackFn("battle-march"));
		const audio = AudioStub.instances[0];
		expect(audio?.src).toContain("resourceUid=battle-march");
		expect(audio?.play).toHaveBeenCalledOnce();
		expect(controller?.playing).toBe(true);

		await act(async () => controller?.setVolumeFn(35));
		expect(audio?.volume).toBeCloseTo(0.28);
		expect(controller?.volume).toBe(35);

		await act(async () => controller?.togglePlaybackFn("battle-march"));
		expect(audio?.pause).toHaveBeenCalledOnce();
		expect(controller?.playing).toBe(false);
	});

	it("filters the searched Music collection by playlist membership", async () => {
		expect(controller?.music.map(({ uid }) => uid)).toEqual([
			"opening-theme",
			"battle-march",
		]);

		await act(async () => controller?.setViewFn("playlist"));
		expect(controller?.music.map(({ uid }) => uid)).toEqual([
			"opening-theme",
		]);

		await act(async () => controller?.setViewFn("unused"));
		expect(controller?.music.map(({ uid }) => uid)).toEqual([
			"battle-march",
		]);

		await act(async () => controller?.setQueryFn("opening"));
		expect(controller?.music).toEqual([]);
	});

	it("keeps item-only music out of Unused without adding it to the global playlist", async () => {
		state.detailMusic = "battle-march";
		await act(async () => root?.render(<Probe />));
		await act(async () => controller?.setViewFn("unused"));
		expect(controller?.music).toEqual([]);
		expect(controller?.playlistResourceUids.has("battle-march")).toBe(false);
	});
	it("tracks playback, seeks through the active row, and disposes on departure", async () => {
		await act(async () => controller?.togglePlaybackFn("battle-march"));
		const audio = AudioStub.instances[0];
		if (audio === undefined) throw new Error("Expected a Music preview audio element.");

		await act(async () => audio.dispatchEvent(new Event("loadedmetadata")));
		audio.currentTime = 30;
		await act(async () => audio.dispatchEvent(new Event("timeupdate")));
		expect(controller?.playbackProgress).toBe(0.25);

		await act(async () => controller?.seekPlaybackFn("battle-march", 0.75));
		expect(audio.currentTime).toBe(90);
		expect(controller?.playbackProgress).toBe(0.75);

		await act(async () => root?.unmount());
		root = undefined;
		expect(audio.pause).toHaveBeenCalledOnce();
		expect(audio.removeAttribute).toHaveBeenCalledWith("src");
	});

	it("toggles one Music resource in the authored random playlist", async () => {
		expect(controller?.playlistResourceUids.has("opening-theme")).toBe(true);
		expect(controller?.playlistResourceUids.has("battle-march")).toBe(false);

		await act(async () => controller?.togglePlaylistFn("battle-march"));
		expect(state.playlistMusicFn).toHaveBeenCalledWith({
			config: {
				resources: {},
				items: {},
				music: {
					playlist: [
						"opening-theme",
						"battle-march",
					],
				},
			},
			expectedRevision: 7,
			projectId: "project-one",
		});
	});
});
