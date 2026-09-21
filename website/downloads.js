const loadDownloadsFn = async () => {
	const container = document.getElementById("download-links");
	if (!container) return;
	try {
		const response = await fetch(
			"https://api.github.com/repos/marek-hanzal/serakki/releases/latest",
			{
				signal: AbortSignal.timeout(8000),
			},
		);
		if (!response.ok) return;
		const release = await response.json();
		if (release.draft || release.prerelease || !Array.isArray(release.assets)) return;
		const platforms = [
			[
				"Windows · x64",
				"-win-x64.exe",
			],
			[
				"Mac · Apple Silicon",
				"-mac-arm64.dmg",
			],
			[
				"Linux · x64",
				"-linux-x86_64.AppImage",
			],
			[
				"Linux · ARM64",
				"-linux-arm64.AppImage",
			],
		];
		for (const [label, suffix] of platforms) {
			const asset = release.assets.find(
				(candidate) =>
					typeof candidate.name === "string" &&
					candidate.name.startsWith("Serakki-") &&
					candidate.name.endsWith(suffix) &&
					candidate.state === "uploaded",
			);
			if (
				!asset ||
				typeof asset.browser_download_url !== "string" ||
				!asset.browser_download_url.startsWith(
					"https://github.com/marek-hanzal/serakki/releases/download/",
				)
			)
				continue;
			const link = document.createElement("a");
			link.className = "button";
			link.href = asset.browser_download_url;
			link.textContent = label;
			container.append(link);
		}
	} catch {
		// The static latest-release link remains available without the API or JavaScript.
	}
};
void loadDownloadsFn();
