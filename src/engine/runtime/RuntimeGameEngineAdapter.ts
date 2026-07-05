import { dispatchRuntimeGameAction } from "~/engine/runtime/dispatchRuntimeGameAction";
import { readInitialRuntimeGameEngineAdapterOptions } from "~/engine/runtime/readInitialRuntimeGameEngineAdapterOptions";
import { readRuntimeActionReadiness } from "~/engine/runtime/readRuntimeActionReadiness";
import { replaceRuntimeGameSave } from "~/engine/runtime/replaceRuntimeGameSave";
import { tickRuntimeGameEngine } from "~/engine/runtime/tickRuntimeGameEngine";
import { validateRuntimeWorldSnapshot } from "~/engine/runtime/validateRuntimeWorldSnapshot";
import type { GameActionReadiness } from "~/action/GameActionReadiness";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type {
	GameEngineRuntimeListener,
	GameEngineRuntimeSnapshot,
	GameEngineRuntimeUpdate,
	RuntimeGameEngineAdapterOptions,
	RuntimeGameEngineAdapterRequiredOptions,
	RuntimeGameEngineDispatchProps,
	RuntimeGameEngineReadinessProps,
	RuntimeGameEngineReplaceSaveProps,
	RuntimeGameEngineTickProps,
	RuntimeGameEngineValidateSnapshotProps,
} from "~/engine/runtime/RuntimeGameEngineAdapterTypes";
import type { GameEvent } from "~/event/GameEventSchema";
import type { RandomService } from "~/random/context/RandomService";

export type {
	GameEngineRuntimeListener,
	GameEngineRuntimeSnapshot,
	GameEngineRuntimeUpdate,
} from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export namespace RuntimeGameEngineAdapter {
	export type Options = RuntimeGameEngineAdapterOptions;
	export type DispatchProps = RuntimeGameEngineDispatchProps;
	export type ReadinessProps = RuntimeGameEngineReadinessProps;
	export type ReplaceSaveProps = RuntimeGameEngineReplaceSaveProps;
	export type TickProps = RuntimeGameEngineTickProps;
	export type ValidateSnapshotProps = RuntimeGameEngineValidateSnapshotProps;
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

	private constructor({
		config,
		initialSave,
		nextWakeAtMs,
		random,
	}: RuntimeGameEngineAdapterRequiredOptions) {
		this.config = config;
		this.random = random;
		this.save = initialSave;
		this.nextWakeAtMs = nextWakeAtMs;
	}

	static async create(options: RuntimeGameEngineAdapter.Options = {}) {
		return new RuntimeGameEngineAdapter(
			await readInitialRuntimeGameEngineAdapterOptions(options),
		);
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

	async readiness(props: RuntimeGameEngineAdapter.ReadinessProps): Promise<GameActionReadiness> {
		return this.enqueueMutation(() => readRuntimeActionReadiness(this.createScope(), props));
	}

	async dispatch(props: RuntimeGameEngineAdapter.DispatchProps): Promise<GameEngineResult> {
		return this.enqueueMutation(() => dispatchRuntimeGameAction(this.createScope(), props));
	}

	async replaceSave(props: RuntimeGameEngineAdapter.ReplaceSaveProps): Promise<GameEngineResult> {
		return this.enqueueMutation(() => replaceRuntimeGameSave(this.createScope(), props));
	}

	async tick(props: RuntimeGameEngineAdapter.TickProps = {}): Promise<GameEngineResult> {
		return this.enqueueMutation(() => tickRuntimeGameEngine(this.createScope(), props));
	}

	async validateSnapshot(props: RuntimeGameEngineAdapter.ValidateSnapshotProps = {}) {
		return this.enqueueMutation(() => validateRuntimeWorldSnapshot(this.createScope(), props));
	}

	private enqueueMutation<T>(run: () => Promise<T>): Promise<T> {
		const queued = this.mutationQueue.then(run, run);
		this.mutationQueue = queued.then(
			() => undefined,
			() => undefined,
		);

		return queued;
	}

	private createScope(): RuntimeGameEngineAdapterScope {
		return {
			config: this.config,
			publish: (update) => this.publish(update),
			random: this.random,
			readNextWakeAtMs: () => this.nextWakeAtMs,
			readSave: () => this.save,
			storeResult: (result) => this.storeResult(result),
		};
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
}
