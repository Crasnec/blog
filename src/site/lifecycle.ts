/** Page orchestration only; each feature owns its listeners and cleanup. */
import { mountTheme } from "#src/site/theme.ts";
import { mountScroll } from "#src/site/scroll.ts";
import { mountNavigation } from "#src/site/navigation.ts";
import { mountSearch } from "#src/site/search/dialog.ts";
import { mountEnhancements } from "#src/site/enhancements.ts";

let wired = false;

export function startSite() {
    if (wired) {
        return;
    }
    wired = true;
    document.addEventListener("astro:page-load", () => {
        document.documentElement.classList.remove("no-js");
        mountTheme();
        mountScroll();
        mountNavigation();
        mountSearch();
        void mountEnhancements();
    });
    // Entrance animations run only on the first arrival, not on internal navigation.
    document.addEventListener("astro:after-swap", () => {
        document.documentElement.dataset.navigated = "true";
        const root = document.documentElement.style;
        root.setProperty("--content-delay", "0ms");
        root.setProperty("--onload-dur", "0ms");
    });
}
