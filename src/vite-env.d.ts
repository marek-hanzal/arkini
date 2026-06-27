/// <reference types="vite/client" />

import type { DebugBugReport } from "~/v0/debug/DebugBugReport";
import type { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import type { DevScenarioDefinition } from "~/v0/debug/scenario/DevScenarioDefinition";

declare global {
	interface FileSystemDirectoryHandle {
		remove(options: { recursive: boolean }): Promise<void>;
	}

	interface Window {
		__ARKINI_DEBUG_TIMELINE__?: DebugTimeline.Api;
		__ARKINI_BUG_REPORT__?: DebugBugReport.Api;
		__ARKINI_SCENARIO__?: {
			list(): readonly DevScenarioDefinition[];
			load(scenarioId: string): Promise<unknown>;
		};
	}
}
