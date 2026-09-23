// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { EditorMusicSelection } from "~/music-authoring/ui/EditorMusicSelection";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

const playback = vi.hoisted(() => ({
	togglePlaybackFn: vi.fn(),
	seekPlaybackFn: vi.fn(),
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
		resources: [
			{
				uid: "track-a",
				title: "Forest",
				type: "music",
			},
			{
				uid: "track-b",
				title: "Tavern",
				type: "music",
			},
		],
	}),
}));
vi.mock("~/audio-authoring/ui/useEditorAudioPreview", () => ({
	useEditorAudioPreview: () => ({
		...playback,
		playing: false,
		playbackProgress: 0,
	}),
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("previews a candidate without assigning it, then assigns its exact resource ID", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const changeFn = vi.fn();
	try {
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<EditorMusicSelection onChangeFn={changeFn} />
				</TranslationTestProvider>,
			),
		);
		await act(async () => (host.querySelector("input") as HTMLInputElement).click());
		const options = document.querySelectorAll('[data-ui="EditorSearchComboboxOption"]');
		expect(options).toHaveLength(2);
		await act(async () =>
			(
				options[1]!.querySelector('[data-ui="EditorMusicOptionPlayback"]') as HTMLElement
			).click(),
		);
		expect(playback.togglePlaybackFn).toHaveBeenCalledWith("track-b");
		expect(changeFn).not.toHaveBeenCalled();
		await act(async () => (options[1] as HTMLButtonElement).click());
		expect(changeFn).toHaveBeenCalledWith("track-b");
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
