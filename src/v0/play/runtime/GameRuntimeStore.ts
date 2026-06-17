import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameAction } from "~/v0/game/engine/model/GameActionSchema";
import {
	RuntimeGameEngineAdapter,
	type GameEngineRuntimeSnapshot,
} from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import { readRuntimeInventoryViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";

export interface GameRuntimeState {
	board: BoardView;
	inventory: InventoryView;
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
	board: readRuntimeBoardViewFromGameSave({
		config: runtime.config,
		nowMs,
		save: runtime.save,
	}),
	inventory: readRuntimeInventoryViewFromGameSave({
		config: runtime.config,
		save: runtime.save,
	}),
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

	static async create({
		adapter,
		nowMs = Date.now(),
	}: GameRuntimeStore.Options = {}) {
		return new GameRuntimeStore({
			adapter: adapter ?? (await RuntimeGameEngineAdapter.create({ nowMs })),
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
		return this.adapter.readiness({ action });
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
