import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
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
	sourceScope: GameConfig["effects"][string]["sourceScope"];
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

			const effectDefinition = config.effects[effect.effectId];
			if (
				!effectDefinition ||
				!sourceScopeIncludes({
					location: sourceLocation,
					sourceScope: effectDefinition.sourceScope,
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
					effect,
					producerJobId: effect.producerJobId,
					sourceLocation,
					status: "producer_paused",
				};
			}
			if (producerFacts?.status === "blocked_by_paused_queue_head") {
				return {
					effect,
					producerJobId: effect.producerJobId,
					sourceLocation,
					status: "blocked_by_paused_queue_head",
				};
			}

			return {
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
