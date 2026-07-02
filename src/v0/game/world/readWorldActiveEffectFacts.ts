import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readGameConfigEffect } from "~/v0/game/config/readGameConfigEffects";
import { readLineDefinition } from "~/v0/game/config/readLineDefinition";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { isGameTimeWindowActive } from "~/v0/game/time/GameTime";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { WorldActiveEffectFacts } from "~/v0/game/world/WorldActiveEffectFacts";

export namespace readWorldActiveEffectFacts {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

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
	effect: GameSave["activeEffects"][string];
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
	effect: GameSave["activeEffects"][string];
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

const readActiveEffectDefinition = ({
	config,
	effect,
	save,
}: {
	config: GameConfig;
	effect: GameSave["activeEffects"][string];
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

	if (line?.effect?.id === effect.effectId) return line.effect;

	return readGameConfigEffect({
		config,
		effectId: effect.effectId,
	});
};

export const readWorldActiveEffectFacts = ({
	config,
	nowMs,
	save,
}: readWorldActiveEffectFacts.Props): WorldActiveEffectFacts[] => {
	const producerFactsByJobId = new Map(
		readWorldProducerJobFacts({
			nowMs,
			save,
		}).map((facts) => [
			facts.job.id,
			facts,
		]),
	);

	return Object.values(save.activeEffects ?? {})
		.map((effect): WorldActiveEffectFacts => {
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

			const producerFacts = effect.producerJobId
				? producerFactsByJobId.get(effect.producerJobId)
				: undefined;
			if (producerFacts?.status === "paused") {
				return {
					definition,
					effect,
					producerJobId: effect.producerJobId,
					sourceLocation,
					status: "producer_paused",
				};
			}
			if (producerFacts?.status === "blocked_by_paused_queue_head") {
				return {
					definition,
					effect,
					producerJobId: effect.producerJobId,
					sourceLocation,
					status: "blocked_by_paused_queue_head",
				};
			}

			return {
				definition,
				effect,
				producerJobId: effect.producerJobId,
				sourceLocation,
				status: readTimeStatus({
					effect,
					nowMs,
				}),
			};
		})
		.sort((left, right) => left.effect.id.localeCompare(right.effect.id));
};
