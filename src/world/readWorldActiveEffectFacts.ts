import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineDefinition } from "~/config/GameItemCapabilities";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import { readGameConfigEffect } from "~/config/readGameConfigEffects";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { isGameTimeWindowActive } from "~/time/GameTime";
import type { WorldActiveEffectFacts } from "~/world/WorldActiveEffectFacts";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";

export namespace readWorldActiveEffectFacts {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

type ActiveEffectRouteScope = readWorldActiveEffectFacts.Props & {
	producerFactsByJobId: ReadonlyMap<string, ReturnType<typeof readWorldProducerJobFacts>[number]>;
};

type ActiveEffect = GameSave["activeEffects"][string];

const sourceScopeIncludes = ({
	location,
	sourceScope,
}: {
	location: NonNullable<WorldActiveEffectFacts["sourceLocation"]>;
	sourceScope: NonNullable<WorldActiveEffectFacts["definition"]>["sourceScope"];
}) => (sourceScope ?? "board") === "both" || (sourceScope ?? "board") === location;

const readActiveEffectSourceLocation = ({
	effect,
	save,
}: {
	effect: ActiveEffect;
	save: GameSave;
}): WorldActiveEffectFacts["sourceLocation"] | undefined => {
	if (save.board.items[effect.sourceItemInstanceId]) return "board";
	return save.inventory.slots.some(
		(slot) =>
			slot !== null &&
			"kind" in slot &&
			slot.kind === "instance" &&
			slot.id === effect.sourceItemInstanceId,
	)
		? "inventory"
		: undefined;
};

const readTimeStatus = ({
	effect,
	nowMs,
}: {
	effect: ActiveEffect;
	nowMs?: number;
}): "active" | "expired" | "scheduled" => {
	if (nowMs === undefined) return "active";
	if (effect.endAtMs <= nowMs) return "expired";
	if (
		!isGameTimeWindowActive({
			endAtMs: effect.endAtMs,
			nowMs,
			startAtMs: effect.startAtMs,
		})
	) {
		return "scheduled";
	}
	return "active";
};

const readProducerLineEffectDefinition = ({
	config,
	effect,
	save,
}: {
	config: GameConfig;
	effect: ActiveEffect;
	save: GameSave;
}) => {
	const job = effect.producerJobId ? save.producerJobs[effect.producerJobId] : undefined;
	const sourceItem = job ? save.board.items[job.itemInstanceId] : undefined;
	const producer = sourceItem
		? readProducerCapabilityDefinition({
				config,
				producerId: sourceItem.itemId,
			})
		: undefined;
	const line = producer
		? readLineDefinition({
				lineId: job?.lineId ?? "",
				producerDefinition: producer,
			})
		: undefined;

	return line?.effect?.id === effect.effectId ? line.effect : undefined;
};

const readActiveEffectDefinition = ({
	config,
	effect,
	save,
}: {
	config: GameConfig;
	effect: ActiveEffect;
	save: GameSave;
}) =>
	readProducerLineEffectDefinition({
		config,
		effect,
		save,
	}) ??
	readGameConfigEffect({
		config,
		effectId: effect.effectId,
	});

const readProducerBoundEffectStatus = ({
	effect,
	producerFactsByJobId,
}: {
	effect: ActiveEffect;
	producerFactsByJobId: ActiveEffectRouteScope["producerFactsByJobId"];
}):
	| Extract<WorldActiveEffectFacts["status"], "blocked_by_paused_queue_head" | "producer_paused">
	| undefined => {
	const producerFacts = effect.producerJobId
		? producerFactsByJobId.get(effect.producerJobId)
		: undefined;
	if (producerFacts?.status === "paused") return "producer_paused";
	if (producerFacts?.status === "blocked_by_paused_queue_head") {
		return "blocked_by_paused_queue_head";
	}
	return undefined;
};

const readActiveEffectFactsForEffect = ({
	config,
	effect,
	nowMs,
	producerFactsByJobId,
	save,
}: ActiveEffectRouteScope & {
	effect: ActiveEffect;
}): WorldActiveEffectFacts => {
	const sourceLocation = readActiveEffectSourceLocation({
		effect,
		save,
	});
	if (!sourceLocation) {
		return {
			effect,
			producerJobId: effect.producerJobId,
			status: "inactive_source_missing",
		};
	}

	const definition = readActiveEffectDefinition({
		config,
		effect,
		save,
	});
	if (
		!definition ||
		!sourceScopeIncludes({
			location: sourceLocation,
			sourceScope: definition.sourceScope,
		})
	) {
		return {
			effect,
			producerJobId: effect.producerJobId,
			sourceLocation,
			status: "out_of_scope",
		};
	}

	const producerBoundStatus = readProducerBoundEffectStatus({
		effect,
		producerFactsByJobId,
	});
	return {
		definition,
		effect,
		producerJobId: effect.producerJobId,
		sourceLocation,
		status:
			producerBoundStatus ??
			readTimeStatus({
				effect,
				nowMs,
			}),
	};
};

const createActiveEffectRouteScope = ({
	config,
	nowMs,
	save,
}: readWorldActiveEffectFacts.Props): ActiveEffectRouteScope => ({
	config,
	nowMs,
	producerFactsByJobId: new Map(
		readWorldProducerJobFacts({
			nowMs,
			save,
		}).map((facts) => [
			facts.job.id,
			facts,
		]),
	),
	save,
});

export const readWorldActiveEffectFacts = (
	props: readWorldActiveEffectFacts.Props,
): WorldActiveEffectFacts[] => {
	const scope = createActiveEffectRouteScope(props);
	return Object.values(props.save.activeEffects ?? {})
		.map((effect) =>
			readActiveEffectFactsForEffect({
				...scope,
				effect,
			}),
		)
		.sort((left, right) => left.effect.id.localeCompare(right.effect.id));
};
