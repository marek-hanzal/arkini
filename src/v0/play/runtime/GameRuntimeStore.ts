import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameAction } from "~/v0/game/engine/model/GameActionSchema";
import {
	RuntimeGameEngineAdapter,
	type GameEngineRuntimeSnapshot,
} from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";

export interface GameRuntimeState {
	nowMs: number;
	revision: number;
	runtime: GameEngineRuntimeSnapshot;
}

export namespace GameRuntimeStore {
	export interface Update {
		current: GameRuntimeState;
		previous: GameRuntimeState;
		result: GameEngineResult;
	}

	export interface Options {
		adapter?: RuntimeGameEngineAdapter;
		nowMs?: number;
	}

	export interface DispatchProps {
		action: GameAction | unknown;
		nowMs?: number;
	}

	export interface ReplaceSaveProps {
		nowMs?: number;
		save: GameSave;
	}

	export type Listener = () => void;
	export type UpdateListener = (update: Update) => void;
}

const createRuntimeState = ({
	nowMs,
	revision,
	runtime,
}: {
	nowMs: number;
	revision: number;
	runtime: GameEngineRuntimeSnapshot;
}): GameRuntimeState => ({
	nowMs,
	revision,
	runtime,
});

export class GameRuntimeStore {
	readonly adapter: RuntimeGameEngineAdapter;
	private readonly listeners = new Set<GameRuntimeStore.Listener>();
	private readonly updateListeners = new Set<GameRuntimeStore.UpdateListener>();
	private readonly unsubscribeAdapter: () => void;
	private state: GameRuntimeState;

	private constructor({ adapter, nowMs }: Required<GameRuntimeStore.Options>) {
		this.adapter = adapter;
		this.state = createRuntimeState({
			nowMs,
			revision: 0,
			runtime: adapter.readSnapshot(),
		});
		this.unsubscribeAdapter = adapter.subscribe((result) => {
			this.publish({
				nowMs: Date.now(),
				result,
			});
		});
	}

	static async create({ adapter, nowMs = Date.now() }: GameRuntimeStore.Options = {}) {
		return new GameRuntimeStore({
			adapter:
				adapter ??
				(await RuntimeGameEngineAdapter.create({
					nowMs,
				})),
			nowMs,
		});
	}

	getSnapshot = () => this.state;

	subscribe = (listener: GameRuntimeStore.Listener) => {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	};

	subscribeUpdate = (listener: GameRuntimeStore.UpdateListener) => {
		this.updateListeners.add(listener);

		return () => {
			this.updateListeners.delete(listener);
		};
	};

	async dispatch({ action, nowMs = Date.now() }: GameRuntimeStore.DispatchProps) {
		return this.adapter.dispatch({
			action,
			nowMs,
		});
	}

	async tick({ nowMs = Date.now() }: RuntimeGameEngineAdapter.TickProps = {}) {
		return this.adapter.tick({
			nowMs,
		});
	}

	async readiness({ action }: RuntimeGameEngineAdapter.ReadinessProps) {
		return this.adapter.readiness({
			action,
		});
	}

	async replaceSave({ save, nowMs = Date.now() }: GameRuntimeStore.ReplaceSaveProps) {
		return this.adapter.replaceSave({
			nowMs,
			save,
		});
	}

	destroy() {
		this.unsubscribeAdapter();
		this.listeners.clear();
		this.updateListeners.clear();
	}

	private publish({ nowMs, result }: { nowMs: number; result: GameEngineResult }) {
		const previous = this.state;
		const current = createRuntimeState({
			nowMs,
			revision: previous.revision + 1,
			runtime: this.adapter.readSnapshot(),
		});
		this.state = current;

		for (const listener of this.listeners) {
			listener();
		}

		const update = {
			current,
			previous,
			result,
		} satisfies GameRuntimeStore.Update;
		for (const listener of this.updateListeners) {
			listener(update);
		}
	}
}

export type GameRuntimeDispatchResult = GameEngineResult;
