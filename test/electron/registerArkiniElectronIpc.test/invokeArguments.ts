import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

const placeholderPackageId = "a".repeat(64);
export const saveKey = {
	packageId: "arkini",
} as const;

export const invokeArguments = new Map<string, ReadonlyArray<unknown>>([
	[
		ArkiniElectronApi.channels.appearanceRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceWrite,
		[
			"dark",
		],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentWrite,
		[
			"rose",
		],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityRead,
		[],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityWrite,
		[
			false,
		],
	],
	[
		ArkiniElectronApi.channels.soundRead,
		[],
	],
	[
		ArkiniElectronApi.channels.soundWrite,
		[
			"master",
			75,
		],
	],
	[
		ArkiniElectronApi.channels.clipboardWriteText,
		[
			"https://example.com/editor/mcp",
		],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdRead,
		[],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdWrite,
		[
			"arkini",
		],
	],
	[
		ArkiniElectronApi.channels.localizationPreferredLanguagesRead,
		[],
	],
	[
		ArkiniElectronApi.channels.windowModeRead,
		[],
	],
	[
		ArkiniElectronApi.channels.windowModeWrite,
		[
			"fullscreen",
		],
	],
	[
		ArkiniElectronApi.channels.arkpackList,
		[],
	],
	[
		ArkiniElectronApi.channels.arkpackRead,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.arkpackImport,
		[],
	],
	[
		ArkiniElectronApi.channels.arkpackInstallEditorBuild,
		[
			{
				packageId: placeholderPackageId,
				expectedRevision: 1,
				contentHash: "a".repeat(64),
			},
		],
	],
	[
		ArkiniElectronApi.channels.arkpackRemove,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.arkpackOpenUserDirectory,
		[],
	],
	[
		ArkiniElectronApi.channels.saveRead,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.saveWrite,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		ArkiniElectronApi.channels.saveClear,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsWrite,
		[
			{
				level: "info",
				category: [
					"test",
				],
				event: "ipc-tested",
			},
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsWriteApplication,
		[
			{
				level: "info",
				message: "IPC tested",
				body: "The trusted renderer reached the application log.",
			},
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsOpenDirectory,
		[],
	],
	[
		ArkiniElectronApi.channels.incidentWrite,
		[
			{
				arkpack: {
					packageId: "game:test",
					contentHash: "0".repeat(64),
					source: "user",
				},
				saveBytes: new Uint8Array(),
				text: {
					incident: "# Incident",
					failure: "# Failure",
					history: "# History",
					runtimeState: "# Runtime state",
				},
			},
		],
	],
	[
		ArkiniElectronApi.channels.userDataOpenDirectory,
		[],
	],
]);
