import { NAVBAR_HEIGHT } from "#src/consts.ts";

let navbar: HTMLElement | null = null;
let backToTop: HTMLElement | null = null;
let wired = false;

function onScroll() {
    const y = window.scrollY;

    // The navbar only grows a backdrop once it has left the masthead.
    navbar?.classList.toggle("is-detached", y > NAVBAR_HEIGHT * 0.5);

    backToTop?.classList.toggle("is-hidden", y < window.innerHeight * 0.6);
}

export function mountScroll() {
    navbar = document.getElementById("navbar-wrapper");
    backToTop = document.getElementById("back-to-top");
    backToTop?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    onScroll();
    if (!wired) {
        wired = true;
        window.addEventListener("scroll", onScroll, { passive: true });
    }
}
