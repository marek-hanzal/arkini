import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigServiceFx, type GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ProducerDefinition } from "~/v0/manifest/activation/ProducerDefinition";
import { assertActivationStoredInputsFx } from "./assertActivationStoredInputsFx";

const gameConfig = {
	getItem(itemId: string) {
		return {
			id: itemId,
			name: itemId === "item:water" ? "Water" : itemId === "item:twig" ? "Twig" : itemId,
		};
	},
} as GameConfigService;

const producer = (overrides: Partial<ProducerDefinition> = {}): ProducerDefinition => ({
	type: "producer",
	trigger: "click",
	placement: "board_then_inventory",
	outputTableId: "loot:tree",
	cooldownMs: 0,
	...overrides,
});

const run = (props: assertActivationStoredInputsFx.Props) =>
	Effect.runPromiseExit(
		assertActivationStoredInputsFx(props).pipe(
			Effect.provideService(GameConfigServiceFx, gameConfig),
		),
	);

describe("assertActivationStoredInputsFx", () => {
	it("treats requirements as gates, not per-step consumable inputs", async () => {
		const result = await run({
			activation: producer({
				inputs: [
					{
						capacity: 10,
						itemId: "item:twig",
						quantity: 2,
					},
				],
				requirements: [
					{
						capacity: 1,
						itemId: "item:water",
						quantity: 1,
					},
				],
			}),
			gameConfig,
			steps: 3,
			storedInputs: new Map([
				[
					"item:water",
					1,
				],
				[
					"item:twig",
					6,
				],
			]),
		});

		expect(Exit.isSuccess(result)).toBe(true);
	});

	it("fails when a gate requirement is missing even if consumable inputs are ready", async () => {
		const result = await run({
			activation: producer({
				inputs: [
					{
						capacity: 10,
						itemId: "item:twig",
						quantity: 2,
					},
				],
				requirements: [
					{
						capacity: 1,
						itemId: "item:water",
						quantity: 1,
					},
				],
			}),
			gameConfig,
			steps: 3,
			storedInputs: new Map([
				[
					"item:twig",
					6,
				],
			]),
		});

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			expect(result.cause.toString()).toContain("Producer requires Water.");
		}
	});

	it("multiplies consumable input quantity by activation steps", async () => {
		const result = await run({
			activation: producer({
				inputs: [
					{
						capacity: 10,
						itemId: "item:twig",
						quantity: 2,
					},
				],
			}),
			gameConfig,
			steps: 3,
			storedInputs: new Map([
				[
					"item:twig",
					5,
				],
			]),
		});

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			expect(result.cause.toString()).toContain("Producer needs Twig.");
		}
	});
});
