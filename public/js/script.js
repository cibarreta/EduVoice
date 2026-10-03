(() => {
    const sidebar = document.getElementById("app-sidebar");
    const sidebarOverlay = document.querySelector("[data-sidebar-overlay]");
    const sidebarOpenButtons = document.querySelectorAll("[data-sidebar-open]");
    const sidebarCloseButton = document.querySelector("[data-sidebar-close]");

    const closeSidebar = () => {
        sidebar?.classList.remove("is-open");
        sidebarOverlay?.classList.remove("is-visible", "is-open");
        sidebarOverlay?.setAttribute("aria-hidden", "true");
        sidebarOpenButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
        sidebarCloseButton?.setAttribute("aria-expanded", "false");
    };

    sidebarOpenButtons.forEach((button) => button.addEventListener("click", () => {
        sidebar?.classList.add("is-open");
        sidebarOverlay?.classList.add("is-visible", "is-open");
        sidebarOverlay?.setAttribute("aria-hidden", "false");
        button.setAttribute("aria-expanded", "true");
        sidebarCloseButton?.setAttribute("aria-expanded", "true");
        sidebarOpenButtons.forEach((openButton) => openButton.setAttribute("aria-expanded", "true"));
    }));
    sidebarCloseButton?.addEventListener("click", closeSidebar);
    sidebarOverlay?.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
    });

    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.querySelector("#primary-navigation");

    if (!menuButton || !navigation) {
        return;
    }

    document.body.classList.add("js-enabled");

    const closeMenu = () => {
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
        navigation.classList.remove("is-open");
    };

    menuButton.addEventListener("click", () => {
        const isExpanded = menuButton.getAttribute("aria-expanded") === "true";

        menuButton.setAttribute("aria-expanded", String(!isExpanded));
        menuButton.setAttribute(
            "aria-label",
            isExpanded ? "Open navigation menu" : "Close navigation menu"
        );
        navigation.classList.toggle("is-open", !isExpanded);
    });

    navigation.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
})();
