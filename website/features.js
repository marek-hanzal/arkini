// Native scrolling also keeps these features usable without JavaScript.
for (const carousel of document.querySelectorAll(".more-features")) {
	const track = carousel.querySelector(".feature-track");
	const controls = carousel.querySelector(".carousel-controls");
	const previous = controls.querySelector('[data-direction="-1"]');
	const next = controls.querySelector('[data-direction="1"]');
	const updateControlsFn = () => {
		previous.disabled = track.scrollLeft <= 1;
		next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
	};
	controls.hidden = false;
	for (const button of controls.querySelectorAll("button")) {
		button.addEventListener("click", () => {
			const step =
				track.firstElementChild.getBoundingClientRect().width +
				parseFloat(getComputedStyle(track).gap);
			track.scrollBy({
				left: Number(button.dataset.direction) * step,
				behavior: "smooth",
			});
		});
	}
	track.addEventListener("scroll", updateControlsFn, {
		passive: true,
	});
	new ResizeObserver(updateControlsFn).observe(track);
	updateControlsFn();
}
