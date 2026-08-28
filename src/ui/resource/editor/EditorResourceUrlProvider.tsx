import { useLayoutEffect, useRef, type PropsWithChildren } from "react";

import type { EditorProject } from "~/editor/EditorProject";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import {
	EditorResourceUrlContext,
	type EditorResourceUrlStore,
} from "~/ui/resource/editor/EditorResourceUrlContext";

type EditorResource = EditorProject["resources"][number];
type ResourceUrlListener = () => void;

interface ResourceUrlEntry {
	bytes: Uint8Array;
	mime: string;
	url: string;
}

/** Owns shared object URLs only while mounted consumers request them. */
export const EditorResourceUrlProvider = ({
	children,
	resources,
}: PropsWithChildren<{
	readonly resources: EditorProject["resources"];
}>) => {
	const storeRef = useRef<EditorResourceUrlStore | undefined>(undefined);
	if (storeRef.current === undefined) {
		let resourcesById = new Map<string, EditorResource>();
		const entries = new Map<string, ResourceUrlEntry>();
		const listenersById = new Map<string, Set<ResourceUrlListener>>();
		const revokeEntry = (resourceId: string) => {
			const entry = entries.get(resourceId);
			if (entry === undefined) return;
			entries.delete(resourceId);
			URL.revokeObjectURL(entry.url);
		};
		const createEntry = (resource: EditorResource) => {
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
	return <EditorResourceUrlContext value={store}>{children}</EditorResourceUrlContext>;
};

/** Binds URL ownership to the current canonical project snapshot. */
export const EditorProjectResourceUrlProvider = ({ children }: PropsWithChildren) => {
	const { resources } = useEditorProject();
	return <EditorResourceUrlProvider resources={resources}>{children}</EditorResourceUrlProvider>;
};
