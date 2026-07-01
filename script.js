// --- KONFIGURASI APLIKASI ---
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/3135/3135679.png"; // Ganti URL ini dengan link logo Anda
document.getElementById('app-logo').src = LOGO_URL;

// --- REAL-TIME DATE & CLOCK ---
function updateClock() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const day = days[now.getDay()];
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const time = now.toLocaleTimeString('id-ID');
    document.getElementById('realtime-date').innerText = `${day}, ${d}-${m}-${y} | ${time}`;
}
setInterval(updateClock, 1000);
updateClock();

// --- DARK/LIGHT MODE TOGGLE ---
const themeBtn = document.getElementById('theme-toggle');
if(localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeBtn.innerText = '☀️';
}
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if(document.body.classList.contains('dark-mode')){
        localStorage.setItem('theme', 'dark');
        themeBtn.innerText = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        themeBtn.innerText = '🌙';
    }
});

// --- NAVIGASI BAWAH ---
function switchPage(pageId, btnElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    btnElement.classList.add('active');
    
    // Tampilkan FAB hanya di halaman terkait
    document.querySelectorAll('.fab').forEach(fab => fab.style.display = 'none');
    if(pageId === 'page-bon') document.querySelector('#page-bon .fab').style.display = 'flex';
    if(pageId === 'page-hutang') document.querySelector('#page-hutang .fab').style.display = 'flex';
}
// Sembunyikan FAB saat di Dashboard awal
document.querySelectorAll('.fab').forEach(fab => fab.style.display = 'none');

// --- FORMAT RUPIAH ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

// --- FORMAT TANGGAL DD/MM/YYYY ---
const formatTanggal = (tanggal) => {
    if (!tanggal) return '-';
    const [tahun, bulan, hari] = tanggal.split('-');
    return `${hari}/${bulan}/${tahun}`;
};

// --- SETUP INDEXEDDB MUTAKHIR ---
const dbName = "FinTrackDB";
let db;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('bon')) {
                db.createObjectStore('bon', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('hutang')) {
                db.createObjectStore('hutang', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- OPERASI DATABASE HELPER ---
const dbOp = {
    getAll: (storeName) => new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    }),
    put: (storeName, data) => new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(data);
        tx.oncomplete = () => resolve();
    }),
    delete: (storeName, id) => new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(id);
        tx.oncomplete = () => resolve();
    })
};

// --- MODAL CONTROLLER ---
const openModal = (id) => document.getElementById(id).classList.add('show');
const closeModal = (id) => {
    document.getElementById(id).classList.remove('show');
    if(id === 'modal-bon') document.getElementById('form-bon').reset();
    if(id === 'modal-hutang') document.getElementById('form-hutang').reset();
    if(id === 'modal-bayar') document.getElementById('form-bayar').reset();
};

// --- LOGIKA BON TOKO ---
document.getElementById('form-bon').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('bon-id').value;
    const total = parseInt(document.getElementById('bon-total').value);
    
    // Jika data baru, dibayar awal = 0
    let dibayar = 0; 
    
    if(idInput) { // Mode Edit, pertahankan nilai dibayar lama
        const existingData = (await dbOp.getAll('bon')).find(b => b.id === idInput);
        if(existingData) dibayar = existingData.dibayar;
    }

    let sisa = total - dibayar;
    if(sisa < 0) sisa = 0;
    
    let status = sisa === 0 ? 'Lunas' : (dibayar > 0 ? 'Cicil' : 'Belum Lunas');

    const data = {
        id: idInput ? idInput : Date.now().toString(),
        tanggal: document.getElementById('bon-tanggal').value,
        toko: document.getElementById('bon-toko').value,
        barang: document.getElementById('bon-barang').value,
        total: total,
        dibayar: dibayar,
        sisa: sisa,
        status: status
    };

    await dbOp.put('bon', data);
    closeModal('modal-bon');
    loadData();
});

// --- LOGIKA HUTANG/PIUTANG ---
document.getElementById('form-hutang').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('hp-id').value;
    const total = parseInt(document.getElementById('hp-total').value);
    
    let dibayar = 0;
    if(idInput) { 
        const existingData = (await dbOp.getAll('hutang')).find(h => h.id === idInput);
        if(existingData) dibayar = existingData.dibayar;
    }

    let sisa = total - dibayar;
    if(sisa < 0) sisa = 0;
    
    let status = sisa === 0 ? 'Lunas' : (dibayar > 0 ? 'Cicil' : 'Belum Lunas');

    const data = {
        id: idInput ? idInput : Date.now().toString(),
        tanggal: document.getElementById('hp-tanggal').value,
        jenis: document.getElementById('hp-jenis').value,
        pihak: document.getElementById('hp-pihak').value,
        ket: document.getElementById('hp-ket').value,
        total: total,
        dibayar: dibayar,
        sisa: sisa,
        status: status
    };

    await dbOp.put('hutang', data);
    closeModal('modal-hutang');
    loadData();
});

// --- LOGIKA PEMBAYARAN / CICILAN ---
function triggerBayar(table, id, sisa_saat_ini) {
    document.getElementById('bayar-table').value = table;
    document.getElementById('bayar-id').value = id;
    document.getElementById('bayar-sisa-label').innerText = formatRupiah(sisa_saat_ini);
    document.getElementById('bayar-jumlah').max = sisa_saat_ini; // Tidak bisa bayar lebih dari sisa
    openModal('modal-bayar');
}

document.getElementById('form-bayar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const table = document.getElementById('bayar-table').value;
    const id = document.getElementById('bayar-id').value;
    const jmlBayar = parseInt(document.getElementById('bayar-jumlah').value);

    const allData = await dbOp.getAll(table);
    const item = allData.find(d => d.id === id);

    if(item) {
        item.dibayar += jmlBayar;
        item.sisa = item.total - item.dibayar;
        if(item.sisa <= 0) {
            item.sisa = 0;
            item.status = 'Lunas';
        } else {
            item.status = 'Cicil';
        }
        await dbOp.put(table, item);
        closeModal('modal-bayar');
        loadData();
    }
});

// --- FUNGSI EDIT & HAPUS ---
async function editData(table, id) {
    const allData = await dbOp.getAll(table);
    const item = allData.find(d => d.id === id);
    if(!item) return;

    if(table === 'bon') {
        document.getElementById('bon-id').value = item.id;
        document.getElementById('bon-tanggal').value = item.tanggal;
        document.getElementById('bon-toko').value = item.toko;
        document.getElementById('bon-barang').value = item.barang;
        document.getElementById('bon-total').value = item.total;
        document.getElementById('modal-bon-title').innerText = "Edit Bon Toko";
        openModal('modal-bon');
    } else {
        document.getElementById('hp-id').value = item.id;
        document.getElementById('hp-tanggal').value = item.tanggal;
        document.getElementById('hp-jenis').value = item.jenis;
        document.getElementById('hp-pihak').value = item.pihak;
        document.getElementById('hp-ket').value = item.ket;
        document.getElementById('hp-total').value = item.total;
        document.getElementById('modal-hutang-title').innerText = "Edit Hutang/Piutang";
        openModal('modal-hutang');
    }
}

async function deleteData(table, id) {
    if(confirm("Apakah Anda yakin ingin menghapus data ini secara permanen?")) {
        await dbOp.delete(table, id);
        loadData();
    }
}

// --- FUNGSI RENDER KE LAYAR ---
function getStatusBadge(status) {
    let cls = status === 'Lunas' ? 'lunas' : (status === 'Cicil' ? 'cicil' : 'belum');
    return `<span class="badge ${cls}">${status}</span>`;
}

async function loadData() {
    const dataBon = await dbOp.getAll('bon');
    const dataHp = await dbOp.getAll('hutang');

    // --- Render Tabel Bon ---
    const tbodyBon = document.getElementById('tbody-bon');
    tbodyBon.innerHTML = '';
    let sumBonTotal = 0, sumBonSisa = 0;

    dataBon.forEach((d, index) => {
        sumBonTotal += d.total; sumBonSisa += d.sisa;
        let btnBayar = d.status !== 'Lunas' ? `<button class="btn-action btn-pay" onclick="triggerBayar('bon', '${d.id}', ${d.sisa})">💰 Bayar</button>` : '';
        tbodyBon.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatTanggal(d.tanggal)}</td>
                <td>${d.toko}</td>
                <td>${d.barang}</td>
                <td>${formatRupiah(d.total)}</td>
                <td>${formatRupiah(d.dibayar)}</td>
                <td>${formatRupiah(d.sisa)}</td>
                <td>${getStatusBadge(d.status)}</td>
                <td>
                    ${btnBayar}
                    <button class="btn-action btn-edit" onclick="editData('bon', '${d.id}')">✏️ Edit</button>
                    <button class="btn-action btn-del" onclick="deleteData('bon', '${d.id}')">🗑️ Hapus</button>
                </td>
            </tr>
        `;
    });

    // --- Render Tabel Hutang / Piutang ---
    const tbodyHp = document.getElementById('tbody-hutang');
    tbodyHp.innerHTML = '';
    let sumHutangTotal = 0, sumHutangSisa = 0, sumPiutangTotal = 0, sumPiutangSisa = 0;

    dataHp.forEach((d, index) => {
        if(d.jenis === 'Hutang') { sumHutangTotal += d.total; sumHutangSisa += d.sisa; }
        else { sumPiutangTotal += d.total; sumPiutangSisa += d.sisa; }
        
        let typeCls = d.jenis === 'Hutang' ? 'type-hutang' : 'type-piutang';
        let btnBayar = d.status !== 'Lunas' ? `<button class="btn-action btn-pay" onclick="triggerBayar('hutang', '${d.id}', ${d.sisa})">💰 ${d.jenis==='Hutang'?'Bayar':'Tagih'}</button>` : '';
        
        tbodyHp.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatTanggal(d.tanggal)}</td>
                <td><span class="badge ${typeCls}">${d.jenis}</span></td>
                <td>${d.pihak}</td>
                <td>${d.ket}</td>
                <td>${formatRupiah(d.total)}</td>
                <td>${formatRupiah(d.dibayar)}</td>
                <td>${formatRupiah(d.sisa)}</td>
                <td>${getStatusBadge(d.status)}</td>
                <td>
                    ${btnBayar}
                    <button class="btn-action btn-edit" onclick="editData('hutang', '${d.id}')">✏️ Edit</button>
                    <button class="btn-action btn-del" onclick="deleteData('hutang', '${d.id}')">🗑️ Hapus</button>
                </td>
            </tr>
        `;
    });

    // --- Update Dashboard Summary ---
    document.getElementById('dash-bon-total').innerText = formatRupiah(sumBonTotal);
    document.getElementById('dash-bon-sisa').innerText = formatRupiah(sumBonSisa);
    
    document.getElementById('dash-hutang-total').innerText = formatRupiah(sumHutangTotal);
    document.getElementById('dash-hutang-sisa').innerText = formatRupiah(sumHutangSisa);
    
    document.getElementById('dash-piutang-total').innerText = formatRupiah(sumPiutangTotal);
    document.getElementById('dash-piutang-sisa').innerText = formatRupiah(sumPiutangSisa);
}

// Inisialisasi Database dan Data Pertama Kali
window.onload = async () => {
    await initDB();
    loadData();
};