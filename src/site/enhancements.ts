function preparePlaygrounds() {
    const targets = document.querySelectorAll("[data-code-playground], [data-python-notebook]");
    if (!targets.length) {
        return;
    }
    let started = false;
    let disposed = false;
    const cleanup = () => {
        disposed = true;
        observer.disconnect();
        for (const target of targets) {
            target.removeEventListener("focusin", activate);
        }
        document.removeEventListener("astro:before-swap", cleanup);
    };

    const activate = () => {
        if (started || disposed) {
            return;
        }
        started = true;
        observer.disconnect();
        void import("../playground/mount").then(({ mountPlaygrounds }) => {
            if (!disposed) {
                mountPlaygrounds();
            }
        });
    };
    const observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                activate();
            }
        },
        { rootMargin: "300px" },
    );
    for (const target of targets) {
        observer.observe(target);
        target.addEventListener("focusin", activate);
    }
    document.addEventListener("astro:before-swap", cleanup);
}

/** A navigation invalidates imports still waiting on the previous document. */
let generation = 0;

document.addEventListener("astro:before-swap", () => {
    generation++;
});

export async function mountEnhancements() {
    const current = ++generation;
    preparePlaygrounds();
    if (document.querySelector("#contents")) {
        const { mountContents } = await import("./contents");
        if (current !== generation) {
            return;
        }
        mountContents();
    }
    if (document.querySelector("#secret-form")) {
        const { mountSecret } = await import("./secret");
        if (current !== generation) {
            return;
        }
        mountSecret();
    }
    if (document.querySelector("#comments")) {
        const { mountComments } = await import("./comments");
        if (current !== generation) {
            return;
        }
        mountComments();
    }
    if (document.querySelector(".diagram[data-mermaid]")) {
        const { renderDiagrams } = await import("./diagrams");
        if (current !== generation) {
            return;
        }
        await renderDiagrams();
    }
    if (current !== generation) {
        return;
    }
    if (document.querySelector(".figure[data-figure]")) {
        const { mountFigures } = await import("../figures/runtime");
        if (current !== generation) {
            return;
        }
        await mountFigures();
    }
}
