import { match } from "ts-pattern";
import { gameDataIndex, type ItemId, type ProducerMode } from "~/domains/game-data";
import type { BoardItemState, ProducerView } from "./gameplayTypes";

export const parseJson = <T>(value: string): T => JSON.parse(value) as T;
export const json = (value: unknown) => JSON.stringify(value);

export function createInitialBoardState(itemId: string, timestamp = Date.now()): BoardItemState {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) return {};

  const mode = producer.mode ?? { type: "infinite" as const };

  return match(mode as ProducerMode)
    .with({ type: "auto" }, (auto) => ({
      producer: {
        paused: !auto.enabledByDefault,
        autoAvailable: auto.capacity,
        nextDropAt: new Date(timestamp + auto.tickMs).toISOString(),
        rechargeUntil: null,
        remainingCharges: null,
        cooldownUntil: null,
      },
    }))
    .with({ type: "finite" }, (finite) => ({
      producer: {
        remainingCharges: finite.charges,
        cooldownUntil: null,
        paused: false,
      },
    }))
    .with({ type: "infinite" }, () => ({ producer: { remainingCharges: null, cooldownUntil: null, paused: false } }))
    .exhaustive();
}

export function readProducerView(itemId: string, state: BoardItemState): ProducerView | null {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) return null;

  const initial = createInitialBoardState(itemId).producer ?? {};
  const producerState = { ...initial, ...(state.producer ?? {}) };

  if (producer.trigger === "click") {
    return {
      trigger: producer.trigger,
      mode: producer.mode ?? { type: "infinite" },
      cooldownMs: producer.cooldownMs ?? null,
      cooldownUntil: producerState.cooldownUntil ?? null,
      remainingCharges: producerState.remainingCharges ?? null,
      paused: false,
      autoAvailable: null,
      nextDropAt: null,
      rechargeUntil: null,
    };
  }

  return {
    trigger: producer.trigger,
    mode: producer.mode ?? { type: "infinite" },
    cooldownMs: producer.cooldownMs ?? null,
    cooldownUntil: null,
    remainingCharges: null,
    paused: producerState.paused ?? false,
    autoAvailable: producerState.autoAvailable ?? null,
    nextDropAt: producerState.nextDropAt ?? null,
    rechargeUntil: producerState.rechargeUntil ?? null,
  };
}
