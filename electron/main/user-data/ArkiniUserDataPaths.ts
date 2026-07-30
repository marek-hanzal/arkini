/** Canonical filesystem roots owned by one Arkini desktop installation. */
export interface ArkiniUserDataPaths {
	readonly root: string;
	readonly game: {
		readonly root: string;
		readonly arkpacks: string;
		readonly logs: string;
		readonly preferences: string;
		readonly saves: string;
	};
	readonly editor: string;
	readonly legacy: {
		readonly arkpacks: string;
		readonly logs: string;
		readonly preferences: string;
		readonly saves: string;
	};
}
