import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { isProductLineVisibleForGameSave } from "~/v0/game/producer/isProductLineVisibleForGameSave";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("isProductLineVisibleForGameSave", () => {
	it("shows product lines without showIf markers", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			isProductLineVisibleForGameSave({
				product: config.products["product:test"],
				save,
			}),
		).toBe(true);
	});

	it("shows product lines when any showIf marker is owned anywhere", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					showIf: [
						"item:axe",
						"item:key",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			isProductLineVisibleForGameSave({
				product: config.products["product:test"],
				save,
			}),
		).toBe(false);

		save.stashInputs["item-instance:stash"] = {
			items: {
				"item:key": 1,
			},
		};

		expect(
			isProductLineVisibleForGameSave({
				product: config.products["product:test"],
				save,
			}),
		).toBe(true);
	});
});
