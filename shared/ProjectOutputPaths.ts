/** Canonical repository-local paths for ignored generated output. */
export const ProjectOutputPaths = {
	root: ".out",
	cache: {
		tanstack: ".out/cache/tanstack",
	},
	desktop: {
		root: ".out/desktop",
		build: ".out/desktop/build",
		stage: ".out/desktop/stage",
		release: ".out/desktop/release",
	},
} as const;
