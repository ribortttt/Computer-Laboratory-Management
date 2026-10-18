(() => {
    'use strict';

    const SESSION_KEY = 'clm_session';
    const ACCOUNT_KEY = 'clm_account';
    const TAB_EPOCH_KEY = 'clm_tab_epoch';
    const LOGIN_URL = 'index.html';

    function readJSON(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (err) {
            return null;
        }
    }

    function getSession() {
        const s = readJSON(SESSION_KEY);
        return s && s.username ? s : null;
    }

    function goToLogin() {
        window.location.replace(LOGIN_URL);
    }
    function isStale() {
        const s = getSession();
        const tab = sessionStorage.getItem(TAB_EPOCH_KEY);
        return !s || (tab !== null && tab !== String(s.epoch || 0));
    }

    function logout() {
        try {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(TAB_EPOCH_KEY);
        } catch (err) {
            console.warn('Could not clear session:', err);
        }
        goToLogin();
    }
    const session = getSession();
    if (!session) {
        goToLogin();
        return;
    }
    if (sessionStorage.getItem(TAB_EPOCH_KEY) === null) {
        sessionStorage.setItem(TAB_EPOCH_KEY, String(session.epoch || 0));
    }
    if (isStale()) {
        goToLogin();
        return;
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest('#logoutBtn');
        if (!link) return;
        e.preventDefault();
        logout();
    });

    function initials(name) {
        return String(name || 'LA').trim().split(/\s+/).slice(0, 2)
            .map((w) => w[0]).join('').toUpperCase() || 'LA';
    }

    function applySidebar() {
        const acc = readJSON(ACCOUNT_KEY);
        if (!acc) return;

        const name = document.querySelector('.admin-card h3');
        const role = document.querySelector('.admin-card p');
        const avatar = document.querySelector('.admin-card .avatar');

        if (name && acc.name) name.textContent = acc.name;
        if (role && acc.role) role.textContent = acc.role;

        if (avatar) {
            if (acc.photo) {
                avatar.textContent = '';
                avatar.style.backgroundImage = 'url("' + acc.photo + '")';
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            } else {
                avatar.style.backgroundImage = '';
                avatar.textContent = initials(acc.name);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySidebar);
    } else {
        applySidebar();
    }
    window.CLMAuth = { applySidebar, initials };
    window.addEventListener('pageshow', (e) => {
        if (e.persisted && isStale()) goToLogin();
    });

    window.addEventListener('storage', (e) => {
        if (e.key === SESSION_KEY || e.key === null) {
            if (isStale()) goToLogin();
        }
        if (e.key === ACCOUNT_KEY || e.key === null) applySidebar();
    });
})();