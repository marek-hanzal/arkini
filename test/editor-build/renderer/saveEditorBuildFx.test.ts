// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveEditorBuildFx } from "~/editor-build/renderer/saveEditorBuildFx";

afterEach(() => vi.restoreAllMocks());

describe("saveEditorBuildFx", () => {
	it("asks main to save the exact local Build identity", async () => {
		const saveProjectBuild = vi.fn(async () => ({
			type: "success" as const,
			value: true,
		}));
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					saveProjectBuild,
				},
			},
		});

		await Effect.runPromise(
			saveEditorBuildFx({
				projectId: "project",
				size: 2,
				contentHash: "a".repeat(64),
				diagnostics: [],
				revision: 1,
			}),
		);

		expect(saveProjectBuild).toHaveBeenCalledWith({
			projectId: "project",
			expectedRevision: 1,
			contentHash: "a".repeat(64),
		});
	});
});
