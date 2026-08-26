// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";

const artifact = {
	projectId: "project",
	bytes: 2,
	contentHash: "a".repeat(64),
	diagnostics: [],
	filename: "project.arkpack",
	game: "0.5.0",
	revision: 1,
	version: "1.0",
};
const content = {
	bytes: new Uint8Array([
		1,
		2,
	]),
};

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("saveBuiltEditorArkpackFx", () => {
	it("downloads and releases the exact signed artifact pair", async () => {
		const signedArtifact = {
			...artifact,
			signatureFilename: "project.arksig",
		};
		const signedContent = {
			...content,
			signature: {
				signature: btoa(String.fromCharCode(...new Uint8Array(64))),
			},
		};
		const createObjectURL = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:arkpack")
			.mockReturnValueOnce("blob:signature");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const downloads: string[] = [];
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			downloads.push(this.download);
		});

		await Effect.runPromise(
			saveBuiltEditorArkpackFx({
				artifact: signedArtifact,
				content: signedContent,
			}),
		);

		expect(createObjectURL).toHaveBeenCalledTimes(2);
		expect(downloads).toEqual([
			"project.arkpack",
			"project.arksig",
		]);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:arkpack");
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:signature");
		expect(document.querySelector("a")).toBeNull();
	});
});
