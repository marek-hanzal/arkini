import { describe, expect, it } from "vitest";
import { createGameAudioPlan } from "~/audio/createGameAudioPlan";
import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameEvent } from "~/event/GameEventSchema";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";

const readSoundIds = (plan: GameAudioPlan.Type): GameAudioSoundId[] =>
	plan.entries.map((entry) => entry.soundId);

const createPlan = (events: readonly GameEvent[]) => {
	const config = createEngineTestConfig({
		game: {
			board: {
				height: 1,
				width: 2,
			},
			id: "game:test",
			inventory: {
				slots: 2,
			},
			title: "Test",
		},
		startingState: {
			board: [
				{
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:stash",
					x: 1,
					y: 0,
				},
			],
			inventory: [],
		},
	});
	const save = runInitialSave({
		config,
		nowMs: 0,
	});
	return createGameAudioPlan({
		config,
		currentSave: save,
		events,
		previousSave: save,
	});
};

describe("createGameAudioPlan", () => {
	it("uses one merge success sound and caps extra merge output sounds", () => {
		const events = [
			{
				from: {
					kind: "board",
					itemInstanceId: "source",
				},
				itemId: "item:twig",
				reason: "merge-source",
				type: "item.consumed",
			},
			{
				atMs: 0,
				fromItemId: "item:twig",
				itemInstanceId: "target",
				reason: "merge-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
			...Array.from(
				{
					length: 5,
				},
				(_, index) => ({
					itemId: "item:twig",
					reason: "merge-output" as const,
					to: {
						kind: "board" as const,
						itemInstanceId: `bonus:${index}`,
						x: 0,
						y: 0,
					},
					type: "item.created" as const,
				}),
			),
		] satisfies GameEvent[];

		expect(readSoundIds(createPlan(events))).toEqual([
			"audio.merge.success",
			"audio.merge.output",
			"audio.merge.output",
			"audio.merge.output",
		]);
	});

	it("lets craft.completed own the reward sound instead of also playing craft result replace", () => {
		const events = [
			{
				atMs: 100,
				jobId: "job:craft",
				recipeId: "item:craft-table",
				targetItemInstanceId: "craft-table",
				type: "craft.completed",
			},
			{
				atMs: 100,
				fromItemId: "item:craft-table",
				itemInstanceId: "craft-table",
				reason: "craft-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
		] satisfies GameEvent[];

		expect(readSoundIds(createPlan(events))).toEqual([
			"audio.craft.complete",
		]);
	});

	it("uses line.completed instead of every line-output item pop", () => {
		const events = [
			{
				atMs: 100,
				itemInstanceId: "missing-instance-is-still-a-producer-sound",
				jobId: "job:line",
				lineId: "line:test",
				type: "line.completed",
			},
			{
				itemId: "item:twig",
				reason: "line-output",
				to: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		] satisfies GameEvent[];

		expect(readSoundIds(createPlan(events))).toEqual([
			"audio.producer.complete",
		]);
	});

	it("uses stash sounds for line events owned by a stash item", () => {
		const config = createEngineTestConfig({
			game: {
				board: {
					height: 1,
					width: 1,
				},
				id: "game:test",
				inventory: {
					slots: 2,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const stashItem = Object.values(save.board.items)[0];
		const events = [
			{
				atMs: 0,
				itemInstanceId: stashItem.id,
				jobId: "job:stash",
				lineId: "line:stash",
				readyAtMs: 0,
				startAtMs: 0,
				type: "line.started",
			},
			{
				atMs: 0,
				itemInstanceId: stashItem.id,
				jobId: "job:stash",
				lineId: "line:stash",
				type: "line.completed",
			},
		] satisfies GameEvent[];

		expect(
			readSoundIds(
				createGameAudioPlan({
					config,
					currentSave: save,
					events,
					previousSave: save,
				}),
			),
		).toEqual([
			"audio.stash.open.start",
			"audio.stash.release",
		]);
	});

	it("maps cheat speed changes to direction-specific sounds", () => {
		const enable = createPlan([
			{
				atMs: 10,
				nextMode: "instant",
				previousMode: "normal",
				type: "cheat.speed_mode.changed",
			},
		]);
		const disable = createPlan([
			{
				atMs: 20,
				nextMode: "normal",
				previousMode: "instant",
				type: "cheat.speed_mode.changed",
			},
		]);

		expect(readSoundIds(enable)).toEqual([
			"audio.cheat.speed.enable",
		]);
		expect(readSoundIds(disable)).toEqual([
			"audio.cheat.speed.disable",
		]);
	});
});
