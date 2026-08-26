// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";

afterEach(() => vi.restoreAllMocks());

describe("saveBuiltEditorArkpackFx", () => {
	it("asks main to save the exact signed build identity", async () => {
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
			saveBuiltEditorArkpackFx({
				projectId: "project",
				size: 2,
				contentHash: "a".repeat(64),
				diagnostics: [],
				revision: 1,
				signed: true,
			}),
		);

		expect(saveProjectBuild).toHaveBeenCalledWith({
			projectId: "project",
			expectedRevision: 1,
			contentHash: "a".repeat(64),
			signed: true,
		});
	});
});
