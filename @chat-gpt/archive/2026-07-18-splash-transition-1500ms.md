# Splash transition timing adjustment

## Change

The startup splash entrance and exit durations were reduced from 2.5 seconds to 1.5 seconds in the canonical `StartupSplash` presentation constants.

## Preserved behavior

- the initial visible black hold remains 500 ms;
- the minimum splash lifecycle remains five seconds;
- automatic and Escape-triggered exits use the same synchronized splash-to-main-menu cross-fade;
- the splash remains mounted until both WAAPI animations finish;
- readiness and `Press Esc to continue` semantics are unchanged.

## Validation

- focused `StartupSplash` tests;
- source, test, and Electron typechecks;
- formatting, game validation, dependency boundaries, and production build.
