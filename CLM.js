(() => {
    'use strict';

    const DEFAULT_ACCOUNT = {
        username: 'admin',
        password: 'admin123',
        name: 'Lab Administrator',
        role: 'Admin'
    };

    const SESSION_KEY = 'clm_session';
    const ACCOUNT_KEY = 'clm_account';
    const TAB_EPOCH_KEY = 'clm_tab_epoch';
    const DASHBOARD_URL = 'Dashboard.html';
    const REDIRECT_DELAY = 700;   

    const $ = (id) => document.getElementById(id);

    const form = $('loginForm');
    const usernameInput = $('username');
    const passwordInput = $('password');
    const msg = $('msg');
    const submitBtn = form.querySelector('button[type="submit"]');

    function getAccount() {
        try {
            const saved = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
            return Object.assign({}, DEFAULT_ACCOUNT, saved || {});
        } catch (err) {
            return Object.assign({}, DEFAULT_ACCOUNT);
        }
    }

    function getSession() {
        try {
            const s = JSON.parse(localStorage.getItem(SESSION_KEY));
            return s && s.username ? s : null;
        } catch (err) {
            return null;
        }
    }

    function showMessage(text, success = false) {
        msg.textContent = text;
        msg.classList.toggle('success', success);
    }

    function saveSession(account, epoch) {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                username: account.username,
                name: account.name,
                role: account.role,
                epoch,
                loggedInAt: new Date().toISOString()
            }));
            sessionStorage.setItem(TAB_EPOCH_KEY, String(epoch));
        } catch (err) {
            console.warn('Could not save session:', err);
        }
    }

    const existing = getSession();
    if (existing) {
        const tabEpoch = sessionStorage.getItem(TAB_EPOCH_KEY);
        if (tabEpoch === null || tabEpoch === String(existing.epoch || 0)) {
            window.location.replace(DASHBOARD_URL);
            return;
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showMessage('Please enter your username and password.');
            (username ? passwordInput : usernameInput).focus();
            return;
        }

        const account = getAccount();
        const valid =
            username.toLowerCase() === String(account.username).toLowerCase() &&
            password === account.password;

        if (!valid) {
            showMessage('Incorrect username or password.');
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        const current = getSession();
        saveSession(account, current ? (current.epoch || 0) : 0);
        showMessage('Login successful. Opening dashboard...', true);
        submitBtn.disabled = true;

        setTimeout(() => {
            window.location.href = DASHBOARD_URL;
        }, REDIRECT_DELAY);
    });

    [usernameInput, passwordInput].forEach((input) => {
        input.addEventListener('input', () => showMessage(''));
    });

    usernameInput.focus();
})();