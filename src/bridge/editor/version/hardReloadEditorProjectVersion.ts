/** Re-enters the restored project from a fresh renderer document and a stable route. */
export const hardReloadEditorProjectVersion = (projectId: string) => {
	try {
		window.history.replaceState(
			window.history.state,
			"",
			`/editor/${encodeURIComponent(projectId)}/versions/history`,
		);
	} catch (cause) {
		console.error("The restored editor route could not be selected before reload.", cause);
	}
	window.location.reload();
};
