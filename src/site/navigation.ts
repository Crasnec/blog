let wired = false;

/*
 * Document-level handlers look their targets up on each event rather than
 * closing over them. A view transition replaces the whole DOM, so a captured
 * element would be the previous page's.
 */
function menuParts() {
    return {
        button: document.getElementById("menu-toggle"),
        menu: document.getElementById("nav-menu"),
    };
}

function setMenuOpen(open: boolean) {
    const { button, menu } = menuParts();
    if (!button || !menu) {
        return;
    }
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
}

function wireMenuButton() {
    const { button, menu } = menuParts();
    if (!button || !menu) {
        return;
    }

    // `hidden` is typed `string | boolean` because of `hidden="until-found"`.
    button.addEventListener("click", () => {
        setMenuOpen(menu.hidden !== false);
    });
}

export function mountNavigation() {
    wireMenuButton();
    if (!wired) {
        wired = true;
        document.addEventListener("dragstart", (event) => {
            if (
                event.target instanceof Element &&
                event.target.closest("#sidebar, #navbar-wrapper")
            ) {
                event.preventDefault();
            }
        });

        document.addEventListener("click", (event) => {
            const { button, menu } = menuParts();
            const target = event.target instanceof Node ? event.target : null;
            if (!menu || menu.hidden || !target) {
                return;
            }
            if (menu.contains(target) || button?.contains(target)) {
                return;
            }
            setMenuOpen(false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }
            const { button, menu } = menuParts();
            if (menu && !menu.hidden) {
                setMenuOpen(false);
                button?.focus();
            }
        });
    }
}
