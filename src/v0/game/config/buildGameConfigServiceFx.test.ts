import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { buildGameConfigServiceFx } from "~/v0/game/config/buildGameConfigServiceFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runConfigService = (props: buildGameConfigServiceFx.Props) =>
	Effect.runSync(buildGameConfigServiceFx(props));

describe("buildGameConfigServiceFx", () => {
	it("exposes the loaded game config as the hard runtime source of truth", () => {
		const config = createEngineTestConfig();

		const service = runConfigService({
			config,
		});

		expect(service.config).toBe(config);
	});
});
