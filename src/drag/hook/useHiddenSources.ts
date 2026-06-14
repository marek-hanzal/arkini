import { useState } from "react";
import { without } from "~/shared/util/without";

export namespace useHiddenSources {
	export interface Result {
		hiddenSourceIds: Set<string>;
		hideSources(ids: readonly string[]): void;
		showSource(id: string): void;
		clearHiddenSources(): void;
	}
}

export const useHiddenSources = (): useHiddenSources.Result => {
	const [hiddenSourceIds, setHiddenSourceIds] = useState(() => new Set<string>());

	const hideSources = (ids: readonly string[]) => {
		if (!ids.length) return;

		setHiddenSourceIds((current) => {
			const next = new Set(current);
			let changed = false;

			for (const id of ids) {
				if (next.has(id)) continue;
				next.add(id);
				changed = true;
			}

			return changed ? next : current;
		});
	};

	const showSource = (id: string) => {
		setHiddenSourceIds((current) => (current.has(id) ? without(current, id) : current));
	};

	const clearHiddenSources = () => {
		setHiddenSourceIds((current) => (current.size ? new Set() : current));
	};

	return {
		hiddenSourceIds,
		hideSources,
		showSource,
		clearHiddenSources,
	};
};
