(() => {
    'use strict';

    const COMPUTERS_KEY = 'clm_computers';
    const COMPUTERS_URL = 'computers.json';
    const PROBLEMS_KEY = 'clm_problems';
    const PROBLEMS_URL = 'problems.json';

    const LABS = ['Laboratory 401', 'Laboratory 402', 'Laboratory 403', 
        'Laboratory 404', 'Laboratory 405', 'Laboratory 406', 
        'Laboratory 407', 'Laboratory 408', 'Laboratory 409'];
    const PROBLEM_TYPES = ['Hardware', 'Software', 'Network', 'Other'];
    const PROBLEM_STATUSES = ['Pending', 'In progress', 'Resolved'];
    const STATUS_CLASS = {
        'Pending': 'status-pending-maintenance',
        'In progress': 'status-in-progress-maintenance',
        'Resolved': 'status-resolved-maintenance'
    };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

    const computersChannel = 'BroadcastChannel' in window ? new BroadcastChannel(COMPUTERS_KEY) : null;
    const problemsChannel = 'BroadcastChannel' in window ? new BroadcastChannel(PROBLEMS_KEY) : null;

    const $ = (id) => document.getElementById(id);

    const el = {
        openBtn: $('openReportBtn-maintenance'),
        search: $('searchInput-maintenance'),
        labFilter: $('labFilter-maintenance'),
        statusFilter: $('statusFilter-maintenance'),
        tbody: $('problemsTableBody-maintenance'),
        modal: $('problemModal-maintenance'),
        modalTitle: $('modalTitle-maintenance'),
        form: $('problemForm-maintenance'),
        cancel: $('cancelBtn-maintenance'),
        submit: $('submitBtn-maintenance'),
        f: {
            laboratory: $('laboratory-maintenance'),
            computer: $('computer-maintenance'),
            problemType: $('problemType-maintenance'),
            description: $('description-maintenance'),
            reportedBy: $('reportedBy-maintenance'),
            day: $('day-maintenance'),
            month: $('month-maintenance'),
            year: $('year-maintenance')
        }
    };

    let computers = [];
    let problems = [];
    let editingId = null;


    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function fillSelect(select, options, firstLabel) {
        select.innerHTML = '';
        if (firstLabel) select.add(new Option(firstLabel, ''));
        options.forEach((o) => select.add(new Option(o, o)));
    }

    function nextId() {
        return problems.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
    }

    function formatDate(iso) {
        const [y, m, d] = String(iso || '').split('-').map(Number);
        if (!y || !m || !d) return iso || '-';
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function todayISO() {
        const t = new Date();
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    function readDate() {
        const d = el.f.day.value.trim();
        const m = el.f.month.value.trim();
        const y = el.f.year.value.trim();

        if (!d && !m && !y) return todayISO();

        const dn = Number(d), mn = Number(m), yn = Number(y);
        const date = new Date(yn, mn - 1, dn);
        const valid = y.length === 4 &&
            date.getFullYear() === yn && date.getMonth() === mn - 1 && date.getDate() === dn;

        return valid ? `${yn}-${pad(mn)}-${pad(dn)}` : null;
    }

    function getStatus() {
        const r = el.form.querySelector('input[name="problemStatus"]:checked');
        return r ? r.value : 'Pending';
    }

    function setStatus(value) {
        const r = el.form.querySelector(`input[name="problemStatus"][value="${value}"]`);
        if (r) r.checked = true;
    }


    async function loadList(key, url) {
        try {
            const saved = localStorage.getItem(key);
            if (saved) return JSON.parse(saved);
        } catch (err) {
            console.warn('Could not read localStorage:', err);
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    function saveProblems() {
        try {
            localStorage.setItem(PROBLEMS_KEY, JSON.stringify(problems));
            if (problemsChannel) problemsChannel.postMessage('updated');
        } catch (err) {
            console.warn('Could not save problems:', err);
        }
    }

    function saveComputers() {
        try {
            localStorage.setItem(COMPUTERS_KEY, JSON.stringify(computers));
            if (computersChannel) computersChannel.postMessage('updated');
        } catch (err) {
            console.warn('Could not save computers:', err);
        }
    }

    function readFreshComputers() {
        try {
            const saved = localStorage.getItem(COMPUTERS_KEY);
            if (saved) {
                const list = JSON.parse(saved);
                if (Array.isArray(list)) computers = list;
            }
        } catch (err) {
            console.warn('Could not read computers:', err);
        }
    }

    function computerStatusFromProblems(computerId) {
        const mine = problems.filter((p) => p.computerId === computerId);
        if (!mine.length) return null;
        if (mine.some((p) => p.status === 'In progress')) return 'Under Maintenance';
        if (mine.some((p) => p.status === 'Pending')) return 'Defective';
        return 'Available';
    }

    function syncComputerStatuses(ids) {
        readFreshComputers();
        let changed = false;

        [...new Set(ids)].forEach((id) => {
            const comp = computers.find((c) => c.id === id);
            const next = computerStatusFromProblems(id);
            if (comp && next && comp.status !== next) {
                comp.status = next;
                changed = true;
            }
        });

        if (changed) saveComputers();
    }


    function getVisible() {
        const q = el.search.value.trim().toLowerCase();
        const lab = el.labFilter.value;
        const st = el.statusFilter.value;

        return problems.filter((p) => {
            if (lab && p.laboratory !== lab) return false;
            if (st && p.status !== st) return false;
            if (!q) return true;
            return [p.laboratory, p.pcNumber, p.problemType, p.description,
                    p.reportedBy, formatDate(p.date), p.status]
                .join(' ').toLowerCase().includes(q);
        });
    }

    function render() {
        const rows = getVisible();

        if (!rows.length) {
            el.tbody.innerHTML = '<tr><td colspan="6">No problems found.</td></tr>';
            return;
        }

        el.tbody.innerHTML = rows.map((p) => `
            <tr>
                <td>${esc(p.laboratory)}/${esc(p.pcNumber)}</td>
                <td class="problem-cell-maintenance" title="${esc(p.description)}">${esc(p.description)}</td>
                <td>${esc(p.reportedBy)}</td>
                <td>${esc(formatDate(p.date))}</td>
                <td><span class="${STATUS_CLASS[p.status] || ''}">${esc(p.status)}</span></td>
                <td>
                    <button type="button" class="action-link-maintenance" data-action="update" data-id="${p.id}">Update</button>
                    <button type="button" class="action-link-maintenance" data-action="delete" data-id="${p.id}">Delete</button>
                </td>
            </tr>`).join('');
    }


    function populateComputers(lab, selectedId) {
        const list = computers
            .filter((c) => c.laboratory === lab)
            .sort((a, b) => String(a.pcNumber).localeCompare(String(b.pcNumber),
                undefined, { numeric: true, sensitivity: 'base' }));

        el.f.computer.innerHTML = '';

        if (!list.length) {
            el.f.computer.add(new Option('No computers in this lab', ''));
            el.f.computer.disabled = true;
            return;
        }

        el.f.computer.disabled = false;
        list.forEach((c) => el.f.computer.add(new Option(c.pcNumber, c.id)));
        if (selectedId != null) el.f.computer.value = String(selectedId);
    }

    function openModal(problem) {
        readFreshComputers();
        editingId = problem ? problem.id : null;

        const firstLabWithPcs = LABS.find((l) => computers.some((c) => c.laboratory === l)) || LABS[0];
        const lab = problem ? problem.laboratory : firstLabWithPcs;

        if (![...el.f.laboratory.options].some((o) => o.value === lab)) {
            el.f.laboratory.add(new Option(lab, lab));
        }
        el.f.laboratory.value = lab;
        populateComputers(lab, problem ? problem.computerId : null);

        el.f.problemType.value = problem ? problem.problemType : PROBLEM_TYPES[0];
        setStatus(problem ? problem.status : 'Pending');
        el.f.description.value = problem ? problem.description : '';
        el.f.reportedBy.value = problem ? problem.reportedBy : '';

        const [y, m, d] = problem ? String(problem.date).split('-') : ['', '', ''];
        el.f.day.value = d || '';
        el.f.month.value = m || '';
        el.f.year.value = y || '';

        el.modalTitle.textContent = problem ? 'Update Problem' : 'Report a Problem';
        el.submit.textContent = problem ? 'Save Changes' : 'Submit Problem';

        el.modal.classList.remove('hidden-maintenance');
        el.f.description.focus();
    }

    function closeModal() {
        el.modal.classList.add('hidden-maintenance');
        editingId = null;
    }


    el.openBtn.addEventListener('click', () => openModal(null));
    el.cancel.addEventListener('click', closeModal);

    el.modal.addEventListener('click', (e) => {
        if (e.target === el.modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !el.modal.classList.contains('hidden-maintenance')) closeModal();
    });

    el.f.laboratory.addEventListener('change', () => {
        populateComputers(el.f.laboratory.value);
    });

    el.form.addEventListener('submit', (e) => {
        e.preventDefault();

        const comp = computers.find((c) => c.id === Number(el.f.computer.value));
        if (!comp) {
            alert('Please choose a computer.');
            return;
        }

        const date = readDate();
        if (!date) {
            alert('Please enter a valid date (DD / MM / YYYY).');
            el.f.day.focus();
            return;
        }

        const record = {
            laboratory: comp.laboratory,
            computerId: comp.id,
            pcNumber: comp.pcNumber,
            problemType: el.f.problemType.value,
            description: el.f.description.value.trim(),
            reportedBy: el.f.reportedBy.value.trim(),
            date,
            status: getStatus()
        };

        const affected = [comp.id];

        if (editingId !== null) {
            const existing = problems.find((p) => p.id === editingId);
            affected.push(existing.computerId);
            Object.assign(existing, record);
        } else {
            problems.push({ id: nextId(), ...record });
        }

        saveProblems();
        syncComputerStatuses(affected);
        render();
        closeModal();
    });

    el.tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const id = Number(btn.dataset.id);
        const problem = problems.find((p) => p.id === id);
        if (!problem) return;

        if (btn.dataset.action === 'update') {
            openModal(problem);
        } else if (confirm('Delete this problem report?')) {
            problems = problems.filter((p) => p.id !== id);
            saveProblems();
            syncComputerStatuses([problem.computerId]);
            render();
        }
    });

    [el.search, el.labFilter, el.statusFilter].forEach((control) => {
        control.addEventListener('input', render);
    });

    fillSelect(el.labFilter, LABS, 'All Laboratories');
    fillSelect(el.statusFilter, PROBLEM_STATUSES, 'All Status');
    fillSelect(el.f.laboratory, LABS);
    fillSelect(el.f.problemType, PROBLEM_TYPES);

    Promise.all([
        loadList(COMPUTERS_KEY, COMPUTERS_URL),
        loadList(PROBLEMS_KEY, PROBLEMS_URL)
    ])
        .then(([computerList, problemList]) => {
            computers = computerList;
            problems = problemList;
            saveProblems();
            render();
        })
        .catch((err) => {
            console.error(err);
            el.tbody.innerHTML =
                '<tr><td colspan="6">Could not load the data files. Open this page with Live Server.</td></tr>';
        });
})();