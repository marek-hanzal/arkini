/** Projects an imported filename into the editor's canonical default resource ID. */
export const readImportedResourceIdFn = (filename: string) =>
	filename
		.replace(/\.[^.]+$/, "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "")
		.toLowerCase();
