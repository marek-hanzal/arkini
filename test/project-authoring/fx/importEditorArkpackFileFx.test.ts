import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { importEditorArkpackFileFx } from "~/project-authoring/fx/importEditorArkpackFileFx";

afterEach(() => vi.unstubAllGlobals());

describe("importEditorArkpackFileFx", () => {
	it("delegates selection and streamed import to Electron main", async () => {
		vi.stubGlobal("window", {
			arkini: {
				editor: {
					importArkpackFn: async () => ({
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

		await expect(Effect.runPromise(importEditorArkpackFileFx())).resolves.toMatchObject({
			projectId: "project:test",
		});
	});
});
