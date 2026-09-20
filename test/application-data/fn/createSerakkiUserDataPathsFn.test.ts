import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createSerakkiUserDataPathsFn } from "~/application-data/fn/createSerakkiUserDataPathsFn";

describe("Serakki user data", () => {
	it("separates canonical persistence directly below one Serakki home root", () => {
		const homePath = join("tmp", "system-home");
		const root = join(homePath, ".serakki");
		const paths = createSerakkiUserDataPathsFn(homePath);

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
				serapacks: join(root, "game", "serapacks"),
				installations: join(root, "game", "installed"),
				incidents: join(root, "game", "incidents"),
				preferences: join(root, "game", "preferences"),
				saves: join(root, "game", "saves"),
			},
		});
	});
});
