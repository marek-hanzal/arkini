export namespace readProjectResourceUrlFn {
	export interface Props {
		readonly projectId: string;
		readonly resourceUid: string;
		readonly version: string;
	}
}

/** The resource version gives every replacement a distinct renderer URL identity. */
export const readProjectResourceUrlFn = ({
	projectId,
	resourceUid,
	version,
}: readProjectResourceUrlFn.Props): string =>
	`serakki://app/editor/resource?${new URLSearchParams({
		projectId,
		resourceUid,
		version,
	})}`;
