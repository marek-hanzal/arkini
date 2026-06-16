import type { QueryClient } from "@tanstack/react-query";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import { databaseQueryKeys } from "~/v0/database/query/databaseQueryKeys";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";
import type { Sheet } from "~/v0/play/sheet/Sheet";
import { DebugTimeline, createDebugJsonReplacer } from "~/v0/debug/DebugTimeline";
import { readLastLoadedDevScenario } from "~/v0/debug/scenario/DevScenarioRuntime";

export namespace DebugBugReport {
	export interface SnapshotContext {
		activeSheet?: Sheet;
		lastError?: string;
	}

	export interface SnapshotGetterProps {
		queryClient: QueryClient;
	}

	export interface RegisterProps {
		queryClient: QueryClient;
		getContext(): SnapshotContext;
	}

	export interface Api {
		dump(): string;
		copy(): Promise<string>;
		clear(): void;
		entries(): ReturnType<typeof DebugTimeline.entries>;
		report(): Record<string, unknown>;
	}
}

let queryClientRef: QueryClient | undefined;
let getContextRef: (() => DebugBugReport.SnapshotContext) | undefined;

const copyText = async (text: string) => {
	await navigator.clipboard.writeText(text);
	return text;
};

const readScreen = () => ({
	width: window.innerWidth,
	height: window.innerHeight,
	devicePixelRatio: window.devicePixelRatio,
	orientation: screen.orientation?.type,
});

const readBrowser = () => ({
	userAgent: navigator.userAgent,
	platform: navigator.platform,
	language: navigator.language,
	languages: navigator.languages,
	onLine: navigator.onLine,
	crossOriginIsolated: window.crossOriginIsolated,
});

const readLocation = () => ({
	href: window.location.href,
	pathname: window.location.pathname,
	search: window.location.search,
	hash: window.location.hash,
});

const readQueryState = (queryClient: QueryClient | undefined) => {
	if (!queryClient) {
		return {
			available: false,
		};
	}

	return {
		available: true,
		board: queryClient.getQueryData(boardQueryKeys.view),
		inventory: queryClient.getQueryData(inventoryQueryKeys.view),
		database: queryClient.getQueryData(databaseQueryKeys.status),
		queries: queryClient
			.getQueryCache()
			.getAll()
			.map((query) => ({
				queryHash: query.queryHash,
				queryKey: query.queryKey,
				state: {
					dataUpdatedAt: query.state.dataUpdatedAt,
					fetchStatus: query.state.fetchStatus,
					status: query.state.status,
					isInvalidated: query.state.isInvalidated,
					error: query.state.error
						? query.state.error instanceof Error
							? {
									name: query.state.error.name,
									message: query.state.error.message,
									stack: query.state.error.stack,
								}
							: query.state.error
						: null,
				},
			})),
	};
};

const createReport = () => ({
	schema: "arkini.debug-report.v2",
	createdAtIso: new Date().toISOString(),
	createdAtMs: Date.now(),
	performanceNowMs: Math.round(performance.now() * 100) / 100,
	app: {
		mode: import.meta.env.MODE,
		dev: import.meta.env.DEV,
		prod: import.meta.env.PROD,
		baseUrl: import.meta.env.BASE_URL,
	},
	context: {
		...getContextRef?.(),
		lastLoadedScenario: readLastLoadedDevScenario(),
	},
	browser: readBrowser(),
	screen: readScreen(),
	location: readLocation(),
	query: readQueryState(queryClientRef),
	timeline: DebugTimeline.entries(),
});

export const DebugBugReport: DebugBugReport.Api = {
	report() {
		return createReport();
	},
	dump() {
		return JSON.stringify(createReport(), createDebugJsonReplacer(), "\t");
	},
	async copy() {
		return copyText(DebugBugReport.dump());
	},
	clear() {
		DebugTimeline.clear();
	},
	entries() {
		return DebugTimeline.entries();
	},
};

export const registerDebugBugReport = ({
	getContext,
	queryClient,
}: DebugBugReport.RegisterProps) => {
	queryClientRef = queryClient;
	getContextRef = getContext;

	if (typeof window !== "undefined" && import.meta.env.DEV) {
		Object.assign(window, {
			__ARKINI_BUG_REPORT__: DebugBugReport,
		});
	}
};
