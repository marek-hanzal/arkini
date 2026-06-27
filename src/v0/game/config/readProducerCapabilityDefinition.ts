import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProducerCapabilityDefinition = ({
	config,
	producerId,
}: {
	config: GameConfig;
	producerId: string;
}) => config.producers[producerId] ?? config.stashes[producerId];
