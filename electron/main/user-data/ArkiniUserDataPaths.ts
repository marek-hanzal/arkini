/** Canonical filesystem roots owned by one Arkini desktop installation. */
export interface ArkiniUserDataPaths {
	readonly root: string;
	readonly diagnostics: string;
	readonly game: {
		readonly root: string;
		readonly arkpacks: string;
		readonly incidents: string;
		readonly preferences: string;
		readonly saves: string;
	};
	readonly editor: {
		readonly root: string;
		readonly catalog: string;
		readonly projects: string;
	};
}
