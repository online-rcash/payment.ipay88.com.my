document.addEventListener('DOMContentLoaded', () => {
    const group = document.getElementById('languageSwitcher');
    const toggle = document.getElementById('languageToggle');
    const options = document.getElementById('languageOptions');
    if (!group || !toggle || !options) return;
    const close = () => {
        options.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', () => {
        options.hidden = !options.hidden;
        toggle.setAttribute('aria-expanded', String(!options.hidden));
    });
    options.addEventListener('click', event => {
        const option = event.target.closest('[data-locale-option]');
        if (!option) return;
        window.DJ_I18N?.setLocale(option.dataset.localeOption);
        close();
        toggle.focus();
    });
    document.addEventListener('click', event => {
        if (!group.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !options.hidden) {
            close();
            toggle.focus();
        }
    });
});
