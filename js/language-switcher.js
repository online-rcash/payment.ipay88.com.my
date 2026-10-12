/* =========================================================
   LANGUAGE SWITCHER HANDLER
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const langOptions = document.querySelectorAll('[data-locale-option]');
    
    langOptions.forEach(option => {
        option.addEventListener('click', (event) => {
            event.preventDefault();
            const locale = option.getAttribute('data-locale-option');
            if (locale && window.DJ_I18N) {
                window.DJ_I18N.setLocale(locale);
            }
        });
    });
});

// Close language dropdown jika click di luar
document.addEventListener('click', (event) => {
    const langDropdown = event.target.closest('.relative.inline-block.text-left');
    if (!langDropdown) {
        const allDropdowns = document.querySelectorAll('.group');
        allDropdowns.forEach(dropdown => {
            dropdown.classList.remove('group-hover:opacity-100', 'group-hover:visible');
        });
    }
});
