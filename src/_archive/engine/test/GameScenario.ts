import { Effect } from "effect";
import type { GameAction } from "~/action/GameActionSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type {
	GameSave,
	GameSaveBoardItem,
	GameSaveInventorySlot,
} from "~/engine/model/GameSaveSchema";
import { writeBoardMemoryLayoutToSaveFx } from "~/board-memory/writeBoardMemoryLayoutToSaveFx";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

export type GameScenarioBoardItemDraft = Omit<GameSaveBoardItem, "id"> & {
	id?: string;
};

export namespace GameScenario {
	export interface Props {
		config?: GameConfig;
		nowMs?: number;
		save?: GameSave;
	}

	export interface RunOptions {
		nowMs?: number;
	}

	export interface TryRunResult {
		either: ReturnType<typeof runActionEither>;
		scenario: GameScenario;
	}
}

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

const normalizeInventorySlots = ({
	config,
	slots,
}: {
	config: GameConfig;
	slots: readonly GameSaveInventorySlot[];
}) => {
	const nextSlots = [
		...slots,
	];
	while (nextSlots.length < config.game.inventory.slots) nextSlots.push(null);
	return nextSlots.slice(0, config.game.inventory.slots);
};

const createBoardItemFromDraft = (
	item: GameScenarioBoardItemDraft,
	index: number,
): GameSaveBoardItem => ({
	...item,
	id: item.id ?? `scenario:board:${index}`,
});

export class GameScenario {
	readonly config: GameConfig;
	readonly lastResult?: GameEngineResult;
	readonly nowMs: number;
	readonly save: GameSave;

	constructor({ config = createEngineTestConfig(), nowMs = 0, save }: GameScenario.Props = {}) {
		this.config = config;
		this.nowMs = nowMs;
		this.save = save
			? cloneSave(save)
			: runInitialSave({
					config,
					nowMs,
				});
	}

	private cloneWith({
		lastResult,
		nowMs = this.nowMs,
		save = this.save,
	}: {
		lastResult?: GameEngineResult;
		nowMs?: number;
		save?: GameSave;
	} = {}) {
		const scenario = new GameScenario({
			config: this.config,
			nowMs,
			save,
		});
		return Object.assign(scenario, {
			lastResult,
		});
	}

	run(action: GameAction, options: GameScenario.RunOptions = {}) {
		const nowMs = options.nowMs ?? this.nowMs + 1;
		const result = runAction({
			action,
			config: this.config,
			nowMs,
			save: this.save,
		});
		return this.cloneWith({
			lastResult: result,
			nowMs,
			save: result.save,
		});
	}

	tryRun(action: GameAction, options: GameScenario.RunOptions = {}): GameScenario.TryRunResult {
		const nowMs = options.nowMs ?? this.nowMs + 1;
		const either = runActionEither({
			action,
			config: this.config,
			nowMs,
			save: this.save,
		});
		return {
			either,
			scenario:
				either._tag === "Right"
					? this.cloneWith({
							lastResult: either.right,
							nowMs,
							save: either.right.save,
						})
					: this,
		};
	}

	withBoardItems(items: readonly GameScenarioBoardItemDraft[]) {
		const save = cloneSave(this.save);
		save.board.items = Object.fromEntries(
			items.map((item, index) => {
				const boardItem = createBoardItemFromDraft(item, index);
				return [
					boardItem.id,
					boardItem,
				];
			}),
		);
		return this.cloneWith({
			save,
		});
	}

	withInventorySlots(slots: readonly GameSaveInventorySlot[]) {
		const save = cloneSave(this.save);
		save.inventory.slots = normalizeInventorySlots({
			config: this.config,
			slots,
		});
		return this.cloneWith({
			save,
		});
	}

	withBoardMemoryLayout({
		boardItemId,
		items,
		savedAtMs = this.nowMs,
	}: {
		boardItemId: string;
		items: GameSave["boardMemoryLayouts"][string]["items"];
		savedAtMs?: number;
	}) {
		const save = cloneSave(this.save);
		Effect.runSync(
			writeBoardMemoryLayoutToSaveFx({
				boardItemId,
				layout: {
					items: [
						...items,
					],
					savedAtMs,
				},
				save,
			}),
		);
		return this.cloneWith({
			save,
		});
	}

	findBoardItem(matcher: { itemId: string; x: number; y: number }) {
		return findBoardItem(this.save, matcher);
	}

	readBoardItemAt(x: number, y: number) {
		return Object.values(this.save.board.items).find((item) => item.x === x && item.y === y);
	}

	readBoardItemById(itemInstanceId: string) {
		return this.save.board.items[itemInstanceId];
	}

	readInventorySlot(slotIndex: number) {
		return this.save.inventory.slots[slotIndex];
	}
}

export const createGameScenario = (props: GameScenario.Props = {}) => new GameScenario(props);
