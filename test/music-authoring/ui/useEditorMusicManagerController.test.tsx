// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	deleteMusicFn: vi.fn(),
	importMusicFn: vi.fn(),
	setCall: 0,
	valueCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () => (state.setCall++ % 2 === 0 ? state.importMusicFn : state.deleteMusicFn),
	useAtomValue: () =>
		state.valueCall++ % 3 === 0
			? {
					master: 80,
					music: 100,
					sfx: 100,
				}
			: AsyncResult.initial(),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
		revision: 7,
		resources: [
			{
				id: "opening-theme",
				size: 47,
				type: "music",
				version: "1",
			},
			{
				id: "battle-march",
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
				"arkini://app/editor/resource?resourceId=opening-theme",
			],
			[
				"battle-march",
				"arkini://app/editor/resource?resourceId=battle-march",
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
	state.deleteMusicFn.mockReset();
	state.importMusicFn.mockReset();
	state.setCall = 0;
	state.valueCall = 0;
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
		expect(controller?.music.map(({ id }) => id)).toEqual([
			"battle-march",
		]);

		await act(async () => controller?.togglePlaybackFn("battle-march"));
		const audio = AudioStub.instances[0];
		expect(audio?.src).toContain("resourceId=battle-march");
		expect(audio?.play).toHaveBeenCalledOnce();
		expect(controller?.playing).toBe(true);

		await act(async () => controller?.setVolumeFn(35));
		expect(audio?.volume).toBeCloseTo(0.28);
		expect(controller?.volume).toBe(35);

		await act(async () => controller?.togglePlaybackFn("battle-march"));
		expect(audio?.pause).toHaveBeenCalledOnce();
		expect(controller?.playing).toBe(false);
	});

	it("tracks playback, seeks through the active row, and deletes the resource", async () => {
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

		await act(async () => controller?.deleteMusicFn("battle-march"));
		expect(state.deleteMusicFn).toHaveBeenCalledWith({
			expectedRevision: 7,
			projectId: "project-one",
			resourceId: "battle-march",
		});
		expect(audio.pause).toHaveBeenCalledOnce();
		expect(controller?.activeResourceId).toBeUndefined();
	});
});
