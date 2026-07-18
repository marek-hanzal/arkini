export namespace ActionLoadingControl {
	export interface RunOptions {
		readonly action: () => Promise<void>;
		readonly completedHoldMs?: number;
		readonly key: string;
		readonly label: string;
		readonly minimumDurationMs?: number;
	}

	export interface Type {
		readonly active: boolean;
		readonly run: (options: RunOptions) => Promise<void>;
		readonly runNativeClose: (options: RunOptions) => Promise<void>;
	}
}
