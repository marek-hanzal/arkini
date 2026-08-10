import { useContext, useLayoutEffect, useMemo, useState } from "react";

import { EditorResourceUrlContext } from "~/ui/resource/editor/EditorResourceUrlContext";

const emptyResourceUrls: ReadonlyMap<string, string> = new Map();

/** Resolves one lazily acquired project-scoped resource URL. */
export const useEditorResourceUrl = (resourceId: string | undefined) => {
	const store = useContext(EditorResourceUrlContext);
	const [url, setUrl] = useState<string>();
	useLayoutEffect(() => {
		if (store === undefined || resourceId === undefined) {
			setUrl(undefined);
			return;
		}
		const update = () => setUrl(store.read(resourceId));
		const release = store.subscribe(resourceId, update);
		update();
		return release;
	}, [
		resourceId,
		store,
	]);
	return url;
};

/** Resolves only the project-scoped resource URLs requested by one mounted consumer. */
export const useEditorResourceUrls = (resourceIds: ReadonlyArray<string>) => {
	const store = useContext(EditorResourceUrlContext);
	const requestedIds = useMemo(
		() => [
			...new Set(resourceIds),
		],
		[
			resourceIds,
		],
	);
	const [snapshot, setSnapshot] = useState<{
		readonly ids: ReadonlyArray<string>;
		readonly urls: ReadonlyMap<string, string>;
	}>({
		ids: requestedIds,
		urls: emptyResourceUrls,
	});
	useLayoutEffect(() => {
		if (store === undefined || requestedIds.length === 0) {
			setSnapshot({
				ids: requestedIds,
				urls: emptyResourceUrls,
			});
			return;
		}
		let active = true;
		const update = () => {
			if (!active) return;
			const urls = new Map<string, string>();
			for (const resourceId of requestedIds) {
				const url = store.read(resourceId);
				if (url !== undefined) urls.set(resourceId, url);
			}
			setSnapshot({
				ids: requestedIds,
				urls,
			});
		};
		const releases = requestedIds.map((resourceId) => store.subscribe(resourceId, update));
		update();
		return () => {
			active = false;
			for (const release of releases) release();
		};
	}, [
		requestedIds,
		store,
	]);
	return snapshot.ids === requestedIds ? snapshot.urls : emptyResourceUrls;
};
