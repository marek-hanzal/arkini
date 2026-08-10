import { Effect } from "effect";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createArkiniUserDataPathsFx } from "../../electron/main/user-data/createArkiniUserDataPathsFx";

describe("Arkini user data", () => {
	it("separates canonical game persistence below one Arkini root", () => {
		const userDataPath = join("tmp", "arkini-user-data");
		const paths = Effect.runSync(createArkiniUserDataPathsFx(userDataPath));

		expect(paths).toEqual({
			root: join(userDataPath, "arkini"),
			editor: {
				root: join(userDataPath, "arkini", "editor"),
				database: join(userDataPath, "arkini", "editor", "projects.sqlite"),
			},
			game: {
				root: join(userDataPath, "arkini", "game"),
				arkpacks: join(userDataPath, "arkini", "game", "arkpacks"),
				logs: join(userDataPath, "arkini", "game", "logs"),
				preferences: join(userDataPath, "arkini", "game", "preferences"),
				saves: join(userDataPath, "arkini", "game", "saves"),
			},
		});
	});
});
