# Progress button clock sync

Fixed item-detail progress buttons drifting ahead of real craft/product-line progress.

The old button overlay owned a CSS keyframe auto-completion duration based on live `remainingMs`. Because `remainingMs` changes every live clock tick, browsers can keep the same animation timeline while shortening its duration, which makes the overlay race ahead of the runtime-derived board/product progress.

Progress buttons are now dumb views again: they render only the current live `progress` value supplied by craft/product-line view models and use the existing short transform transition for smoothing. No autonomous CSS timer/keyframe is allowed in `UiProgressButton`; runtime live clock remains the single source of timing truth.
