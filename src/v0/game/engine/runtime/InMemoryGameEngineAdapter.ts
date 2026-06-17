import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/fx/readActionReadinessFx";
import { runGameTickFx } from "~/v0/game/engine/fx/runGameTickFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import type { GameAction } from "~/v0/game/engine/model/GameActionSchema";
import type { GameActionReadiness } from "~/v0/game/engine/model/GameActionReadinessSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
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

export namespace InMemoryGameEngineAdapter {
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
	}

	export interface TickProps {
		nowMs?: number;
	}
}

/**
 * Small in-memory adapter around the standalone tick/action engine.
 *
 * It owns the current `(config, save)` pair for a running browser session and publishes
 * domain events from engine results. It deliberately does not know Dexie, SQLite,
 * React Query or TileEngine. Those layers can subscribe/wrap it later like civilized
 * code instead of pouring persistence concrete into gameplay rules.
 */
export class InMemoryGameEngineAdapter {
	readonly config: GameConfig;
	private readonly listeners = new Set<GameEngineRuntimeListener>();
	private readonly random?: RandomService;
	private lastEvents: readonly GameEvent[] = [];
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
	}: InMemoryGameEngineAdapter.Options = {}) {
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
				save,
			}),
			{
				random,
			},
		);

		return new InMemoryGameEngineAdapter({
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
	}: InMemoryGameEngineAdapter.ReadinessProps): Promise<GameActionReadiness> {
		return runGameEngineEffect(
			readActionReadinessFx({
				action,
				config: this.config,
				save: this.save,
			}),
			{
				random: this.random,
			},
		);
	}

	async dispatch({
		action,
		nowMs = Date.now(),
	}: InMemoryGameEngineAdapter.DispatchProps): Promise<GameEngineResult> {
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
	}

	async tick({
		nowMs = Date.now(),
	}: InMemoryGameEngineAdapter.TickProps = {}): Promise<GameEngineResult> {
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
