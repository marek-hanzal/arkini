import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createArkiniUserDataPathsFn } from "~electron/main/user-data/fn/createArkiniUserDataPathsFn";

describe("Arkini user data", () => {
	it("separates canonical game persistence below one Arkini root", () => {
		const userDataPath = join("tmp", "arkini-user-data");
		const paths = createArkiniUserDataPathsFn(userDataPath);

		expect(paths).toEqual({
			root: join(userDataPath, "arkini"),
			editor: {
				root: join(userDataPath, "arkini", "editor"),
				catalog: join(userDataPath, "arkini", "editor", "projects.json"),
				projects: join(userDataPath, "arkini", "editor", "projects"),
			},
			game: {
				root: join(userDataPath, "arkini", "game"),
				arkpacks: join(userDataPath, "arkini", "game", "arkpacks"),
				incidents: join(userDataPath, "arkini", "game", "incidents"),
				logs: join(userDataPath, "arkini", "game", "logs"),
				preferences: join(userDataPath, "arkini", "game", "preferences"),
				saves: join(userDataPath, "arkini", "game", "saves"),
			},
		});
	});
});
