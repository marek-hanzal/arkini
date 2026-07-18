# Settings native View Transition

Issue #274 originally navigated from the open in-game menu by first running the menu's local WAAPI exit and only then changing route. Native smoke showed that sequence as a broken two-step handoff: the menu disappeared, the bare game flashed, and Settings arrived afterward.

The corrected contract is route-specific:

- ordinary menu dismissal, hard reset, and controlled application close still use the owned game-menu exit lifecycle;
- the Settings action navigates directly from the still-open menu with TanStack Router `viewTransition: true`;
- the old View Transition snapshot therefore contains the complete open menu rather than an intermediate bare game frame;
- `GameMenu` and the Settings modal share one `view-transition-name`, allowing Chromium to treat the panels as one shared element;
- route release still disposes/saves the game normally, and browser history returns to the exact game route without reopening the menu.

Do not reintroduce `menu.close().then(navigate)` for route transitions whose old snapshot should contain the overlay.
