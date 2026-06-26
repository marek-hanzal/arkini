import { Effect } from "effect";
import { applyGameActionFx } from "~/v0/game/engine/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/readActionReadinessFx";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import type { GameActionReadiness } from "~/v0/game/action/GameActionReadinessSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { RandomService } from "~/v0/random/context/RandomService";
import { runGameEngineEffect } from "~/v0/game/engine/runtime/runGameEngineEffect";

export type GameEngineRuntimeListener = (result: GameEngineResult) => void;

export interface GameEngineRuntimeSnapshot {
	config: GameConfig;
	lastEvents: readonly GameEvent[];
	nextWakeAtMs: number | null;
	save: GameSave;
}

export namespace RuntimeGameEngineAdapter {
	export interface Options {
		config?: GameConfig;
		initialSave?: GameSave;
		nowMs?: number;
		random?: RandomService;
	}

	export interface DispatchProps {
		action: GameAction | unknown;
		nowMs?: number;
	}

	export interface ReadinessProps {
		action: GameAction | unknown;
		nowMs?: number;
	}

	export interface ReplaceSaveProps {
		events?: GameEvent[];
		nowMs?: number;
		save: GameSave;
	}

	export interface TickProps {
		nowMs?: number;
	}
}

/**
 * Runtime adapter around the standalone tick/action engine.
 *
 * It owns the current `(config, save)` pair for a running browser session and publishes
 * domain events from engine results. It deliberately does not know Dexie, browser
 * storage or TileEngine. Those layers can subscribe/wrap it later like civilized
 * code instead of pouring persistence concrete into gameplay rules.
 */
export class RuntimeGameEngineAdapter {
	readonly config: GameConfig;
	private readonly listeners = new Set<GameEngineRuntimeListener>();
	private readonly random?: RandomService;
	private lastEvents: readonly GameEvent[] = [];
	private mutationQueue: Promise<void> = Promise.resolve();
	private nextWakeAtMs: number | null = null;
	private save: GameSave;

	private constructor({ config, initialSave, nextWakeAtMs, random }: RequiredAdapterOptions) {
		this.config = config;
		this.random = random;
		this.save = initialSave;
		this.nextWakeAtMs = nextWakeAtMs;
	}

	static async create({
		config = defaultGameConfig,
		initialSave,
		nowMs = Date.now(),
		random,
	}: RuntimeGameEngineAdapter.Options = {}) {
		const save =
			initialSave ??
			(await runGameEngineEffect(
				createInitialGameSaveFx({
					config,
					nowMs,
				}),
				{
					random,
				},
			));

		const nextWakeAtMs = await runGameEngineEffect(
			readNextWakeAtMsFx({
				nowMs,
				save,
			}),
			{
				random,
			},
		);

		return new RuntimeGameEngineAdapter({
			config,
			initialSave: save,
			nextWakeAtMs,
			random,
		});
	}

	readSnapshot(): GameEngineRuntimeSnapshot {
		return {
			config: this.config,
			lastEvents: this.lastEvents,
			nextWakeAtMs: this.nextWakeAtMs,
			save: this.save,
		};
	}

	readSave() {
		return this.save;
	}

	subscribe(listener: GameEngineRuntimeListener) {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	async readiness({
		action,
		nowMs = Date.now(),
	}: RuntimeGameEngineAdapter.ReadinessProps): Promise<GameActionReadiness> {
		return this.enqueueMutation(async () => {
			await this.catchUpDueTicks(nowMs);

			return runGameEngineEffect(
				readActionReadinessFx({
					action,
					config: this.config,
					nowMs,
					save: this.save,
				}),
				{
					random: this.random,
				},
			);
		});
	}

	async dispatch({
		action,
		nowMs = Date.now(),
	}: RuntimeGameEngineAdapter.DispatchProps): Promise<GameEngineResult> {
		return this.enqueueMutation(async () => {
			await this.catchUpDueTicks(nowMs);

			const result = await runGameEngineEffect(
				applyGameActionFx({
					action,
					config: this.config,
					nowMs,
					save: this.save,
				}),
				{
					random: this.random,
				},
			);

			this.commit(result);

			return result;
		});
	}

	async replaceSave({
		events = [],
		nowMs = Date.now(),
		save,
	}: RuntimeGameEngineAdapter.ReplaceSaveProps): Promise<GameEngineResult> {
		return this.enqueueMutation(async () => {
			const nextWakeAtMs = await runGameEngineEffect(
				readNextWakeAtMsFx({
					nowMs,
					save,
				}),
				{
					random: this.random,
				},
			);

			const result = {
				events: [
					...events,
				],
				nextWakeAtMs,
				save: {
					...save,
					updatedAtMs: nowMs,
				},
			} satisfies GameEngineResult;
			this.commit(result);

			return result;
		});
	}

	async tick({
		nowMs = Date.now(),
	}: RuntimeGameEngineAdapter.TickProps = {}): Promise<GameEngineResult> {
		return this.enqueueMutation(async () => {
			const result = await runGameEngineEffect(
				runGameTickFx({
					config: this.config,
					nowMs,
					save: this.save,
				}),
				{
					random: this.random,
				},
			);

			this.commit(result);

			return result;
		});
	}

	private async catchUpDueTicks(nowMs: number) {
		let tickCount = 0;
		while (this.nextWakeAtMs !== null && this.nextWakeAtMs <= nowMs) {
			tickCount += 1;
			if (tickCount > 100) {
				throw new Error("Game runtime catch-up exceeded 100 ready ticks.");
			}

			const result = await runGameEngineEffect(
				runGameTickFx({
					config: this.config,
					nowMs,
					save: this.save,
				}),
				{
					random: this.random,
				},
			);

			this.commit(result);
		}
	}

	private enqueueMutation<T>(run: () => Promise<T>): Promise<T> {
		const queued = this.mutationQueue.then(run, run);
		this.mutationQueue = queued.then(
			() => undefined,
			() => undefined,
		);

		return queued;
	}

	private commit(result: GameEngineResult) {
		this.save = result.save;
		this.lastEvents = result.events;
		this.nextWakeAtMs = result.nextWakeAtMs;

		for (const listener of this.listeners) {
			listener(result);
		}
	}
}

interface RequiredAdapterOptions {
	config: GameConfig;
	initialSave: GameSave;
	nextWakeAtMs: number | null;
	random?: RandomService;
}
