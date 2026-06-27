export namespace DebugTimeline {
	export interface Entry {
		id: number;
		atMs: number;
		scope: string;
		event: string;
		detail?: unknown;
	}

	export interface Api {
		record(props: { scope: string; event: string; detail?: unknown }): void;
		entries(): readonly Entry[];
		dump(): string;
		clear(): void;
	}
}

const maxEntries = 500;
let nextId = 1;
const entries: DebugTimeline.Entry[] = [];

const shouldRecord = () => Boolean(import.meta.env.DEV);

export const createDebugJsonReplacer = () => {
	const seen = new WeakSet<object>();
	return (_key: string, value: unknown) => {
		if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
		if (!value || typeof value !== "object") return value;
		if (value instanceof Element) {
			return {
				tag: value.tagName.toLowerCase(),
				id: value.id || undefined,
				className: value.className || undefined,
			};
		}
		if (seen.has(value)) return "[Circular]";
		seen.add(value);
		return value;
	};
};

export const DebugTimeline: DebugTimeline.Api = {
	record({ detail, event, scope }) {
		if (!shouldRecord()) return;

		entries.push({
			id: nextId++,
			atMs: Math.round(performance.now() * 100) / 100,
			scope,
			event,
			detail,
		});
		if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
	},
	entries() {
		return [
			...entries,
		];
	},
	dump() {
		return JSON.stringify(entries, createDebugJsonReplacer(), "\t");
	},
	clear() {
		entries.length = 0;
	},
};

if (typeof window !== "undefined" && import.meta.env.DEV) {
	Object.assign(window, {
		__ARKINI_DEBUG_TIMELINE__: DebugTimeline,
	});
}
