(() => {
    'use strict';

    const STORAGE_KEY = 'clm_computers';
    const DATA_URL = 'computers.json';

    const LABS = ['Laboratory 401', 'Laboratory 402', 'Laboratory 403', 
        'Laboratory 404', 'Laboratory 405', 'Laboratory 406', 
        'Laboratory 407', 'Laboratory 408', 'Laboratory 409'];
    const STATUSES = ['Available', 'In Use', 'Under Maintenance', 'Defective'];
    const STATUS_CLASS = {
        'Available': 'status-available-computers',
        'In Use': 'status-in-use-computers',
        'Under Maintenance': 'status-maintenance-computers',
        'Defective': 'status-defective-computers'
    };

    const $ = (id) => document.getElementById(id);

    const el = {
        openBtn: $('openAddModalBtn-computers'),
        search: $('searchInput-computers'),
        labFilter: $('labFilter-computers'),
        statusFilter: $('statusFilter-computers'),
        ramFilter: $('ramFilter-computers'),
        tbody: $('computersTableBody-computers'),
        count: $('recordCount-computers'),
        headers: document.querySelectorAll('[data-sort]'),
        modal: $('computerModal-computers'),
        modalTitle: $('modalTitle-computers'),
        form: $('computerForm-computers'),
        cancel: $('cancelBtn-computers'),
        submit: $('submitBtn-computers'),
        f: {
            pcNumber: $('pcNumber-computers'),
            laboratory: $('laboratory-computers'),
            status: $('status-computers'),
            assignedTo: $('assignedTo-computers'),
            processor: $('processor-computers'),
            ram: $('ram-computers'),
            storage: $('storage-computers'),
            keyboard: $('keyboard-computers'),
            mouse: $('mouse-computers')
        }
    };

    let computers = [];
    let sortKey = 'pcNumber';
    let sortDir = 1;
    let editingId = null;


    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fillSelect(select, options, firstLabel) {
        select.innerHTML = '';
        if (firstLabel) {
            select.add(new Option(firstLabel, ''));
        }
        options.forEach((o) => select.add(new Option(o, o)));
    }

    function nextId() {
        return computers.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
    }

    function nextPcNumber() {
        const nums = computers
            .map((c) => parseInt((String(c.pcNumber).match(/(\d+)\s*$/) || [])[1], 10))
            .filter(Number.isFinite);
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return 'PC - ' + String(next).padStart(2, '0');
    }


    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(STORAGE_KEY) : null;

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(computers));
            if (channel) channel.postMessage('updated');
        } catch (err) {
            console.warn('Could not save to localStorage:', err);
        }
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


    function buildRamFilter() {
        const current = el.ramFilter.value;
        const rams = [...new Set(computers.map((c) => c.ram).filter(Boolean))]
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        fillSelect(el.ramFilter, rams, 'All RAM sizes');
        el.ramFilter.value = rams.includes(current) ? current : '';
    }

    function getVisible() {
        const q = el.search.value.trim().toLowerCase();
        const lab = el.labFilter.value;
        const st = el.statusFilter.value;
        const ram = el.ramFilter.value;

        return computers
            .filter((c) => {
                if (lab && c.laboratory !== lab) return false;
                if (st && c.status !== st) return false;
                if (ram && c.ram !== ram) return false;
                if (!q) return true;
                return [c.pcNumber, c.laboratory, c.status, c.assignedTo,
                        c.processor, c.ram, c.storage, c.keyboard, c.mouse]
                    .join(' ').toLowerCase().includes(q);
            })
            .sort((a, b) =>
                String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''),
                    undefined, { numeric: true, sensitivity: 'base' }) * sortDir
            );
    }


    function render() {
        const rows = getVisible();

        if (!rows.length) {
            el.tbody.innerHTML = '<tr><td colspan="8">No computers found.</td></tr>';
        } else {
            el.tbody.innerHTML = rows.map((c) => `
                <tr>
                    <td>${esc(c.pcNumber)}</td>
                    <td>${esc(c.laboratory)}</td>
                    <td><span class="${STATUS_CLASS[c.status] || ''}">${esc(c.status)}</span></td>
                    <td>${esc(c.assignedTo) || '-'}</td>
                    <td>${esc(c.processor)}</td>
                    <td>${esc(c.ram)}</td>
                    <td>${esc(c.storage)}</td>
                    <td>
                        <button type="button" class="action-link-computers" data-action="edit" data-id="${c.id}">Edit</button>
                        <button type="button" class="action-link-computers" data-action="delete" data-id="${c.id}">Delete</button>
                    </td>
                </tr>`).join('');
        }

        el.count.textContent =
            `${rows.length} of ${computers.length} records. Click a column heading to sort.`;

        el.headers.forEach((th) => {
            th.classList.remove('sorted-asc-computers', 'sorted-desc-computers');
            if (th.dataset.sort === sortKey) {
                th.classList.add(sortDir === 1 ? 'sorted-asc-computers' : 'sorted-desc-computers');
            }
        });
    }

    function openModal(comp) {
        editingId = comp ? comp.id : null;

        const d = comp || {
            pcNumber: nextPcNumber(),
            laboratory: LABS[0],
            status: 'Available',
            assignedTo: '',
            processor: 'Intel Core i5-10400',
            ram: '16 GB',
            storage: '512 GB',
            keyboard: 'Standard USB',
            mouse: 'Optical USB'
        };

        el.modalTitle.textContent = comp ? 'Edit Computer' : 'Add Computer';
        el.submit.textContent = comp ? 'Save Changes' : 'Add Computer';

        Object.keys(el.f).forEach((key) => {
            el.f[key].value = d[key] ?? '';
        });

        el.modal.classList.remove('hidden-computers');
        el.f.pcNumber.focus();
    }

    function closeModal() {
        el.modal.classList.add('hidden-computers');
        editingId = null;
    }

    el.openBtn.addEventListener('click', () => openModal(null));
    el.cancel.addEventListener('click', closeModal);

    el.modal.addEventListener('click', (e) => {
        if (e.target === el.modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !el.modal.classList.contains('hidden-computers')) closeModal();
    });

    el.form.addEventListener('submit', (e) => {
        e.preventDefault();

        const record = {};
        Object.keys(el.f).forEach((key) => {
            record[key] = el.f[key].value.trim();
        });

        const duplicate = computers.some(
            (c) => c.pcNumber.toLowerCase() === record.pcNumber.toLowerCase() && c.id !== editingId
        );
        if (duplicate) {
            alert(record.pcNumber + ' already exists.');
            el.f.pcNumber.focus();
            return;
        }

        if (editingId !== null) {
            Object.assign(computers.find((c) => c.id === editingId), record);
        } else {
            computers.push({ id: nextId(), ...record });
        }

        saveData();
        buildRamFilter();
        render();
        closeModal();
    });

    el.tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const id = Number(btn.dataset.id);
        const comp = computers.find((c) => c.id === id);
        if (!comp) return;

        if (btn.dataset.action === 'edit') {
            openModal(comp);
        } else if (confirm('Delete ' + comp.pcNumber + '?')) {
            computers = computers.filter((c) => c.id !== id);
            saveData();
            buildRamFilter();
            render();
        }
    });

    el.headers.forEach((th) => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            sortDir = key === sortKey ? -sortDir : 1;
            sortKey = key;
            render();
        });
    });

    [el.search, el.labFilter, el.statusFilter, el.ramFilter].forEach((control) => {
        control.addEventListener('input', render);
    });


    fillSelect(el.labFilter, LABS, 'All Laboratories');
    fillSelect(el.statusFilter, STATUSES, 'All Status');
    fillSelect(el.f.laboratory, LABS);
    fillSelect(el.f.status, STATUSES);

    loadData()
        .then((data) => {
            computers = data;
            saveData(); 
            render();
        })
        .catch((err) => {
            console.error(err);
            el.tbody.innerHTML =
                '<tr><td colspan="8">Could not load computers.json. Open this page with Live Server.</td></tr>';
        });
})();