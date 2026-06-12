import { match } from "ts-pattern";
import { gameDataIndex } from "~/manifest/server/gameDataIndex";
import type { ItemId } from "~/manifest/server/manifestId";
import type { ProducerMode } from "~/manifest/server/producer";
import { parseJson } from "~/shared/json";
import type { BoardItemState, ProducerView } from "~/play/server/playTypes";

export function createInitialBoardState(itemId: string): BoardItemState {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) return {};

  const mode = producer.mode ?? { type: "infinite" as const };

  return match(mode as ProducerMode)
    .with({ type: "finite" }, (finite) => ({
      producer: {
        remainingCharges: finite.charges,
        cooldownUntil: null,
      },
    }))
    .with({ type: "infinite" }, () => ({ producer: { remainingCharges: null, cooldownUntil: null } }))
    .exhaustive();
}

export function readProducerView(itemId: string, state: BoardItemState): ProducerView | null {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) return null;

  const initial = createInitialBoardState(itemId).producer ?? {};
  const producerState = { ...initial, ...(state.producer ?? {}) };

  return {
    trigger: producer.trigger,
    mode: producer.mode ?? { type: "infinite" },
    cooldownMs: producer.cooldownMs ?? null,
    doubleClickBehavior: producer.doubleClickBehavior ?? null,
    cooldownUntil: producerState.cooldownUntil ?? null,
    remainingCharges: producerState.remainingCharges ?? null,
  };
}

export function readBoardState(row: Pick<readBoardState.Row, "stateJson">) {
  return parseJson<BoardItemState>(row.stateJson || "{}");
}

export namespace readBoardState {
  export interface Row {
    stateJson: string;
  }
}
