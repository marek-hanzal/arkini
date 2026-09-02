import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createArkiniUserDataPathsFn } from "~/application-data/fn/createArkiniUserDataPathsFn";

describe("Arkini user data", () => {
	it("separates canonical persistence directly below one Arkini home root", () => {
		const homePath = join("tmp", "system-home");
		const root = join(homePath, ".arkini");
		const paths = createArkiniUserDataPathsFn(homePath);

		expect(paths).toEqual({
			root,
			diagnostics: join(root, "diagnostics"),
			editor: {
				root: join(root, "editor"),
				catalog: join(root, "editor", "projects.json"),
				projects: join(root, "editor", "projects"),
			},
			game: {
				root: join(root, "game"),
				arkpacks: join(root, "game", "arkpacks"),
				incidents: join(root, "game", "incidents"),
				preferences: join(root, "game", "preferences"),
				saves: join(root, "game", "saves"),
			},
		});
	});
});
