// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";

const artifact = {
	bytes: new Uint8Array([
		1,
		2,
	]),
	contentHash: "a".repeat(64),
	diagnostics: [],
	filename: "project.arkpack",
	game: "0.5.0",
	revision: 1,
	version: "1.0",
};

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("saveBuiltEditorArkpackFx", () => {
	it("clicks one exact browser download and always revokes its object URL", async () => {
		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:build");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		await Effect.runPromise(saveBuiltEditorArkpackFx(artifact));

		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:build");
		expect(document.querySelector("a")).toBeNull();
	});

	it("surfaces browser download setup failures without clicking", async () => {
		vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
			throw new Error("download unavailable");
		});
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		await expect(Effect.runPromise(saveBuiltEditorArkpackFx(artifact))).rejects.toThrow(
			"download unavailable",
		);
		expect(click).not.toHaveBeenCalled();
	});

	it("removes the download anchor and revokes its URL when clicking fails", async () => {
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:build");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
			throw new Error("download blocked");
		});

		await expect(Effect.runPromise(saveBuiltEditorArkpackFx(artifact))).rejects.toThrow(
			"download blocked",
		);
		expect(document.querySelector("a")).toBeNull();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:build");
	});
});
