import { useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Owns one short-lived object URL for a resource in the active editor project. */
export const useEditorResourceUrl = (resourceId: string | undefined) => {
	const project = useEditorProject();
	const resource = useMemo(
		() => project.resources.find(({ id }) => id === resourceId),
		[project.resources, resourceId],
	);
	const [url, setUrl] = useState<string>();
	useEffect(() => {
		if (resource === undefined) {
			setUrl(undefined);
			return;
		}
		const nextUrl = URL.createObjectURL(
			new Blob([
				resource.bytes.slice().buffer,
			], {
				type: resource.mime,
			}),
		);
		setUrl(nextUrl);
		return () => URL.revokeObjectURL(nextUrl);
	}, [resource]);
	return url;
};
