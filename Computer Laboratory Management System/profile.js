(() => {
    'use strict';

    const ACCOUNT_KEY = 'clm_account';
    const SESSION_KEY = 'clm_session';
    const TAB_EPOCH_KEY = 'clm_tab_epoch';

    const DEFAULT_ACCOUNT = {
        username: 'admin',
        password: 'admin123',
        name: 'Lab Administrator',
        role: 'Admin',
        email: '',
        contact: '',
        photo: ''
    };

    const $ = (id) => document.getElementById(id);

    const el = {
        avatar: $('avatarLarge-profile'),
        displayName: $('displayName-profile'),
        displayRole: $('displayRole-profile'),
        photoLastLogin: $('photoLastLogin-profile'),
        sessionLastLogin: $('sessionLastLogin-profile'),
        changePhotoBtn: $('changePhotoBtn-profile'),
        photoInput: $('photoInput-profile'),
        photoMsg: $('photoMsg-profile'),
        profileForm: $('profileForm-profile'),
        fullName: $('fullName-profile'),
        username: $('username-profile'),
        email: $('email-profile'),
        contact: $('contact-profile'),
        role: $('role-profile'),
        infoMsg: $('infoMsg-profile'),
        logoutOthersBtn: $('logoutOthersBtn-profile'),
        sessionMsg: $('sessionMsg-profile'),
        passwordForm: $('passwordForm-profile'),
        currentPassword: $('currentPassword-profile'),
        newPassword: $('newPassword-profile'),
        confirmPassword: $('confirmPassword-profile'),
        passwordMsg: $('passwordMsg-profile')
    };

    function getAccount() {
        try {
            const saved = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
            return Object.assign({}, DEFAULT_ACCOUNT, saved || {});
        } catch (err) {
            return Object.assign({}, DEFAULT_ACCOUNT);
        }
    }

    function saveAccount(account) {
        try {
            localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
            return true;
        } catch (err) {
            console.warn('Could not save account:', err);
            return false;
        }
    }

    function getSession() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
        } catch (err) {
            return null;
        }
    }

    function saveSession(session) {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (err) {
            console.warn('Could not save session:', err);
        }
    }

    function initials(name) {
        return String(name || 'LA').trim().split(/\s+/).slice(0, 2)
            .map((w) => w[0]).join('').toUpperCase() || 'LA';
    }

    function formatDateTime(iso) {
        const d = new Date(iso);
        if (!iso || isNaN(d)) return '-';
        return d.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    function showMessage(node, text, success = false) {
        node.textContent = text;
        node.classList.toggle('success-profile', success);
    }

    function refreshSidebar() {
        if (window.CLMAuth) window.CLMAuth.applySidebar();
    }

    function render() {
        const acc = getAccount();
        const session = getSession();
        const lastLogin = session ? formatDateTime(session.loggedInAt) : '-';

        el.displayName.textContent = acc.name;
        el.displayRole.textContent = acc.role;
        el.photoLastLogin.textContent = 'Last login: ' + lastLogin;
        el.sessionLastLogin.textContent = lastLogin;

        if (acc.photo) {
            el.avatar.textContent = '';
            el.avatar.style.backgroundImage = 'url("' + acc.photo + '")';
        } else {
            el.avatar.style.backgroundImage = '';
            el.avatar.textContent = initials(acc.name);
        }

        el.fullName.value = acc.name;
        el.username.value = acc.username;
        el.email.value = acc.email;
        el.contact.value = acc.contact;
        el.role.value = acc.role;

        refreshSidebar();
    }

    function resizeImage(file, max) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    const scale = Math.min(1, max / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    el.changePhotoBtn.addEventListener('click', () => el.photoInput.click());

    el.photoInput.addEventListener('change', () => {
        const file = el.photoInput.files[0];
        el.photoInput.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showMessage(el.photoMsg, 'Please choose an image file.');
            return;
        }

        resizeImage(file, 400)
            .then((dataUrl) => {
                const acc = getAccount();
                acc.photo = dataUrl;
                if (saveAccount(acc)) {
                    render();
                    showMessage(el.photoMsg, 'Photo updated.', true);
                } else {
                    showMessage(el.photoMsg, 'Could not save the photo.');
                }
            })
            .catch(() => showMessage(el.photoMsg, 'Could not read that image.'));
    });

    el.profileForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = el.fullName.value.trim();
        const username = el.username.value.trim();
        const email = el.email.value.trim();
        const contact = el.contact.value.trim();

        if (!name) {
            showMessage(el.infoMsg, 'Full name is required.');
            el.fullName.focus();
            return;
        }
        if (!username) {
            showMessage(el.infoMsg, 'Username is required.');
            el.username.focus();
            return;
        }
        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            showMessage(el.infoMsg, 'Please enter a valid email address.');
            el.email.focus();
            return;
        }
        if (contact && !/^[0-9+()\-\s]{7,20}$/.test(contact)) {
            showMessage(el.infoMsg, 'Please enter a valid contact number.');
            el.contact.focus();
            return;
        }

        const acc = getAccount();
        Object.assign(acc, { name, username, email, contact });

        if (!saveAccount(acc)) {
            showMessage(el.infoMsg, 'Could not save your changes.');
            return;
        }

        const session = getSession();
        if (session) {
            session.username = acc.username;
            session.name = acc.name;
            saveSession(session);
        }

        render();
        showMessage(el.infoMsg, 'Profile saved.', true);
    });

    el.passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const current = el.currentPassword.value;
        const next = el.newPassword.value;
        const confirm = el.confirmPassword.value;
        const acc = getAccount();

        if (!current || !next || !confirm) {
            showMessage(el.passwordMsg, 'Please fill in all password fields.');
            return;
        }
        if (current !== acc.password) {
            showMessage(el.passwordMsg, 'Current password is incorrect.');
            el.currentPassword.focus();
            return;
        }
        if (next.length < 8) {
            showMessage(el.passwordMsg, 'New password must be at least 8 characters.');
            el.newPassword.focus();
            return;
        }
        if (next === current) {
            showMessage(el.passwordMsg, 'New password must be different from the current one.');
            el.newPassword.focus();
            return;
        }
        if (next !== confirm) {
            showMessage(el.passwordMsg, 'New passwords do not match.');
            el.confirmPassword.focus();
            return;
        }

        acc.password = next;
        if (!saveAccount(acc)) {
            showMessage(el.passwordMsg, 'Could not update the password.');
            return;
        }

        el.passwordForm.reset();
        showMessage(el.passwordMsg, 'Password updated.', true);
    });

    el.logoutOthersBtn.addEventListener('click', () => {
        const session = getSession();
        if (!session) return;

        session.epoch = (session.epoch || 0) + 1;
        saveSession(session);
        sessionStorage.setItem(TAB_EPOCH_KEY, String(session.epoch));

        showMessage(el.sessionMsg, 'All other sessions were signed out.', true);
    });

    window.addEventListener('storage', (e) => {
        if (e.key === ACCOUNT_KEY || e.key === SESSION_KEY) render();
    });

    render();
})();