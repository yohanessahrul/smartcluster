const switchButtons = document.querySelectorAll(".switch-btn");
const flowPanels = document.querySelectorAll(".flow-panel");

switchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;

    switchButtons.forEach((item) => item.classList.remove("active"));
    flowPanels.forEach((panel) => panel.classList.remove("active"));

    button.classList.add("active");
    document.querySelector(`.${target}`)?.classList.add("active");
  });
});

const revealNodes = document.querySelectorAll("[data-reveal]");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("show");
      revealObserver.unobserve(entry.target);
    });
  },
  {
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.2,
  }
);

revealNodes.forEach((node, index) => {
  node.style.transitionDelay = `${Math.min(index * 35, 260)}ms`;
  revealObserver.observe(node);
});
