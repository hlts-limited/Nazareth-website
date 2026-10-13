/* ============================================================
   MODERN VISUAL LAYER
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    /* --------------------------------------------------------
       Premium subtle grid
       -------------------------------------------------------- */

    const grid = document.createElement("div");

    grid.className = "site-ambient-grid";
    grid.setAttribute("aria-hidden", "true");

    document.body.appendChild(grid);


    /* --------------------------------------------------------
       Scroll progress
       -------------------------------------------------------- */

    const progress = document.createElement("div");

    progress.className = "site-scroll-progress";
    progress.setAttribute("aria-hidden", "true");

    document.body.appendChild(progress);


    const updateProgress = () => {

        const documentHeight =
            document.documentElement.scrollHeight -
            window.innerHeight;

        const scrollPosition = window.scrollY;

        const percentage =
            documentHeight > 0
                ? scrollPosition / documentHeight
                : 0;

        progress.style.transform =
            `scaleX(${Math.min(Math.max(percentage, 0), 1)})`;
    };


    window.addEventListener(
        "scroll",
        updateProgress,
        { passive: true }
    );


    updateProgress();
});