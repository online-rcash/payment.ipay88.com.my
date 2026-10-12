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

    const langGroup = document.querySelector('.group');
    if (langGroup) {
        const button = langGroup.querySelector('button');
        if (button) {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                langGroup.classList.toggle('is-open');
            });
        }
    }
});

document.addEventListener('click', (event) => {
    const langDropdown = event.target.closest('.group');
    if (!langDropdown) {
        document.querySelectorAll('.group').forEach((group) => {
            group.classList.remove('is-open');
            group.classList.remove('opacity-100');
            group.classList.remove('visible');
        });
    }
});