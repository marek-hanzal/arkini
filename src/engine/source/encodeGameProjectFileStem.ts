/** Encodes one validated project identity into a collision-safe portable filename stem. */
export const encodeGameProjectFileStem = (projectId: string) =>
	encodeURIComponent(projectId).replaceAll(".", "%2E");
