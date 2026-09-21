# Serakki website

A standalone English landing page. All public images and videos live in `assets/`;
there are no runtime dependencies, external fonts, or build steps.
A small vanilla script adds manual carousel buttons; the feature strip also
scrolls without JavaScript. Highlight artwork is copied into `assets/`.

Run `argc website:preview` from the repository root, then open
http://127.0.0.1:4173/. Refresh the browser after edits.

For GitHub Pages, upload the contents of `website/` as the Pages artifact.
Relative asset URLs support both a repository subpath and a custom domain.
`.nojekyll` also allows serving this directory without Jekyll processing.
The Website workflow publishes changes under `website/` on main, and can also
be run manually. Publishing is separate from the application release workflow.

The gameplay clips are web-sized, silent MP4 exports of the supplied recordings.
The hero and author portrait are local copies of the supplied originals.

Social metadata uses the official HTTPS domain,
https://serakki.dev/, and the local hero artwork.
Update canonical, Open Graph, and Twitter image URLs together if the domain changes.
The longer gameplay sample uses the complete 21.32.28 recording (about 2 minutes
46 seconds), without trimming. It is exported at 1920 pixels wide and loads on demand.

Downloads resolve platform assets from GitHub's public `releases/latest` API at page load. Asset suffixes match the desktop packaging names; versions are not embedded in the page. Drafts and prereleases are excluded. The static latest-release link remains usable without JavaScript or if the API is unavailable/rate-limited. No token is shipped to the browser.
