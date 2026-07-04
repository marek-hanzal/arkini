import { applyGameActionFx } from "~/engine/applyGameActionFx";
import { createInitialGameSaveFx } from "~/save/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/engine/readActionReadinessFx";
import { runGameTickFx } from "~/engine/runGameTickFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { syncRealtimeWorldJobsFx } from "~/world/syncRealtimeWorldJobsFx";
import { validateWorldSnapshotFx } from "~/world/validateWorldSnapshotFx";
import { hasProcessableWorldJobs } from "~/world/hasProcessableWorldJobs";
import type { GameConfig } from "~/config/GameConfigTypes";
import { loadDefaultGameConfig } from "~/config/compiled/defaultGameConfig";
import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionReadiness } from "~/action/GameActionReadiness";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { RandomService } from "~/random/context/RandomService";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";

export interface GameEngineRuntimeUpdate {
	nowMs: number;
	result: GameEngineResult;
}

export type GameEngineRuntimeListener = (update: GameEngineRuntimeUpdate) => void;

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

	export interface ValidateSnapshotProps {
		checks?: readonly WorldSnapshotCheckId[];
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
		config,
		initialSave,
		nowMs = Date.now(),
		random,
	}: RuntimeGameEngineAdapter.Options = {}) {
		const resolvedConfig = config ?? (await loadDefaultGameConfig());
		const save =
			initialSave ??
			(await runGameEngineEffect(
				createInitialGameSaveFx({
					config: resolvedConfig,
					nowMs,
				}),
				{
					random,
				},
			));

		const syncedSave = await runGameEngineEffect(
			syncRealtimeWorldJobsFx({
				config: resolvedConfig,
				nowMs,
				save,
			}),
			{
				random,
			},
		);
		const nextWakeAtMs = await runGameEngineEffect(
			readNextWakeAtMsFx({
				config: resolvedConfig,
				nowMs,
				save: syncedSave,
			}),
			{
				random,
			},
		);

		return new RuntimeGameEngineAdapter({
			config: resolvedConfig,
			initialSave: syncedSave,
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
			const catchUpResults = await this.catchUpDueTicks(nowMs, {
				publish: false,
			});

			let result: GameEngineResult;
			try {
				result = await runGameEngineEffect(
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
			} catch (error) {
				const catchUpResult = this.combineResults(catchUpResults);
				if (catchUpResult) {
					this.publish({
						nowMs,
						result: catchUpResult,
					});
				}
				throw error;
			}

			const publishedResult =
				this.combineResults([
					...catchUpResults,
					result,
				]) ?? result;
			this.publish({
				nowMs,
				result: publishedResult,
			});

			return publishedResult;
		});
	}

	async replaceSave({
		events = [],
		nowMs = Date.now(),
		save,
	}: RuntimeGameEngineAdapter.ReplaceSaveProps): Promise<GameEngineResult> {
		return this.enqueueMutation(async () => {
			const syncedSave = await runGameEngineEffect(
				syncRealtimeWorldJobsFx({
					config: this.config,
					nowMs,
					save,
				}),
				{
					random: this.random,
				},
			);
			const nextWakeAtMs = await runGameEngineEffect(
				readNextWakeAtMsFx({
					config: this.config,
					nowMs,
					save: syncedSave,
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
					...syncedSave,
					updatedAtMs: nowMs,
				},
			} satisfies GameEngineResult;
			this.commit({
				nowMs,
				result,
			});

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

			this.commit({
				nowMs,
				result,
			});

			return result;
		});
	}

	async validateSnapshot({
		checks,
		nowMs = Date.now(),
	}: RuntimeGameEngineAdapter.ValidateSnapshotProps = {}) {
		return this.enqueueMutation(async () =>
			runGameEngineEffect(
				validateWorldSnapshotFx({
					checks,
					config: this.config,
					nowMs,
					save: this.save,
				}),
				{
					random: this.random,
				},
			),
		);
	}

	private async catchUpDueTicks(
		nowMs: number,
		{
			publish = true,
		}: {
			publish?: boolean;
		} = {},
	) {
		let tickCount = 0;
		const results: GameEngineResult[] = [];
		while (
			(this.nextWakeAtMs !== null && this.nextWakeAtMs <= nowMs) ||
			hasProcessableWorldJobs({
				config: this.config,
				nowMs,
				save: this.save,
			})
		) {
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

			results.push(result);
			if (publish) {
				this.commit({
					nowMs,
					result,
				});
			} else {
				this.storeResult(result);
			}
		}

		return results;
	}

	private enqueueMutation<T>(run: () => Promise<T>): Promise<T> {
		const queued = this.mutationQueue.then(run, run);
		this.mutationQueue = queued.then(
			() => undefined,
			() => undefined,
		);

		return queued;
	}

	private combineResults(results: readonly GameEngineResult[]) {
		const lastResult = results.at(-1);
		if (!lastResult) return null;

		return {
			events: results.flatMap((result) => result.events),
			nextWakeAtMs: lastResult.nextWakeAtMs,
			save: lastResult.save,
		} satisfies GameEngineResult;
	}

	private storeResult(result: GameEngineResult) {
		this.save = result.save;
		this.lastEvents = result.events;
		this.nextWakeAtMs = result.nextWakeAtMs;
	}

	private publish({ nowMs, result }: GameEngineRuntimeUpdate) {
		this.storeResult(result);

		for (const listener of this.listeners) {
			listener({
				nowMs,
				result,
			});
		}
	}

	private commit({ nowMs, result }: GameEngineRuntimeUpdate) {
		this.publish({
			nowMs,
			result,
		});
	}
}

interface RequiredAdapterOptions {
	config: GameConfig;
	initialSave: GameSave;
	nextWakeAtMs: number | null;
	random?: RandomService;
}
