import {
	createContext,
	type PropsWithChildren,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { readProjectResourceUrlFn } from "~/project-authoring/fn/readProjectResourceUrlFn";
import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

type ResourceUrlListener = () => void;

interface ResourceUrlStore {
	readonly readFn: (resourceUid: string) => string | undefined;
	readonly subscribeFn: (resourceUid: string, listenerFn: ResourceUrlListener) => () => void;
	readonly syncFn: (resources: Project["resources"]) => void;
	readonly disposeFn: () => void;
}

const ResourceUrlContext = createContext<ResourceUrlStore | undefined>(undefined);
const emptyResourceUrls: ReadonlyMap<string, string> = new Map();

const ResourceUrlProvider = ({
	children,
	resources,
	projectId,
}: PropsWithChildren<{
	readonly projectId: string;
	readonly resources: Project["resources"];
}>) => {
	const storeRef = useRef<ResourceUrlStore | undefined>(undefined);
	if (storeRef.current === undefined) {
		let resourcesById = new Map<string, Project.Resource>();
		const urls = new Map<string, string>();
		const listenersById = new Map<string, Set<ResourceUrlListener>>();
		const createUrlFn = (resource: Project.Resource) => {
			const url = readProjectResourceUrlFn({
				projectId,
				resourceUid: resource.uid,
				version: resource.version,
			});
			urls.set(resource.uid, url);
			return url;
		};
		storeRef.current = {
			readFn: (resourceUid) => urls.get(resourceUid),
			subscribeFn: (resourceUid, listenerFn) => {
				let listeners = listenersById.get(resourceUid);
				if (listeners === undefined) {
					listeners = new Set();
					listenersById.set(resourceUid, listeners);
				}
				listeners.add(listenerFn);
				if (!urls.has(resourceUid)) {
					const resource = resourcesById.get(resourceUid);
					if (resource !== undefined) createUrlFn(resource);
				}
				return () => {
					const currentListeners = listenersById.get(resourceUid);
					currentListeners?.delete(listenerFn);
					if (currentListeners !== undefined && currentListeners.size > 0) return;
					listenersById.delete(resourceUid);
					urls.delete(resourceUid);
				};
			},
			syncFn: (nextResources) => {
				resourcesById = new Map(
					nextResources.map((resource) => [
						resource.uid,
						resource,
					]),
				);
				const changedListeners = new Set<ResourceUrlListener>();
				for (const [resourceUid, listeners] of listenersById) {
					const resource = resourcesById.get(resourceUid);
					const url = urls.get(resourceUid);
					if (resource === undefined) {
						if (url === undefined) continue;
						urls.delete(resourceUid);
						for (const listenerFn of listeners) changedListeners.add(listenerFn);
						continue;
					}
					if (url === undefined) {
						createUrlFn(resource);
						for (const listenerFn of listeners) changedListeners.add(listenerFn);
						continue;
					}
					if (
						url ===
						readProjectResourceUrlFn({
							projectId,
							resourceUid: resource.uid,
							version: resource.version,
						})
					)
						continue;
					urls.delete(resourceUid);
					createUrlFn(resource);
					for (const listenerFn of listeners) changedListeners.add(listenerFn);
				}
				for (const listenerFn of changedListeners) listenerFn();
			},
			disposeFn: () => {
				urls.clear();
				listenersById.clear();
				resourcesById.clear();
			},
		};
	}
	const store = storeRef.current;
	useLayoutEffect(() => {
		store.syncFn(resources);
	}, [
		resources,
		store,
	]);
	useLayoutEffect(
		() => () => {
			store.disposeFn();
		},
		[
			store,
		],
	);
	return <ResourceUrlContext value={store}>{children}</ResourceUrlContext>;
};

/** Keeps versioned file URLs stable so consumers share unchanged project resources. */
export const ProjectResourceUrlProvider = ({ children }: PropsWithChildren) => {
	const { resources, projectId } = useEditorProject();
	return (
		<ResourceUrlProvider
			key={projectId}
			projectId={projectId}
			resources={resources}
		>
			{children}
		</ResourceUrlProvider>
	);
};

/** Resolves one lazily acquired project-scoped resource URL. */
export const useResourceUrl = (resourceUid: string | undefined) => {
	const store = useContext(ResourceUrlContext);
	const [url, setUrlFn] = useState<string>();
	useLayoutEffect(() => {
		if (store === undefined || resourceUid === undefined) {
			setUrlFn(undefined);
			return;
		}
		const updateFn = () => setUrlFn(store.readFn(resourceUid));
		const releaseFn = store.subscribeFn(resourceUid, updateFn);
		updateFn();
		return releaseFn;
	}, [
		resourceUid,
		store,
	]);
	return url;
};

/** Resolves only the project-scoped resource URLs requested by one mounted consumer. */
export const useResourceUrls = (resourceUids: ReadonlyArray<string>) => {
	const store = useContext(ResourceUrlContext);
	const requestedIds = useMemo(
		() => [
			...new Set(resourceUids),
		],
		[
			resourceUids,
		],
	);
	const [snapshot, setSnapshotFn] = useState<{
		readonly ids: ReadonlyArray<string>;
		readonly urls: ReadonlyMap<string, string>;
	}>({
		ids: requestedIds,
		urls: emptyResourceUrls,
	});
	useLayoutEffect(() => {
		if (store === undefined || requestedIds.length === 0) {
			setSnapshotFn({
				ids: requestedIds,
				urls: emptyResourceUrls,
			});
			return;
		}
		let active = true;
		const updateFn = () => {
			if (!active) return;
			const urls = new Map<string, string>();
			for (const resourceUid of requestedIds) {
				const url = store.readFn(resourceUid);
				if (url !== undefined) urls.set(resourceUid, url);
			}
			setSnapshotFn({
				ids: requestedIds,
				urls,
			});
		};
		const releases = requestedIds.map((resourceUid) =>
			store.subscribeFn(resourceUid, updateFn),
		);
		updateFn();
		return () => {
			active = false;
			for (const releaseFn of releases) releaseFn();
		};
	}, [
		requestedIds,
		store,
	]);
	return snapshot.ids === requestedIds ? snapshot.urls : emptyResourceUrls;
};
