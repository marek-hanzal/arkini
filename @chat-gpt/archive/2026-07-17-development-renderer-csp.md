# Development renderer CSP and HMR

Issue: #267

The development renderer failed before React startup because `@vitejs/plugin-react` injects one inline module preamble for React Refresh while the development response still used production `script-src 'self'`.

Implemented boundary:

- `RendererDevelopmentServer` is produced from one validated URL, currently `http://127.0.0.1:4040/`.
- The same parser rejects credentials, HTTPS, non-loopback hosts, alternate paths, query strings, and fragments before trusted-renderer authorization.
- Development CSP derives `ws://127.0.0.1:4040/` from that parsed URL instead of maintaining another port or origin literal.
- Each Vite serve process generates one random nonce. `html.cspNonce` puts it on the React Refresh preamble, Vite client, entry module, and Vite nonce meta tag; the response CSP permits that nonce only.
- Development does not use script `unsafe-inline` or `unsafe-eval`.
- Production CSP remains the previous strict policy and receives no nonce or HMR WebSocket source.

Verification:

- focused URL, CSP, trusted-renderer, and packaged-protocol tests;
- real Vite response verified one identical nonce in the CSP header and every emitted script/meta tag;
- real `vite-hmr` WebSocket connected to the tokenized URL under the URL-derived endpoint;
- editing the loaded stylesheet produced a Vite `js-update` HMR message;
- production build contains no CSP nonce and packaged protocol tests retain the production policy.

The retained runtime did not contain the Electron native executable and could not download it, so the final macOS BrowserWindow smoke check may still be performed locally. The Vite/CSP/HMR transport itself was exercised rather than mocked.
