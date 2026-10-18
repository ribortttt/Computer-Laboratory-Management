(() => {
    'use strict';

    const STORAGE_KEY = 'clm_computers';
    const DATA_URL = 'computers.json';
    const DEFAULT_LABS = ['Laboratory 401', 'Laboratory 402', 'Laboratory 403', 
        'Laboratory 404', 'Laboratory 405', 'Laboratory 406', 'Laboratory 407', 
        'Laboratory 408', 'Laboratory 409'];

    const $ = (id) => document.getElementById(id);

    const el = {
        total: $('totalComputers-dashboard'),
        inUse: $('inUseComputers-dashboard'),
        available: $('availableComputers-dashboard'),
        maintenance: $('maintenanceComputers-dashboard'),
        defective: $('defectiveComputers-dashboard'),
        labTable: $('laboratoryTable-dashboard')
    };

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (err) {
            console.warn('Could not read localStorage:', err);
        }

        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    function countStatuses(list) {
        const c = { total: list.length, available: 0, inUse: 0, maintenance: 0, defective: 0 };

        list.forEach((pc) => {
            switch (pc.status) {
                case 'Available': c.available++; break;
                case 'In Use': c.inUse++; break;
                case 'Under Maintenance': c.maintenance++; break;
                case 'Defective': c.defective++; break;
            }
        });

        return c;
    }

    function percent(part, total) {
        return total ? (part / total) * 100 : 0;
    }

    function statusBar(c) {
        const segments = [
            ['status-available-dashboard', 'Available', c.available],
            ['status-in-use-dashboard', 'In use', c.inUse],
            ['status-maintenance-dashboard', 'Maintenance', c.maintenance],
            ['status-defective-dashboard', 'Defective', c.defective]
        ];

        const spans = segments
            .filter(([, , n]) => n > 0)
            .map(([cls, label, n]) =>
                `<span class="${cls}" style="width:${percent(n, c.total)}%" title="${label}: ${n}"></span>`)
            .join('');

        return `<div class="status-bar-dashboard">${spans}</div>`;
    }

    function render(computers) {
        const all = countStatuses(computers);
        el.total.textContent = all.total;
        el.inUse.textContent = all.inUse;
        el.available.textContent = all.available;
        el.maintenance.textContent = all.maintenance;
        el.defective.textContent = all.defective;

        const labs = [...new Set([...DEFAULT_LABS, ...computers.map((pc) => pc.laboratory).filter(Boolean)])]
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        el.labTable.innerHTML = labs.map((lab) => {
            const c = countStatuses(computers.filter((pc) => pc.laboratory === lab));
            return `
                <tr>
                    <td>${esc(lab)}</td>
                    <td>${c.total}</td>
                    <td>${c.available}</td>
                    <td>${c.inUse}</td>
                    <td>${c.maintenance}</td>
                    <td>${c.defective}</td>
                    <td>${statusBar(c)}</td>
                </tr>`;
        }).join('');
    }

    function refresh() {
        loadData()
            .then(render)
            .catch((err) => {
                console.error(err);
                el.labTable.innerHTML =
                    '<tr><td colspan="7">Could not load computers.json. Open this page with Live Server.</td></tr>';
            });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY || e.key === null) refresh();
    });

    if ('BroadcastChannel' in window) {
        new BroadcastChannel(STORAGE_KEY).addEventListener('message', refresh);
    }

    window.addEventListener('pageshow', (e) => {
        if (e.persisted) refresh();
    });
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh();
    });

    refresh();
})();