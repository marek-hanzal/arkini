import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorProjectRequestParserFx } from "~electron/main/editor-project/ipc/createEditorProjectRequestParserFx";

describe("createEditorProjectRequestParserFx", () => {
	it("admits Music file imports at the renderer IPC boundary", async () => {
		const parser = Effect.runSync(createEditorProjectRequestParserFx());
		const request = {
			files: [
				{
					name: "Unresolved Waltz.mp3",
					path: "/music/Unresolved Waltz.mp3",
				},
			],
			projectId: "arkini",
			source: "files" as const,
			type: "music" as const,
		};

		await expect(Effect.runPromise(parser.parseImportResourcesFx(request))).resolves.toEqual(
			request,
		);
	});
});
