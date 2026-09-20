import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { importEditorSerapackFileFx } from "~/project-authoring/fx/importEditorSerapackFileFx";

afterEach(() => vi.unstubAllGlobals());

describe("importEditorSerapackFileFx", () => {
	it("delegates selection and streamed import to Electron main", async () => {
		vi.stubGlobal("window", {
			serakki: {
				editor: {
					importSerapackFn: async () => ({
						type: "success",
						value: {
							projectId: "project:test",
							title: "Test",
							version: {
								major: 1,
								minor: 0,
							},
							createdAtMs: 1,
							updatedAtMs: 1,
						},
					}),
				},
			},
		});

		await expect(Effect.runPromise(importEditorSerapackFileFx())).resolves.toMatchObject({
			projectId: "project:test",
		});
	});
});
