import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameActionSchema, type GameAction } from "~/v0/game/engine/model/GameActionSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type {
	GameSave,
	GameSaveBoardItem,
	GameSaveInventoryStack,
} from "~/v0/game/engine/model/GameSaveSchema";

export namespace applyGameActionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
		nowMs: number;
	}
}

export const applyGameActionFx = Effect.fn("applyGameActionFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: applyGameActionFx.Props) {
	const parsedAction = yield* parseGameActionFx(action);

	return yield* match(parsedAction)
		.with(
			{
				type: "producer.product.start",
			},
			(startAction) =>
				startProducerProductFx({
					action: startAction,
					config,
					nowMs,
					save,
				}),
		)
		.exhaustive();
});

const parseGameActionFx = Effect.fn("parseGameActionFx")(function* (action: unknown) {
	const result = GameActionSchema.safeParse(action);
	if (!result.success) {
		return yield* Effect.fail(
			GameEngineError.actionInvalid(
				result.error.issues.map((issue) => issue.message).join("; "),
			),
		);
	}
	return result.data;
});

type ProducerProductStartAction = Extract<
	GameAction,
	{
		type: "producer.product.start";
	}
>;

const startProducerProductFx = Effect.fn("startProducerProductFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	action: ProducerProductStartAction;
	nowMs: number;
}) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		save,
		producerItemInstanceId: action.producerItemInstanceId,
	});
	const producerDefinition =
		config.producers[config.items[producerItem.itemId]?.producerId ?? ""];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Producer item "${producerItem.itemId}" references missing producer.`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}

	const product = config.products[action.productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${action.productId}".`),
		);
	}

	yield* checkRequirementsFx({
		config,
		requirements: producerDefinition.requirements,
		save,
	});
	yield* checkRequirementsFx({
		config,
		requirements: product.requirements,
		save,
	});

	const consumed = yield* consumeProductInputsFx({
		config,
		inputRefs: action.inputRefs,
		inputs: product.inputs,
		nowMs,
		save,
	});
	const nextSave = consumed.save;
	const jobId = createGameJobId(nextSave);
	const completesAtMs = nowMs + product.durationMs;
	nextSave.producerJobs[jobId] = {
		completesAtMs,
		id: jobId,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: action.productId,
		startedAtMs: nowMs,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				completesAtMs,
				jobId,
				producerItemInstanceId: action.producerItemInstanceId,
				productId: action.productId,
				startedAtMs: nowMs,
				type: "product.started" as const,
			},
		],
		nextWakeAtMs: readNextWakeAtMs(nextSave),
		save: nextSave,
	} satisfies GameEngineResult;
});

const readProducerBoardItemFx = Effect.fn("readProducerBoardItemFx")(function* ({
	config,
	save,
	producerItemInstanceId,
}: {
	config: GameConfig;
	save: GameSave;
	producerItemInstanceId: string;
}) {
	const boardItem = save.board.items[producerItemInstanceId];
	if (!boardItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing board item instance "${producerItemInstanceId}".`,
			),
		);
	}
	const item = config.items[boardItem.itemId];
	if (!item?.producerId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Board item "${producerItemInstanceId}" is not a producer.`,
			),
		);
	}
	return boardItem;
});

type Requirements = GameConfig["producers"][string]["requirements"];

const checkRequirementsFx = Effect.fn("checkRequirementsFx")(function* ({
	config,
	save,
	requirements,
}: {
	config: GameConfig;
	save: GameSave;
	requirements: Requirements;
}) {
	for (const requirement of requirements) {
		yield* match(requirement)
			.with(
				{
					type: "passive",
				},
				(passiveRequirement) => {
					const availableQuantity = countPassiveItemQuantity({
						itemId: passiveRequirement.itemId,
						save,
						scope: passiveRequirement.scope,
					});
					if (availableQuantity < passiveRequirement.quantity) {
						return Effect.fail(
							GameEngineError.actionRejected(
								"missing_requirement",
								`Missing passive requirement "${passiveRequirement.itemId}" (${availableQuantity}/${passiveRequirement.quantity}).`,
							),
						);
					}
					return Effect.void;
				},
			)
			.with(
				{
					type: "stored",
				},
				(storedRequirement) =>
					Effect.fail(
						GameEngineError.actionRejected(
							"unsupported_requirement",
							`Stored requirement "${storedRequirement.itemId}" needs save storage before the new engine can evaluate it.`,
						),
					),
			)
			.exhaustive();
	}

	// Keep config in scope for future requirement variants and to make callsites explicit.
	void config;
});

const consumeProductInputsFx = Effect.fn("consumeProductInputsFx")(function* ({
	config,
	save,
	inputs,
	inputRefs,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	inputs: GameConfig["products"][string]["inputs"];
	inputRefs: ProducerProductStartAction["inputRefs"];
	nowMs: number;
}) {
	const requiredByItemId = mergeInputRequirements(inputs);
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save,
	});
	const selectedByItemId = sumResolvedInputRefs(resolvedRefs);

	for (const [itemId, selectedQuantity] of selectedByItemId) {
		if (!requiredByItemId.has(itemId)) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" is not required by this product.`,
				),
			);
		}
		const required = requiredByItemId.get(itemId);
		if (required && selectedQuantity !== required.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${required.quantity}).`,
				),
			);
		}
	}

	for (const [itemId, required] of requiredByItemId) {
		const selectedQuantity = selectedByItemId.get(itemId) ?? 0;
		if (selectedQuantity !== required.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${required.quantity}).`,
				),
			);
		}
	}

	const nextSave = cloneGameSave(save);
	const events: GameEvent[] = [];
	const consumedItemIds = new Set(
		[
			...requiredByItemId,
		]
			.filter(([, requirement]) => requirement.consume)
			.map(([itemId]) => itemId),
	);

	for (const ref of resolvedRefs) {
		if (!consumedItemIds.has(ref.itemId)) {
			continue;
		}

		yield* consumeResolvedRefFx({
			events,
			nextSave,
			ref,
		});
	}

	nextSave.updatedAtMs = nowMs;
	void config;

	return {
		events,
		save: nextSave,
	};
});

type InputRequirement = {
	quantity: number;
	consume: boolean;
};

const mergeInputRequirements = (inputs: GameConfig["products"][string]["inputs"]) => {
	const map = new Map<string, InputRequirement>();
	for (const input of inputs) {
		const previous = map.get(input.itemId);
		map.set(input.itemId, {
			consume: (previous?.consume ?? false) || input.consume,
			quantity: (previous?.quantity ?? 0) + input.quantity,
		});
	}
	return map;
};

type ResolvedInputRef =
	| {
			kind: "board";
			itemId: string;
			itemInstanceId: string;
			quantity: 1;
	  }
	| {
			kind: "inventory";
			itemId: string;
			slotIndex: number;
			quantity: number;
	  };

const resolveInputRefsFx = Effect.fn("resolveInputRefsFx")(function* ({
	save,
	inputRefs,
}: {
	save: GameSave;
	inputRefs: ProducerProductStartAction["inputRefs"];
}) {
	const resolved: ResolvedInputRef[] = [];
	const seen = new Set<string>();

	for (const ref of inputRefs) {
		yield* match(ref)
			.with(
				{
					kind: "board",
				},
				(boardRef) => {
					const key = `board:${boardRef.itemInstanceId}`;
					if (seen.has(key)) {
						return Effect.fail(
							GameEngineError.actionRejected(
								"input_mismatch",
								`Duplicate input ref "${key}".`,
							),
						);
					}
					const item = save.board.items[boardRef.itemInstanceId];
					if (!item) {
						return Effect.fail(
							GameEngineError.actionRejected(
								"input_unavailable",
								`Missing board input "${boardRef.itemInstanceId}".`,
							),
						);
					}
					seen.add(key);
					resolved.push({
						kind: "board",
						itemId: item.itemId,
						itemInstanceId: item.id,
						quantity: 1,
					});
					return Effect.void;
				},
			)
			.with(
				{
					kind: "inventory",
				},
				(inventoryRef) => {
					const key = `inventory:${inventoryRef.slotIndex}`;
					if (seen.has(key)) {
						return Effect.fail(
							GameEngineError.actionRejected(
								"input_mismatch",
								`Duplicate input ref "${key}".`,
							),
						);
					}
					const slot = save.inventory.slots[inventoryRef.slotIndex];
					if (!slot || slot.quantity < inventoryRef.quantity) {
						return Effect.fail(
							GameEngineError.actionRejected(
								"input_unavailable",
								`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
							),
						);
					}
					seen.add(key);
					resolved.push({
						kind: "inventory",
						itemId: slot.itemId,
						quantity: inventoryRef.quantity,
						slotIndex: inventoryRef.slotIndex,
					});
					return Effect.void;
				},
			)
			.exhaustive();
	}

	return resolved;
});

const sumResolvedInputRefs = (refs: ResolvedInputRef[]) => {
	const map = new Map<string, number>();
	for (const ref of refs) {
		map.set(ref.itemId, (map.get(ref.itemId) ?? 0) + ref.quantity);
	}
	return map;
};

const consumeResolvedRefFx = Effect.fn("consumeResolvedRefFx")(function* ({
	nextSave,
	ref,
	events,
}: {
	nextSave: GameSave;
	ref: ResolvedInputRef;
	events: GameEvent[];
}) {
	yield* match(ref)
		.with(
			{
				kind: "board",
			},
			(boardRef) => {
				delete nextSave.board.items[boardRef.itemInstanceId];
				events.push({
					from: {
						kind: "board",
						itemInstanceId: boardRef.itemInstanceId,
					},
					itemId: boardRef.itemId,
					reason: "product-input",
					type: "item.consumed",
				});
				return Effect.void;
			},
		)
		.with(
			{
				kind: "inventory",
			},
			(inventoryRef) => {
				const slot = nextSave.inventory.slots[inventoryRef.slotIndex];
				if (!slot) {
					return Effect.fail(
						GameEngineError.actionRejected(
							"input_unavailable",
							`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
						),
					);
				}
				const previousQuantity = slot.quantity;
				const nextQuantity = previousQuantity - inventoryRef.quantity;
				if (nextQuantity < 0) {
					return Effect.fail(
						GameEngineError.actionRejected(
							"input_unavailable",
							`Inventory input at slot ${inventoryRef.slotIndex} is already spent.`,
						),
					);
				}
				nextSave.inventory.slots[inventoryRef.slotIndex] =
					nextQuantity === 0
						? null
						: ({
								itemId: slot.itemId,
								quantity: nextQuantity,
							} satisfies GameSaveInventoryStack);
				events.push({
					from: {
						kind: "inventory",
						nextQuantity,
						previousQuantity,
						quantity: inventoryRef.quantity,
						slotIndex: inventoryRef.slotIndex,
					},
					itemId: inventoryRef.itemId,
					reason: "product-input",
					type: "item.consumed",
				});
				return Effect.void;
			},
		)
		.exhaustive();
});

const countPassiveItemQuantity = ({
	save,
	itemId,
	scope,
}: {
	save: GameSave;
	itemId: string;
	scope: "board" | "inventory" | "board_or_inventory";
}) => {
	let quantity = 0;
	if (scope === "board" || scope === "board_or_inventory") {
		quantity += Object.values(save.board.items).filter((item) => item.itemId === itemId).length;
	}
	if (scope === "inventory" || scope === "board_or_inventory") {
		quantity += save.inventory.slots.reduce((total, slot) => {
			if (!slot || slot.itemId !== itemId) {
				return total;
			}
			return total + slot.quantity;
		}, 0);
	}
	return quantity;
};

const cloneGameSave = (save: GameSave): GameSave => structuredClone(save) as GameSave;

const createGameJobId = (save: GameSave) => {
	const id = `job:${save.nextJobIndex}`;
	save.nextJobIndex += 1;
	return id;
};

const readNextWakeAtMs = (save: GameSave): number | null => {
	const wakeTimes = [
		...Object.values(save.scheduledEvents).map((event) => event.dueAtMs),
		...Object.values(save.producerJobs).map((job) => job.completesAtMs),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	];

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
};
