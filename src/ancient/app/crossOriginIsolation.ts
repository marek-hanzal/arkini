const reloadFlag = "arkini:coi-reload";

// OPFS SQLite wants cross-origin isolation. Proper server headers are the clean
// path. For static hosts that cannot set headers, for example GitHub Pages, this
// service worker re-serves same-origin files with COOP/COEP and reloads once.
export async function ensureCrossOriginIsolation() {
	if (window.crossOriginIsolated) {
		sessionStorage.removeItem(reloadFlag);
		return;
	}

	if (!("serviceWorker" in navigator)) {
		throw new Error(
			"This browser cannot enable cross-origin isolation without server headers.",
		);
	}

	if (sessionStorage.getItem(reloadFlag) === "done") {
		throw new Error("Cross-origin isolation is still missing after the service worker reload.");
	}

	const serviceWorkerUrl = new URL(
		`${import.meta.env.BASE_URL}coi-serviceworker.js`,
		window.location.href,
	);
	await navigator.serviceWorker.register(serviceWorkerUrl, {
		scope: import.meta.env.BASE_URL,
	});
	await navigator.serviceWorker.ready;

	sessionStorage.setItem(reloadFlag, "done");
	window.location.reload();
	await new Promise(() => undefined);
}
