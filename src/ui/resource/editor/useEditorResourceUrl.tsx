import {
	createContext,
	useContext,
	useLayoutEffect,
	useRef,
	useState,
	type PropsWithChildren,
} from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { useEditorProject } from "~/bridge/editor/useEditorProject";

const emptyResourceUrls: ReadonlyMap<string, string> = new Map();
const EditorResourceUrlContext = createContext<ReadonlyMap<string, string>>(emptyResourceUrls);

interface ResourceUrlEntry {
	readonly bytes: Uint8Array;
	readonly mime: string;
	readonly url: string;
}

const haveEqualBytes = (left: Uint8Array, right: Uint8Array) => {
	if (left === right) return true;
	if (left.byteLength !== right.byteLength) return false;
	for (let index = 0; index < left.byteLength; index += 1) {
		if (left[index] !== right[index]) return false;
	}
	return true;
};

/** Owns exactly one object URL per resource for the lifetime of one project snapshot. */
export const EditorResourceUrlProvider = ({
	children,
	resources,
}: PropsWithChildren<{
	readonly resources: EditorProject["resources"];
}>) => {
	const [snapshot, setSnapshot] = useState<{
		readonly resources: EditorProject["resources"];
		readonly urls: ReadonlyMap<string, string>;
	}>({
		resources,
		urls: emptyResourceUrls,
	});
	const entriesRef = useRef<ReadonlyMap<string, ResourceUrlEntry>>(new Map());
	useLayoutEffect(() => {
		const previous = entriesRef.current;
		const entries = new Map<string, ResourceUrlEntry>();
		for (const resource of resources) {
			const existing = previous.get(resource.id);
			if (
				existing !== undefined &&
				existing.mime === resource.mime &&
				haveEqualBytes(existing.bytes, resource.bytes)
			) {
				entries.set(resource.id, existing);
				continue;
			}
			entries.set(resource.id, {
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
			});
		}
		for (const [resourceId, entry] of previous) {
			if (entries.get(resourceId) !== entry) URL.revokeObjectURL(entry.url);
		}
		entriesRef.current = entries;
		const urls = new Map(
			[
				...entries,
			].map(([resourceId, entry]) => [
				resourceId,
				entry.url,
			]),
		);
		setSnapshot({
			resources,
			urls,
		});
	}, [
		resources,
	]);
	useLayoutEffect(
		() => () => {
			for (const entry of entriesRef.current.values()) URL.revokeObjectURL(entry.url);
			entriesRef.current = new Map();
		},
		[],
	);
	const urls = snapshot.resources === resources ? snapshot.urls : emptyResourceUrls;
	return <EditorResourceUrlContext value={urls}>{children}</EditorResourceUrlContext>;
};

/** Binds URL ownership to the current canonical project snapshot. */
export const EditorProjectResourceUrlProvider = ({ children }: PropsWithChildren) => {
	const { resources } = useEditorProject();
	return <EditorResourceUrlProvider resources={resources}>{children}</EditorResourceUrlProvider>;
};

/** Reads the project-scoped resource URL index without allocating object URLs. */
export const useEditorResourceUrls = () => useContext(EditorResourceUrlContext);

/** Resolves the project-scoped URL without allocating per mounted thumbnail. */
export const useEditorResourceUrl = (resourceId: string | undefined) =>
	useEditorResourceUrls().get(resourceId ?? "");
