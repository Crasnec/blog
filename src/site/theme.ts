import { t } from "#src/strings.ts";

type ThemeMode = "light" | "dark" | "auto";
const ORDER: ThemeMode[] = ["light", "dark", "auto"];

const isThemeMode = (value: string | undefined): value is ThemeMode =>
    value === "light" || value === "dark" || value === "auto";

function applyTheme(mode: ThemeMode) {
    const dark =
        mode === "dark" ||
        (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("theme", mode);

    // Which mode is active is carried by the icon, which a screen reader cannot
    // see, so the label has to say it.
    const toggle = document.getElementById("theme-toggle");
    const name = toggle?.dataset[mode];
    if (toggle && name) {
        const action = toggle.dataset.action ?? t("action.theme");
        toggle.setAttribute("aria-label", `${action}: ${name}`);
    }

    // Diagrams are rendered with baked-in colours, so they need redrawing.
    document.dispatchEvent(new CustomEvent("theme:change", { detail: { dark } }));
}

function cycleTheme() {
    const stored = document.documentElement.dataset.theme;
    const current = isThemeMode(stored) ? stored : "auto";
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "auto";
    applyTheme(next);
}

export function mountTheme() {
    document.getElementById("theme-toggle")?.addEventListener("click", cycleTheme);
}
