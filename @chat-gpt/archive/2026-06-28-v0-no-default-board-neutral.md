# No-default producer board visual neutral

Board producer tiles without an explicitly selected default product line must render as neutral opacity.

No default is a valid interaction state: board tap opens item detail instead of quick-starting a product line. This is especially important for Town Hall style producers that exist as management/building hubs and may never have a default quick-start line.

Dim board opacity only for actionable ready states that are currently blocked/not ready, such as an explicit default line missing inputs or a non-complete craft.
