/* R-Cash notice: image hotspots, email links and a ten-second countdown. */
(function () {
    "use strict";

    function initNotice() {
        const overlay = document.getElementById("maintenanceNotificationPopup");
        const popup = overlay?.querySelector(".maintenance-popup");
        const poster = document.getElementById("maintenancePopupImage");
        const closeButton = document.getElementById("maintenancePopupClose");
        const closeX = document.getElementById("maintenancePopupCloseX");
        const countdown = document.getElementById("maintenancePopupCountdown");
        
        if (!overlay || !popup || !poster || !closeButton || !closeX || !countdown || overlay.dataset.initialized) return;
        overlay.dataset.initialized = "true";

        let previousFocus = null;
        let isOpen = false;
        let hasOpened = false;
        let deadline = 0;
        let interval = null;
        let autoClose = null;

        function closeNotice() {
            if (!isOpen) return;
            isOpen = false;
            window.clearInterval(interval);
            window.clearTimeout(autoClose);
            overlay.setAttribute("aria-hidden", "true");
            document.body.classList.remove("maintenance-popup-open");
            if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
                previousFocus.focus({ preventScroll: true });
            }
        }

        function updateCountdown() {
            if (!isOpen) return;
            const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            countdown.textContent = String(seconds);
            if (seconds === 0) closeNotice();
        }

        function openNotice() {
            // KITA BUANG SYARAT !poster.naturalWidth DI SINI
            if (hasOpened) return; 
            hasOpened = true;
            isOpen = true;
            previousFocus = document.activeElement;
            deadline = Date.now() + 10000;
            
            // Tunjuk popup
            overlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("maintenance-popup-open");
            
            updateCountdown();
            interval = window.setInterval(updateCountdown, 1000);
            autoClose = window.setTimeout(closeNotice, 10000);
            
            window.requestAnimationFrame(function () {
                if (isOpen) closeX.focus({ preventScroll: true });
            });
        }

        closeButton.addEventListener("click", closeNotice);
        closeX.addEventListener("click", closeNotice);
        
        popup.querySelectorAll("a[href]").forEach(function (link) {
            link.addEventListener("click", closeNotice);
        });
        
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) closeNotice();
        });
        
        document.addEventListener("keydown", function (event) {
            if (!isOpen) return;
            if (event.key === "Escape") {
                event.preventDefault();
                closeNotice();
            } else if (event.key === "Tab") {
                const controls = Array.from(popup.querySelectorAll("button:not([disabled]), a[href]"));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (!first) return;
                if (event.shiftKey && (document.activeElement === first || !popup.contains(document.activeElement))) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !popup.contains(document.activeElement))) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
        
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) updateCountdown();
        });
        
        window.addEventListener("pageshow", updateCountdown);
        window.addEventListener("pagehide", closeNotice);
        
        // Trigger Bila Gambar Selesai Load
        poster.addEventListener("load", openNotice, { once: true });
        
        // Trigger Jika Gambar Error (Contoh: 404, tapi popup tetap keluar)
        poster.addEventListener("error", openNotice, { once: true }); 
        
        // Trigger Jika Gambar Dah Ada Dalam Cache
        if (poster.complete) {
            openNotice();
        } else {
            // FALLBACK: Kalau gambar lambat sangat load, paksa keluar selepas 1.5 saat
            setTimeout(openNotice, 1500); 
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNotice, { once: true });
    } else {
        initNotice();
    }
})();