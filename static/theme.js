// Apply a saved choice before the page renders. First-time visitors get light mode.
try {
    if (localStorage.getItem("pokechef-theme") === "dark") {
        document.documentElement.dataset.theme = "dark";
    }
} catch {
    // The default still works when browser storage is unavailable.
}

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("theme-toggle");
    toggle.checked = document.documentElement.dataset.theme === "dark";
    toggle.addEventListener("change", () => {
        const theme = toggle.checked ? "dark" : "light";
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem("pokechef-theme", theme);
        } catch {
            // Switching themes does not depend on persistence.
        }
    });
});
