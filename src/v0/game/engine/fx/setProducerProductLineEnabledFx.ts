import { Effect } from "effect";
import { checkProducerProductLineSetEnabledReadinessFx } from "~/v0/game/engine/fx/checkProducerProductLineSetEnabledReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { readProducerProductLineEnabledFx } from "~/v0/game/engine/fx/readProducerProductLineEnabledFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductLineSetEnabled } from "~/v0/game/engine/model/GameActionProducerProductLineSetEnabled";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace setProducerProductLineEnabledFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductLineSetEnabled;
		nowMs: number;
	}
}

export const setProducerProductLineEnabledFx = Effect.fn("setProducerProductLineEnabledFx")(
	function* ({ config, save, action, nowMs }: setProducerProductLineEnabledFx.Props) {
		const checked = yield* checkProducerProductLineSetEnabledReadinessFx({
			action,
			config,
			save,
		});
		const previousEnabled = yield* readProducerProductLineEnabledFx({
			producerItemInstanceId: action.producerItemInstanceId,
			productId: action.productId,
			save,
		});
		if (previousEnabled === action.enabled) {
			return {
				events: [],
				nextWakeAtMs: yield* readNextWakeAtMsFx({
					save,
				}),
				save,
			} satisfies GameEngineResult;
		}

		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const disabledProductIds = new Set(
			nextSave.producerLines[action.producerItemInstanceId]?.disabledProductIds ?? [],
		);
		if (action.enabled) {
			disabledProductIds.delete(action.productId);
		} else {
			disabledProductIds.add(action.productId);
		}

		const productOrder = new Map(
			checked.producerDefinition.productIds.map((productId, index) => [
				productId,
				index,
			]),
		);
		const nextDisabledProductIds = Array.from(disabledProductIds).sort((left, right) => {
			const orderDiff =
				(productOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
				(productOrder.get(right) ?? Number.MAX_SAFE_INTEGER);
			return orderDiff || left.localeCompare(right);
		});
		if (nextDisabledProductIds.length === 0) {
			delete nextSave.producerLines[action.producerItemInstanceId];
		} else {
			nextSave.producerLines[action.producerItemInstanceId] = {
				disabledProductIds: nextDisabledProductIds,
			};
		}
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					changedAtMs: nowMs,
					nextEnabled: action.enabled,
					previousEnabled,
					producerItemInstanceId: action.producerItemInstanceId,
					productId: action.productId,
					type: "producer.product_line.enabled_changed" as const,
				},
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	},
);
