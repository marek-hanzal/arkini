import { useArkiniDatabaseStatus } from "~/play/hook/useArkiniDatabaseStatus";

export namespace useDbStatusCard {
	export interface Props {}
}

export const useDbStatusCard = (_props?: useDbStatusCard.Props) => {
	const status = useArkiniDatabaseStatus();
	const isolated = typeof window !== "undefined" && window.crossOriginIsolated === true;

	return {
		isolated,
		databasePath: status.databasePath,
		gameConfigHash: status.gameConfigHash.slice(0, 10),
		itemCount: String(status.itemCount),
		producerCount: String(status.producerCount),
	};
};
