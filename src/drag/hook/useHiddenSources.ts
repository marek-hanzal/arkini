import { useCallback, useMemo, useState } from "react";
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

	const hideSources = useCallback((ids: readonly string[]) => {
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
	}, []);

	const showSource = useCallback((id: string) => {
		setHiddenSourceIds((current) => (current.has(id) ? without(current, id) : current));
	}, []);

	const clearHiddenSources = useCallback(() => {
		setHiddenSourceIds((current) => (current.size ? new Set() : current));
	}, []);

	return useMemo(
		() => ({
			hiddenSourceIds,
			hideSources,
			showSource,
			clearHiddenSources,
		}),
		[
			clearHiddenSources,
			hiddenSourceIds,
			hideSources,
			showSource,
		],
	);
};
