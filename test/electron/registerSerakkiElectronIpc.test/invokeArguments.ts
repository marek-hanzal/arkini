import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";

const placeholderPackageId = "a".repeat(64);
export const saveKey = {
	packageId: "serakki",
} as const;

export const invokeArguments = new Map<string, ReadonlyArray<unknown>>([
	[
		SerakkiElectronApi.channels.saveList,
		[
			saveKey,
		],
	],
	[
		SerakkiElectronApi.channels.saveRestore,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		SerakkiElectronApi.channels.appearanceRead,
		[],
	],
	[
		SerakkiElectronApi.channels.appearanceWrite,
		[
			"dark",
		],
	],
	[
		SerakkiElectronApi.channels.appearanceAccentRead,
		[],
	],
	[
		SerakkiElectronApi.channels.appearanceAccentWrite,
		[
			"rose",
		],
	],
	[
		SerakkiElectronApi.channels.cheatAvailabilityRead,
		[],
	],
	[
		SerakkiElectronApi.channels.cheatAvailabilityWrite,
		[
			false,
		],
	],
	[
		SerakkiElectronApi.channels.soundRead,
		[],
	],
	[
		SerakkiElectronApi.channels.soundWrite,
		[
			"master",
			75,
		],
	],
	[
		SerakkiElectronApi.channels.clipboardWriteText,
		[
			"https://example.com/editor/mcp",
		],
	],
	[
		SerakkiElectronApi.channels.launcherLastPackageIdRead,
		[],
	],
	[
		SerakkiElectronApi.channels.launcherLastPackageIdWrite,
		[
			"serakki",
		],
	],
	[
		SerakkiElectronApi.channels.localizationPreferredLanguagesRead,
		[],
	],
	[
		SerakkiElectronApi.channels.windowModeRead,
		[],
	],
	[
		SerakkiElectronApi.channels.windowModeWrite,
		[
			"fullscreen",
		],
	],
	[
		SerakkiElectronApi.channels.serapackList,
		[],
	],
	[
		SerakkiElectronApi.channels.serapackRead,
		[
			placeholderPackageId,
		],
	],
	[
		SerakkiElectronApi.channels.serapackImport,
		[],
	],
	[
		SerakkiElectronApi.channels.serapackInstallEditorBuild,
		[
			{
				packageId: placeholderPackageId,
				expectedRevision: 1,
				contentHash: "a".repeat(64),
			},
		],
	],
	[
		SerakkiElectronApi.channels.serapackRemove,
		[
			placeholderPackageId,
		],
	],
	[
		SerakkiElectronApi.channels.serapackOpenUserDirectory,
		[],
	],
	[
		SerakkiElectronApi.channels.saveRead,
		[
			saveKey,
		],
	],
	[
		SerakkiElectronApi.channels.saveWrite,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		SerakkiElectronApi.channels.saveClear,
		[
			saveKey,
		],
	],
	[
		SerakkiElectronApi.channels.diagnosticsWrite,
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
		SerakkiElectronApi.channels.diagnosticsWriteApplication,
		[
			{
				level: "info",
				message: "IPC tested",
				body: "The trusted renderer reached the application log.",
			},
		],
	],
	[
		SerakkiElectronApi.channels.diagnosticsOpenDirectory,
		[],
	],
	[
		SerakkiElectronApi.channels.diagnosticsExport,
		[],
	],
	[
		SerakkiElectronApi.channels.incidentWrite,
		[
			{
				serapack: {
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
		SerakkiElectronApi.channels.userDataHardReset,
		[],
	],
	[
		SerakkiElectronApi.channels.userDataOpenDirectory,
		[],
	],
]);
