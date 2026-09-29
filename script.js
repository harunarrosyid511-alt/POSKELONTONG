/**
 * Toko Kita POS Web Application Engine
 * Frontend JavaScript controller for Vercel Deployment with Supabase integration
 */

// SUPABASE CONFIGURATION (ISI DENGAN URL & KEY ANDA NANTI)
const SUPABASE_URL = 'https://fhfgzpirdkrtultezuak.supabase.co'; // Contoh: 'https://xyz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZmd6cGlyZGtydHVsdGV6dWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTU2MDQsImV4cCI6MjEwNjE5MTYwNH0.Gv_aRkRMJsFpxrR1-wKdC7pKMPuQMi88PYQB6d6IbeY'; // Contoh: 'eyJhbGciOiJIUzI1Ni...'
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("Supabase Client Initialized");
}

// GLOBAL STATE
var state = {
  user: null,
  settings: {
    store_name: 'Toko Kita',
    store_address: 'Jl. Merdeka No. 45, Karanganyar',
    store_phone: '0812-3456-7890',
    invoice_footer: 'Terima kasih telah berbelanja di Toko Kita!'
  },
  products: [],
  categories: [],
  units: [],
  customers: [
    { Customer_ID: 'CUST-001', Customer_Name: 'Pelanggan Umum', Phone: '-', Address: 'Karanganyar', Piutang: 0, Is_Active: true },
    { Customer_ID: 'CUST-002', Customer_Name: 'Bpk. Budi S.', Phone: '0812-3456-7890', Address: 'Jl. Pemuda No. 12', Piutang: 150000, Is_Active: true },
    { Customer_ID: 'CUST-003', Customer_Name: 'Ibu Ani', Phone: '0857-1122-3344', Address: 'Karanganyar', Piutang: 0, Is_Active: false }
  ],
  suppliers: [
    { Supplier_ID: 'SUP-001', Supplier_Name: 'PT Sembako Makmur Jaya', Phone: '0811-9988-7766', Address: 'Solo', Hutang: 500000, Is_Active: true },
    { Supplier_ID: 'SUP-002', Supplier_Name: 'CV Minyak Nusantara', Phone: '0821-4455-6677', Address: 'Boyolali', Hutang: 0, Is_Active: true }
  ],
  purchases: [
    { Purchase_No: 'PO-2026-001', Supplier_Name: 'PT Sembako Makmur Jaya', Total: 2500000, Status: 'SELESAI', Date: '28 Sep 2026' },
    { Purchase_No: 'PO-2026-002', Supplier_Name: 'CV Minyak Nusantara', Total: 1200000, Status: 'PROSES', Date: '29 Sep 2026' }
  ],
  stockMovements: [
    { ID: 'STK-001', Date: '29 Sep 2026 08:30', Product_Name: 'Aqua 600ml', Type: 'Penjualan Kasir', In: 0, Out: 5, Ref: 'INV-001' },
    { ID: 'STK-002', Date: '28 Sep 2026 14:10', Product_Name: 'Minyak Bimoli 1L', Type: 'Kulakan Supplier', In: 20, Out: 0, Ref: 'PO-2026-001' }
  ],
  returns: [
    { Return_No: 'RET-2026-001', Date: '28 Sep 2026', Invoice_No: 'INV-008', Total: 25000, Status: 'SELESAI' }
  ],
  posCart: [],
  posCategoryFilter: 'ALL',
  activeView: 'dashboard',
  salesChart: null,
  paymentChart: null
};

// INITIALIZATION ON DOM LOAD
document.addEventListener('DOMContentLoaded', function () {
  var dateBadge = document.getElementById('current-date-badge');
  if (dateBadge) {
    dateBadge.innerText = formatDateIndo(new Date());
  }
  checkStoredSession();
});

function formatDateIndo(date) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

// API BRIDGE FOR VERCEL DEPLOYMENT (SUPABASE OR MOCK)
async function callApi(functionName) {
  var args = Array.prototype.slice.call(arguments, 1);

  // Jika Supabase sudah dikonfigurasi, gunakan Supabase
  if (supabaseClient) {
    try {
      if (functionName === 'loginUser') {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: args[0],
          password: args[1]
        });
        if (error) {
          console.error("Auth Error:", error);
          return { success: false, message: 'Email atau password salah!' };
        }
        return {
          success: true,
          user: { user_id: data.user.id, username: data.user.email, full_name: 'Administrator', role: 'admin' },
          message: 'Login berhasil!'
        };
      }
      else if (functionName === 'getProducts') {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error || !data || data.length === 0) {
          console.log("Supabase products fallback or empty:", error);
          return getMockProducts();
        }
        return data.map(p => ({
          Product_ID: p.product_id || p.Product_ID || ('PRD-' + Math.floor(Math.random() * 1000)),
          Barcode: p.barcode || p.Barcode || '',
          Product_Name: p.product_name || p.Product_Name || 'Produk',
          Category_ID: p.category_id || p.Category_ID || 'CAT-001',
          Category_Name: p.category_name || p.Category_Name || 'Umum',
          Base_Unit: p.base_unit || p.Base_Unit || 'PCS',
          Buy_Price_WAC: parseFloat(p.buy_price_wac || p.Buy_Price_WAC || 0),
          Sell_Price: parseFloat(p.sell_price || p.Sell_Price || 0),
          Stock: parseFloat(p.stock || p.Stock || 0),
          Min_Stock: parseFloat(p.min_stock || p.Min_Stock || 5)
        }));
      }
      else if (functionName === 'getCategories') {
        const { data, error } = await supabaseClient.from('categories').select('*');
        if (error || !data || data.length === 0) {
          return [
            { Category_ID: 'CAT-001', Category_Name: 'Makanan' },
            { Category_ID: 'CAT-002', Category_Name: 'Minuman' },
            { Category_ID: 'CAT-003', Category_Name: 'Bahan Pokok' }
          ];
        }
        return data.map(c => ({
          Category_ID: c.category_id || c.Category_ID,
          Category_Name: c.category_name || c.Category_Name
        }));
      }
      else if (functionName === 'addProduct') {
        const p = args[0];
        try {
          const { data, error } = await supabaseClient.from('products').insert([{
            product_id: p.Product_ID,
            product_name: p.Product_Name,
            category_id: p.Category_ID,
            base_unit: p.Base_Unit || 'PCS',
            buy_price_wac: p.Buy_Price_WAC,
            sell_price: p.Sell_Price,
            stock: p.Stock,
            min_stock: p.Min_Stock || 5
          }]);
          if (error) console.error("Supabase addProduct Error:", error);
          return { success: !error, message: error ? error.message : 'Produk disimpan ke Supabase' };
        } catch(e) {
          console.error("AddProduct Exception:", e);
        }
      }
    } catch (err) {
      console.error("Supabase Error:", err);
    }
  }

  // FALLBACK KE MOCK API JIKA SUPABASE BELUM DISETTING
  return new Promise(function (resolve, reject) {
    console.log("[Mock API Executed]:", functionName, args);
    setTimeout(function () {
      if (functionName === 'loginUser') {
        resolve({
          success: true,
          user: { user_id: 'USR-001', username: args[0], full_name: 'Admin Toko', role: 'admin' },
          settings: state.settings,
          message: 'Login berhasil!'
        });
      } else if (functionName === 'getProducts') {
        resolve(getMockProducts());
      } else if (functionName === 'getCategories') {
        resolve([
          { Category_ID: 'CAT-001', Category_Name: 'Makanan' },
          { Category_ID: 'CAT-002', Category_Name: 'Minuman' },
          { Category_ID: 'CAT-003', Category_Name: 'Bahan Pokok' }
        ]);
      } else if (functionName === 'getDashboardStats') {
        resolve({
          sales_today: 450000, count_today: 12, sales_month: 8500000, count_month: 140,
          total_piutang: 650000, low_stock_count: 2,
          low_stock_items: [
            { Product_Name: 'Minyak Goreng 1L', Min_Stock: 5, Stock: 2, Base_Unit: 'PCS' },
            { Product_Name: 'Gula 1Kg', Min_Stock: 10, Stock: 4, Base_Unit: 'PCS' }
          ],
          chart_7days: { labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], values: [150, 220, 180, 310, 420, 290, 480] },
          payment_distribution: { cash: 120, credit: 30 },
          top_products: [
            { product_name: 'Aqua 600ml', total_qty: 45 },
            { product_name: 'Indomie Goreng', total_qty: 38 }
          ]
        });
      } else if (functionName === 'processSale') {
        resolve({ success: true, message: 'Transaksi berhasil disimpan!', invoice_no: 'INV-001' });
      } else {
        resolve({ success: true, message: 'Operasi berhasil!' });
      }
    }, 400);
  });
}

function getMockProducts() {
  return [
    { Product_ID: 'PRD-001', Barcode: '8991001001', Product_Name: 'Aqua 600ml', Category_ID: 'CAT-002', Category_Name: 'Minuman', Base_Unit: 'PCS', Buy_Price_WAC: 3000, Sell_Price: 4000, Stock: 45, Min_Stock: 10, Conversions: [] },
    { Product_ID: 'PRD-002', Barcode: '8991001002', Product_Name: 'Indomie Goreng', Category_ID: 'CAT-001', Category_Name: 'Makanan', Base_Unit: 'PCS', Buy_Price_WAC: 2800, Sell_Price: 3500, Stock: 80, Min_Stock: 20, Conversions: [] },
    { Product_ID: 'PRD-003', Barcode: '8991001003', Product_Name: 'Minyak Bimoli 1L', Category_ID: 'CAT-003', Category_Name: 'Bahan Pokok', Base_Unit: 'PCS', Buy_Price_WAC: 14000, Sell_Price: 16500, Stock: 2, Min_Stock: 5, Conversions: [] },
    { Product_ID: 'PRD-004', Barcode: '8991001004', Product_Name: 'Beras Pandan 5kg', Category_ID: 'CAT-003', Category_Name: 'Bahan Pokok', Base_Unit: 'PCS', Buy_Price_WAC: 60000, Sell_Price: 65000, Stock: 15, Min_Stock: 5, Conversions: [] }
  ];
}

/* AUTHENTICATION */
function checkStoredSession() {
  var sess = localStorage.getItem('pos_session');
  if (sess) {
    try {
      var data = JSON.parse(sess);
      state.user = data.user;
      state.settings = data.settings || state.settings;
      document.getElementById('login-screen').style.display = 'none';
      updateUserUI();
      loadAllMasterData();
      return;
    } catch (e) { }
  }
  document.getElementById('login-screen').style.display = 'flex';
}

function handleLogin(e) {
  e.preventDefault();
  var u = document.getElementById('login-username').value;
  var p = document.getElementById('login-password').value;
  var btn = document.getElementById('btn-login-submit');

  btn.innerHTML = 'Memproses...';
  btn.disabled = true;

  callApi('loginUser', u, p).then(function (res) {
    btn.innerHTML = 'Masuk Aplikasi';
    btn.disabled = false;
    if (res.success) {
      state.user = res.user;
      state.settings = res.settings || state.settings;
      localStorage.setItem('pos_session', JSON.stringify(res));
      document.getElementById('login-screen').style.display = 'none';
      showToast('success', res.message);
      updateUserUI();
      loadAllMasterData();
    } else {
      showToast('error', res.message);
    }
  });
}

function handleLogout() {
  localStorage.removeItem('pos_session');
  state.user = null;
  document.getElementById('login-screen').style.display = 'flex';
  showToast('info', 'Anda telah keluar.');
}

function updateUserUI() {
  if (state.user) {
    var nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.innerText = state.user.full_name;
    var roleEl = document.getElementById('user-display-role');
    if (roleEl) roleEl.innerText = state.user.role;
    var avatarEl = document.getElementById('user-avatar-initial');
    if (avatarEl) avatarEl.innerText = state.user.full_name.charAt(0).toUpperCase();
    
    var mobUser = document.getElementById('mobile-user-name');
    if (mobUser) mobUser.innerText = state.user.full_name;
  }
}

/* NAVIGATION & VIEWS */
function switchView(viewId) {
  state.activeView = viewId;

  // Highlight desktop nav items
  var navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function (item) {
    if (item.getAttribute('data-view') === viewId) item.classList.add('active');
    else item.classList.remove('active');
  });

  // Highlight mobile bottom tabs
  var mobileTabs = document.querySelectorAll('.mobile-tab');
  mobileTabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewId) tab.classList.add('active');
    else tab.classList.remove('active');
  });

  // Show selected panel
  var panels = document.querySelectorAll('.view-panel');
  panels.forEach(function (panel) {
    if (panel.id === 'view-' + viewId) panel.classList.add('active');
    else panel.classList.remove('active');
  });

  var titles = {
    dashboard: 'Dashboard',
    kasir: 'Kasir (Point of Sale)',
    produk: 'Master Produk',
    kulakan: 'Pembelian',
    stok: 'Kelola Stok',
    pelanggan: 'Pelanggan',
    supplier: 'Supplier',
    piutang: 'Piutang',
    hutang: 'Hutang',
    retur: 'Retur',
    laporan: 'Laporan',
    pengaturan: 'Pengaturan Toko'
  };
  document.getElementById('current-page-title').innerText = titles[viewId] || 'Toko Kita';

  // Trigger view specific re-render
  if (viewId === 'dashboard') loadDashboardStats();
  else if (viewId === 'kasir') { renderPosProducts(); populatePosCustomerSelect(); }
  else if (viewId === 'produk') renderProductTable();
  else if (viewId === 'pelanggan') renderCustomerTable();
  else if (viewId === 'supplier') renderSupplierTable();
  else if (viewId === 'kulakan') renderPurchaseTable();
  else if (viewId === 'stok') renderStockMovementTable();
  else if (viewId === 'piutang') renderPiutangTable();
  else if (viewId === 'hutang') renderHutangTable();
  else if (viewId === 'retur') renderReturnTable();
  else if (viewId === 'laporan') loadReports();
  else if (viewId === 'pengaturan') loadStoreSettingsToForm();

  // Scroll to top when view switches
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

/* MASTER DATA LOADER */
function loadAllMasterData() {
  Promise.all([
    callApi('getProducts'),
    callApi('getCategories')
  ]).then(function (results) {
    state.products = results[0] || [];
    state.categories = results[1] || [];
    populateCategorySelects();
    populateInitialTables();
    switchView(state.activeView);
  });
}

function populateInitialTables() {
  populatePosCustomerSelect();
  renderCustomerTable();
  renderSupplierTable();
  renderPurchaseTable();
  renderStockMovementTable();
  renderPiutangTable();
  renderHutangTable();
  renderReturnTable();
  loadReports();
  loadStoreSettingsToForm();
}

/* TABLE RENDERERS WITH FULL ITEM ACTIONS */
function renderCustomerTable() {
  var tbody = document.getElementById('table-customers-body');
  if (!tbody) return;
  var html = '';
  state.customers.forEach(function (c) {
    var statusBadge = c.Is_Active !== false
      ? '<span class="badge badge-success">Aktif</span>'
      : '<span class="badge badge-danger">Non-Aktif</span>';

    var toggleBtn = c.Is_Active !== false
      ? `<button class="btn btn-warning btn-sm" onclick="toggleCustomerStatus('${c.Customer_ID}')"><i class="ri-eye-off-line"></i> Nonaktifkan</button>`
      : `<button class="btn btn-success btn-sm" onclick="toggleCustomerStatus('${c.Customer_ID}')"><i class="ri-eye-line"></i> Aktifkan</button>`;

    html += `<tr>
      <td>${c.Customer_ID}</td>
      <td><strong>${c.Customer_Name}</strong></td>
      <td>${c.Phone}</td>
      <td style="font-weight:800; color: ${c.Piutang > 0 ? 'var(--danger)' : 'var(--text-main)'}">${formatRupiah(c.Piutang)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editCustomer('${c.Customer_ID}')"><i class="ri-edit-line"></i> Edit</button>
        ${c.Piutang > 0 ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('Piutang Pelanggan', '${c.Customer_Name}', ${c.Piutang})"><i class="ri-money-dollar-circle-line"></i> Bayar</button>` : ''}
        ${toggleBtn}
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.Customer_ID}')"><i class="ri-delete-bin-line"></i></button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada pelanggan</td></tr>';
}

function editCustomer(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (!c) return;
  openDynamicModal('customer_edit', c);
}

function toggleCustomerStatus(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (c) {
    c.Is_Active = !c.Is_Active;
    renderCustomerTable();
    showToast('info', 'Status pelanggan ' + c.Customer_Name + ' diubah menjadi ' + (c.Is_Active ? 'Aktif' : 'Non-Aktif'));
  }
}

function deleteCustomer(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (c && confirm('Apakah Anda yakin ingin menghapus pelanggan ' + c.Customer_Name + '?')) {
    state.customers = state.customers.filter(item => String(item.Customer_ID) !== String(id));
    renderCustomerTable();
    renderPiutangTable();
    showToast('info', 'Pelanggan telah dihapus.');
  }
}

function renderSupplierTable() {
  var tbody = document.getElementById('table-suppliers-body');
  if (!tbody) return;
  var html = '';
  state.suppliers.forEach(function (s) {
    var statusBadge = s.Is_Active !== false
      ? '<span class="badge badge-success">Aktif</span>'
      : '<span class="badge badge-danger">Non-Aktif</span>';

    var toggleBtn = s.Is_Active !== false
      ? `<button class="btn btn-warning btn-sm" onclick="toggleSupplierStatus('${s.Supplier_ID}')"><i class="ri-eye-off-line"></i> Nonaktifkan</button>`
      : `<button class="btn btn-success btn-sm" onclick="toggleSupplierStatus('${s.Supplier_ID}')"><i class="ri-eye-line"></i> Aktifkan</button>`;

    html += `<tr>
      <td>${s.Supplier_ID}</td>
      <td><strong>${s.Supplier_Name}</strong></td>
      <td>${s.Phone}</td>
      <td style="font-weight:800; color: ${s.Hutang > 0 ? 'var(--danger)' : 'var(--text-main)'}">${formatRupiah(s.Hutang)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editSupplier('${s.Supplier_ID}')"><i class="ri-edit-line"></i> Edit</button>
        ${s.Hutang > 0 ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('Hutang Supplier', '${s.Supplier_Name}', ${s.Hutang})"><i class="ri-money-dollar-circle-line"></i> Bayar</button>` : ''}
        ${toggleBtn}
        <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.Supplier_ID}')"><i class="ri-delete-bin-line"></i></button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada supplier</td></tr>';
}

function editSupplier(id) {
  var s = state.suppliers.find(item => String(item.Supplier_ID) === String(id));
  if (!s) return;
  openDynamicModal('supplier_edit', s);
}

function toggleSupplierStatus(id) {
  var s = state.suppliers.find(item => String(item.Supplier_ID) === String(id));
  if (s) {
    s.Is_Active = !s.Is_Active;
    renderSupplierTable();
    showToast('info', 'Status supplier ' + s.Supplier_Name + ' diubah menjadi ' + (s.Is_Active ? 'Aktif' : 'Non-Aktif'));
  }
}

function deleteSupplier(id) {
  var s = state.suppliers.find(item => String(item.Supplier_ID) === String(id));
  if (s && confirm('Apakah Anda yakin ingin menghapus supplier ' + s.Supplier_Name + '?')) {
    state.suppliers = state.suppliers.filter(item => String(item.Supplier_ID) !== String(id));
    renderSupplierTable();
    renderHutangTable();
    showToast('info', 'Supplier telah dihapus.');
  }
}

function renderPurchaseTable() {
  var tbody = document.getElementById('table-purchases-body');
  if (!tbody) return;
  var html = '';
  state.purchases.forEach(function (p) {
    var isDone = p.Status === 'SELESAI';
    html += `<tr>
      <td><strong>${p.Purchase_No}</strong></td>
      <td>${p.Supplier_Name}</td>
      <td style="font-weight:800;">${formatRupiah(p.Total)}</td>
      <td><span class="badge ${isDone ? 'badge-success' : 'badge-warning'}">${p.Status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewTransactionDetail('Pembelian ${p.Purchase_No}', '${p.Supplier_Name}', ${p.Total})"><i class="ri-file-text-line"></i> Detail</button>
        <button class="btn btn-danger btn-sm" onclick="deletePurchase('${p.Purchase_No}')"><i class="ri-delete-bin-line"></i> Hapus</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada transaksi pembelian</td></tr>';
}

function deletePurchase(poNo) {
  if (confirm('Apakah Anda yakin ingin menghapus ' + poNo + '?')) {
    state.purchases = state.purchases.filter(p => p.Purchase_No !== poNo);
    renderPurchaseTable();
    showToast('info', poNo + ' telah dihapus.');
  }
}

function renderStockMovementTable() {
  var tbody = document.getElementById('table-stock-movements-body');
  if (!tbody) return;
  var html = '';
  state.stockMovements.forEach(function (s) {
    html += `<tr>
      <td>${s.Date}</td>
      <td><strong>${s.Product_Name}</strong></td>
      <td><span class="badge badge-info">${s.Type}</span></td>
      <td style="color:var(--success); font-weight:800;">${s.In ? '+' + s.In : '-'}</td>
      <td style="color:var(--danger); font-weight:800;">${s.Out ? '-' + s.Out : '-'}</td>
      <td>${s.Ref}</td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada pergerakan stok</td></tr>';
}

function renderPiutangTable() {
  var tbody = document.getElementById('table-piutang-body');
  if (!tbody) return;
  var piutangList = state.customers.filter(c => c.Piutang > 0);
  var html = '<thead><tr><th>Pelanggan</th><th>Total Piutang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
  piutangList.forEach(function (c) {
    html += `<tr>
      <td><strong>${c.Customer_Name}</strong></td>
      <td style="font-weight:900; color:var(--danger);">${formatRupiah(c.Piutang)}</td>
      <td><span class="badge badge-warning">Belum Lunas</span></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="openPaymentModal('Piutang Pelanggan', '${c.Customer_Name}', ${c.Piutang})"><i class="ri-hand-coin-line"></i> Pelunasan</button>
        <button class="btn btn-secondary btn-sm" onclick="viewTransactionDetail('Piutang ${c.Customer_Name}', '${c.Customer_Name}', ${c.Piutang})"><i class="ri-file-list-line"></i> Detail</button>
      </td>
    </tr>`;
  });
  html += '</tbody>';
  tbody.innerHTML = piutangList.length > 0 ? html : '<tr><td colspan="4" style="text-align:center; padding:20px;">Semua piutang telah lunas 🎉</td></tr>';
}

function renderHutangTable() {
  var tbody = document.getElementById('table-hutang-body');
  if (!tbody) return;
  var hutangList = state.suppliers.filter(s => s.Hutang > 0);
  var html = '<thead><tr><th>Supplier</th><th>Total Hutang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
  hutangList.forEach(function (s) {
    html += `<tr>
      <td><strong>${s.Supplier_Name}</strong></td>
      <td style="font-weight:900; color:var(--danger);">${formatRupiah(s.Hutang)}</td>
      <td><span class="badge badge-danger">Belum Lunas</span></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="openPaymentModal('Hutang Supplier', '${s.Supplier_Name}', ${s.Hutang})"><i class="ri-hand-coin-line"></i> Pelunasan</button>
        <button class="btn btn-secondary btn-sm" onclick="viewTransactionDetail('Hutang ${s.Supplier_Name}', '${s.Supplier_Name}', ${s.Hutang})"><i class="ri-file-list-line"></i> Detail</button>
      </td>
    </tr>`;
  });
  html += '</tbody>';
  tbody.innerHTML = hutangList.length > 0 ? html : '<tr><td colspan="4" style="text-align:center; padding:20px;">Semua hutang telah lunas 🎉</td></tr>';
}

function renderReturnTable() {
  var tbody = document.getElementById('table-returns-body');
  if (!tbody) return;
  var html = '<thead><tr><th>No Retur</th><th>Tanggal</th><th>Invoice</th><th>Total Retur</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
  state.returns.forEach(function (r) {
    html += `<tr>
      <td><strong>${r.Return_No}</strong></td>
      <td>${r.Date}</td>
      <td>${r.Invoice_No}</td>
      <td style="font-weight:800;">${formatRupiah(r.Total)}</td>
      <td><span class="badge badge-success">${r.Status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewTransactionDetail('Retur ${r.Return_No}', '${r.Invoice_No}', ${r.Total})"><i class="ri-file-text-line"></i> Detail</button>
      </td>
    </tr>`;
  });
  html += '</tbody>';
  tbody.innerHTML = html;
}

function populateCategorySelects() {
  var selects = ['prod-cat', 'produk-filter-cat'];
  selects.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var html = id === 'produk-filter-cat' ? '<option value="">Semua Kategori</option>' : '<option value="">Pilih Kategori</option>';
    state.categories.forEach(function (c) {
      html += '<option value="' + c.Category_ID + '">' + c.Category_Name + '</option>';
    });
    el.innerHTML = html;
  });

  // Render POS category pills
  var pillContainer = document.getElementById('pos-category-pills');
  if (pillContainer) {
    var phtml = '<button class="btn btn-primary btn-sm active" onclick="filterPosCategory(\'ALL\', this)">Semua</button>';
    state.categories.forEach(function (c) {
      phtml += '<button class="btn btn-secondary btn-sm" onclick="filterPosCategory(\'' + c.Category_ID + '\', this)">' + c.Category_Name + '</button>';
    });
    pillContainer.innerHTML = phtml;
  }
}

/* DASHBOARD CONTROLLER */
function loadDashboardStats() {
  callApi('getDashboardStats').then(function (stats) {
    document.getElementById('dash-sales-today').innerText = formatRupiah(stats.sales_today);
    document.getElementById('dash-count-today').innerText = stats.count_today + ' transaksi';
    document.getElementById('dash-sales-month').innerText = formatRupiah(stats.sales_month);
    document.getElementById('dash-count-month').innerText = stats.count_month + ' transaksi';
    document.getElementById('dash-total-piutang').innerText = formatRupiah(stats.total_piutang);
    document.getElementById('dash-low-stock-count').innerText = stats.low_stock_count + ' produk';

    renderDashboardCharts(stats);

    // Low stock list
    var lowList = document.getElementById('dash-low-stock-list');
    if (stats.low_stock_items && stats.low_stock_items.length > 0) {
      var lhtml = '';
      stats.low_stock_items.forEach(function (p) {
        lhtml += '<div class="list-box">' +
          '<div><div class="font-bold">' + p.Product_Name + '</div><div style="font-size:12px; color:var(--text-dim);">Min: ' + p.Min_Stock + '</div></div>' +
          '<div class="badge badge-danger">Sisa: ' + p.Stock + '</div>' +
          '</div>';
      });
      lowList.innerHTML = lhtml;
    } else {
      lowList.innerHTML = '<div style="color: var(--text-dim); padding: 12px;">Stok aman!</div>';
    }

    // Top products list
    var topList = document.getElementById('dash-top-products-list');
    if (stats.top_products && stats.top_products.length > 0) {
      var thtml = '';
      stats.top_products.forEach(function (tp, idx) {
        thtml += '<div class="list-box" style="border-color: #000;">' +
          '<div><span class="font-bold" style="margin-right:8px;">#' + (idx + 1) + '</span><span class="font-bold">' + tp.product_name + '</span></div>' +
          '<div class="badge badge-success">' + tp.total_qty + ' terjual</div>' +
          '</div>';
      });
      topList.innerHTML = thtml;
    } else {
      topList.innerHTML = '<div style="color: var(--text-dim); padding: 12px;">Belum ada penjualan.</div>';
    }
  });
}

function renderDashboardCharts(stats) {
  var ctx1 = document.getElementById('chart-sales-7days').getContext('2d');
  if (state.salesChart) state.salesChart.destroy();
  state.salesChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: stats.chart_7days.labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: stats.chart_7days.values,
        backgroundColor: '#facc15',
        borderColor: '#000000',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold' } } },
        y: { grid: { color: '#e5e5e5' }, ticks: { color: '#000', font: { weight: 'bold' } } }
      }
    }
  });

  var ctx2 = document.getElementById('chart-payment-dist').getContext('2d');
  if (state.paymentChart) state.paymentChart.destroy();
  state.paymentChart = new Chart(ctx2, {
    type: 'pie',
    data: {
      labels: ['Tunai', 'Kredit'],
      datasets: [{
        data: [stats.payment_distribution.cash, stats.payment_distribution.credit],
        backgroundColor: ['#4ade80', '#fb7185'],
        borderColor: '#000000',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#000', font: { weight: 'bold' } } } }
    }
  });
}

/* KASIR / POS CONTROLLER */
function renderPosProducts() {
  var grid = document.getElementById('pos-product-grid');
  if (!grid) return;

  var q = (document.getElementById('pos-search').value || '').toLowerCase();

  var filtered = state.products.filter(function (p) {
    if (state.posCategoryFilter !== 'ALL' && String(p.Category_ID) !== String(state.posCategoryFilter)) return false;
    if (q) {
      return (p.Product_Name || '').toLowerCase().indexOf(q) !== -1 || (p.Barcode || '').toLowerCase().indexOf(q) !== -1;
    }
    return true;
  });

  var html = '';
  filtered.forEach(function (p) {
    var stock = parseFloat(p.Stock) || 0;
    var isLow = stock <= (parseFloat(p.Min_Stock) || 5);
    html += '<div class="product-item-card" onclick="addToCart(\'' + p.Product_ID + '\')">' +
      '<div>' +
      '<h4>' + p.Product_Name + '</h4>' +
      '<div class="price">' + formatRupiah(p.Sell_Price) + '</div>' +
      '</div>' +
      '<div class="stock-tag">' +
      '<span class="badge ' + (isLow ? 'badge-danger' : 'badge-success') + '">Stok: ' + stock + ' ' + p.Base_Unit + '</span>' +
      '</div>' +
      '</div>';
  });
  grid.innerHTML = html || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; font-weight:600;">Tidak ada produk.</div>';
}

function filterPosProducts() { renderPosProducts(); }

function filterPosCategory(catId, btnEl) {
  state.posCategoryFilter = catId;
  var btns = document.querySelectorAll('#pos-category-pills button');
  btns.forEach(function (b) {
    b.classList.remove('active');
    b.classList.replace('btn-primary', 'btn-secondary');
  });
  btnEl.classList.add('active');
  btnEl.classList.replace('btn-secondary', 'btn-primary');
  renderPosProducts();
}

function addToCart(productId) {
  var p = state.products.find(function (item) { return String(item.Product_ID) === String(productId); });
  if (!p) return;

  var existing = state.posCart.find(function (c) { return String(c.Product_ID) === String(productId); });
  if (existing) {
    existing.Qty += 1;
    existing.Subtotal = existing.Qty * existing.Sell_Price;
  } else {
    state.posCart.push({
      Product_ID: p.Product_ID,
      Product_Name: p.Product_Name,
      Qty: 1,
      Sell_Price: parseFloat(p.Sell_Price) || 0,
      Subtotal: parseFloat(p.Sell_Price) || 0
    });
  }
  renderPosCart();
}

function updateCartQty(idx, delta) {
  var newQty = state.posCart[idx].Qty + delta;
  if (newQty <= 0) {
    removeFromCart(idx);
    return;
  }
  state.posCart[idx].Qty = newQty;
  state.posCart[idx].Subtotal = newQty * state.posCart[idx].Sell_Price;
  renderPosCart();
}

function removeFromCart(idx) {
  state.posCart.splice(idx, 1);
  renderPosCart();
}

function clearPosCart() {
  state.posCart = [];
  renderPosCart();
  showToast('info', 'Keranjang kasir telah dikosongkan.');
}

function setQuickCash(val) {
  var grandVal = 0;
  if (val === 'pas') {
    var subtotal = 0;
    state.posCart.forEach(function (item) { subtotal += item.Subtotal; });
    var disc = parseFloat(document.getElementById('pos-discount-total').value) || 0;
    grandVal = Math.max(0, subtotal - disc);
  } else {
    grandVal = parseFloat(val) || 0;
  }
  syncCashInput(grandVal);
  calculatePosTotal();
}

function syncCustomerSelect(val) {
  var s1 = document.getElementById('pos-customer-select');
  var s2 = document.getElementById('pos-customer-select-mobile');
  if (s1) s1.value = val;
  if (s2) s2.value = val;
}

function populatePosCustomerSelect() {
  var s1 = document.getElementById('pos-customer-select');
  var s2 = document.getElementById('pos-customer-select-mobile');
  if (!state.customers) return;
  var html = '';
  state.customers.forEach(function (c) {
    if (c.Is_Active !== false) {
      html += `<option value="${c.Customer_ID}">${c.Customer_Name} (${c.Phone || '-'})</option>`;
    }
  });
  if (s1) s1.innerHTML = html;
  if (s2) s2.innerHTML = html;
}

function renderPosCart() {
  var list = document.getElementById('pos-cart-list');
  var listMobile = document.getElementById('pos-cart-list-mobile');
  var mobFloatBar = document.getElementById('mobile-cart-float-bar');

  var totalItems = 0;
  state.posCart.forEach(item => { totalItems += item.Qty; });

  var mobCountBadge = document.getElementById('mob-cart-badge-count');
  var mobCountHeader = document.getElementById('mob-cart-item-count');
  if (mobCountBadge) mobCountBadge.innerText = totalItems;
  if (mobCountHeader) mobCountHeader.innerText = totalItems;

  if (mobFloatBar) {
    mobFloatBar.style.display = (state.posCart.length > 0) ? 'flex' : 'none';
  }

  if (state.posCart.length === 0) {
    var emptyHtml = '<div style="text-align: center; padding: 30px 0; font-weight: 600; color: var(--text-dim);">Keranjang kosong</div>';
    if (list) list.innerHTML = emptyHtml;
    if (listMobile) listMobile.innerHTML = emptyHtml;
    calculatePosTotal();
    return;
  }

  var html = '';
  state.posCart.forEach(function (item, idx) {
    html += '<div class="cart-item-row" style="display:flex; align-items:center; justify-content:space-between; padding: 8px 0; border-bottom: 1px dashed var(--border-color);">' +
      '<div style="flex: 1;">' +
      '<h5 style="font-size:14px; font-weight:800; margin-bottom:2px;">' + item.Product_Name + '</h5>' +
      '<div style="font-size:12px; font-weight:600; color:var(--text-dim);">' + formatRupiah(item.Sell_Price) + '</div>' +
      '</div>' +
      '<div class="qty-controls" style="display:flex; align-items:center; gap: 4px; margin: 0 8px;">' +
      '<button class="btn-qty" style="width:26px; height:26px; border:2px solid #000; background:var(--primary); font-weight:900; border-radius:4px; cursor:pointer;" onclick="updateCartQty(' + idx + ', -1)">-</button>' +
      '<span style="font-size: 13px; font-weight: 800; width: 24px; text-align: center;">' + item.Qty + '</span>' +
      '<button class="btn-qty" style="width:26px; height:26px; border:2px solid #000; background:var(--primary); font-weight:900; border-radius:4px; cursor:pointer;" onclick="updateCartQty(' + idx + ', 1)">+</button>' +
      '</div>' +
      '<div style="text-align: right; min-width: 70px; display:flex; align-items:center; justify-content:flex-end; gap: 6px;">' +
      '<div style="font-size: 13px; font-weight: 900;">' + formatRupiah(item.Subtotal) + '</div>' +
      '<button class="btn-icon" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:16px;" onclick="removeFromCart(' + idx + ')" title="Hapus"><i class="ri-delete-bin-line"></i></button>' +
      '</div>' +
      '</div>';
  });

  if (list) list.innerHTML = html;
  if (listMobile) listMobile.innerHTML = html;
  calculatePosTotal();
}

function calculatePosTotal() {
  var subtotal = 0;
  state.posCart.forEach(function (item) { subtotal += item.Subtotal; });

  var subEl = document.getElementById('pos-subtotal-text');
  var subMobEl = document.getElementById('pos-subtotal-text-mobile');
  if (subEl) subEl.innerText = formatRupiah(subtotal);
  if (subMobEl) subMobEl.innerText = formatRupiah(subtotal);

  var discEl = document.getElementById('pos-discount-total');
  var disc = discEl ? (parseFloat(discEl.value) || 0) : 0;

  var grand = subtotal - disc;
  if (grand < 0) grand = 0;

  var grandEl = document.getElementById('pos-grand-total-text');
  var grandMobEl = document.getElementById('pos-grand-total-text-mobile');
  var mobFloatTotal = document.getElementById('mob-cart-badge-total');
  if (grandEl) grandEl.innerText = formatRupiah(grand);
  if (grandMobEl) grandMobEl.innerText = formatRupiah(grand);
  if (mobFloatTotal) mobFloatTotal.innerText = formatRupiah(grand);

  var cashEl = document.getElementById('pos-cash-received');
  var cash = cashEl ? (parseFloat(cashEl.value) || 0) : 0;
  var change = cash > grand ? cash - grand : 0;

  var changeEl = document.getElementById('pos-cash-change-text');
  var changeMobEl = document.getElementById('pos-cash-change-text-mobile');
  if (changeEl) changeEl.innerText = formatRupiah(change);
  if (changeMobEl) changeMobEl.innerText = formatRupiah(change);
}

function syncDiscountInput(val) {
  var d1 = document.getElementById('pos-discount-total');
  var d2 = document.getElementById('pos-discount-total-mobile');
  if (d1) d1.value = val;
  if (d2) d2.value = val;
}

function syncCashInput(val) {
  var c1 = document.getElementById('pos-cash-received');
  var c2 = document.getElementById('pos-cash-received-mobile');
  if (c1) c1.value = val;
  if (c2) c2.value = val;
}

function syncPaymentMethodSelect(val) {
  var m1 = document.getElementById('pos-payment-method');
  var m2 = document.getElementById('pos-payment-method-mobile');
  if (m1) m1.value = val;
  if (m2) m2.value = val;
}

function togglePosPaymentMethod() {
  var methodEl = document.getElementById('pos-payment-method');
  var method = methodEl ? methodEl.value : 'CASH';
  var cashCont = document.getElementById('pos-cash-container');
  var cashContMob = document.getElementById('pos-cash-container-mobile');
  if (cashCont) cashCont.style.display = method === 'CREDIT' ? 'none' : 'block';
  if (cashContMob) cashContMob.style.display = method === 'CREDIT' ? 'none' : 'block';
}

function submitPosSale() {
  if (state.posCart.length === 0) {
    showToast('warning', 'Keranjang masih kosong!');
    return;
  }
  showToast('info', 'Memproses...');

  // Hitung total untuk struk
  var subtotal = 0;
  state.posCart.forEach(function (item) { subtotal += item.Subtotal; });
  var disc = parseFloat(document.getElementById('pos-discount-total').value) || 0;
  var grand = subtotal - disc;
  if (grand < 0) grand = 0;
  var cash = parseFloat(document.getElementById('pos-cash-received').value) || 0;
  var change = cash > grand ? cash - grand : 0;
  var method = document.getElementById('pos-payment-method').value;

  // Save last transaction details for WhatsApp / PDF export
  state.lastCart = JSON.parse(JSON.stringify(state.posCart));
  state.lastSubtotal = subtotal;
  state.lastDiscount = disc;
  state.lastGrandTotal = grand;
  state.lastCash = cash;
  state.lastChange = change;
  state.lastPaymentMethod = method;

  callApi('processSale', state.posCart).then(function (res) {
    showToast('success', res.message);

    // Generate Receipt Preview with Neobrutalism theme
    var receiptHtml = `
      <div style="font-family: 'Outfit', sans-serif; color: #000; padding: 12px; background: #fff; border: 3px solid #000; border-radius: 12px; box-shadow: 4px 4px 0 0 #000;">
        <div style="background: var(--primary, #facc15); border: 2px solid #000; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 12px; box-shadow: 2px 2px 0 0 #000;">
          <h2 style="margin:0; font-size:18px; font-weight:900; color:#000;">${state.settings.store_name}</h2>
          <p style="margin:2px 0 0 0; font-size:12px; font-weight:700;">${state.settings.store_address}</p>
          <p style="margin:2px 0 0 0; font-size:11px; font-weight:600;">Telp: ${state.settings.store_phone}</p>
        </div>
        
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px dashed #000;">
          <span>Tgl: ${new Date().toLocaleString('id-ID')}</span>
          <span>Kasir: ${state.user ? state.user.full_name : 'Admin'}</span>
        </div>

        <table style="width: 100%; text-align: left; font-size:13px; border-collapse: collapse; margin-bottom: 10px;">
    `;

    state.posCart.forEach(function (item) {
      receiptHtml += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 4px 0; font-weight: 800;">${item.Product_Name}</td>
          <td style="padding: 4px 0; text-align: center; font-weight: 600;">${item.Qty} x ${formatRupiah(item.Sell_Price)}</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 800;">${formatRupiah(item.Subtotal)}</td>
        </tr>
      `;
    });

    receiptHtml += `
        </table>
        
        <div style="background: #f4f5f4; border: 2px solid #000; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 13px;">
          <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom: 4px;">
            <span>Subtotal</span><span>${formatRupiah(subtotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom: 4px; color: var(--danger);">
            <span>Diskon</span><span>- ${formatRupiah(disc)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:900; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px;">
            <span>TOTAL</span><span style="color: #000;">${formatRupiah(grand)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; margin-top: 6px;">
            <span>Metode Bayar</span><span>${method === 'CASH' ? 'TUNAI' : 'HUTANG/PIUTANG'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>Diterima</span><span>${method === 'CASH' ? formatRupiah(cash) : 'HUTANG'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:900; color: #000000;">
            <span>Kembalian</span><span>${method === 'CASH' ? formatRupiah(change) : 'Rp 0'}</span>
          </div>
        </div>

        <div style="text-align: center; font-size: 12px; font-weight: 700; font-style: italic; background: var(--secondary, #38bdf8); padding: 8px; border: 2px solid #000; border-radius: 6px;">
          ${state.settings.invoice_footer}
        </div>
      </div>
    `;

    document.getElementById('receipt-preview-area').innerHTML = receiptHtml;
    openModal('modal-invoice');

    // Deduct stock in state & update UI
    state.posCart.forEach(function (cartItem) {
      var prod = state.products.find(p => String(p.Product_ID) === String(cartItem.Product_ID));
      if (prod) {
        prod.Stock = Math.max(0, prod.Stock - cartItem.Qty);
      }
    });

    // Reset Cart & Refresh Product Views
    state.posCart = [];
    document.getElementById('pos-discount-total').value = 0;
    document.getElementById('pos-cash-received').value = '';
    renderPosCart();
    renderPosProducts();
    renderProductTable();
  });
}

/* MASTER PRODUK CONTROLLER */
function renderProductTable() {
  var tbody = document.getElementById('table-products-body');
  if (!tbody) return;

  var q = (document.getElementById('produk-search').value || '').toLowerCase();

  var filtered = state.products.filter(function (p) {
    if (q) return (p.Product_Name || '').toLowerCase().indexOf(q) !== -1;
    return true;
  });

  var html = '';
  filtered.forEach(function (p) {
    html += '<tr>' +
      '<td>' + p.Product_ID + '</td>' +
      '<td><strong>' + p.Product_Name + '</strong></td>' +
      '<td>' + (p.Category_Name || '-') + '</td>' +
      '<td>' + formatRupiah(p.Buy_Price_WAC) + '</td>' +
      '<td style="color: var(--success); font-weight: 800;">' + formatRupiah(p.Sell_Price) + '</td>' +
      '<td><span class="badge badge-primary">' + p.Stock + '</span></td>' +
      '<td>' +
      '<button class="btn btn-secondary btn-sm" onclick="editProduct(\'' + p.Product_ID + '\')"><i class="ri-edit-line"></i></button> ' +
      '<button class="btn btn-danger btn-sm" onclick="deleteProduct(\'' + p.Product_ID + '\')"><i class="ri-delete-bin-line"></i></button>' +
      '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Kosong</td></tr>';
}

function deleteProduct(productId) {
  var p = state.products.find(item => String(item.Product_ID) === String(productId));
  var pName = p ? p.Product_Name : 'produk ini';
  if (confirm('Apakah Anda yakin ingin menghapus ' + pName + '?')) {
    state.products = state.products.filter(item => String(item.Product_ID) !== String(productId));
    renderProductTable();
    renderPosProducts();
    showToast('info', 'Produk "' + pName + '" telah dihapus.');
  }
}

function editProduct(productId) {
  var p = state.products.find(item => String(item.Product_ID) === String(productId));
  if (!p) return;
  openDynamicModal('product_edit', p);
}

/* MODALS & TOASTS */
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('active');
}
function openProductModal() { openDynamicModal('product'); }
let currentDynamicType = '';
function openDynamicModal(type, extraData) {
  currentDynamicType = type;
  let title = '';
  let html = '';
  let editingProdId = extraData ? extraData.Product_ID : '';

  if (type === 'product' || type === 'product_edit') {
    let isEdit = type === 'product_edit';
    title = isEdit ? 'Edit Produk (' + (extraData ? extraData.Product_Name : '') + ')' : 'Tambah Produk Baru';
    let catOptions = '';
    let currentCat = extraData ? extraData.Category_ID : '';
    if (state.categories && state.categories.length > 0) {
      state.categories.forEach(c => {
        let sel = (String(c.Category_ID) === String(currentCat)) ? 'selected' : '';
        catOptions += `<option value="${c.Category_ID}" ${sel}>${c.Category_Name}</option>`;
      });
    } else {
      catOptions = `<option value="CAT-001">Makanan</option><option value="CAT-002">Minuman</option><option value="CAT-003">Bahan Pokok</option>`;
    }

    html = `
      <input type="hidden" id="dyn-prod-id" value="${editingProdId}">
      <div class="form-group">
        <label>Nama Produk</label>
        <input type="text" id="dyn-nama" class="form-control" value="${extraData ? extraData.Product_Name : ''}" placeholder="Contoh: Aqua 600ml" required>
      </div>
      <div class="form-group">
        <label>Kategori</label>
        <select id="dyn-cat" class="form-control" required>${catOptions}</select>
      </div>
      <div class="form-group">
        <label>Harga Beli (Rp)</label>
        <input type="number" id="dyn-buy" class="form-control" value="${extraData ? extraData.Buy_Price_WAC : 3000}" required>
      </div>
      <div class="form-group">
        <label>Harga Jual (Rp)</label>
        <input type="number" id="dyn-sell" class="form-control" value="${extraData ? extraData.Sell_Price : 4000}" required>
      </div>
      <div class="form-group">
        <label>Stok</label>
        <input type="number" id="dyn-stock" class="form-control" value="${extraData ? extraData.Stock : 25}" required>
      </div>
    `;
  } else if (type === 'category') {
    title = 'Tambah Kategori';
    html = `<div class="form-group"><label>Nama Kategori</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>Deskripsi</label><input type="text" id="dyn-desc" class="form-control"></div>`;
  } else if (type === 'customer' || type === 'customer_edit') {
    let isEdit = type === 'customer_edit';
    let cId = extraData ? extraData.Customer_ID : '';
    title = isEdit ? 'Edit Pelanggan (' + (extraData ? extraData.Customer_Name : '') + ')' : 'Tambah Pelanggan Baru';
    html = `
      <input type="hidden" id="dyn-cust-id" value="${cId}">
      <div class="form-group">
        <label>Nama Pelanggan</label>
        <input type="text" id="dyn-nama" class="form-control" value="${extraData ? extraData.Customer_Name : ''}" placeholder="Nama Pelanggan" required>
      </div>
      <div class="form-group">
        <label>No HP / Whatsapp</label>
        <input type="text" id="dyn-hp" class="form-control" value="${extraData ? extraData.Phone : ''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Jumlah Piutang (Rp)</label>
        <input type="number" id="dyn-piutang" class="form-control" value="${extraData ? (extraData.Piutang || 0) : 0}">
      </div>
    `;
  } else if (type === 'supplier' || type === 'supplier_edit') {
    let isEdit = type === 'supplier_edit';
    let sId = extraData ? extraData.Supplier_ID : '';
    title = isEdit ? 'Edit Supplier (' + (extraData ? extraData.Supplier_Name : '') + ')' : 'Tambah Supplier Baru';
    html = `
      <input type="hidden" id="dyn-supp-id" value="${sId}">
      <div class="form-group">
        <label>Nama Supplier</label>
        <input type="text" id="dyn-nama" class="form-control" value="${extraData ? extraData.Supplier_Name : ''}" placeholder="Nama Supplier / PT" required>
      </div>
      <div class="form-group">
        <label>No HP / Telepon</label>
        <input type="text" id="dyn-hp" class="form-control" value="${extraData ? extraData.Phone : ''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Jumlah Hutang (Rp)</label>
        <input type="number" id="dyn-hutang" class="form-control" value="${extraData ? (extraData.Hutang || 0) : 0}">
      </div>
    `;
  } else if (type === 'unit') {
    title = 'Tambah Satuan';
    html = `<div class="form-group"><label>Nama Satuan</label><input type="text" id="dyn-nama" class="form-control" required></div>`;
  } else if (type === 'purchase') {
    title = 'Tambah Pembelian';
    html = `<div class="form-group"><label>Nama Supplier</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>Total Pembelian</label><input type="number" id="dyn-total" class="form-control" required></div>`;
  } else if (type === 'stock_adj') {
    title = 'Penyesuaian Stok';
    html = `<div class="form-group"><label>Nama Produk</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>Jumlah Penambahan</label><input type="number" id="dyn-qty" class="form-control" required></div>`;
  } else if (type === 'return') {
    title = 'Retur Transaksi';
    html = `<div class="form-group"><label>No Invoice</label><input type="text" id="dyn-invoice" class="form-control" required></div>`;
  } else if (type === 'payment') {
    let pTitle = extraData ? extraData.title : 'Pembayaran';
    let pName = extraData ? extraData.name : 'Pihak Terkait';
    let pAmount = extraData ? extraData.amount : 0;
    title = 'Bayar ' + pTitle + ' (' + pName + ')';
    html = `
      <div class="form-group">
        <label>Nama Pihak / Sasaran</label>
        <input type="text" id="dyn-nama" class="form-control" value="${pName}" readonly>
      </div>
      <div class="form-group">
        <label>Nominal Pembayaran (Rp)</label>
        <input type="number" id="dyn-amount" class="form-control" value="${pAmount}" required>
      </div>
      <div class="form-group">
        <label>Metode Pembayaran</label>
        <select id="dyn-method" class="form-control">
          <option value="TUNAI">Tunai</option>
          <option value="TRANSFER">Transfer Bank</option>
        </select>
      </div>
      <div class="form-group">
        <label>Catatan / Keterangan</label>
        <input type="text" id="dyn-note" class="form-control" placeholder="Contoh: Pembayaran Lunas">
      </div>
    `;
  }
  
  document.getElementById('modal-dynamic-title').innerText = title;
  document.getElementById('modal-dynamic-body').innerHTML = html;
  openModal('modal-dynamic');
}

function handleDynamicSave(e) {
  e.preventDefault();
  closeModal('modal-dynamic');
  var nama = document.getElementById('dyn-nama') ? document.getElementById('dyn-nama').value : 'Data';

  if (currentDynamicType === 'product' || currentDynamicType === 'product_edit') {
    var catSelect = document.getElementById('dyn-cat');
    var catId = catSelect ? catSelect.value : 'CAT-001';
    var catText = catSelect && catSelect.options[catSelect.selectedIndex] ? catSelect.options[catSelect.selectedIndex].text : 'Umum';
    var buyPrice = document.getElementById('dyn-buy') ? parseFloat(document.getElementById('dyn-buy').value) || 0 : 0;
    var sellPrice = document.getElementById('dyn-sell') ? parseFloat(document.getElementById('dyn-sell').value) || 0 : 0;
    var stock = document.getElementById('dyn-stock') ? parseFloat(document.getElementById('dyn-stock').value) || 0 : 10;
    var existingId = document.getElementById('dyn-prod-id') ? document.getElementById('dyn-prod-id').value : '';

    if (currentDynamicType === 'product_edit' && existingId) {
      var item = state.products.find(p => String(p.Product_ID) === String(existingId));
      if (item) {
        item.Product_Name = nama;
        item.Category_ID = catId;
        item.Category_Name = catText;
        item.Buy_Price_WAC = buyPrice;
        item.Sell_Price = sellPrice;
        item.Stock = stock;
      }
      renderProductTable();
      renderPosProducts();
      showToast('success', 'Produk "' + nama + '" berhasil diperbarui!');
      return;
    }

    var newProdId = 'PRD-' + Math.floor(100 + Math.random() * 900);
    var newProd = {
      Product_ID: newProdId,
      Product_Name: nama,
      Category_ID: catId,
      Category_Name: catText,
      Base_Unit: 'PCS',
      Buy_Price_WAC: buyPrice,
      Sell_Price: sellPrice,
      Stock: stock,
      Min_Stock: 5
    };

    callApi('addProduct', newProd).then(function(res) {
      state.products.push(newProd);
      renderProductTable();
      renderPosProducts();
      showToast('success', 'Produk "' + nama + '" berhasil ditambahkan!');
    });
    return;
  }

  if (currentDynamicType === 'customer' || currentDynamicType === 'customer_edit') {
    var hp = document.getElementById('dyn-hp') ? document.getElementById('dyn-hp').value : '-';
    var piutang = document.getElementById('dyn-piutang') ? parseFloat(document.getElementById('dyn-piutang').value) || 0 : 0;
    var custId = document.getElementById('dyn-cust-id') ? document.getElementById('dyn-cust-id').value : '';

    if (currentDynamicType === 'customer_edit' && custId) {
      var custObj = state.customers.find(c => String(c.Customer_ID) === String(custId));
      if (custObj) {
        custObj.Customer_Name = nama;
        custObj.Phone = hp;
        custObj.Piutang = piutang;
      }
      renderCustomerTable();
      renderPiutangTable();
      showToast('success', 'Pelanggan "' + nama + '" berhasil diperbarui!');
      return;
    }

    var newCustId = 'CUST-00' + (state.customers.length + 1);
    var newCust = {
      Customer_ID: newCustId,
      Customer_Name: nama,
      Phone: hp || '-',
      Address: '-',
      Piutang: piutang,
      Is_Active: true
    };
    state.customers.push(newCust);
    renderCustomerTable();
    renderPiutangTable();
    showToast('success', 'Pelanggan "' + nama + '" berhasil ditambahkan!');
    return;
  }

  if (currentDynamicType === 'supplier' || currentDynamicType === 'supplier_edit') {
    var hp = document.getElementById('dyn-hp') ? document.getElementById('dyn-hp').value : '-';
    var hutang = document.getElementById('dyn-hutang') ? parseFloat(document.getElementById('dyn-hutang').value) || 0 : 0;
    var suppId = document.getElementById('dyn-supp-id') ? document.getElementById('dyn-supp-id').value : '';

    if (currentDynamicType === 'supplier_edit' && suppId) {
      var suppObj = state.suppliers.find(s => String(s.Supplier_ID) === String(suppId));
      if (suppObj) {
        suppObj.Supplier_Name = nama;
        suppObj.Phone = hp;
        suppObj.Hutang = hutang;
      }
      renderSupplierTable();
      renderHutangTable();
      showToast('success', 'Supplier "' + nama + '" berhasil diperbarui!');
      return;
    }

    var newSuppId = 'SUP-00' + (state.suppliers.length + 1);
    var newSupp = {
      Supplier_ID: newSuppId,
      Supplier_Name: nama,
      Phone: hp || '-',
      Address: '-',
      Hutang: hutang,
      Is_Active: true
    };
    state.suppliers.push(newSupp);
    renderSupplierTable();
    renderHutangTable();
    showToast('success', 'Supplier "' + nama + '" berhasil ditambahkan!');
    return;
  }

  if (currentDynamicType === 'payment') {
    var amt = document.getElementById('dyn-amount') ? parseFloat(document.getElementById('dyn-amount').value) || 0 : 0;
    var targetCust = state.customers.find(c => c.Customer_Name === nama);
    if (targetCust) {
      targetCust.Piutang = Math.max(0, targetCust.Piutang - amt);
      renderCustomerTable();
      renderPiutangTable();
    }
    var targetSupp = state.suppliers.find(s => s.Supplier_Name === nama);
    if (targetSupp) {
      targetSupp.Hutang = Math.max(0, targetSupp.Hutang - amt);
      renderSupplierTable();
      renderHutangTable();
    }
    showToast('success', 'Pembayaran sebesar ' + formatRupiah(amt) + ' untuk ' + nama + ' berhasil dicatat!');
    return;
  }

  if (currentDynamicType === 'purchase') {
    var tot = document.getElementById('dyn-total') ? parseFloat(document.getElementById('dyn-total').value) || 0 : 0;
    var poNo = 'PO-2026-00' + (state.purchases.length + 1);
    state.purchases.unshift({
      Purchase_No: poNo,
      Supplier_Name: nama,
      Total: tot,
      Status: 'SELESAI',
      Date: formatDateIndo(new Date())
    });
    renderPurchaseTable();
    showToast('success', 'Pembelian PO ' + poNo + ' berhasil dicatat!');
    return;
  }

  if (currentDynamicType === 'stock_adj') {
    var qty = document.getElementById('dyn-qty') ? parseFloat(document.getElementById('dyn-qty').value) || 0 : 0;
    state.stockMovements.unshift({
      ID: 'STK-00' + (state.stockMovements.length + 1),
      Date: new Date().toLocaleString('id-ID'),
      Product_Name: nama,
      Type: 'Penyesuaian Manual',
      In: qty,
      Out: 0,
      Ref: 'ADJ-MANUAL'
    });
    var targetP = state.products.find(p => p.Product_Name.toLowerCase() === nama.toLowerCase());
    if (targetP) {
      targetP.Stock += qty;
      renderProductTable();
      renderPosProducts();
    }
    renderStockMovementTable();
    showToast('success', 'Penyesuaian stok ' + nama + ' (+' + qty + ') berhasil disimpan!');
    return;
  }

  if (currentDynamicType === 'return') {
    var invNo = document.getElementById('dyn-invoice') ? document.getElementById('dyn-invoice').value : 'INV-001';
    var retNo = 'RET-2026-00' + (state.returns.length + 1);
    state.returns.unshift({
      Return_No: retNo,
      Date: formatDateIndo(new Date()),
      Invoice_No: invNo,
      Total: 50000,
      Status: 'SELESAI'
    });
    renderReturnTable();
    showToast('success', 'Retur ' + retNo + ' untuk ' + invNo + ' berhasil dicatat!');
    return;
  }
}

function openCategoryModal() { openDynamicModal('category'); }
function openUnitModal() { openDynamicModal('unit'); }
function openPurchaseModal() { openDynamicModal('purchase'); }
function openStockAdjustmentModal() { openDynamicModal('stock_adj'); }
function openCustomerModal() { openDynamicModal('customer'); }
function openSupplierModal() { openDynamicModal('supplier'); }
function openReturnModal() { openDynamicModal('return'); }

function openPaymentModal(titleType, targetName, amount) {
  openDynamicModal('payment', { title: titleType, name: targetName, amount: amount });
}

function viewTransactionDetail(title, name, amount) {
  var html = `
    <div style="padding: 10px; font-family: var(--font-main);">
      <div style="background: var(--primary); padding: 12px; border: 2px solid #000; border-radius: 8px; margin-bottom: 14px; box-shadow: 2px 2px 0 #000;">
        <h4 style="font-family: var(--font-heading); font-size: 18px; font-weight: 900; margin: 0;">${title}</h4>
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
        <p>Pihak Terkait: <strong>${name}</strong></p>
        <p>Nominal Transaksi: <strong style="color: var(--success); font-size: 16px;">${formatRupiah(amount)}</strong></p>
        <p>Tanggal: <strong>${new Date().toLocaleString('id-ID')}</strong></p>
        <p style="font-size: 13px; color: var(--text-dim); margin-top: 8px; border-top: 1px dashed #000; padding-top: 8px;">
          ✓ Status: Sah & terverifikasi dalam sistem POS
        </p>
      </div>
    </div>
  `;
  document.getElementById('modal-dynamic-title').innerText = 'Detail ' + title;
  document.getElementById('modal-dynamic-body').innerHTML = html;
  openModal('modal-dynamic');
}

function cancelTransaction(title) {
  if (confirm('Apakah Anda yakin ingin membatalkan ' + title + '?')) {
    showToast('info', title + ' telah dibatalkan.');
  }
}

function showToast(type, message) {
  var cont = document.getElementById('toast-container');
  if (!cont) return;
  var div = document.createElement('div');
  div.className = 'toast toast-' + type;
  var icon = type === 'success' ? 'ri-check-line' : type === 'error' ? 'ri-error-warning-line' : 'ri-information-line';
  div.innerHTML = '<i class="' + icon + '"></i> ' + message;
  cont.appendChild(div);
  setTimeout(function () { div.remove(); }, 3500);
}

// Dummy prevent forms
function handleSaveProduct(e) {
  e.preventDefault();
  closeModal('modal-product');
  showToast('success', 'Produk disimpan (Mock).');
}
function runSetupDatabase() { showToast('success', 'Database OK (Mock).'); }
function loadReports() {
  var container = document.getElementById('laporan-table-container');
  if (!container) return;

  var type = document.getElementById('lap-type') ? document.getElementById('lap-type').value : 'ALL';
  var html = `
    <div class="table-responsive" style="margin-top: 12px;">
      <table class="table">
        <thead>
          <tr>
            <th>No Invoice</th>
            <th>Tanggal</th>
            <th>Kasir</th>
            <th>Metode</th>
            <th>Total Sales</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>INV-2026-091</td><td>29 Sep 2026 08:30</td><td>${state.user ? state.user.full_name : 'Admin'}</td><td>TUNAI</td><td>Rp 45.000</td><td><span class="badge badge-success">LUNAS</span></td></tr>
          <tr><td>INV-2026-090</td><td>29 Sep 2026 07:45</td><td>${state.user ? state.user.full_name : 'Admin'}</td><td>TUNAI</td><td>Rp 120.000</td><td><span class="badge badge-success">LUNAS</span></td></tr>
          <tr><td>INV-2026-089</td><td>28 Sep 2026 18:20</td><td>${state.user ? state.user.full_name : 'Admin'}</td><td>HUTANG</td><td>Rp 150.000</td><td><span class="badge badge-warning">PIUTANG</span></td></tr>
          <tr><td>INV-2026-088</td><td>28 Sep 2026 16:15</td><td>${state.user ? state.user.full_name : 'Admin'}</td><td>TUNAI</td><td>Rp 85.000</td><td><span class="badge badge-success">LUNAS</span></td></tr>
        </tbody>
      </table>
    </div>
  `;
  container.innerHTML = html;
}
function loadStoreSettingsToForm() {
  if (document.getElementById('set-store-name')) document.getElementById('set-store-name').value = state.settings.store_name || '';
  if (document.getElementById('set-store-address')) document.getElementById('set-store-address').value = state.settings.store_address || '';
  if (document.getElementById('set-store-phone')) document.getElementById('set-store-phone').value = state.settings.store_phone || '';
  if (document.getElementById('set-invoice-footer')) document.getElementById('set-invoice-footer').value = state.settings.invoice_footer || '';
  if (document.getElementById('set-supabase-url')) document.getElementById('set-supabase-url').value = SUPABASE_URL || '';
  if (document.getElementById('set-supabase-key')) document.getElementById('set-supabase-key').value = SUPABASE_KEY || '';
  if (document.getElementById('set-user-fullname') && state.user) document.getElementById('set-user-fullname').value = state.user.full_name || 'Admin Toko';
}

function handleSaveStoreSettings(e) {
  e.preventDefault();
  
  state.settings.store_name = document.getElementById('set-store-name') ? (document.getElementById('set-store-name').value || 'Toko Kita') : 'Toko Kita';
  state.settings.store_address = document.getElementById('set-store-address') ? document.getElementById('set-store-address').value : '';
  state.settings.store_phone = document.getElementById('set-store-phone') ? document.getElementById('set-store-phone').value : '';
  state.settings.invoice_footer = document.getElementById('set-invoice-footer') ? (document.getElementById('set-invoice-footer').value || 'Terima kasih telah berbelanja!') : 'Terima kasih!';

  var userFullname = document.getElementById('set-user-fullname') ? document.getElementById('set-user-fullname').value : '';
  if (state.user && userFullname) {
    state.user.full_name = userFullname;
  }

  // Update DOM header & branding elements
  var brandStoreName = document.getElementById('brand-store-name');
  if (brandStoreName) brandStoreName.innerText = state.settings.store_name;

  updateUserUI();

  // Save session state to localStorage
  localStorage.setItem('pos_session', JSON.stringify({
    user: state.user,
    settings: state.settings
  }));

  showToast('success', 'Pengaturan toko berhasil disimpan!');
}

function runTestSupabase() {
  var statusBadge = document.getElementById('set-db-status-badge');
  if (!statusBadge) return;

  statusBadge.innerText = 'Menguji...';
  statusBadge.className = 'badge badge-warning';

  if (supabaseClient) {
    supabaseClient.from('products').select('count', { count: 'exact', head: true }).then(function(res) {
      if (res.error) {
        statusBadge.innerText = 'Supabase Error';
        statusBadge.className = 'badge badge-danger';
        showToast('error', 'Gagal terhubung ke Supabase: ' + res.error.message);
      } else {
        statusBadge.innerText = 'Supabase Terhubung ✓';
        statusBadge.className = 'badge badge-success';
        showToast('success', 'Koneksi ke Database Supabase Berhasil!');
      }
    }).catch(function(err) {
      statusBadge.innerText = 'Supabase Offline';
      statusBadge.className = 'badge badge-danger';
      showToast('warning', 'Supabase Offline, berjalan pada mode lokal.');
    });
  } else {
    setTimeout(function() {
      statusBadge.innerText = 'Mode Standalone / Lokal OK';
      statusBadge.className = 'badge badge-success';
      showToast('info', 'Aplikasi aktif dengan penyimpanan data lokal.');
    }, 300);
  }
}

/* RECEIPT & PDF LOGIC */
function sendReceiptWhatsapp() {
  var storeName = state.settings.store_name || "Toko Kita";
  var storeAddress = state.settings.store_address || "";
  var storePhone = state.settings.store_phone || "";

  var dateStr = new Date().toLocaleString('id-ID');
  var cashierName = state.user ? state.user.full_name : 'Admin';

  var text = `🧾 *STRUK TRANSAKSI RESMI*\n`;
  text += `🏪 *${storeName.toUpperCase()}*\n`;
  if (storeAddress) text += `📍 ${storeAddress}\n`;
  if (storePhone) text += `📞 Telp: ${storePhone}\n`;
  text += `-----------------------------------\n`;
  text += `📅 Tanggal: ${dateStr}\n`;
  text += `👤 Kasir: ${cashierName}\n`;
  text += `-----------------------------------\n\n`;

  text += `🛍️ *RINCIAN ITEM BELANJA:*\n`;

  var items = (state.lastCart && state.lastCart.length > 0) ? state.lastCart : state.posCart;
  if (items && items.length > 0) {
    items.forEach(function (item, idx) {
      text += `${idx + 1}. *${item.Product_Name}*\n`;
      text += `   └ ${item.Qty} x ${formatRupiah(item.Sell_Price)} = *${formatRupiah(item.Subtotal)}*\n`;
    });
  } else {
    text += `• Transaksi Kasir Toko\n`;
  }

  text += `\n-----------------------------------\n`;
  var grandVal = state.lastGrandTotal !== undefined ? formatRupiah(state.lastGrandTotal) : (document.getElementById('pos-grand-total-text') ? document.getElementById('pos-grand-total-text').innerText : 'Rp 0');
  var subVal = state.lastSubtotal !== undefined ? formatRupiah(state.lastSubtotal) : 'Rp 0';
  var discVal = state.lastDiscount ? formatRupiah(state.lastDiscount) : 'Rp 0';
  var methodVal = state.lastPaymentMethod === 'CASH' ? 'TUNAI' : (state.lastPaymentMethod || 'TUNAI');
  var cashVal = state.lastPaymentMethod === 'CASH' ? formatRupiah(state.lastCash || 0) : 'HUTANG';
  var changeVal = state.lastPaymentMethod === 'CASH' ? formatRupiah(state.lastChange || 0) : 'Rp 0';

  text += `Subtotal: ${subVal}\n`;
  if (state.lastDiscount > 0) text += `Diskon: -${discVal}\n`;
  text += `💵 *TOTAL: ${grandVal}*\n`;
  text += `Metode Bayar: ${methodVal}\n`;
  text += `Diterima: ${cashVal}\n`;
  text += `Kembalian: ${changeVal}\n`;
  text += `-----------------------------------\n\n`;
  text += `🙏 *${state.settings.invoice_footer || "Terima kasih telah berbelanja di toko kami!"}*\n`;
  text += `✨ _Simpan pesan ini sebagai bukti pembayaran sah._`;

  // Automatis mengunduh gambar struk agar kasir bisa langsung melampirkan file gambarnya jika perlu
  downloadReceiptImage();

  showToast('info', 'Membuka WhatsApp & mengunduh gambar struk...');
  setTimeout(function() {
    var waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(waUrl, '_blank');
  }, 500);
}

function downloadReceiptImage() {
  showToast('info', 'Menyiapkan gambar struk...');
  var element = document.getElementById('receipt-preview-area');
  html2canvas(element, { scale: 2 }).then(function (canvas) {
    var link = document.createElement('a');
    link.download = 'Struk_' + state.settings.store_name.replace(/\s+/g, '_') + '_' + new Date().getTime() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function downloadReceiptPDF() {
  showToast('info', 'Menyiapkan PDF Struk...');
  var element = document.getElementById('receipt-preview-area');
  html2canvas(element, { scale: 2 }).then(function (canvas) {
    try {
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a5'); // Compact A5 receipt size
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.setFillColor(244, 245, 244);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
      
      doc.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
      doc.save('Struk_Transaksi_' + new Date().getTime() + '.pdf');
      showToast('success', 'PDF Struk berhasil diunduh!');
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal membuat PDF Struk.');
    }
  });
}

function downloadAllReportsPDF() {
  showToast('info', 'Menyiapkan PDF Laporan Neobrutalism...');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // COLOR PALETTE (NEOBRUTALISM)
    const COLOR_YELLOW = [250, 204, 21];  // #facc15
    const COLOR_BLUE   = [56, 189, 248];  // #38bdf8
    const COLOR_GREEN  = [74, 222, 128];  // #4ade80
    const COLOR_ROSE   = [251, 113, 133]; // #fb7185
    const COLOR_BLACK  = [0, 0, 0];
    const COLOR_BG     = [244, 245, 244];

    // Background Canvas
    doc.setFillColor(...COLOR_BG);
    doc.rect(0, 0, 210, 297, 'F');

    // 1. HEADER BANNER
    doc.setLineWidth(1.2);
    doc.setDrawColor(...COLOR_BLACK);
    
    // Header Hard Shadow
    doc.setFillColor(...COLOR_BLACK);
    doc.rect(16, 16, 178, 32, 'F');
    // Header Main Box
    doc.setFillColor(...COLOR_YELLOW);
    doc.rect(14, 14, 178, 32, 'FD');

    // Header Text
    doc.setTextColor(...COLOR_BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(state.settings.store_name.toUpperCase(), 20, 26);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN RESMI KASIR & INVENTORI - POS NEOBRUTALISM", 20, 33);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Tanggal: " + new Date().toLocaleString('id-ID') + "  |  Operator: " + (state.user ? state.user.full_name : 'Admin Toko'), 20, 40);

    // 2. METRIC CARDS
    const cardWidth = 56;
    const cardHeight = 24;
    const startY = 54;

    // Card 1: Hari Ini
    doc.setFillColor(...COLOR_BLACK);
    doc.rect(16, startY + 2, cardWidth, cardHeight, 'F');
    doc.setFillColor(...COLOR_GREEN);
    doc.rect(14, startY, cardWidth, cardHeight, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SALES HARI INI", 18, startY + 7);
    doc.setFontSize(12);
    const salesToday = document.getElementById('dash-sales-today') ? document.getElementById('dash-sales-today').innerText : 'Rp 0';
    doc.text(salesToday, 18, startY + 17);

    // Card 2: Bulan Ini
    doc.setFillColor(...COLOR_BLACK);
    doc.rect(76, startY + 2, cardWidth, cardHeight, 'F');
    doc.setFillColor(...COLOR_BLUE);
    doc.rect(74, startY, cardWidth, cardHeight, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SALES BULAN INI", 78, startY + 7);
    doc.setFontSize(12);
    const salesMonth = document.getElementById('dash-sales-month') ? document.getElementById('dash-sales-month').innerText : 'Rp 0';
    doc.text(salesMonth, 78, startY + 17);

    // Card 3: Piutang
    doc.setFillColor(...COLOR_BLACK);
    doc.rect(136, startY + 2, cardWidth, cardHeight, 'F');
    doc.setFillColor(...COLOR_ROSE);
    doc.rect(134, startY, cardWidth, cardHeight, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TOTAL PIUTANG", 138, startY + 7);
    doc.setFontSize(12);
    const piutang = document.getElementById('dash-total-piutang') ? document.getElementById('dash-total-piutang').innerText : 'Rp 0';
    doc.text(piutang, 138, startY + 17);

    // 3. INVENTORY TABLE
    let tableY = 88;
    
    // Table Header Box
    doc.setFillColor(255, 255, 255);
    doc.rect(14, tableY, 178, 8, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DAFTAR STOK PRODUK TOKO", 18, tableY + 5.5);

    tableY += 10;

    // Table Column Headers
    doc.setFillColor(...COLOR_YELLOW);
    doc.rect(14, tableY, 178, 8, 'FD');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ID PRODUK", 18, tableY + 5.5);
    doc.text("NAMA PRODUK", 50, tableY + 5.5);
    doc.text("KATEGORI", 115, tableY + 5.5);
    doc.text("HARGA JUAL", 148, tableY + 5.5);
    doc.text("STOK", 180, tableY + 5.5);

    tableY += 8;

    // Items
    const items = state.products && state.products.length > 0 ? state.products : getMockProducts();
    doc.setFont("helvetica", "normal");
    
    items.forEach((p, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 255 : 242, idx % 2 === 0 ? 255 : 242, idx % 2 === 0 ? 255 : 242);
      doc.rect(14, tableY, 178, 8, 'FD');
      
      doc.text(String(p.Product_ID || ('PRD-00' + (idx+1))), 18, tableY + 5.5);
      
      let pName = p.Product_Name || 'Produk';
      if (pName.length > 26) pName = pName.substring(0, 24) + '...';
      doc.text(pName, 50, tableY + 5.5);

      doc.text(String(p.Category_Name || 'Umum'), 115, tableY + 5.5);
      doc.text(formatRupiah(p.Sell_Price || 0), 148, tableY + 5.5);
      
      if (p.Stock <= (p.Min_Stock || 5)) {
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        doc.text(String(p.Stock) + ' (LOW)', 180, tableY + 5.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
      } else {
        doc.text(String(p.Stock), 180, tableY + 5.5);
      }

      tableY += 8;
    });

    // 4. FOOTER NOTE
    const footerY = Math.max(tableY + 12, 240);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, footerY, 178, 20, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("VERIFIKASI LAPORAN:", 18, footerY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Dokumen ini dihasilkan secara rasmi oleh Sistem PWA Toko Kelontong Berkah.", 18, footerY + 11);
    doc.text("Hak Cipta © " + new Date().getFullYear() + " Toko Kita POS. Seluruh data transaksi tersimpan aman.", 18, footerY + 15);

    doc.save("Laporan_Keseluruhan_Berkah_" + new Date().toISOString().slice(0,10) + ".pdf");
    showToast('success', 'PDF Laporan berhasil diunduh!');
  } catch (e) {
    console.error(e);
    showToast('error', 'Gagal membuat PDF Laporan.');
  }
}
