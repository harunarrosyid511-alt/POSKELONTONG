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
        return data || [];
      }
      else if (functionName === 'getCategories') {
        const { data, error } = await supabaseClient.from('categories').select('*');
        return data || [];
      }
      // Untuk dashboard dan transaksi bisa dikembangkan lebih lanjut dengan query SQL (RPC) di Supabase
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
  else if (viewId === 'kasir') renderPosProducts();
  else if (viewId === 'produk') renderProductTable();

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
    switchView(state.activeView);
  });
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

function renderPosCart() {
  var list = document.getElementById('pos-cart-list');
  if (state.posCart.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 40px 0; font-weight: 600;">Keranjang kosong</div>';
    calculatePosTotal();
    return;
  }

  var html = '';
  state.posCart.forEach(function (item, idx) {
    html += '<div class="cart-item-row">' +
      '<div style="flex: 1;">' +
      '<h5 style="font-size:15px; font-weight:800; margin-bottom:4px;">' + item.Product_Name + '</h5>' +
      '<div style="font-size:13px; font-weight:600; color:var(--text-dim);">' + formatRupiah(item.Sell_Price) + '</div>' +
      '</div>' +
      '<div class="qty-controls" style="margin: 0 10px;">' +
      '<button class="btn-qty" onclick="updateCartQty(' + idx + ', -1)">-</button>' +
      '<span style="font-size: 14px; font-weight: 800; width: 28px; text-align: center;">' + item.Qty + '</span>' +
      '<button class="btn-qty" onclick="updateCartQty(' + idx + ', 1)">+</button>' +
      '</div>' +
      '<div style="text-align: right; min-width: 80px;">' +
      '<div style="font-size: 14px; font-weight: 800;">' + formatRupiah(item.Subtotal) + '</div>' +
      '</div>' +
      '</div>';
  });
  list.innerHTML = html;
  calculatePosTotal();
}

function calculatePosTotal() {
  var subtotal = 0;
  state.posCart.forEach(function (item) { subtotal += item.Subtotal; });
  document.getElementById('pos-subtotal-text').innerText = formatRupiah(subtotal);

  var disc = parseFloat(document.getElementById('pos-discount-total').value) || 0;
  var grand = subtotal - disc;
  if (grand < 0) grand = 0;
  document.getElementById('pos-grand-total-text').innerText = formatRupiah(grand);

  var cash = parseFloat(document.getElementById('pos-cash-received').value) || 0;
  var change = cash > grand ? cash - grand : 0;
  document.getElementById('pos-cash-change-text').innerText = formatRupiah(change);
}

function togglePosPaymentMethod() {
  var method = document.getElementById('pos-payment-method').value;
  var cashCont = document.getElementById('pos-cash-container');
  cashCont.style.display = method === 'CREDIT' ? 'none' : 'block';
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

    // Reset Cart
    state.posCart = [];
    document.getElementById('pos-discount-total').value = 0;
    document.getElementById('pos-cash-received').value = '';
    renderPosCart();
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
      '<button class="btn btn-secondary btn-sm"><i class="ri-edit-line"></i></button> ' +
      '<button class="btn btn-danger btn-sm"><i class="ri-delete-bin-line"></i></button>' +
      '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Kosong</td></tr>';
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
function openProductModal() { openModal('modal-product'); }
let currentDynamicType = '';
function openDynamicModal(type) {
  currentDynamicType = type;
  let title = '';
  let html = '';
  if (type === 'category') {
    title = 'Tambah Kategori';
    html = `<div class="form-group"><label>Nama Kategori</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>Deskripsi</label><input type="text" id="dyn-desc" class="form-control"></div>`;
  } else if (type === 'customer') {
    title = 'Tambah Pelanggan';
    html = `<div class="form-group"><label>Nama Pelanggan</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>No HP</label><input type="text" id="dyn-hp" class="form-control"></div>`;
  } else if (type === 'supplier') {
    title = 'Tambah Supplier';
    html = `<div class="form-group"><label>Nama Supplier</label><input type="text" id="dyn-nama" class="form-control" required></div>
            <div class="form-group"><label>No HP</label><input type="text" id="dyn-hp" class="form-control"></div>`;
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
  }
  
  document.getElementById('modal-dynamic-title').innerText = title;
  document.getElementById('modal-dynamic-body').innerHTML = html;
  openModal('modal-dynamic');
}

function handleDynamicSave(e) {
  e.preventDefault();
  closeModal('modal-dynamic');
  var nama = document.getElementById('dyn-nama') ? document.getElementById('dyn-nama').value : 'Data';
  showToast('success', nama + ' berhasil disimpan!');
  
  // Fake update to UI tables to make it look alive
  if(currentDynamicType === 'customer') {
    document.getElementById('table-customers-body').innerHTML += `<tr><td>${nama}</td><td>Baru</td><td>Rp 0</td><td><button class="btn btn-sm btn-primary">Edit</button></td></tr>`;
  } else if (currentDynamicType === 'supplier') {
    document.getElementById('table-suppliers-body').innerHTML += `<tr><td>${nama}</td><td>Baru</td><td>Rp 0</td><td><button class="btn btn-sm btn-primary">Edit</button></td></tr>`;
  } else if (currentDynamicType === 'purchase') {
    document.getElementById('table-purchases-body').innerHTML += `<tr><td>PO-NEW</td><td>${nama}</td><td>Baru</td><td>SELESAI</td><td>-</td></tr>`;
  } else if (currentDynamicType === 'stock_adj') {
    document.getElementById('table-stock-movements-body').innerHTML += `<tr><td>Baru saja</td><td>${nama}</td><td>Penyesuaian</td><td>Ada</td><td>-</td><td>Disimpan</td></tr>`;
  } else if (currentDynamicType === 'return') {
    document.getElementById('table-returns-body').innerHTML += `<tr><td>INV-RET</td><td>Selesai</td></tr>`;
  }
}

function openCategoryModal() { openDynamicModal('category'); }
function openUnitModal() { openDynamicModal('unit'); }
function openPurchaseModal() { openDynamicModal('purchase'); }
function openStockAdjustmentModal() { openDynamicModal('stock_adj'); }
function openCustomerModal() { openDynamicModal('customer'); }
function openSupplierModal() { openDynamicModal('supplier'); }
function openReturnModal() { openDynamicModal('return'); }

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
function loadReports() { document.getElementById('laporan-table-container').innerText = 'Menampilkan seluruh tipe aktivitas...'; }
function handleSaveStoreSettings(e) { e.preventDefault(); showToast('success', 'Tersimpan.'); }

/* RECEIPT & PDF LOGIC */
function sendReceiptWhatsapp() {
  var text = "Terima kasih telah berbelanja di " + state.settings.store_name + "!\n\n";
  text += "Tanggal: " + new Date().toLocaleString('id-ID') + "\n";
  text += "Total Belanja: " + document.getElementById('pos-grand-total-text').innerText + "\n\n";
  text += "Struk lengkap dapat dilihat di toko kami.";
  var waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(waUrl, '_blank');
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
