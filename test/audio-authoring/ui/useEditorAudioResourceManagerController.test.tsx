// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	deleteResourceFn: vi.fn(),
	importResourcesFn: vi.fn(),
	setCall: 0,
	valueCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importResourcesFn,
			state.deleteResourceFn,
		][state.setCall++ % 2],
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
		config: {},
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
				id: "job-start",
				size: 23,
				type: "sfx",
				version: "1",
			},
		],
	}),
}));

vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrls: () =>
		new Map([
			[
				"job-start",
				"arkini://app/editor/resource?resourceId=job-start",
			],
		]),
}));

import { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";

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
	duration = 1;
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
let controller: ReturnType<typeof useEditorAudioResourceManagerController> | undefined;

const Probe = () => {
	controller = useEditorAudioResourceManagerController({
		type: "sfx",
	});
	return null;
};

beforeEach(async () => {
	state.deleteResourceFn.mockReset();
	state.importResourcesFn.mockReset();
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

describe("useEditorAudioResourceManagerController", () => {
	it("owns SFX import, filtering, lazy preview and deletion", async () => {
		expect(controller?.resources.map(({ id }) => id)).toEqual([
			"job-start",
		]);

		const file = new File(
			[
				new Uint8Array([
					1,
				]),
			],
			"coin.mp3",
			{
				type: "audio/mpeg",
			},
		);
		const input = {
			files: [
				file,
			],
			value: "coin.mp3",
		};
		await act(async () =>
			controller?.onFilesChangeFn({
				currentTarget: input,
			} as unknown as ChangeEvent<HTMLInputElement>),
		);
		expect(state.importResourcesFn).toHaveBeenCalledWith({
			files: [
				file,
			],
			projectId: "project-one",
			type: "sfx",
		});
		expect(input.value).toBe("");

		await act(async () => controller?.togglePlaybackFn("job-start"));
		expect(AudioStub.instances[0]?.src).toContain("resourceId=job-start");
		expect(AudioStub.instances[0]?.volume).toBeCloseTo(0.8);

		await act(async () => controller?.deleteResourceFn("job-start"));
		expect(state.deleteResourceFn).toHaveBeenCalledWith({
			expectedRevision: 7,
			projectId: "project-one",
			resourceId: "job-start",
		});
	});
});
