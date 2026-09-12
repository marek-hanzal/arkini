export namespace readProjectResourceUrlFn {
	export interface Props {
		readonly projectId: string;
		readonly resourceId: string;
		readonly version: string;
	}
}

/** The resource version gives every replacement a distinct renderer image identity. */
export const readProjectResourceUrlFn = ({
	projectId,
	resourceId,
	version,
}: readProjectResourceUrlFn.Props): string =>
	`arkini://editor/resource?${new URLSearchParams({
		projectId,
		resourceId,
		version,
	})}`;
