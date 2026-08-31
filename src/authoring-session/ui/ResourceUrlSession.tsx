import {
	createContext,
	type PropsWithChildren,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

type Resource = Project["resources"][number];
type ResourceUrlListener = () => void;

interface ResourceUrlEntry {
	bytes: Uint8Array;
	mime: string;
	url: string;
}

interface ResourceUrlStore {
	readonly read: (resourceId: string) => string | undefined;
	readonly subscribe: (resourceId: string, listener: ResourceUrlListener) => () => void;
	readonly sync: (resources: Project["resources"]) => void;
	readonly dispose: () => void;
}

const ResourceUrlContext = createContext<ResourceUrlStore | undefined>(undefined);
const emptyResourceUrls: ReadonlyMap<string, string> = new Map();

const ResourceUrlProvider = ({
	children,
	resources,
}: PropsWithChildren<{
	readonly resources: Project["resources"];
}>) => {
	const storeRef = useRef<ResourceUrlStore | undefined>(undefined);
	if (storeRef.current === undefined) {
		let resourcesById = new Map<string, Resource>();
		const entries = new Map<string, ResourceUrlEntry>();
		const listenersById = new Map<string, Set<ResourceUrlListener>>();
		const revokeEntry = (resourceId: string) => {
			const entry = entries.get(resourceId);
			if (entry === undefined) return;
			entries.delete(resourceId);
			URL.revokeObjectURL(entry.url);
		};
		const createEntry = (resource: Resource) => {
			const entry: ResourceUrlEntry = {
				bytes: resource.bytes,
				mime: resource.mime,
				url: URL.createObjectURL(
					new Blob(
						[
							resource.bytes.slice().buffer,
						],
						{
							type: resource.mime,
						},
					),
				),
			};
			entries.set(resource.id, entry);
			return entry;
		};
		storeRef.current = {
			read: (resourceId) => entries.get(resourceId)?.url,
			subscribe: (resourceId, listener) => {
				let listeners = listenersById.get(resourceId);
				if (listeners === undefined) {
					listeners = new Set();
					listenersById.set(resourceId, listeners);
				}
				listeners.add(listener);
				if (!entries.has(resourceId)) {
					const resource = resourcesById.get(resourceId);
					if (resource !== undefined) createEntry(resource);
				}
				return () => {
					const currentListeners = listenersById.get(resourceId);
					currentListeners?.delete(listener);
					if (currentListeners !== undefined && currentListeners.size > 0) return;
					listenersById.delete(resourceId);
					revokeEntry(resourceId);
				};
			},
			sync: (nextResources) => {
				resourcesById = new Map(
					nextResources.map((resource) => [
						resource.id,
						resource,
					]),
				);
				const changedListeners = new Set<ResourceUrlListener>();
				for (const [resourceId, listeners] of listenersById) {
					const resource = resourcesById.get(resourceId);
					const entry = entries.get(resourceId);
					if (resource === undefined) {
						if (entry === undefined) continue;
						revokeEntry(resourceId);
						for (const listener of listeners) changedListeners.add(listener);
						continue;
					}
					if (entry === undefined) {
						createEntry(resource);
						for (const listener of listeners) changedListeners.add(listener);
						continue;
					}
					const equalBytes =
						entry.bytes === resource.bytes ||
						(entry.bytes.byteLength === resource.bytes.byteLength &&
							entry.bytes.every((byte, index) => byte === resource.bytes[index]));
					if (entry.mime === resource.mime && equalBytes) {
						entry.bytes = resource.bytes;
						continue;
					}
					revokeEntry(resourceId);
					createEntry(resource);
					for (const listener of listeners) changedListeners.add(listener);
				}
				for (const listener of changedListeners) listener();
			},
			dispose: () => {
				for (const resourceId of [
					...entries.keys(),
				])
					revokeEntry(resourceId);
				listenersById.clear();
				resourcesById.clear();
			},
		};
	}
	const store = storeRef.current;
	useLayoutEffect(() => {
		store.sync(resources);
	}, [
		resources,
		store,
	]);
	useLayoutEffect(
		() => () => {
			store.dispose();
		},
		[
			store,
		],
	);
	return <ResourceUrlContext value={store}>{children}</ResourceUrlContext>;
};

/** Binds object-URL ownership to the current canonical project snapshot. */
export const ProjectResourceUrlProvider = ({ children }: PropsWithChildren) => {
	const { resources } = useEditorProject();
	return <ResourceUrlProvider resources={resources}>{children}</ResourceUrlProvider>;
};

/** Resolves one lazily acquired project-scoped resource URL. */
export const useResourceUrl = (resourceId: string | undefined) => {
	const store = useContext(ResourceUrlContext);
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
export const useResourceUrls = (resourceIds: ReadonlyArray<string>) => {
	const store = useContext(ResourceUrlContext);
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
