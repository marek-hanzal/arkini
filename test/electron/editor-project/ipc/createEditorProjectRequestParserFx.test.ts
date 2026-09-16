import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorProjectRequestParserFx } from "~electron/main/editor-project/ipc/createEditorProjectRequestParserFx";

describe("createEditorProjectRequestParserFx", () => {
	it.each([
		"music",
		"sfx",
	] as const)("admits %s file imports at the renderer IPC boundary", async (type) => {
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
			type,
		};

		await expect(Effect.runPromise(parser.parseImportResourcesFx(request))).resolves.toEqual(
			request,
		);
	});
});
