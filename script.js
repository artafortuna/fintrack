// --- KONFIGURASI APLIKASI ---
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/3135/3135679.png";
document.getElementById('app-logo').src = LOGO_URL;

// --- JAM & TEMA ---
function updateClock() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    document.getElementById('realtime-date').innerText = `${days[now.getDay()]}, ${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} | ${now.toLocaleTimeString('id-ID')}`;
}
setInterval(updateClock, 1000); updateClock();

const themeBtn = document.getElementById('theme-toggle');
if(localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); themeBtn.innerText = '☀️'; }
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    themeBtn.innerText = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});

// --- HELPER FORMAT ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatTanggal = (tanggal) => {
    if (!tanggal) return '-';
    const [tahun, bulan, hari] = tanggal.split('-');
    return `${hari}/${bulan}/${tahun}`;
};
const getDaysDiff = (targetDateStr) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(targetDateStr); target.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// --- NAVIGASI BAWAH ---
function switchPage(pageId, btnElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    btnElement.classList.add('active');
    
    // Tampilkan FAB hanya di halaman tabel
    document.querySelectorAll('.fab').forEach(fab => fab.style.display = 'none');
    if(pageId === 'page-bon') document.querySelector('#page-bon .fab').style.display = 'flex';
    if(pageId === 'page-hutang') document.querySelector('#page-hutang .fab').style.display = 'flex';
    if(pageId === 'page-tagihan') document.querySelector('#page-tagihan .fab').style.display = 'flex';
}
document.querySelectorAll('.fab').forEach(fab => fab.style.display = 'none');

// --- DATABASE (IndexedDB VERSI 2) ---
const dbName = "FinTrackDB"; let db;
const initDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2); 
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('bon')) db.createObjectStore('bon', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('hutang')) db.createObjectStore('hutang', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tagihan')) db.createObjectStore('tagihan', { keyPath: 'id' });
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(); };
    request.onerror = (e) => reject(e.target.error);
});
const dbOp = {
    getAll: (store) => new Promise(res => { const req = db.transaction(store, 'readonly').objectStore(store).getAll(); req.onsuccess = () => res(req.result || []); }),
    put: (store, data) => new Promise(res => { const tx = db.transaction(store, 'readwrite').objectStore(store).put(data); tx.onsuccess = () => res(); }),
    delete: (store, id) => new Promise(res => { const tx = db.transaction(store, 'readwrite').objectStore(store).delete(id); tx.onsuccess = () => res(); })
};

// --- MODAL CONTROLLER ---
const openModal = (id) => document.getElementById(id).classList.add('show');
const closeModal = (id) => { 
    document.getElementById(id).classList.remove('show'); 
    const form = document.getElementById('form-' + id.split('-')[1]);
    if (form) form.reset(); 
    
    if (id === 'modal-bon') {
        document.getElementById('bon-id').value = '';
        document.getElementById('modal-bon-title').innerText = 'Tambah Bon';
    } else if (id === 'modal-hutang') {
        document.getElementById('hp-id').value = '';
        document.getElementById('modal-hutang-title').innerText = 'Tambah Hutang/Piutang';
    } else if (id === 'modal-tagihan') {
        document.getElementById('tagihan-id').value = '';
        document.getElementById('modal-tagihan-title').innerText = 'Tambah Tagihan';
    } else if (id === 'modal-bayar') {
        document.getElementById('bayar-id').value = '';
        document.getElementById('bayar-table').value = '';
    }
};

// --- CUSTOM CONFIRM POPUP ---
let confirmActionCallback = null;
function showCustomConfirm(message, callback) {
    document.getElementById('confirm-msg').innerText = message;
    confirmActionCallback = callback;
    openModal('modal-confirm');
}
function executeConfirm() {
    if (confirmActionCallback) confirmActionCallback();
    closeModal('modal-confirm');
}

// --- SUBMIT FORM DATA ---
const handleFormSubmit = async (e, table, prefix) => {
    e.preventDefault();
    const idInput = document.getElementById(`${prefix}-id`).value;
    const total = parseInt(document.getElementById(`${prefix}-total`).value);
    let dibayar = 0;

    if(idInput) { 
        const existing = (await dbOp.getAll(table)).find(x => x.id === idInput);
        if(existing) dibayar = existing.dibayar;
    }
    let sisa = Math.max(0, total - dibayar);
    let status = sisa === 0 ? 'Lunas' : (dibayar > 0 ? 'Cicil' : 'Belum Lunas');

    let data = { id: idInput || Date.now().toString(), total, dibayar, sisa, status };

    if(table === 'bon') {
        data.tanggal = document.getElementById('bon-tanggal').value;
        data.toko = document.getElementById('bon-toko').value;
        data.barang = document.getElementById('bon-barang').value;
    } else if(table === 'hutang') {
        data.tanggal = document.getElementById('hp-tanggal').value;
        data.jenis = document.getElementById('hp-jenis').value;
        data.pihak = document.getElementById('hp-pihak').value;
        data.ket = document.getElementById('hp-ket').value;
    } else if(table === 'tagihan') {
        data.tanggal = document.getElementById('tagihan-tanggal').value;
        data.pihak = document.getElementById('tagihan-pihak').value; 
        data.nama = document.getElementById('tagihan-nama').value;
    }

    await dbOp.put(table, data); closeModal(`modal-${table === 'hutang' ? 'hutang' : table}`); loadData();
};
document.getElementById('form-bon').addEventListener('submit', e => handleFormSubmit(e, 'bon', 'bon'));
document.getElementById('form-hutang').addEventListener('submit', e => handleFormSubmit(e, 'hutang', 'hp'));
document.getElementById('form-tagihan').addEventListener('submit', e => handleFormSubmit(e, 'tagihan', 'tagihan'));

// --- PEMBAYARAN ---
function triggerBayar(table, id, sisa_saat_ini) {
    document.getElementById('bayar-table').value = table;
    document.getElementById('bayar-id').value = id;
    document.getElementById('bayar-sisa-label').innerText = formatRupiah(sisa_saat_ini);
    document.getElementById('bayar-jumlah').max = sisa_saat_ini; 
    openModal('modal-bayar');
}
document.getElementById('form-bayar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const table = document.getElementById('bayar-table').value;
    const item = (await dbOp.getAll(table)).find(d => d.id === document.getElementById('bayar-id').value);
    if(item) {
        item.dibayar += parseInt(document.getElementById('bayar-jumlah').value);
        item.sisa = Math.max(0, item.total - item.dibayar);
        item.status = item.sisa === 0 ? 'Lunas' : 'Cicil';
        await dbOp.put(table, item); closeModal('modal-bayar'); loadData();
    }
});

// --- EDIT & HAPUS (DENGAN CUSTOM CONFIRM) ---
async function editData(table, id) {
    const item = (await dbOp.getAll(table)).find(d => d.id === id); if(!item) return;
    if(table === 'bon') {
        ['id', 'tanggal', 'toko', 'barang', 'total'].forEach(k => document.getElementById(`bon-${k}`).value = item[k]);
        document.getElementById('modal-bon-title').innerText = "Edit Bon"; openModal('modal-bon');
    } else if(table === 'hutang') {
        ['id', 'tanggal', 'jenis', 'pihak', 'ket', 'total'].forEach(k => document.getElementById(`hp-${k}`).value = item[k]);
        document.getElementById('modal-hutang-title').innerText = "Edit Hutang/Piutang"; openModal('modal-hutang');
    } else if(table === 'tagihan') {
        ['id', 'tanggal', 'pihak', 'nama', 'total'].forEach(k => document.getElementById(`tagihan-${k}`).value = item[k]);
        document.getElementById('modal-tagihan-title').innerText = "Edit Tagihan"; openModal('modal-tagihan');
    }
}

function deleteData(table, id) { 
    // Menggunakan UI Konfirmasi Custom Bawaan Aplikasi
    showCustomConfirm("Menghapus data ini tidak dapat dibatalkan. Apakah Anda yakin ingin melanjutkan?", async () => {
        await dbOp.delete(table, id); 
        loadData();
    });
}

// --- DASHBOARD FILTER (CARI NAMA) ---
async function filterDashboard() {
    const query = document.getElementById('search-name').value.toLowerCase();
    const [dataBon, dataHp, dataTagihan] = await Promise.all([dbOp.getAll('bon'), dbOp.getAll('hutang'), dbOp.getAll('tagihan')]);
    
    let sums = { bon:0, bonSisa:0, htg:0, htgSisa:0, ptg:0, ptgSisa:0, tag:0, tagSisa:0 };

    dataBon.forEach(d => { if (d.toko.toLowerCase().includes(query)) { sums.bon += d.total; sums.bonSisa += d.sisa; } });
    dataHp.forEach(d => {
        if (d.pihak.toLowerCase().includes(query)) {
            if(d.jenis === 'Hutang') { sums.htg += d.total; sums.htgSisa += d.sisa; }
            else { sums.ptg += d.total; sums.ptgSisa += d.sisa; }
        }
    });
    dataTagihan.forEach(d => {
        if ((d.pihak && d.pihak.toLowerCase().includes(query)) || (d.nama && d.nama.toLowerCase().includes(query))) {
            sums.tag += d.total; sums.tagSisa += d.sisa;
        }
    });

    document.getElementById('dash-bon-total').innerText = formatRupiah(sums.bon); document.getElementById('dash-bon-sisa').innerText = formatRupiah(sums.bonSisa);
    document.getElementById('dash-hutang-total').innerText = formatRupiah(sums.htg); document.getElementById('dash-hutang-sisa').innerText = formatRupiah(sums.htgSisa);
    document.getElementById('dash-piutang-total').innerText = formatRupiah(sums.ptg); document.getElementById('dash-piutang-sisa').innerText = formatRupiah(sums.ptgSisa);
    document.getElementById('dash-tagihan-total').innerText = formatRupiah(sums.tag); document.getElementById('dash-tagihan-sisa').innerText = formatRupiah(sums.tagSisa);
}

// --- RENDER DATA & SMART ALERT TAGIHAN ---
const getStatusBadge = (s) => `<span class="badge ${s==='Lunas'?'lunas':(s==='Cicil'?'cicil':'belum')}">${s}</span>`;

async function loadData() {
    const [dataBon, dataHp, dataTagihan] = await Promise.all([dbOp.getAll('bon'), dbOp.getAll('hutang'), dbOp.getAll('tagihan')]);

    // Render Tabel Bon
    document.getElementById('tbody-bon').innerHTML = dataBon.map((d, i) => `
        <tr><td>${i + 1}</td><td>${formatTanggal(d.tanggal)}</td><td>${d.toko}</td><td>${d.barang}</td>
        <td>${formatRupiah(d.total)}</td><td>${formatRupiah(d.dibayar)}</td><td>${formatRupiah(d.sisa)}</td><td>${getStatusBadge(d.status)}</td>
        <td>${d.status !== 'Lunas' ? `<button class="btn-action btn-pay" onclick="triggerBayar('bon','${d.id}',${d.sisa})">💰</button>` : ''}
        <button class="btn-action btn-edit" onclick="editData('bon','${d.id}')">✏️</button> <button class="btn-action btn-del" onclick="deleteData('bon','${d.id}')">🗑️</button></td></tr>
    `).join('');

    // Render Tabel Hutang
    document.getElementById('tbody-hutang').innerHTML = dataHp.map((d, i) => `
        <tr><td>${i + 1}</td><td>${formatTanggal(d.tanggal)}</td><td><span class="badge ${d.jenis==='Hutang'?'type-hutang':'type-piutang'}">${d.jenis}</span></td>
        <td>${d.pihak}</td><td>${d.ket}</td><td>${formatRupiah(d.total)}</td><td>${formatRupiah(d.dibayar)}</td><td>${formatRupiah(d.sisa)}</td><td>${getStatusBadge(d.status)}</td>
        <td>${d.status !== 'Lunas' ? `<button class="btn-action btn-pay" onclick="triggerBayar('hutang','${d.id}',${d.sisa})">💰</button>` : ''}
        <button class="btn-action btn-edit" onclick="editData('hutang','${d.id}')">✏️</button> <button class="btn-action btn-del" onclick="deleteData('hutang','${d.id}')">🗑️</button></td></tr>
    `).join('');

    // Render Tabel Tagihan
    document.getElementById('tbody-tagihan').innerHTML = dataTagihan.map((d, i) => `
        <tr><td>${i + 1}</td><td>${formatTanggal(d.tanggal)}</td><td>${d.pihak || '-'}</td><td>${d.nama}</td>
        <td>${formatRupiah(d.total)}</td><td>${formatRupiah(d.dibayar)}</td><td>${formatRupiah(d.sisa)}</td><td>${getStatusBadge(d.status)}</td>
        <td>${d.status !== 'Lunas' ? `<button class="btn-action btn-pay" onclick="triggerBayar('tagihan','${d.id}',${d.sisa})">💰</button>` : ''}
        <button class="btn-action btn-edit" onclick="editData('tagihan','${d.id}')">✏️</button> <button class="btn-action btn-del" onclick="deleteData('tagihan','${d.id}')">🗑️</button></td></tr>
    `).join('');

    // Logika Tagihan Terdekat (Smart Alert)
    const card = document.getElementById('upcoming-bill-card');
    const pendingBills = dataTagihan.filter(t => t.status !== 'Lunas').sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    
    if (pendingBills.length === 0) {
        card.className = "card tagihan-card"; card.innerHTML = `<p style="text-align:center; color:var(--text-muted);">🎉 Asyik! Tidak ada tagihan yang menunggak.</p>`;
    } else {
        const closest = pendingBills[0]; const days = getDaysDiff(closest.tanggal);
        let alertClass = days <= 0 ? "status-critical" : (days <= 3 ? "status-danger" : (days <= 7 ? "status-warning" : "status-safe"));
        let statusText = days < 0 ? `Telah Lewat ${Math.abs(days)} Hari!` : (days === 0 ? "Jatuh Tempo Hari Ini!" : `Jatuh Tempo H-${days}`);
        
        card.className = `card tagihan-card ${alertClass}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">${closest.nama} (${closest.pihak || '-'})</h4>
                <span class="badge" style="background:rgba(255,255,255,0.7); color:#333; border: 1px solid var(--border);">${formatTanggal(closest.tanggal)}</span>
            </div>
            <p class="amount" style="margin:0; font-size:1.4rem; color:var(--text-main);">${formatRupiah(closest.sisa)}</p>
            <small style="display:block; margin-top:8px; font-weight:600; color:var(--text-main);">⚠️ ${statusText}</small>
        `;
    }
    
    filterDashboard(); 
}

window.onload = async () => { await initDB(); loadData(); };
