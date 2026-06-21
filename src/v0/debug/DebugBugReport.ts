import type { Sheet } from "~/v0/play/sheet/Sheet";
import { DebugTimeline, createDebugJsonReplacer } from "~/v0/debug/DebugTimeline";
import { readLastLoadedDevScenario } from "~/v0/debug/scenario/DevScenarioRuntime";

export namespace DebugBugReport {
	export interface SnapshotContext {
		activeSheet?: Sheet;
		lastError?: string;
		runtime?: {
			boardItems: number;
			inventoryStacks: number;
			nextWakeAtMs: number | null;
			revision: number;
		};
	}

	export interface RegisterProps {
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

const readDataset = (element: HTMLElement) => Object.fromEntries(Object.entries(element.dataset));

const readComputedMotion = (element: HTMLElement, pseudoElement?: string) => {
	const style = window.getComputedStyle(element, pseudoElement);

	return {
		zIndex: style.zIndex,
		transform: style.transform,
		transitionProperty: style.transitionProperty,
		transitionDuration: style.transitionDuration,
		transitionTimingFunction: style.transitionTimingFunction,
		animationName: style.animationName,
		animationDuration: style.animationDuration,
		opacity: style.opacity,
		backgroundColor: style.backgroundColor,
		boxShadow: style.boxShadow,
	};
};

const readElementMotionSnapshot = (element: HTMLElement) => ({
	tag: element.tagName.toLowerCase(),
	dataset: readDataset(element),
	className: element.className,
	inlineStyle: {
		transform: element.style.transform,
		zIndex: element.style.zIndex,
	},
	computed: readComputedMotion(element),
});

const readTileEngineDom = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-ak-tile-engine-id]")).map((engine) => {
		return {
			id: engine.dataset.akTileEngineId,
			layerRole: engine.dataset.akTileEngineLayerRole,
			className: engine.className,
			actors: Array.from(
				engine.querySelectorAll<HTMLElement>("[data-ak-tile-engine-tile-id]"),
			).map((actor) => {
				const visual = actor.querySelector<HTMLElement>("[data-ak-tile-engine-visual]");
				const rendered = visual?.firstElementChild as HTMLElement | null | undefined;

				return {
					tileId: actor.dataset.akTileEngineTileId,
					slotId: actor.dataset.akTileEngineSlotId,
					dataset: readDataset(actor),
					className: actor.className,
					inlineStyle: {
						transform: actor.style.transform,
						zIndex: actor.style.zIndex,
					},
					computed: readComputedMotion(actor),
					visual: visual ? readElementMotionSnapshot(visual) : null,
					child: rendered ? readElementMotionSnapshot(rendered) : null,
				};
			}),
			slots: Array.from(
				engine.querySelectorAll<HTMLElement>("[data-ak-tile-engine-slot-id]"),
			).map((slot) => ({
				slotId: slot.dataset.akTileEngineSlotId,
				dropId: slot.dataset.akTileEngineDropId,
				dataset: readDataset(slot),
				className: slot.className,
				computed: readComputedMotion(slot),
			})),
		};
	});

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
	tileEngineDom: readTileEngineDom(),
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

export const registerDebugBugReport = ({ getContext }: DebugBugReport.RegisterProps) => {
	getContextRef = getContext;

	if (typeof window !== "undefined" && import.meta.env.DEV) {
		Object.assign(window, {
			__ARKINI_BUG_REPORT__: DebugBugReport,
		});
	}
};
