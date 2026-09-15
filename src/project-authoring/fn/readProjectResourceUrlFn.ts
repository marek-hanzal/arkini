export namespace readProjectResourceUrlFn {
	export interface Props {
		readonly projectId: string;
		readonly resourceId: string;
		readonly version: string;
	}
}

/** The resource version gives every replacement a distinct renderer URL identity. */
export const readProjectResourceUrlFn = ({
	projectId,
	resourceId,
	version,
}: readProjectResourceUrlFn.Props): string =>
	`arkini://app/editor/resource?${new URLSearchParams({
		projectId,
		resourceId,
		version,
	})}`;
