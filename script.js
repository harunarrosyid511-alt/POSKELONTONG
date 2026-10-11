/**
 * Toko Kita POS Web Application Engine
 * Frontend JavaScript controller for Vercel Deployment with Supabase integration
 */

// Only the public anon key belongs in a browser. Database RLS protects access.
const SUPABASE_URL = window.POS_CONFIG && window.POS_CONFIG.supabaseUrl || '';
const SUPABASE_KEY = window.POS_CONFIG && window.POS_CONFIG.supabaseAnonKey || '';
let supabaseClient = null;
let supabaseConfigError = '';

function isServiceRoleKey(key) {
  if (key.indexOf('sb_secret_') === 0) return true;
  var segments = key.split('.');
  if (segments.length !== 3) return false;
  try {
    var payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    payload += '='.repeat((4 - payload.length % 4) % 4);
    return JSON.parse(atob(payload)).role === 'service_role';
  } catch (error) {
    return false;
  }
}

if (SUPABASE_KEY && isServiceRoleKey(SUPABASE_KEY)) {
  supabaseConfigError = 'service_role tidak boleh digunakan pada aplikasi browser. Gunakan anon/publishable key.';
  console.error(supabaseConfigError);
} else if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    supabaseConfigError = 'Konfigurasi Supabase tidak valid: ' + error.message;
    console.error(supabaseConfigError);
  }
}

// GLOBAL STATE
var state = {
  user: null,
  settings: { store_name: 'Toko Kita', store_address: '', store_phone: '', invoice_footer: 'Terima kasih telah berbelanja!' },
  products: [],
  categories: [],
  masterDataLoaded: false,
  units: [],
  customers: [],
  suppliers: [],
  purchases: [],
  stockMovements: [],
  returns: [],
  salesTransactions: [],
  paymentHistory: [],
  posCart: [],
  isSubmittingSale: false,
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

function localDateInputValue(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function parseLocalDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  var parts = value.split('-').map(Number);
  var date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 &&
    date.getDate() === parts[2] ? date : null;
}

function getPeriodRange(period, startValue, endValue, now) {
  var today = new Date(now || new Date());
  today.setHours(0, 0, 0, 0);
  var start = new Date(today);
  var endExclusive = new Date(today);
  endExclusive.setDate(endExclusive.getDate() + 1);

  if (period === 'WEEKLY') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'MONTHLY') {
    start.setDate(1);
  } else if (period === 'CUSTOM') {
    start = parseLocalDateInput(startValue);
    var end = parseLocalDateInput(endValue);
    if (!start || !end || end < start) return null;
    endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
  } else if (period !== 'DAILY') {
    return null;
  }

  var labels = { DAILY: 'Harian', WEEKLY: 'Mingguan', MONTHLY: 'Bulanan', CUSTOM: 'Rentang pilihan' };
  var endInclusive = new Date(endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return {
    period: period,
    start: start,
    endExclusive: endExclusive,
    label: labels[period] + ' (' + formatDateIndo(start) +
      (start.getTime() === endInclusive.getTime() ? '' : ' - ' + formatDateIndo(endInclusive)) + ')'
  };
}

function getSelectedPeriodRange(scope) {
  var periodSelect = document.getElementById(scope + '-period');
  var startInput = document.getElementById(scope + '-date-from');
  var endInput = document.getElementById(scope + '-date-to');
  return periodSelect ? getPeriodRange(periodSelect.value,
    startInput ? startInput.value : '', endInput ? endInput.value : '') : null;
}

function handlePeriodChange(scope) {
  var periodSelect = document.getElementById(scope + '-period');
  var customFields = document.getElementById(scope + '-custom-fields');
  var startInput = document.getElementById(scope + '-date-from');
  var endInput = document.getElementById(scope + '-date-to');
  if (!periodSelect) return;
  var isCustom = periodSelect.value === 'CUSTOM';
  if (customFields) customFields.hidden = !isCustom;
  if (isCustom) {
    var todayValue = localDateInputValue(new Date());
    if (startInput && !startInput.value) startInput.value = todayValue;
    if (endInput && !endInput.value) endInput.value = todayValue;
    if (scope === 'dashboard') loadDashboardStats();
    else if (scope === 'reports') loadReports();
    return;
  }
  if (scope === 'dashboard') loadDashboardStats();
  else if (scope === 'reports') loadReports();
}

function applyPeriodFilter(scope) {
  var range = getSelectedPeriodRange(scope);
  if (!range) {
    showToast('warning', 'Pilih tanggal awal dan akhir yang valid. Tanggal akhir tidak boleh sebelum tanggal awal.');
    return;
  }
  if (scope === 'dashboard') loadDashboardStats();
  else if (scope === 'reports') loadReports();
}

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character];
  });
}

function setAuthenticatedView(isAuthenticated) {
  var protectedElements = [document.getElementById('sidebar'), document.getElementById('main-wrapper')];
  protectedElements.forEach(function (element) {
    if (!element) return;
    if (isAuthenticated) {
      element.removeAttribute('inert');
      element.setAttribute('aria-hidden', 'false');
    } else {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    }
  });
}

function requireSupabase() {
  if (!supabaseClient) throw new Error(supabaseConfigError ||
    'Supabase belum dikonfigurasi. Isi URL proyek dan anon key publik di config.js.');
  return supabaseClient;
}

async function queryData(query) {
  var result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function mapProduct(row) {
  return {
    Product_ID: row.product_id, Barcode: row.barcode || '', Product_Name: row.product_name,
    Category_ID: row.category_id || '', Category_Name: row.categories ? row.categories.category_name : '',
    Base_Unit: row.base_unit || 'PCS', Buy_Price_WAC: Number(row.buy_price_wac) || 0,
    Sell_Price: Number(row.sell_price) || 0, Stock: Number(row.stock) || 0,
    Min_Stock: Number(row.min_stock) || 0, Is_Active: row.is_active !== false
  };
}

function mapCustomer(row) {
  return {
    Customer_ID: row.customer_id, Customer_Name: row.customer_name, Phone: row.phone || '-',
    Address: row.address || '', Piutang: Number(row.total_piutang) || 0,
    Saldo: Number(row.saldo_pelanggan) || 0, Is_Active: row.is_active !== false
  };
}

function mapSupplier(row) {
  return {
    Supplier_ID: row.supplier_id, Supplier_Name: row.supplier_name, Phone: row.phone || '-',
    Address: row.address || '', Hutang: Number(row.total_hutang) || 0, Is_Active: row.is_active !== false
  };
}

function mapSale(row) {
  var customer = state.customers.find(function (item) { return item.Customer_ID === row.customer_id; });
  return {
    Invoice_No: row.invoice_no, Date: row.created_at, Cashier: row.cashier_id || '',
    Customer_ID: row.customer_id, Customer_Name: row.customers ? row.customers.customer_name : customer ? customer.Customer_Name : 'Pelanggan',
    Payment_Method: row.payment_method, Payment_Status: row.status, Subtotal: Number(row.subtotal) || 0,
    Discount: Number(row.discount_total) || 0, Total: Number(row.grand_total) || 0,
    Balance_Used: Number(row.balance_used) || 0, Amount_Paid: Number(row.amount_paid) || 0,
    Amount_Due: Number(row.amount_due) || 0, Cash_Received: Number(row.cash_received) || 0,
    Change_Given: Number(row.cash_change) || 0, Debt_Payment: Number(row.debt_payment) || 0,
    Customer_Balance_Added: Number(row.balance_added) || 0,
    Items: (row.sales_items || []).map(function (item) {
      return { Product_ID: item.product_id, Product_Name: item.product_name, Qty: Number(item.qty) || 0,
        Sell_Price: Number(item.sell_price) || 0, Subtotal: Number(item.subtotal) || 0, Sales_Item_ID: item.item_id };
    })
  };
}

function mapPurchase(row) {
  return {
    Purchase_No: row.purchase_no, Supplier_ID: row.supplier_id,
    Supplier_Name: row.suppliers ? row.suppliers.supplier_name : '', Total: Number(row.total) || 0,
    Status: row.status, Payment_Method: row.payment_method, Payment_Status: row.payment_status,
    Debt_Added: Number(row.debt_added) || 0, Date: row.created_at,
    Items: (row.purchase_items || []).map(function (item) {
      return { Product_ID: item.product_id, Product_Name: item.product_name, Qty: Number(item.qty) || 0,
        Unit_Price: Number(item.unit_price) || 0, Subtotal: Number(item.subtotal) || 0 };
    })
  };
}

async function callApi(functionName) {
  var args = Array.prototype.slice.call(arguments, 1);
  var client = requireSupabase();

  if (functionName === 'loginUser') {
    var auth = await client.auth.signInWithPassword({ email: args[0], password: args[1] });
    if (auth.error) throw new Error(auth.error.message);
    var profile = await queryData(client.from('staff_profiles').select('user_id, full_name, role, is_active')
      .eq('user_id', auth.data.user.id).maybeSingle());
    if (!profile || !profile.is_active) {
      await client.auth.signOut();
      throw new Error('Akun belum didaftarkan sebagai staf aktif toko.');
    }
    return { success: true, user: { user_id: profile.user_id, username: auth.data.user.email,
      full_name: profile.full_name, role: profile.role }, message: 'Login berhasil.' };
  }
  if (functionName === 'getProfile') {
    var currentSession = await client.auth.getSession();
    if (currentSession.error) throw new Error(currentSession.error.message);
    if (!currentSession.data.session) return null;
    var currentUser = currentSession.data.session.user;
    var currentProfile = await queryData(client.from('staff_profiles').select('user_id, full_name, role, is_active')
      .eq('user_id', currentUser.id).maybeSingle());
    if (!currentProfile || !currentProfile.is_active) {
      var inactiveSignOut = await client.auth.signOut();
      if (inactiveSignOut.error) throw new Error(inactiveSignOut.error.message);
      return null;
    }
    return { user_id: currentProfile.user_id, username: currentUser.email,
      full_name: currentProfile.full_name, role: currentProfile.role };
  }
  if (functionName === 'getProducts') {
    return (await queryData(client.from('products').select('*, categories(category_name)').order('product_name')))
      .filter(function (row) { return row.is_active; }).map(mapProduct);
  }
  if (functionName === 'getCategories') {
    return (await queryData(client.from('categories').select('*').order('category_name'))).map(function (row) {
      return { Category_ID: row.category_id, Category_Name: row.category_name, Description: row.description || '' };
    });
  }
  if (functionName === 'getUnits') {
    return (await queryData(client.from('units').select('*').order('unit_name'))).map(function (row) {
      return { Unit_ID: row.unit_id, Unit_Name: row.unit_name, Base_Unit: row.base_unit,
        Conversion_Factor: Number(row.conversion_factor) || 1 };
    });
  }
  if (functionName === 'getCustomers') return (await queryData(client.from('customers').select('*').order('customer_name'))).map(mapCustomer);
  if (functionName === 'getSuppliers') return (await queryData(client.from('suppliers').select('*').order('supplier_name'))).map(mapSupplier);
  if (functionName === 'getPurchases') {
    return (await queryData(client.from('purchases').select('*, suppliers(supplier_name), purchase_items(*)')
      .order('created_at', { ascending: false }))).map(mapPurchase);
  }
  if (functionName === 'getStockMovements') {
    return (await queryData(client.from('stock_movements').select('*').order('created_at', { ascending: false }))).map(function (row) {
      return { ID: row.movement_id, Date: row.created_at, Product_ID: row.product_id, Product_Name: row.product_name,
        Type: row.movement_type, In: Number(row.qty_in) || 0, Out: Number(row.qty_out) || 0, Ref: row.reference_no };
    });
  }
  if (functionName === 'getReturns') {
    return (await queryData(client.from('returns').select('*, return_items(*)').order('created_at', { ascending: false }))).map(function (row) {
      return { Return_No: row.return_no, Date: row.created_at, Invoice_No: row.invoice_no,
        Customer_ID: row.customer_id, Total: Number(row.total) || 0,
        Settlement_Method: row.settlement_method, Status: row.status,
        Items: (row.return_items || []).map(function (item) {
          return { Sales_Item_ID: item.sales_item_id, Qty: Number(item.qty) || 0 };
        }) };
    });
  }
  if (functionName === 'getSales') {
    return (await queryData(client.from('sales').select('*, customers(customer_name), sales_items(*)')
      .order('created_at', { ascending: false }))).map(mapSale);
  }
  if (functionName === 'getPayments') {
    return (await queryData(client.from('payments').select('*').order('created_at', { ascending: false }))).map(function (row) {
      return { Payment_No: row.payment_no, Date: row.created_at,
        Type: row.payment_type === 'CUSTOMER_RECEIVABLE' ? 'Cicilan piutang pelanggan' : 'Cicilan hutang supplier',
        Party_Name: row.party_name, Method: row.method, Amount: Number(row.amount) || 0,
        Amount_Applied: Number(row.amount_applied) || 0, Remaining_Due: Number(row.remaining_due) || 0,
        Customer_Balance_Added: Number(row.customer_balance_added) || 0, Note: row.note || '' };
    });
  }
  if (functionName === 'getSettings') {
    var rows = await queryData(client.from('settings').select('key, value'));
    return rows.reduce(function (settings, row) { settings[row.key] = row.value; return settings; }, {});
  }
  if (functionName === 'getDashboardStats') {
    var range = args[0] || getPeriodRange('DAILY');
    var periodSales = state.salesTransactions.filter(function (sale) {
      var timestamp = new Date(sale.Date).getTime();
      return Number.isFinite(timestamp) && timestamp >= range.start.getTime() &&
        timestamp < range.endExclusive.getTime();
    });
    var chartBuckets = {};
    var chartLabels = [];
    var chartKeys = [];
    var chartTitle = 'Penjualan per hari';
    if (range.period === 'DAILY') {
      chartLabels = Array.from({ length: 24 }, function (_, hour) {
        var label = String(hour).padStart(2, '0') + '.00';
        chartBuckets[hour] = 0;
        chartKeys.push(hour);
        return label;
      });
      periodSales.forEach(function (sale) {
        chartBuckets[new Date(sale.Date).getHours()] += sale.Total;
      });
      chartTitle = 'Penjualan per jam';
    } else {
      var rangeDays = Math.ceil((range.endExclusive.getTime() - range.start.getTime()) / 86400000);
      if (range.period === 'CUSTOM' && rangeDays > 62) {
        chartTitle = 'Penjualan per bulan';
        var monthCursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
        while (monthCursor < range.endExclusive) {
          var monthKey = monthCursor.getFullYear() + '-' + monthCursor.getMonth();
          chartBuckets[monthKey] = 0;
          chartKeys.push(monthKey);
          chartLabels.push(monthCursor.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));
          monthCursor.setMonth(monthCursor.getMonth() + 1);
        }
        periodSales.forEach(function (sale) {
          var date = new Date(sale.Date);
          chartBuckets[date.getFullYear() + '-' + date.getMonth()] += sale.Total;
        });
      } else {
        var dayCursor = new Date(range.start);
        while (dayCursor < range.endExclusive) {
          var dayKey = localDateInputValue(dayCursor);
          chartBuckets[dayKey] = 0;
          chartKeys.push(dayKey);
          chartLabels.push(dayCursor.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
          dayCursor.setDate(dayCursor.getDate() + 1);
        }
        periodSales.forEach(function (sale) {
          var date = new Date(sale.Date);
          chartBuckets[localDateInputValue(date)] += sale.Total;
        });
      }
    }
    var topProducts = {};
    var paymentCounts = {};
    periodSales.forEach(function (sale) {
      paymentCounts[sale.Payment_Method] = (paymentCounts[sale.Payment_Method] || 0) + 1;
      sale.Items.forEach(function (item) { topProducts[item.Product_Name] = (topProducts[item.Product_Name] || 0) + item.Qty; });
    });
    var lowStock = state.products.filter(function (product) { return product.Stock <= product.Min_Stock; });
    return {
      period_sales: periodSales.reduce(function (sum, sale) { return sum + sale.Total; }, 0),
      period_count: periodSales.length,
      total_piutang: state.customers.reduce(function (sum, customer) { return sum + customer.Piutang; }, 0),
      low_stock_count: lowStock.length,
      low_stock_items: lowStock.map(function (product) { return { Product_Name: product.Product_Name,
        Min_Stock: product.Min_Stock, Stock: product.Stock, Base_Unit: product.Base_Unit }; }),
      chart_period: { labels: chartLabels, values: chartKeys.map(function (key) { return chartBuckets[key] || 0; }),
        title: chartTitle },
      payment_distribution: {
        cash: paymentCounts.CASH || 0, transfer: paymentCounts.TRANSFER || 0,
        qris: paymentCounts.QRIS || 0, credit: paymentCounts.CREDIT || 0
      },
      top_products: Object.keys(topProducts).map(function (name) { return { product_name: name, total_qty: topProducts[name] }; })
        .sort(function (a, b) { return b.total_qty - a.total_qty; }).slice(0, 5)
    };
  }
  if (functionName === 'addProduct' || functionName === 'updateProduct') {
    var product = args[0];
    var productValues = { product_id: product.Product_ID, product_name: product.Product_Name, barcode: product.Barcode || null,
      category_id: product.Category_ID || null, base_unit: product.Base_Unit || 'PCS',
      buy_price_wac: product.Buy_Price_WAC, sell_price: product.Sell_Price,
      min_stock: product.Min_Stock, is_active: product.Is_Active !== false, updated_at: new Date().toISOString() };
    if (functionName === 'addProduct') productValues.stock = product.Stock;
    var productQuery = functionName === 'addProduct'
      ? client.from('products').insert(productValues).select('*, categories(category_name)').single()
      : client.from('products').update(productValues).eq('product_id', product.Product_ID).select('*, categories(category_name)').single();
    return mapProduct(await queryData(productQuery));
  }
  if (functionName === 'deleteProduct') return queryData(client.from('products').delete().eq('product_id', args[0]));
  if (functionName === 'addCategory') {
    var category = args[0];
    return queryData(client.from('categories').insert({ category_id: category.Category_ID,
      category_name: category.Category_Name, description: category.Description }).select().single());
  }
  if (functionName === 'addUnit') {
    var unit = args[0];
    return queryData(client.from('units').insert({ unit_id: unit.Unit_ID, unit_name: unit.Unit_Name,
      base_unit: unit.Base_Unit || unit.Unit_Name }).select().single());
  }
  if (functionName === 'addCustomer' || functionName === 'updateCustomer') {
    var customer = args[0];
    var customerValues = { customer_name: customer.Customer_Name, phone: customer.Phone || null, address: customer.Address || null };
    var customerQuery = functionName === 'addCustomer'
      ? client.from('customers').insert(Object.assign({ customer_id: customer.Customer_ID,
        total_piutang: 0, saldo_pelanggan: 0 }, customerValues)).select().single()
      : client.from('customers').update(Object.assign(customerValues, {
        is_active: customer.Is_Active })).eq('customer_id', customer.Customer_ID).select().single();
    return mapCustomer(await queryData(customerQuery));
  }
  if (functionName === 'toggleCustomer') return queryData(client.from('customers').update({ is_active: args[1] }).eq('customer_id', args[0]));
  if (functionName === 'deleteCustomer') return queryData(client.from('customers').delete().eq('customer_id', args[0]));
  if (functionName === 'addSupplier' || functionName === 'updateSupplier') {
    var supplier = args[0];
    var supplierValues = { supplier_name: supplier.Supplier_Name, phone: supplier.Phone || null, address: supplier.Address || null };
    var supplierQuery = functionName === 'addSupplier'
      ? client.from('suppliers').insert(Object.assign({ supplier_id: supplier.Supplier_ID,
        total_hutang: 0 }, supplierValues)).select().single()
      : client.from('suppliers').update(Object.assign(supplierValues, {
        is_active: supplier.Is_Active })).eq('supplier_id', supplier.Supplier_ID).select().single();
    return mapSupplier(await queryData(supplierQuery));
  }
  if (functionName === 'toggleSupplier') return queryData(client.from('suppliers').update({ is_active: args[1] }).eq('supplier_id', args[0]));
  if (functionName === 'deleteSupplier') return queryData(client.from('suppliers').delete().eq('supplier_id', args[0]));
  if (functionName === 'processSale') {
    var saleResult = await queryData(client.rpc('process_sale', { p_customer_name: args[0].customerName, p_customer_phone: args[0].customerPhone,
      p_payment_method: args[0].method, p_discount: args[0].discount, p_cash_received: args[0].cashReceived,
      p_retain_change: args[0].retainChange, p_items: args[0].items }));
    if (!saleResult || !saleResult.success || !saleResult.invoice_no) throw new Error('Konfirmasi transaksi dari database tidak valid.');
    return saleResult;
  }
  if (functionName === 'createPurchase') {
    var purchaseResult = await queryData(client.rpc('create_purchase', { p_supplier_id: args[0], p_payment_method: args[1], p_items: args[2] }));
    if (!purchaseResult || !purchaseResult.success || !purchaseResult.purchase_no) throw new Error('Konfirmasi pembelian dari database tidak valid.');
    return purchaseResult;
  }
  if (functionName === 'deletePurchase') {
    var deleteResult = await queryData(client.rpc('delete_purchase', { p_purchase_no: args[0] }));
    if (!deleteResult || !deleteResult.success) throw new Error('Database tidak mengonfirmasi pembatalan pembelian.');
    return deleteResult;
  }
  if (functionName === 'recordPayment') {
    var paymentResult = await queryData(client.rpc('record_payment', { p_payment_type: args[0], p_party_id: args[1],
      p_method: args[2], p_amount: args[3], p_note: args[4] || '' }));
    if (!paymentResult || !paymentResult.success || !paymentResult.payment_no) throw new Error('Konfirmasi pembayaran dari database tidak valid.');
    return paymentResult;
  }
  if (functionName === 'adjustStock') {
    var stockResult = await queryData(client.rpc('adjust_stock', { p_product_id: args[0], p_quantity: args[1], p_note: args[2] || '' }));
    if (!stockResult || !stockResult.success || !stockResult.reference_no) throw new Error('Konfirmasi penyesuaian stok dari database tidak valid.');
    return stockResult;
  }
  if (functionName === 'createReturn') {
    var returnResult = await queryData(client.rpc('create_return', { p_invoice_no: args[0], p_sales_item_id: args[1],
      p_quantity: args[2], p_settlement_method: args[3] }));
    if (!returnResult || !returnResult.success || !returnResult.return_no) throw new Error('Konfirmasi retur dari database tidak valid.');
    return returnResult;
  }
  if (functionName === 'saveSettings') {
    var settingRows = Object.keys(args[0]).map(function (key) {
      return { key: key, value: args[0][key], updated_at: new Date().toISOString() };
    });
    return queryData(client.from('settings').upsert(settingRows, { onConflict: 'key' }));
  }
  if (functionName === 'resetStoreData') {
    var resetResult = await queryData(client.rpc('reset_store_data'));
    if (!resetResult || resetResult.success !== true) throw new Error('Database tidak mengonfirmasi reset data toko.');
    return resetResult;
  }
  if (functionName === 'logoutUser') {
    var logout = await client.auth.signOut();
    if (logout.error) throw new Error(logout.error.message);
    return true;
  }
  throw new Error('Operasi API tidak dikenal: ' + functionName);
}

/* AUTHENTICATION */
async function checkStoredSession() {
  var status = document.getElementById('login-config-state');
  var loginButton = document.getElementById('btn-login-submit');
  if (!supabaseClient) {
    if (status) status.textContent = supabaseConfigError ||
      (!SUPABASE_URL || !SUPABASE_KEY
        ? 'Aplikasi belum dikonfigurasi. Hubungi administrator toko.'
        : 'Pustaka Supabase tidak dapat dimuat. Periksa koneksi internet.');
    if (loginButton) loginButton.disabled = true;
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }
  if (status) status.textContent = '';
  try {
    var user = await callApi('getProfile');
    if (!user) {
      setAuthenticatedView(false);
      document.getElementById('login-screen').style.display = 'flex';
      return;
    }
    state.user = user;
    setAuthenticatedView(true);
    document.getElementById('login-screen').style.display = 'none';
    updateUserUI();
    await loadAllMasterData();
  } catch (error) {
    console.error('Gagal memeriksa sesi Supabase:', error);
    if (status) status.textContent = 'Koneksi belum tersedia. Periksa konfigurasi dan koneksi internet.';
    document.getElementById('login-screen').style.display = 'flex';
  }
}

function handleLogin(e) {
  e.preventDefault();
  var u = document.getElementById('login-username').value.trim();
  var p = document.getElementById('login-password').value;
  var btn = document.getElementById('btn-login-submit');

  btn.innerHTML = 'Memproses...';
  btn.disabled = true;

  callApi('loginUser', u, p).then(async function (res) {
    btn.innerHTML = 'Masuk Aplikasi';
    btn.disabled = false;
    if (res.success) {
      state.user = res.user;
      setAuthenticatedView(true);
      document.getElementById('login-screen').style.display = 'none';
      showToast('success', res.message);
      updateUserUI();
      await loadAllMasterData();
    }
  }).catch(function (error) {
    btn.innerHTML = 'Masuk Aplikasi';
    btn.disabled = false;
    console.error('Login Supabase gagal:', error);
    showToast('error', 'Login gagal: ' + error.message);
  });
}

async function handleLogout() {
  try {
    await callApi('logoutUser');
  } catch (error) {
    console.error('Logout Supabase gagal:', error);
    showToast('error', 'Logout gagal: ' + error.message);
    return;
  }
  state.user = null;
  setAuthenticatedView(false);
  document.getElementById('login-screen').style.display = 'flex';
  showToast('info', 'Anda telah keluar.');
}

function updateUserUI() {
  if (state.user) {
    var resetSection = document.getElementById('store-reset-section');
    if (resetSection) resetSection.style.display = state.user.role === 'admin' ? '' : 'none';
    var nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.innerText = state.user.full_name;
    var roleEl = document.getElementById('user-display-role');
    if (roleEl) roleEl.innerText = state.user.role;
    var avatarEl = document.getElementById('user-avatar-initial');
    if (avatarEl) avatarEl.innerText = state.user.full_name.charAt(0).toUpperCase();
    
    var mobUser = document.getElementById('mobile-user-name');
    if (mobUser) mobUser.innerText = state.user.full_name;
    var dashboardUser = document.getElementById('dashboard-user-name');
    if (dashboardUser) dashboardUser.innerText = state.user.full_name;
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
async function loadAllMasterData() {
  try {
    var results = await Promise.all([
    callApi('getProducts'),
    callApi('getCategories'),
    callApi('getUnits'),
    callApi('getCustomers'),
    callApi('getSuppliers'),
    callApi('getPurchases'),
    callApi('getStockMovements'),
    callApi('getReturns'),
    callApi('getSales'),
    callApi('getPayments'),
    callApi('getSettings')
    ]);
    state.products = results[0];
    state.categories = results[1];
    state.units = results[2];
    state.customers = results[3];
    state.suppliers = results[4];
    state.purchases = results[5];
    state.stockMovements = results[6];
    state.returns = results[7];
    state.salesTransactions = results[8];
    state.paymentHistory = results[9];
    state.settings = Object.assign({}, state.settings, results[10]);
    state.masterDataLoaded = true;
    refreshPurchaseProductOptions();
    populateCategorySelects();
    populateInitialTables();
    switchView(state.activeView);
  } catch (error) {
    state.masterDataLoaded = false;
    console.error('Gagal memuat data toko dari Supabase:', error);
    showToast('error', 'Data toko gagal dimuat dari Supabase: ' + error.message);
    throw error;
  }
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
      <td><strong>${escapeHtml(c.Customer_Name)}</strong></td>
      <td>${escapeHtml(c.Phone)}</td>
      <td style="font-weight:800; color: ${c.Piutang > 0 ? 'var(--danger)' : 'var(--text-main)'}">${formatRupiah(c.Piutang)}</td>
      <td style="font-weight:800; color: ${c.Saldo > 0 ? 'var(--success)' : 'var(--text-main)'}">${formatRupiah(c.Saldo || 0)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editCustomer('${c.Customer_ID}')"><i class="ri-edit-line"></i> Edit</button>
        ${c.Piutang > 0 ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('Piutang Pelanggan', '${c.Customer_Name}', ${c.Piutang})"><i class="ri-money-dollar-circle-line"></i> Bayar</button>` : ''}
        ${toggleBtn}
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.Customer_ID}')"><i class="ri-delete-bin-line"></i></button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:20px;">Belum ada pelanggan</td></tr>';
}

function editCustomer(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (!c) return;
  openDynamicModal('customer_edit', c);
}

async function toggleCustomerStatus(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (!c) return;
  try {
    await callApi('toggleCustomer', id, c.Is_Active === false);
    c.Is_Active = c.Is_Active === false;
    renderCustomerTable();
    populatePosCustomerSelect();
    showToast('info', 'Status pelanggan ' + c.Customer_Name + ' diubah menjadi ' + (c.Is_Active ? 'Aktif' : 'Non-Aktif'));
  } catch (error) {
    console.error('Gagal mengubah status pelanggan:', error);
    showToast('error', 'Status pelanggan gagal disimpan: ' + error.message);
  }
}

async function deleteCustomer(id) {
  var c = state.customers.find(item => String(item.Customer_ID) === String(id));
  if (c && confirm('Apakah Anda yakin ingin menghapus pelanggan ' + c.Customer_Name + '?')) {
    try {
      await callApi('deleteCustomer', id);
      state.customers = state.customers.filter(item => String(item.Customer_ID) !== String(id));
      renderCustomerTable();
      renderPiutangTable();
      populatePosCustomerSelect();
      showToast('info', 'Pelanggan telah dihapus.');
    } catch (error) {
      console.error('Gagal menghapus pelanggan:', error);
      showToast('error', 'Pelanggan gagal dihapus: ' + error.message);
    }
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

async function toggleSupplierStatus(id) {
  var s = state.suppliers.find(item => String(item.Supplier_ID) === String(id));
  if (!s) return;
  try {
    await callApi('toggleSupplier', id, s.Is_Active === false);
    s.Is_Active = s.Is_Active === false;
    renderSupplierTable();
    showToast('info', 'Status supplier ' + s.Supplier_Name + ' diubah menjadi ' + (s.Is_Active ? 'Aktif' : 'Non-Aktif'));
  } catch (error) {
    console.error('Gagal mengubah status supplier:', error);
    showToast('error', 'Status supplier gagal disimpan: ' + error.message);
  }
}

async function deleteSupplier(id) {
  var s = state.suppliers.find(item => String(item.Supplier_ID) === String(id));
  if (s && confirm('Apakah Anda yakin ingin menghapus supplier ' + s.Supplier_Name + '?')) {
    try {
      await callApi('deleteSupplier', id);
      state.suppliers = state.suppliers.filter(item => String(item.Supplier_ID) !== String(id));
      renderSupplierTable();
      renderHutangTable();
      showToast('info', 'Supplier telah dihapus.');
    } catch (error) {
      console.error('Gagal menghapus supplier:', error);
      showToast('error', 'Supplier gagal dihapus: ' + error.message);
    }
  }
}

function renderPurchaseTable() {
  var tbody = document.getElementById('table-purchases-body');
  if (!tbody) return;
  var html = '';
  state.purchases.forEach(function (p) {
    var items = Array.isArray(p.Items) ? p.Items : [];
    var itemSummary = items.map(function (item) {
      return escapeHtml(item.Product_Name) + ' (' + item.Qty + ')';
    }).join(', ') || '-';
    var paymentMethod = { CASH: 'Tunai', TRANSFER: 'Transfer', CREDIT: 'Hutang' }[p.Payment_Method] || '-';
    var paymentStatus = p.Payment_Status || p.Status || '-';
    var isPaid = paymentStatus === 'LUNAS' || paymentStatus === 'SELESAI';
    html += `<tr>
      <td><strong>${p.Purchase_No}</strong></td>
      <td>${escapeHtml(p.Supplier_Name)}</td>
      <td>${itemSummary}</td>
      <td style="font-weight:800;">${formatRupiah(p.Total)}</td>
      <td>${paymentMethod}</td>
      <td><span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">${paymentStatus}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewTransactionDetail('Pembelian ${p.Purchase_No}', '${escapeHtml(p.Supplier_Name)}', ${p.Total})"><i class="ri-file-text-line"></i> Detail</button>
        <button class="btn btn-danger btn-sm" onclick="deletePurchase('${p.Purchase_No}')"><i class="ri-delete-bin-line"></i> Hapus</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:20px;">Belum ada transaksi pembelian</td></tr>';
}

async function deletePurchase(poNo) {
  var purchase = state.purchases.find(function (item) { return item.Purchase_No === poNo; });
  if (!purchase) return;
  if (!confirm('Hapus pembelian ' + poNo + '? Stok dan hutang supplier yang dicatat dari transaksi ini juga akan disesuaikan.')) return;
  try {
    await callApi('deletePurchase', poNo);
    showToast('info', poNo + ' dan dampak stok/hutangnya telah dibatalkan.');
    try {
      await loadAllMasterData();
    } catch (refreshError) {
      console.error('Pembelian dibatalkan, tetapi penyegaran data gagal:', refreshError);
    }
  } catch (error) {
    console.error('Gagal menghapus pembelian:', error);
    showToast('error', 'Pembelian gagal dihapus: ' + error.message);
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
  var html = '<thead><tr><th>No Retur</th><th>Tanggal</th><th>Invoice</th><th>Total Retur</th><th>Penyelesaian</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
  state.returns.forEach(function (r) {
    html += `<tr>
      <td><strong>${r.Return_No}</strong></td>
      <td>${r.Date}</td>
      <td>${r.Invoice_No}</td>
      <td style="font-weight:800;">${formatRupiah(r.Total)}</td>
      <td>${{ CASH: 'Tunai', BALANCE: 'Saldo pelanggan', RECEIVABLE: 'Piutang / saldo' }[r.Settlement_Method] || '-'}</td>
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
  var range = getSelectedPeriodRange('dashboard');
  var loadState = document.getElementById('dashboard-load-state');
  var periodSummary = document.getElementById('dashboard-period-summary');
  if (!range) {
    showToast('warning', 'Pilih tanggal awal dan akhir yang valid untuk ringkasan dashboard.');
    return;
  }
  if (loadState) {
    loadState.dataset.state = 'loading';
    loadState.textContent = 'Memuat ringkasan toko...';
    loadState.hidden = false;
  }

  callApi('getDashboardStats', range).then(function (stats) {
    document.getElementById('dash-sales-today').innerText = formatRupiah(stats.period_sales);
    document.getElementById('dash-count-today').innerText = stats.period_count.toLocaleString('id-ID');
    document.getElementById('dash-period-note').innerText = 'dalam periode yang dipilih';
    document.getElementById('dashboard-period-sales-label').innerText = 'Penjualan ' +
      (range.period === 'DAILY' ? 'hari ini' : range.period === 'WEEKLY' ? 'minggu ini' :
        range.period === 'MONTHLY' ? 'bulan ini' : 'periode pilihan');
    if (periodSummary) periodSummary.textContent = range.label;
    document.getElementById('dash-total-piutang').innerText = formatRupiah(stats.total_piutang);
    document.getElementById('dash-low-stock-count').innerText = stats.low_stock_count + ' produk';

    renderDashboardCharts(stats);
    var salesChartTitle = document.getElementById('chart-sales-title');
    if (salesChartTitle) salesChartTitle.textContent = stats.chart_period.title;

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
      lowList.innerHTML = '<div style="color: var(--text-dim); padding: 12px;">Stok aman untuk saat ini.</div>';
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
      topList.innerHTML = '<div style="color: var(--text-dim); padding: 12px;">Belum ada penjualan yang tercatat.</div>';
    }
    if (loadState) loadState.hidden = true;
  }).catch(function (error) {
    console.error('Gagal memuat ringkasan dashboard:', error);
    if (loadState) {
      loadState.dataset.state = 'error';
      loadState.innerHTML = '<p>Ringkasan toko gagal dimuat. Periksa koneksi, lalu coba lagi.</p><button type="button" class="btn btn-secondary" onclick="loadDashboardStats()">Coba lagi</button>';
      loadState.hidden = false;
    }
  });
}

function renderDashboardCharts(stats) {
  var ctx1 = document.getElementById('chart-sales-7days').getContext('2d');
  if (state.salesChart) state.salesChart.destroy();
  state.salesChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: stats.chart_period.labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: stats.chart_period.values,
        backgroundColor: '#1769c2',
        borderColor: '#1769c2',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#40516b' } },
        y: { grid: { color: '#e8ecf1' }, ticks: { color: '#40516b' } }
      }
    }
  });

  var ctx2 = document.getElementById('chart-payment-dist').getContext('2d');
  if (state.paymentChart) state.paymentChart.destroy();
  state.paymentChart = new Chart(ctx2, {
    type: 'pie',
    data: {
      labels: ['Tunai', 'Transfer', 'QRIS', 'Piutang'],
      datasets: [{
        data: [stats.payment_distribution.cash, stats.payment_distribution.transfer,
          stats.payment_distribution.qris, stats.payment_distribution.credit],
        backgroundColor: ['#1769c2', '#27836a', '#8c5b9d', '#d89428'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#40516b' } } }
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
  var availableStock = Math.max(0, Number(p.Stock) || 0);
  if ((existing ? Number(existing.Qty) : 0) + 1 > availableStock) {
    showToast('warning', 'Stok ' + p.Product_Name + ' tidak mencukupi.');
    return;
  }
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
  var cartItem = state.posCart[idx];
  if (!cartItem) return;
  var product = state.products.find(function (item) {
    return String(item.Product_ID) === String(cartItem.Product_ID);
  });
  var newQty = Number(cartItem.Qty) + delta;
  if (newQty <= 0) {
    removeFromCart(idx);
    return;
  }
  if (!product || newQty > Math.max(0, Number(product.Stock) || 0)) {
    showToast('warning', 'Stok produk tidak mencukupi.');
    return;
  }
  cartItem.Qty = newQty;
  cartItem.Subtotal = newQty * cartItem.Sell_Price;
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
    grandVal = calculatePosSaleAmounts().amountDue;
  } else {
    grandVal = parseFloat(val) || 0;
  }
  syncCashInput(grandVal);
  calculatePosTotal();
}

function syncCustomerInput(val) {
  var s1 = document.getElementById('pos-customer-name');
  var s2 = document.getElementById('pos-customer-name-mobile');
  if (s1) s1.value = val;
  if (s2) s2.value = val;
  var customer = findCustomerByName(val);
  var customerId = customer && customer.Is_Active !== false ? String(customer.Customer_ID) : '';
  var select1 = document.getElementById('pos-customer-select');
  var select2 = document.getElementById('pos-customer-select-mobile');
  if (select1) select1.value = customerId;
  if (select2) select2.value = customerId;
  renderPosCustomerBalance();
  calculatePosTotal();
}

function selectPosCustomer(customerId) {
  var customer = state.customers.find(function (item) {
    return item.Is_Active !== false && String(item.Customer_ID) === String(customerId);
  });
  if (customer) syncCustomerInput(customer.Customer_Name);
}

function syncCustomerPhone(val) {
  var p1 = document.getElementById('pos-customer-phone');
  var p2 = document.getElementById('pos-customer-phone-mobile');
  if (p1) p1.value = val;
  if (p2) p2.value = val;
}

function syncRetainChange(checked) {
  var c1 = document.getElementById('pos-retain-change');
  var c2 = document.getElementById('pos-retain-change-mobile');
  if (c1) c1.checked = checked;
  if (c2) c2.checked = checked;
}

function getSelectedPosCustomer() {
  var nameInput = document.getElementById('pos-customer-name');
  return findCustomerByName(nameInput ? nameInput.value : '');
}

function calculatePosSaleAmounts() {
  var subtotal = state.posCart.reduce(function (sum, item) {
    return sum + (Number(item.Subtotal) || 0);
  }, 0);
  var discountInput = document.getElementById('pos-discount-total');
  var discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  var total = Math.max(0, subtotal - discount);
  var customer = getSelectedPosCustomer();
  var availableBalance = customer ? Math.max(0, Number(customer.Saldo) || 0) : 0;
  var balanceUsed = Math.min(total, availableBalance);
  return {
    subtotal: subtotal,
    discount: discount,
    total: total,
    customer: customer,
    balanceUsed: balanceUsed,
    amountDue: Math.max(0, total - balanceUsed)
  };
}

function renderPosCustomerBalance() {
  var nameInput = document.getElementById('pos-customer-name');
  var name = nameInput ? nameInput.value : '';
  var customer = findCustomerByName(name);
  var message = customer
    ? 'Piutang: ' + formatRupiah(Number(customer.Piutang) || 0) + ' · Saldo: ' + formatRupiah(Number(customer.Saldo) || 0)
    : 'Pelanggan baru. Piutang dan saldo saat ini Rp 0.';
  var desktopInfo = document.getElementById('pos-customer-balance-info');
  var mobileInfo = document.getElementById('pos-customer-balance-info-mobile');
  if (desktopInfo) desktopInfo.textContent = message;
  if (mobileInfo) mobileInfo.textContent = message;
}

function populatePosCustomerSelect() {
  var s1 = document.getElementById('pos-customer-name');
  var s2 = document.getElementById('pos-customer-name-mobile');
  var customerSelect1 = document.getElementById('pos-customer-select');
  var customerSelect2 = document.getElementById('pos-customer-select-mobile');
  var options = document.getElementById('pos-customer-options');
  if (!state.customers) return;
  if (s1 && !s1.value) s1.value = 'Pelanggan Umum';
  if (s2 && !s2.value) s2.value = s1 ? s1.value : 'Pelanggan Umum';
  if (options) options.replaceChildren();
  [customerSelect1, customerSelect2].forEach(function (select) {
    if (!select) return;
    select.replaceChildren();
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih pelanggan tersimpan';
    select.appendChild(placeholder);
  });
  state.customers.forEach(function (c) {
    if (c.Is_Active === false) return;
    if (options) {
      var suggestion = document.createElement('option');
      suggestion.value = c.Customer_Name;
      options.appendChild(suggestion);
    }
    [customerSelect1, customerSelect2].forEach(function (select) {
      if (!select) return;
      var option = document.createElement('option');
      option.value = String(c.Customer_ID);
      option.textContent = c.Customer_Name;
      select.appendChild(option);
    });
  });
  if (s1 && s2) syncCustomerInput(s1.value || s2.value);
  renderPosCustomerBalance();
}

function findCustomerByName(name) {
  var normalizedName = (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return state.customers.find(function (customer) {
    return (customer.Customer_Name || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalizedName;
  });
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
  var amounts = calculatePosSaleAmounts();
  var subEl = document.getElementById('pos-subtotal-text');
  var subMobEl = document.getElementById('pos-subtotal-text-mobile');
  if (subEl) subEl.innerText = formatRupiah(amounts.subtotal);
  if (subMobEl) subMobEl.innerText = formatRupiah(amounts.subtotal);

  var grandEl = document.getElementById('pos-grand-total-text');
  var grandMobEl = document.getElementById('pos-grand-total-text-mobile');
  var totalBeforeBalance = document.getElementById('pos-total-before-balance-text');
  var totalBeforeBalanceMob = document.getElementById('pos-total-before-balance-text-mobile');
  var balanceUsed = document.getElementById('pos-balance-used-text');
  var balanceUsedMob = document.getElementById('pos-balance-used-text-mobile');
  var mobFloatTotal = document.getElementById('mob-cart-badge-total');
  if (grandEl) grandEl.innerText = formatRupiah(amounts.amountDue);
  if (grandMobEl) grandMobEl.innerText = formatRupiah(amounts.amountDue);
  if (totalBeforeBalance) totalBeforeBalance.innerText = formatRupiah(amounts.total);
  if (totalBeforeBalanceMob) totalBeforeBalanceMob.innerText = formatRupiah(amounts.total);
  if (balanceUsed) balanceUsed.innerText = formatRupiah(amounts.balanceUsed);
  if (balanceUsedMob) balanceUsedMob.innerText = formatRupiah(amounts.balanceUsed);
  if (mobFloatTotal) mobFloatTotal.innerText = formatRupiah(amounts.amountDue);

  var cashEl = document.getElementById('pos-cash-received');
  var cash = cashEl ? (parseFloat(cashEl.value) || 0) : 0;
  var grossChange = Math.max(0, cash - amounts.amountDue);
  var retainInput = document.getElementById('pos-retain-change');
  var retainedChange = retainInput && retainInput.checked ? grossChange : 0;
  var changeToDebt = Math.min(amounts.customer ? (Number(amounts.customer.Piutang) || 0) : 0, retainedChange);
  var changeToBalance = retainedChange - changeToDebt;
  var returnedChange = grossChange - retainedChange;
  var changeEl = document.getElementById('pos-cash-change-text');
  var changeMobEl = document.getElementById('pos-cash-change-text-mobile');
  var debtEl = document.getElementById('pos-change-to-debt-text');
  var debtMobEl = document.getElementById('pos-change-to-debt-text-mobile');
  var balanceEl = document.getElementById('pos-change-to-balance-text');
  var balanceMobEl = document.getElementById('pos-change-to-balance-text-mobile');
  if (changeEl) changeEl.innerText = formatRupiah(returnedChange);
  if (changeMobEl) changeMobEl.innerText = formatRupiah(returnedChange);
  if (debtEl) debtEl.innerText = formatRupiah(changeToDebt);
  if (debtMobEl) debtMobEl.innerText = formatRupiah(changeToDebt);
  if (balanceEl) balanceEl.innerText = formatRupiah(changeToBalance);
  if (balanceMobEl) balanceMobEl.innerText = formatRupiah(changeToBalance);
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
  if (cashCont) cashCont.style.display = method === 'CASH' ? 'block' : 'none';
  if (cashContMob) cashContMob.style.display = method === 'CASH' ? 'block' : 'none';
  if (method !== 'CASH') {
    syncCashInput('');
    syncRetainChange(false);
  }
  calculatePosTotal();
}

function submitPosSale() {
  if (state.isSubmittingSale) return;
  if (state.posCart.length === 0) {
    showToast('warning', 'Keranjang masih kosong!');
    return;
  }
  var unavailableItem = state.posCart.find(function (cartItem) {
    var product = state.products.find(function (item) {
      return String(item.Product_ID) === String(cartItem.Product_ID);
    });
    return !product || !Number.isFinite(Number(cartItem.Qty)) ||
      Number(cartItem.Qty) <= 0 || Number(cartItem.Qty) > (Number(product.Stock) || 0);
  });
  if (unavailableItem) {
    showToast('warning', 'Stok ' + unavailableItem.Product_Name + ' tidak mencukupi. Periksa kembali keranjang.');
    return;
  }
  var customerNameEl = document.getElementById('pos-customer-name');
  var customerPhoneEl = document.getElementById('pos-customer-phone');
  var customerName = customerNameEl ? customerNameEl.value.trim().replace(/\s+/g, ' ') : '';
  var customerPhone = customerPhoneEl ? customerPhoneEl.value.trim() : '';
  if (!customerName) {
    showToast('warning', 'Nama pelanggan wajib diisi.');
    if (customerNameEl) customerNameEl.focus();
    return;
  }

  var amounts = calculatePosSaleAmounts();
  var method = document.getElementById('pos-payment-method').value;
  var cashInput = document.getElementById('pos-cash-received');
  var cashReceived = method === 'CASH' ? (parseFloat(cashInput ? cashInput.value : '') || 0) : 0;
  if (method === 'CASH' && cashReceived < amounts.amountDue) {
    showToast('warning', 'Uang diterima belum mencukupi sisa pembayaran.');
    if (cashInput) cashInput.focus();
    return;
  }
  showToast('info', 'Memproses...');
  state.isSubmittingSale = true;
  document.querySelectorAll('button[onclick="submitPosSale()"]').forEach(function (button) {
    button.disabled = true;
  });
  var grossChange = method === 'CASH' ? Math.max(0, cashReceived - amounts.amountDue) : 0;
  var retainInput = document.getElementById('pos-retain-change');
  var retainedChange = method === 'CASH' && retainInput && retainInput.checked ? grossChange : 0;
  var startingDebt = amounts.customer ? Math.max(0, Number(amounts.customer.Piutang) || 0) : 0;
  var debtPayment = Math.min(startingDebt, retainedChange);
  var customerBalanceAdded = retainedChange - debtPayment;
  var startingBalance = amounts.customer ? Math.max(0, Number(amounts.customer.Saldo) || 0) : 0;
  var paymentStatus = method === 'CREDIT' && amounts.amountDue > 0 ? 'PIUTANG' : 'LUNAS';

  var saleItems = state.posCart.map(function (item) {
    return { Product_ID: item.Product_ID, Qty: item.Qty };
  });
  var submittedCart = JSON.parse(JSON.stringify(state.posCart));
  callApi('processSale', {
    customerName: customerName,
    customerPhone: customerPhone,
    method: method,
    discount: amounts.discount,
    cashReceived: cashReceived,
    retainChange: Boolean(retainInput && retainInput.checked),
    items: saleItems
  }).then(async function (res) {
    if (!res || !res.success || !res.invoice_no) {
      throw new Error('Supabase tidak mengembalikan konfirmasi transaksi yang valid.');
    }
    showToast('success', res.message || 'Transaksi berhasil disimpan.');
    try {
      await loadAllMasterData();
    } catch (refreshError) {
      console.error('Transaksi tersimpan, tetapi penyegaran data gagal:', refreshError);
      showToast('warning', 'Transaksi sudah tersimpan, tetapi tampilan data belum diperbarui. Muat ulang aplikasi.');
    }
    var customer = state.customers.find(function (item) {
      return String(item.Customer_ID) === String(res.customer_id);
    });
    if (!customer) {
      customer = {
        Customer_ID: res.customer_id,
        Customer_Name: customerName,
        Phone: customerPhone || '-',
        Address: '-',
        Piutang: 0,
        Saldo: 0,
        Is_Active: true
      };
      customer.Piutang = Math.max(0, startingDebt - Number(res.debt_payment || 0) +
        (method === 'CREDIT' ? Number(res.amount_due || 0) : 0));
      customer.Saldo = Math.max(0, startingBalance - Number(res.balance_used || 0) +
        Number(res.balance_added || 0));
    }
    var committedAmounts = {
      subtotal: Number(res.subtotal),
      discount: Number(res.discount_total),
      total: Number(res.grand_total),
      amountDue: Number(res.amount_due),
      balanceUsed: Number(res.balance_used)
    };
    state.lastCustomerName = customer.Customer_Name;
    state.lastCustomerId = customer.Customer_ID;
    state.lastCustomerPhone = customer.Phone || '-';
    state.lastCustomer = {
      Piutang: customer.Piutang,
      Saldo: customer.Saldo
    };
    var savedSale = state.salesTransactions.find(function (sale) {
      return sale.Invoice_No === res.invoice_no;
    });
    state.lastCart = savedSale ? JSON.parse(JSON.stringify(savedSale.Items)) : submittedCart;
    state.lastSubtotal = committedAmounts.subtotal;
    state.lastDiscount = committedAmounts.discount;
    state.lastGrandTotal = committedAmounts.total;
    state.lastBalanceUsed = committedAmounts.balanceUsed;
    state.lastAmountDue = committedAmounts.amountDue;
    state.lastCash = Number(res.cash_received || 0);
    state.lastChange = Number(res.cash_change || 0);
    state.lastRetainedChange = Number(res.debt_payment || 0) + Number(res.balance_added || 0);
    state.lastDebtPayment = Number(res.debt_payment || 0);
    state.lastCustomerBalanceAdded = Number(res.balance_added || 0);
    state.lastPaymentMethod = method;
    state.lastPaymentStatus = res.status || paymentStatus;
    populatePosCustomerSelect();
    renderCustomerTable();
    renderPiutangTable();
    closeModal('modal-mobile-cart');

    state.lastInvoiceNo = res.invoice_no;

    var receiptMethodNames = {
      CASH: 'Tunai',
      TRANSFER: 'Transfer',
      QRIS: 'QRIS',
      CREDIT: 'Hutang / piutang'
    };
    var receiptMethod = receiptMethodNames[method] || method;
    var receiptTimestamp = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    var receiptRows = '';
    state.lastCart.forEach(function (item) {
      receiptRows += `
        <div class="receipt-item">
          <div class="receipt-item-name">${escapeHtml(item.Product_Name)}</div>
          <div class="receipt-item-details">
            <span>${Number(item.Qty).toLocaleString('id-ID')} x ${formatRupiah(item.Sell_Price)}</span>
            <strong>${formatRupiah(item.Subtotal)}</strong>
          </div>
        </div>
      `;
    });

    var receiptHtml = `
      <article class="receipt-paper">
        <header class="receipt-header">
          <h2>${escapeHtml(state.settings.store_name || 'Toko Kita')}</h2>
          ${state.settings.store_address ? `<p>${escapeHtml(state.settings.store_address)}</p>` : ''}
          ${state.settings.store_phone ? `<p>Telp. ${escapeHtml(state.settings.store_phone)}</p>` : ''}
        </header>
        <div class="receipt-title">Struk pembelian</div>
        <div class="receipt-meta">
          ${state.lastInvoiceNo ? `<div><span>No. transaksi</span><strong>${escapeHtml(state.lastInvoiceNo)}</strong></div>` : ''}
          <div><span>Tanggal</span><strong>${receiptTimestamp}</strong></div>
          <div><span>Kasir</span><strong>${escapeHtml(state.user ? state.user.full_name : '-')}</strong></div>
          <div><span>Pelanggan</span><strong>${escapeHtml(state.lastCustomerName)}</strong></div>
        </div>
        <div class="receipt-section-title">Rincian barang</div>
        <div class="receipt-items">${receiptRows}</div>
        <div class="receipt-totals">
          <div><span>Subtotal</span>          <strong>${formatRupiah(committedAmounts.subtotal)}</strong></div>
          ${committedAmounts.discount > 0 ? `<div><span>Diskon</span><strong>- ${formatRupiah(committedAmounts.discount)}</strong></div>` : ''}
          ${committedAmounts.balanceUsed > 0 ? `<div><span>Saldo pelanggan</span><strong>- ${formatRupiah(committedAmounts.balanceUsed)}</strong></div>` : ''}
          <div class="receipt-total-due">
            <span>${method === 'CREDIT' ? 'Sisa tagihan' : 'Total dibayar'}</span>
            <strong>${formatRupiah(committedAmounts.amountDue)}</strong>
          </div>
        </div>
        <div class="receipt-payment">
          <div><span>Metode pembayaran</span><strong>${escapeHtml(receiptMethod)}</strong></div>
          ${method === 'CASH' ? `
            <div><span>Uang diterima</span><strong>${formatRupiah(cashReceived)}</strong></div>
            <div><span>Kembalian</span><strong>${formatRupiah(grossChange - retainedChange)}</strong></div>
          ` : ''}
          ${retainedChange > 0 ? `<div><span>Kembalian ditahan</span><strong>${formatRupiah(retainedChange)}</strong></div>` : ''}
          ${debtPayment > 0 ? `<div><span>Untuk cicilan piutang</span><strong>${formatRupiah(debtPayment)}</strong></div>` : ''}
          ${customerBalanceAdded > 0 ? `<div><span>Saldo pelanggan bertambah</span><strong>${formatRupiah(customerBalanceAdded)}</strong></div>` : ''}
          <div><span>Status</span><strong>${escapeHtml(state.lastPaymentStatus)}</strong></div>
          ${customer.Piutang > 0 ? `<div><span>Total piutang pelanggan</span><strong>${formatRupiah(customer.Piutang)}</strong></div>` : ''}
          ${customer.Saldo > 0 ? `<div><span>Saldo pelanggan tersisa</span><strong>${formatRupiah(customer.Saldo)}</strong></div>` : ''}
        </div>
        <footer class="receipt-footer">
          <strong>${escapeHtml(state.settings.invoice_footer || 'Terima kasih telah berbelanja!')}</strong>
          <span>Simpan struk ini sebagai bukti transaksi.</span>
        </footer>
      </div>
    `;

    document.getElementById('receipt-preview-area').innerHTML = receiptHtml;
    openModal('modal-invoice');

    // Reset Cart & Refresh Product Views
    state.posCart = [];
    document.getElementById('pos-discount-total').value = 0;
    document.getElementById('pos-cash-received').value = '';
    syncDiscountInput(0);
    syncCashInput('');
    syncRetainChange(false);
    renderPosCart();
    renderPosProducts();
    renderProductTable();
    renderStockMovementTable();
  }).catch(function (error) {
    console.error('Transaksi penjualan gagal disimpan:', error);
    showToast('error', 'Transaksi gagal disimpan: ' + error.message);
  }).finally(function () {
    state.isSubmittingSale = false;
    document.querySelectorAll('button[onclick="submitPosSale()"]').forEach(function (button) {
      button.disabled = false;
    });
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

async function deleteProduct(productId) {
  var p = state.products.find(item => String(item.Product_ID) === String(productId));
  var pName = p ? p.Product_Name : 'produk ini';
  if (confirm('Apakah Anda yakin ingin menghapus ' + pName + '?')) {
    try {
      await callApi('deleteProduct', productId);
      state.products = state.products.filter(item => String(item.Product_ID) !== String(productId));
      renderProductTable();
      renderPosProducts();
      showToast('info', 'Produk "' + pName + '" telah dihapus.');
    } catch (error) {
      console.error('Gagal menghapus produk:', error);
      showToast('error', 'Produk gagal dihapus: ' + error.message);
    }
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
  if (!el) return;
  el.returnFocusTo = document.activeElement;
  el.classList.add('active');
  var firstFocusable = el.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  if (id === 'modal-reset-store-data' && el.dataset.resetInProgress === 'true') return;
  el.classList.remove('active');
  if (el.returnFocusTo && document.contains(el.returnFocusTo)) el.returnFocusTo.focus();
}
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  var activeModals = document.querySelectorAll('.modal-overlay.active');
  if (activeModals.length > 0) closeModal(activeModals[activeModals.length - 1].id);
});

function addPurchaseItemRow() {
  var list = document.getElementById('purchase-items-list');
  if (!list) return;

  var row = document.createElement('div');
  row.className = 'purchase-item-row';
  row.innerHTML = `
    <div class="purchase-item-field purchase-product-field">
      <label>Produk</label>
      <select class="form-control" data-purchase-product required>
        <option value="">Pilih produk</option>
      </select>
    </div>
    <div class="purchase-item-field">
      <label>Jumlah</label>
      <input class="form-control" type="number" data-purchase-qty min="0.01" step="any" value="1" required>
    </div>
    <div class="purchase-item-field">
      <label>Harga beli / unit (Rp)</label>
      <input class="form-control" type="number" data-purchase-price min="0" step="any" placeholder="0" required>
    </div>
    <button type="button" class="btn-icon purchase-remove-item" aria-label="Hapus barang" title="Hapus barang">
      <i class="ri-delete-bin-line"></i>
    </button>
    <small class="purchase-item-subtotal">Subtotal: <strong data-purchase-subtotal>Rp 0</strong></small>
  `;

  var productSelect = row.querySelector('[data-purchase-product]');
  productSelect.addEventListener('change', function () {
    var product = state.products.find(function (item) {
      return String(item.Product_ID) === productSelect.value;
    });
    row.querySelector('[data-purchase-price]').value = product
      ? String(Number(product.Buy_Price_WAC) || 0)
      : '';
    calculatePurchaseTotal();
  });
  row.querySelector('[data-purchase-qty]').addEventListener('input', calculatePurchaseTotal);
  row.querySelector('[data-purchase-price]').addEventListener('input', calculatePurchaseTotal);
  row.querySelector('.purchase-remove-item').addEventListener('click', function () {
    row.remove();
    if (!list.children.length) addPurchaseItemRow();
    calculatePurchaseTotal();
  });
  list.appendChild(row);
  refreshPurchaseProductOptions();
  calculatePurchaseTotal();
}

function refreshPurchaseProductOptions() {
  document.querySelectorAll('#purchase-items-list [data-purchase-product]').forEach(function (select) {
    var selectedProductId = select.value;
    select.replaceChildren();
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = state.products.length ? 'Pilih produk' : 'Memuat produk...';
    placeholder.disabled = !state.products.length;
    select.appendChild(placeholder);
    state.products.forEach(function (product) {
      var option = document.createElement('option');
      option.value = String(product.Product_ID);
      option.textContent = product.Product_Name;
      select.appendChild(option);
    });
    select.value = selectedProductId;
  });
}

function calculatePurchaseTotal() {
  var total = 0;
  document.querySelectorAll('#purchase-items-list .purchase-item-row').forEach(function (row) {
    var quantity = parseFloat(row.querySelector('[data-purchase-qty]').value) || 0;
    var unitPrice = parseFloat(row.querySelector('[data-purchase-price]').value) || 0;
    var subtotal = quantity * unitPrice;
    total += subtotal;
    row.querySelector('[data-purchase-subtotal]').textContent = formatRupiah(subtotal);
  });
  var totalElement = document.getElementById('purchase-total-value');
  if (totalElement) totalElement.textContent = formatRupiah(total);
  return total;
}

function getPurchaseItems() {
  var items = [];
  var rows = document.querySelectorAll('#purchase-items-list .purchase-item-row');
  rows.forEach(function (row) {
    var productId = row.querySelector('[data-purchase-product]').value;
    var product = state.products.find(function (item) {
      return String(item.Product_ID) === productId;
    });
    var quantity = parseFloat(row.querySelector('[data-purchase-qty]').value);
    var unitPrice = parseFloat(row.querySelector('[data-purchase-price]').value);
    if (!product || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return;
    items.push({
      Product_ID: product.Product_ID,
      Product_Name: product.Product_Name,
      Qty: quantity,
      Unit_Price: unitPrice,
      Subtotal: quantity * unitPrice
    });
  });
  return items;
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
      catOptions = '<option value="">Belum ada kategori; tambahkan kategori terlebih dahulu</option>';
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
        <input type="number" id="dyn-buy" class="form-control" value="${extraData ? extraData.Buy_Price_WAC : 0}" min="0" required>
      </div>
      <div class="form-group">
        <label>Harga Jual (Rp)</label>
        <input type="number" id="dyn-sell" class="form-control" value="${extraData ? extraData.Sell_Price : 0}" min="0" required>
      </div>
      <div class="form-group">
        <label>Stok</label>
        <input type="number" id="dyn-stock" class="form-control" value="${extraData ? extraData.Stock : 0}" min="0" step="0.001" ${isEdit ? 'readonly' : ''} required>
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
      ${isEdit ? '<small>Piutang dan saldo hanya berubah melalui transaksi serta pembayaran yang tercatat.</small>' : ''}
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
      ${isEdit ? '<small>Hutang hanya berubah melalui pembelian dan pembayaran yang tercatat.</small>' : ''}
    `;
  } else if (type === 'unit') {
    title = 'Tambah Satuan';
    html = `<div class="form-group"><label>Nama Satuan</label><input type="text" id="dyn-nama" class="form-control" required></div>`;
  } else if (type === 'purchase') {
    title = 'Tambah Pembelian';
    var supplierOptions = state.suppliers.filter(function (supplier) {
      return supplier.Is_Active !== false;
    }).map(function (supplier) {
      return `<option value="${escapeHtml(supplier.Supplier_ID)}">${escapeHtml(supplier.Supplier_Name)}</option>`;
    }).join('');
    html = `
      <div class="form-group">
        <label for="dyn-purchase-supplier">Supplier</label>
        <select id="dyn-purchase-supplier" class="form-control" required>
          <option value="">Pilih supplier</option>
          ${supplierOptions}
        </select>
      </div>
      <div class="form-group">
        <div class="purchase-items-heading">
          <label>Barang yang dibeli</label>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addPurchaseItemRow()"><i class="ri-add-line"></i> Tambah Barang</button>
        </div>
        <div id="purchase-items-list"></div>
      </div>
      <div class="form-group">
        <label for="dyn-method">Cara bayar</label>
        <select id="dyn-method" class="form-control" required>
          <option value="CASH">Tunai</option>
          <option value="TRANSFER">Transfer</option>
          <option value="CREDIT">Hutang ke supplier</option>
        </select>
      </div>
      <div class="purchase-total">
        <span>Total pembelian</span>
        <strong id="purchase-total-value">Rp 0</strong>
      </div>
      <input type="hidden" id="dyn-nama" value="">
    `;
  } else if (type === 'stock_adj') {
    title = 'Penyesuaian Stok';
    var stockOptions = state.products.map(function (product) {
      return `<option value="${escapeHtml(product.Product_ID)}">${escapeHtml(product.Product_Name)} (stok ${product.Stock})</option>`;
    }).join('');
    html = `<div class="form-group"><label for="dyn-stock-product">Produk</label>
              <select id="dyn-stock-product" class="form-control" required>${stockOptions}</select></div>
            <div class="form-group"><label for="dyn-qty">Perubahan stok (gunakan angka negatif untuk pengurangan)</label>
              <input type="number" id="dyn-qty" class="form-control" step="0.001" required></div>
            <div class="form-group"><label for="dyn-stock-note">Catatan</label>
              <input type="text" id="dyn-stock-note" class="form-control" placeholder="Alasan penyesuaian"></div>`;
  } else if (type === 'return') {
    title = 'Retur Transaksi';
    var invoiceOptions = state.salesTransactions.map(function (sale) {
      return `<option value="${escapeHtml(sale.Invoice_No)}">${escapeHtml(sale.Invoice_No)} - ${escapeHtml(sale.Customer_Name)}</option>`;
    }).join('');
    html = `<div class="form-group"><label for="dyn-invoice">Transaksi</label>
              <select id="dyn-invoice" class="form-control" onchange="populateReturnItems()" required>
                <option value="">Pilih transaksi</option>${invoiceOptions}</select></div>
            <div class="form-group"><label for="dyn-return-item">Barang yang diretur</label>
              <select id="dyn-return-item" class="form-control" required><option value="">Pilih transaksi terlebih dahulu</option></select></div>
            <div class="form-group"><label for="dyn-return-qty">Jumlah</label>
              <input type="number" id="dyn-return-qty" class="form-control" min="0.001" step="0.001" required></div>
            <div class="form-group"><label for="dyn-return-method">Penyelesaian</label>
              <select id="dyn-return-method" class="form-control" required>
                <option value="CASH">Pengembalian tunai</option>
                <option value="BALANCE">Tambahkan ke saldo pelanggan</option>
                <option value="RECEIVABLE">Kurangi piutang, sisa menjadi saldo</option>
              </select></div>`;
  } else if (type === 'payment') {
    let pTitle = extraData ? extraData.title : 'Pembayaran';
    let pName = extraData ? extraData.name : 'Pihak Terkait';
    let pAmount = extraData ? extraData.amount : 0;
    let paymentKind = pTitle === 'Hutang Supplier' ? 'SUPPLIER' : 'CUSTOMER';
    let paymentTarget = paymentKind === 'SUPPLIER'
      ? state.suppliers.find(function (supplier) { return supplier.Supplier_Name === pName; })
      : state.customers.find(function (customer) { return customer.Customer_Name === pName; });
    title = 'Bayar ' + pTitle + ' (' + pName + ')';
    html = `
      <input type="hidden" id="dyn-payment-kind" value="${paymentKind}">
      <input type="hidden" id="dyn-payment-target-id" value="${escapeHtml(paymentTarget ? paymentTarget.Supplier_ID || paymentTarget.Customer_ID : '')}">
      <div class="form-group">
        <label>Nama Pihak / Sasaran</label>
        <input type="text" id="dyn-nama" class="form-control" value="${escapeHtml(pName)}" readonly>
      </div>
      <div class="form-group">
        <label>Nominal Pembayaran (Rp)</label>
        <input type="number" id="dyn-amount" class="form-control" value="${pAmount}" min="1" ${paymentKind === 'SUPPLIER' ? `max="${pAmount}"` : ''} required>
        ${pTitle === 'Piutang Pelanggan' ? '<small>Kelebihan pembayaran setelah piutang lunas akan menjadi saldo pelanggan.</small>' : ''}
      </div>
      <div class="form-group">
        <label>Metode Pembayaran</label>
        <select id="dyn-method" class="form-control">
          <option value="TUNAI">Tunai</option>
          <option value="TRANSFER">Transfer Bank</option>
          <option value="QRIS">QRIS</option>
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
  if (type === 'purchase') addPurchaseItemRow();
  if (type === 'return') populateReturnItems();
}

function populateReturnItems() {
  var invoiceSelect = document.getElementById('dyn-invoice');
  var itemSelect = document.getElementById('dyn-return-item');
  if (!invoiceSelect || !itemSelect) return;
  var sale = state.salesTransactions.find(function (item) {
    return item.Invoice_No === invoiceSelect.value;
  });
  if (!sale) {
    itemSelect.innerHTML = '<option value="">Pilih transaksi terlebih dahulu</option>';
    return;
  }
  var availableItems = sale.Items.map(function (saleItem) {
    var returnedQty = state.returns.reduce(function (sum, ret) {
      if (ret.Invoice_No !== sale.Invoice_No) return sum;
      return sum + (ret.Items || []).reduce(function (itemSum, returnedItem) {
        return itemSum + (String(returnedItem.Sales_Item_ID) === String(saleItem.Sales_Item_ID)
          ? Number(returnedItem.Qty) || 0 : 0);
      }, 0);
    }, 0);
    return { item: saleItem, remaining: Number(saleItem.Qty) - returnedQty };
  }).filter(function (entry) { return entry.remaining > 0; });
  itemSelect.innerHTML = availableItems.map(function (entry) {
    return `<option value="${escapeHtml(entry.item.Sales_Item_ID)}" data-remaining="${entry.remaining}">${escapeHtml(entry.item.Product_Name)} - sisa dapat diretur ${entry.remaining}</option>`;
  }).join('') || '<option value="">Semua barang pada transaksi sudah diretur</option>';
}

async function handleDynamicSave(e) {
  e.preventDefault();
  if (currentDynamicType === 'payment') {
    var paymentAmountInput = document.getElementById('dyn-amount');
    var paymentAmount = paymentAmountInput ? Number(paymentAmountInput.value) : 0;
    var paymentKind = document.getElementById('dyn-payment-kind')?.value || '';
    var paymentTargetId = document.getElementById('dyn-payment-target-id')?.value || '';
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      showToast('warning', 'Nominal pembayaran harus lebih dari Rp 0.');
      return;
    }
    if (paymentKind === 'SUPPLIER') {
      var paymentSupplier = state.suppliers.find(function (supplier) {
        return String(supplier.Supplier_ID) === String(paymentTargetId);
      });
      if (!paymentSupplier || paymentAmount > Math.max(0, Number(paymentSupplier.Hutang) || 0)) {
        showToast('warning', 'Nominal pembayaran tidak boleh melebihi hutang supplier yang tersisa.');
        return;
      }
    }
  }
  if (currentDynamicType === 'purchase' && !e.currentTarget.checkValidity()) {
    e.currentTarget.reportValidity();
    return;
  }
  if (currentDynamicType === 'purchase') {
    var purchaseRows = document.querySelectorAll('#purchase-items-list .purchase-item-row');
    if (!purchaseRows.length || getPurchaseItems().length !== purchaseRows.length) {
      showToast('warning', 'Pilih produk dan lengkapi jumlah serta harga beli setiap barang.');
      return;
    }
  }
  var nama = document.getElementById('dyn-nama') ? document.getElementById('dyn-nama').value : 'Data';

  if (currentDynamicType === 'category') {
    var category = {
      Category_ID: 'CAT-' + crypto.randomUUID(),
      Category_Name: nama,
      Description: document.getElementById('dyn-desc') ? document.getElementById('dyn-desc').value : ''
    };
    try {
      var savedCategory = await callApi('addCategory', category);
      state.categories.push({ Category_ID: savedCategory.category_id, Category_Name: savedCategory.category_name,
        Description: savedCategory.description || '' });
      closeModal('modal-dynamic');
      populateCategorySelects();
      showToast('success', 'Kategori berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menambahkan kategori:', error);
      showToast('error', 'Kategori gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'unit') {
    try {
      var savedUnit = await callApi('addUnit', {
        Unit_ID: 'UNIT-' + crypto.randomUUID(), Unit_Name: nama, Base_Unit: nama
      });
      state.units.push({ Unit_ID: savedUnit.unit_id, Unit_Name: savedUnit.unit_name,
        Base_Unit: savedUnit.base_unit, Conversion_Factor: Number(savedUnit.conversion_factor) || 1 });
      closeModal('modal-dynamic');
      showToast('success', 'Satuan berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menambahkan satuan:', error);
      showToast('error', 'Satuan gagal disimpan: ' + error.message);
    }
    return;
  }

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
      if (!item) return;
      var updatedProduct = Object.assign({}, item, {
        Product_Name: nama, Category_ID: catId, Category_Name: catText,
        Buy_Price_WAC: buyPrice, Sell_Price: sellPrice, Stock: stock
      });
      try {
        var savedProduct = await callApi('updateProduct', updatedProduct);
        state.products[state.products.indexOf(item)] = savedProduct;
        closeModal('modal-dynamic');
        renderProductTable();
        renderPosProducts();
        showToast('success', 'Produk "' + nama + '" berhasil diperbarui.');
      } catch (error) {
        console.error('Gagal memperbarui produk:', error);
        showToast('error', 'Produk gagal diperbarui: ' + error.message);
      }
      return;
    }

    var newProd = {
      Product_ID: 'PRD-' + crypto.randomUUID(),
      Product_Name: nama,
      Category_ID: catId,
      Category_Name: catText,
      Base_Unit: 'PCS',
      Buy_Price_WAC: buyPrice,
      Sell_Price: sellPrice,
      Stock: stock,
      Min_Stock: 5
    };

    try {
      var savedProduct = await callApi('addProduct', newProd);
      state.products.push(savedProduct);
      closeModal('modal-dynamic');
      renderProductTable();
      renderPosProducts();
      showToast('success', 'Produk "' + nama + '" berhasil ditambahkan.');
    } catch (error) {
      console.error('Gagal menambahkan produk:', error);
      showToast('error', 'Produk gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'customer' || currentDynamicType === 'customer_edit') {
    var hp = document.getElementById('dyn-hp') ? document.getElementById('dyn-hp').value : '-';
    var piutang = 0;
    var custId = document.getElementById('dyn-cust-id') ? document.getElementById('dyn-cust-id').value : '';

    if (currentDynamicType === 'customer_edit' && custId) {
      var custObj = state.customers.find(c => String(c.Customer_ID) === String(custId));
      if (!custObj) return;
      try {
        var savedCustomer = await callApi('updateCustomer', Object.assign({}, custObj, {
          Customer_Name: nama, Phone: hp, Piutang: piutang
        }));
        state.customers[state.customers.indexOf(custObj)] = savedCustomer;
        closeModal('modal-dynamic');
        renderCustomerTable();
        renderPiutangTable();
        populatePosCustomerSelect();
        showToast('success', 'Pelanggan "' + nama + '" berhasil diperbarui.');
      } catch (error) {
        console.error('Gagal memperbarui pelanggan:', error);
        showToast('error', 'Pelanggan gagal diperbarui: ' + error.message);
      }
      return;
    }

    var newCust = {
      Customer_ID: 'CUST-' + crypto.randomUUID(),
      Customer_Name: nama,
      Phone: hp || '-',
      Address: '-',
      Piutang: piutang,
      Saldo: 0,
      Is_Active: true
    };
    try {
      state.customers.push(await callApi('addCustomer', newCust));
      closeModal('modal-dynamic');
      renderCustomerTable();
      renderPiutangTable();
      populatePosCustomerSelect();
      showToast('success', 'Pelanggan "' + nama + '" berhasil ditambahkan.');
    } catch (error) {
      console.error('Gagal menambahkan pelanggan:', error);
      showToast('error', 'Pelanggan gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'supplier' || currentDynamicType === 'supplier_edit') {
    var hp = document.getElementById('dyn-hp') ? document.getElementById('dyn-hp').value : '-';
    var hutang = 0;
    var suppId = document.getElementById('dyn-supp-id') ? document.getElementById('dyn-supp-id').value : '';

    if (currentDynamicType === 'supplier_edit' && suppId) {
      var suppObj = state.suppliers.find(s => String(s.Supplier_ID) === String(suppId));
      if (!suppObj) return;
      try {
        var savedSupplier = await callApi('updateSupplier', Object.assign({}, suppObj, {
          Supplier_Name: nama, Phone: hp, Hutang: hutang
        }));
        state.suppliers[state.suppliers.indexOf(suppObj)] = savedSupplier;
        closeModal('modal-dynamic');
        renderSupplierTable();
        renderHutangTable();
        showToast('success', 'Supplier "' + nama + '" berhasil diperbarui.');
      } catch (error) {
        console.error('Gagal memperbarui supplier:', error);
        showToast('error', 'Supplier gagal diperbarui: ' + error.message);
      }
      return;
    }

    var newSupp = {
      Supplier_ID: 'SUP-' + crypto.randomUUID(),
      Supplier_Name: nama,
      Phone: hp || '-',
      Address: '-',
      Hutang: hutang,
      Is_Active: true
    };
    try {
      state.suppliers.push(await callApi('addSupplier', newSupp));
      closeModal('modal-dynamic');
      renderSupplierTable();
      renderHutangTable();
      showToast('success', 'Supplier "' + nama + '" berhasil ditambahkan.');
    } catch (error) {
      console.error('Gagal menambahkan supplier:', error);
      showToast('error', 'Supplier gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'payment') {
    var amt = document.getElementById('dyn-amount') ? parseFloat(document.getElementById('dyn-amount').value) || 0 : 0;
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('warning', 'Nominal pembayaran harus lebih dari Rp 0.');
      return;
    }
    var paymentMethodSelect = document.getElementById('dyn-method');
    var paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'TUNAI';
    var paymentKind = document.getElementById('dyn-payment-kind')?.value || '';
    var paymentTargetId = document.getElementById('dyn-payment-target-id')?.value || '';
    if (!paymentTargetId || (paymentKind !== 'CUSTOMER' && paymentKind !== 'SUPPLIER')) {
      showToast('error', 'Pihak tujuan pembayaran tidak valid.');
      return;
    }
    try {
      var payment = await callApi('recordPayment',
        paymentKind === 'CUSTOMER' ? 'CUSTOMER_RECEIVABLE' : 'SUPPLIER_PAYABLE',
        paymentTargetId, paymentMethod, amt, '');
      closeModal('modal-dynamic');
      showToast('success', 'Pembayaran ' + formatRupiah(amt) + ' berhasil dicatat di Supabase.');
      if (payment.customer_balance_added > 0) {
        showToast('info', 'Kelebihan pembayaran ' + formatRupiah(payment.customer_balance_added) + ' disimpan sebagai saldo pelanggan.');
      }
      try {
        await loadAllMasterData();
      } catch (refreshError) {
        console.error('Pembayaran tersimpan, tetapi penyegaran data gagal:', refreshError);
      }
    } catch (error) {
      console.error('Gagal mencatat pembayaran:', error);
      showToast('error', 'Pembayaran gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'purchase') {
    var supplierSelect = document.getElementById('dyn-purchase-supplier');
    var supplierId = supplierSelect ? supplierSelect.value : '';
    var items = getPurchaseItems();
    var methodSelect = document.getElementById('dyn-method');
    var method = methodSelect ? methodSelect.value : 'CASH';
    try {
      var purchase = await callApi('createPurchase', supplierId, method, items.map(function (item) {
        return { Product_ID: item.Product_ID, Qty: item.Qty, Unit_Price: item.Unit_Price };
      }));
      closeModal('modal-dynamic');
      showToast('success', 'Pembelian ' + purchase.purchase_no + ' berhasil disimpan di Supabase.');
      try {
        await loadAllMasterData();
      } catch (refreshError) {
        console.error('Pembelian tersimpan, tetapi penyegaran data gagal:', refreshError);
      }
    } catch (error) {
      console.error('Gagal menyimpan pembelian:', error);
      showToast('error', 'Pembelian gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'stock_adj') {
    var qty = document.getElementById('dyn-qty') ? parseFloat(document.getElementById('dyn-qty').value) || 0 : 0;
    var stockProductId = document.getElementById('dyn-stock-product').value;
    var stockProduct = state.products.find(function (product) {
      return String(product.Product_ID) === String(stockProductId);
    });
    try {
      await callApi('adjustStock', stockProductId, qty,
        document.getElementById('dyn-stock-note').value.trim());
      closeModal('modal-dynamic');
      showToast('success', 'Penyesuaian stok ' + (stockProduct ? stockProduct.Product_Name : '') + ' berhasil disimpan.');
      try {
        await loadAllMasterData();
      } catch (refreshError) {
        console.error('Penyesuaian stok tersimpan, tetapi penyegaran data gagal:', refreshError);
      }
    } catch (error) {
      console.error('Gagal menyesuaikan stok:', error);
      showToast('error', 'Penyesuaian stok gagal disimpan: ' + error.message);
    }
    return;
  }

  if (currentDynamicType === 'return') {
    var invNo = document.getElementById('dyn-invoice').value;
    var returnItemSelect = document.getElementById('dyn-return-item');
    var returnQtyInput = document.getElementById('dyn-return-qty');
    var returnQty = Number(returnQtyInput.value);
    var remainingQty = Number(returnItemSelect.options[returnItemSelect.selectedIndex]?.dataset.remaining);
    if (!returnItemSelect.value || !Number.isFinite(returnQty) || returnQty <= 0 || returnQty > remainingQty) {
      showToast('warning', 'Jumlah retur harus lebih dari nol dan tidak melebihi sisa barang yang dapat diretur.');
      return;
    }
    var returnMethod = document.getElementById('dyn-return-method').value;
    try {
      var returned = await callApi('createReturn', invNo, returnItemSelect.value, returnQty, returnMethod);
      closeModal('modal-dynamic');
      showToast('success', 'Retur ' + returned.return_no + ' berhasil disimpan di Supabase.');
      try {
        await loadAllMasterData();
      } catch (refreshError) {
        console.error('Retur tersimpan, tetapi penyegaran data gagal:', refreshError);
      }
    } catch (error) {
      console.error('Gagal mencatat retur:', error);
      showToast('error', 'Retur gagal disimpan: ' + error.message);
    }
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
  var iconElement = document.createElement('i');
  iconElement.className = icon;
  div.appendChild(iconElement);
  div.appendChild(document.createTextNode(' ' + String(message)));
  cont.appendChild(div);
  setTimeout(function () { div.remove(); }, 3500);
}

function loadReports() {
  var container = document.getElementById('laporan-table-container');
  if (!container) return;
  if (!state.masterDataLoaded) {
    container.innerHTML = '<p role="status">Data toko belum selesai dimuat. Coba tampilkan laporan kembali setelah data tersedia.</p>';
    return;
  }

  var type = document.getElementById('lap-type') ? document.getElementById('lap-type').value : 'ALL';
  var range = getSelectedPeriodRange('reports');
  if (!range) {
    showToast('warning', 'Pilih tanggal awal dan akhir yang valid untuk laporan.');
    return;
  }
  var periodSummary = document.getElementById('reports-period-summary');
  if (periodSummary) periodSummary.textContent = range.label;
  var activityRows = [];
  (state.salesTransactions || []).forEach(function (sale) {
    activityRows.push({
      date: sale.Date,
      type: 'Penjualan',
      reference: sale.Invoice_No,
      party: sale.Customer_Name,
      method: sale.Payment_Method,
      amount: sale.Total,
      status: sale.Payment_Status
    });
  });
  (state.purchases || []).forEach(function (purchase) {
    activityRows.push({
      date: purchase.Date,
      type: 'Pembelian',
      reference: purchase.Purchase_No,
      party: purchase.Supplier_Name,
      method: purchase.Payment_Method,
      amount: purchase.Total,
      status: purchase.Payment_Status || purchase.Status
    });
  });
  (state.paymentHistory || []).forEach(function (payment) {
    activityRows.push({
      date: payment.Date,
      type: payment.Type,
      reference: payment.Payment_No,
      party: payment.Party_Name,
      method: payment.Method,
      amount: payment.Amount,
      status: 'Tercatat'
    });
  });
  (state.returns || []).forEach(function (item) {
    activityRows.push({
      date: item.Date,
      type: 'Retur',
      reference: item.Return_No,
      party: item.Invoice_No,
      method: '-',
      amount: item.Total,
      status: item.Status
    });
  });
  if (type === 'PENJUALAN') {
    activityRows = activityRows.filter(function (item) { return item.type === 'Penjualan'; });
  }
  activityRows = activityRows.filter(function (item) {
    var timestamp = new Date(item.date).getTime();
    return Number.isFinite(timestamp) && timestamp >= range.start.getTime() &&
      timestamp < range.endExclusive.getTime();
  });
  activityRows.sort(function (a, b) {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  function reportDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? (value || '-') : date.toLocaleString('id-ID');
  }

  var html = `
    <div class="table-responsive" style="margin-top: 12px;">
      <table class="table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jenis Aktivitas</th>
            <th>No. Referensi</th>
            <th>Pelanggan / Supplier</th>
            <th>Metode</th>
            <th>Nominal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${activityRows.map(function (item) {
          return `<tr>
            <td>${escapeHtml(reportDate(item.date))}</td>
            <td>${escapeHtml(item.type)}</td>
            <td>${escapeHtml(item.reference || '-')}</td>
            <td>${escapeHtml(item.party || '-')}</td>
            <td>${escapeHtml(item.method || '-')}</td>
            <td>${formatRupiah(Number(item.amount) || 0)}</td>
            <td>${escapeHtml(item.status || '-')}</td>
          </tr>`;
        }).join('') || `<tr><td colspan="7" style="text-align:center; padding:20px;">Belum ada ${type === 'PENJUALAN' ? 'transaksi penjualan' : 'aktivitas'} pada ${escapeHtml(range.label.toLowerCase())}.</td></tr>`}</tbody>
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
}

async function handleSaveStoreSettings(e) {
  e.preventDefault();
  var settings = {
    store_name: document.getElementById('set-store-name').value.trim(),
    store_address: document.getElementById('set-store-address').value.trim(),
    store_phone: document.getElementById('set-store-phone').value.trim(),
    invoice_footer: document.getElementById('set-invoice-footer').value.trim()
  };
  if (!settings.store_name) {
    showToast('warning', 'Nama toko wajib diisi.');
    return;
  }
  try {
    await callApi('saveSettings', settings);
    state.settings = Object.assign({}, state.settings, settings);
    var brandStoreName = document.getElementById('brand-store-name');
    if (brandStoreName) brandStoreName.innerText = state.settings.store_name;
    showToast('success', 'Pengaturan toko berhasil disimpan di Supabase.');
  } catch (error) {
    console.error('Gagal menyimpan pengaturan toko:', error);
    showToast('error', 'Pengaturan toko gagal disimpan: ' + error.message);
  }
}

async function runTestSupabase() {
  var statusBadge = document.getElementById('set-db-status-badge');
  if (!statusBadge) return;
  statusBadge.textContent = 'Menguji...';
  statusBadge.className = 'badge badge-warning';
  if (!supabaseClient) {
    statusBadge.textContent = 'Belum dikonfigurasi';
    statusBadge.className = 'badge badge-danger';
    showToast('error', 'Supabase belum dikonfigurasi melalui config.js.');
    return;
  }
  try {
    var sessionResult = await supabaseClient.auth.getSession();
    if (sessionResult.error) throw new Error(sessionResult.error.message);
    var result = await supabaseClient.from('products').select('product_id', { count: 'exact', head: true });
    if (result.error) throw new Error(result.error.message);
    statusBadge.textContent = sessionResult.data.session
      ? 'Supabase terhubung'
      : 'Terhubung; belum login';
    statusBadge.className = 'badge badge-success';
    showToast('success', sessionResult.data.session
      ? 'Koneksi dan akses database Supabase berhasil.'
      : 'API Supabase terhubung. Login staf diperlukan untuk menguji akses data.');
  } catch (error) {
    statusBadge.textContent = 'Koneksi gagal';
    statusBadge.className = 'badge badge-danger';
    console.error('Uji koneksi Supabase gagal:', error);
    showToast('error', 'Koneksi Supabase gagal: ' + error.message);
  }
}

function openStoreResetModal() {
  if (!state.user || state.user.role !== 'admin') {
    showToast('error', 'Hanya admin yang dapat mereset data toko.');
    return;
  }
  var status = document.getElementById('store-reset-status');
  var resetButton = document.getElementById('btn-confirm-store-reset');
  var cancelButton = document.getElementById('btn-cancel-store-reset');
  var closeButton = document.getElementById('btn-close-store-reset');
  var modal = document.getElementById('modal-reset-store-data');
  if (status) status.textContent = '';
  if (modal) modal.dataset.resetInProgress = 'false';
  if (resetButton) {
    resetButton.disabled = false;
    resetButton.innerHTML = '<i class="ri-delete-bin-line"></i> Ya, reset semua data';
  }
  if (cancelButton) cancelButton.disabled = false;
  if (closeButton) closeButton.disabled = false;
  openModal('modal-reset-store-data');
}

async function confirmStoreDataReset() {
  if (!state.user || state.user.role !== 'admin') {
    showToast('error', 'Hanya admin yang dapat mereset data toko.');
    return;
  }
  var status = document.getElementById('store-reset-status');
  var resetButton = document.getElementById('btn-confirm-store-reset');
  var cancelButton = document.getElementById('btn-cancel-store-reset');
  var closeButton = document.getElementById('btn-close-store-reset');
  var modal = document.getElementById('modal-reset-store-data');
  if (modal) modal.dataset.resetInProgress = 'true';
  if (resetButton) {
    resetButton.disabled = true;
    resetButton.textContent = 'Mereset data...';
  }
  if (cancelButton) cancelButton.disabled = true;
  if (closeButton) closeButton.disabled = true;
  if (status) status.textContent = 'Reset sedang diproses. Jangan tutup halaman ini.';

  try {
    await callApi('resetStoreData');
    if (modal) modal.dataset.resetInProgress = 'false';
    closeModal('modal-reset-store-data');
    try {
      await loadAllMasterData();
      showToast('success', 'Data toko berhasil direset. Akun admin dan pengaturan toko tetap tersimpan.');
    } catch (reloadError) {
      console.error('Reset berhasil, tetapi data toko gagal dimuat ulang:', reloadError);
      showToast('error', 'Reset telah dikonfirmasi database, tetapi data terbaru gagal dimuat. Muat ulang halaman.');
    }
  } catch (error) {
    console.error('Reset data toko gagal:', error);
    if (modal) modal.dataset.resetInProgress = 'false';
    if (status) status.textContent = 'Reset gagal: ' + error.message;
    showToast('error', 'Data toko gagal direset: ' + error.message);
    if (resetButton) {
      resetButton.disabled = false;
      resetButton.innerHTML = '<i class="ri-delete-bin-line"></i> Ya, reset semua data';
    }
    if (cancelButton) cancelButton.disabled = false;
    if (closeButton) closeButton.disabled = false;
  }
}

/* RECEIPT & PDF LOGIC */
function sendReceiptWhatsapp() {
  var methodNames = {
    CASH: 'Tunai',
    TRANSFER: 'Transfer',
    QRIS: 'QRIS',
    CREDIT: 'Hutang / piutang'
  };
  var method = state.lastPaymentMethod || 'CASH';
  var items = state.lastCart || state.posCart;
  var dateStr = new Date().toLocaleString('id-ID');
  var text = `*${state.settings.store_name || 'Toko Kita'}*\n`;
  if (state.settings.store_address) text += `${state.settings.store_address}\n`;
  if (state.settings.store_phone) text += `Telp. ${state.settings.store_phone}\n`;
  text += `\n*STRUK PEMBELIAN*\n`;
  if (state.lastInvoiceNo) text += `No. transaksi: ${state.lastInvoiceNo}\n`;
  text += `Tanggal: ${dateStr}\n`;
  text += `Kasir: ${state.user ? state.user.full_name : '-'}\n`;
  if (state.lastCustomerName) text += `Pelanggan: ${state.lastCustomerName}\n`;
  text += `\n------------------------------\n`;
  text += `*RINCIAN BARANG*\n`;
  items.forEach(function (item) {
    text += `\n*${item.Product_Name}*\n`;
    text += `${Number(item.Qty).toLocaleString('id-ID')} x ${formatRupiah(item.Sell_Price)} = ${formatRupiah(item.Subtotal)}\n`;
  });

  text += `\n------------------------------\n`;
  text += `Subtotal: ${formatRupiah(state.lastSubtotal || 0)}\n`;
  if (state.lastDiscount > 0) text += `Diskon: - ${formatRupiah(state.lastDiscount)}\n`;
  if (state.lastBalanceUsed > 0) text += `Saldo pelanggan: - ${formatRupiah(state.lastBalanceUsed)}\n`;
  text += `*Total belanja: ${formatRupiah(state.lastGrandTotal || 0)}*\n`;
  if (method === 'CREDIT') {
    text += `Sisa tagihan: ${formatRupiah(state.lastAmountDue || 0)}\n`;
  } else {
    text += `Dibayar: ${formatRupiah(state.lastAmountDue || 0)}\n`;
  }
  text += `Metode pembayaran: ${methodNames[method] || method}\n`;
  if (method === 'CASH') {
    text += `Uang diterima: ${formatRupiah(state.lastCash || 0)}\n`;
    text += `Kembalian: ${formatRupiah(state.lastChange || 0)}\n`;
  }
  if (state.lastDebtPayment > 0) text += `Untuk cicilan piutang: ${formatRupiah(state.lastDebtPayment)}\n`;
  if (state.lastCustomerBalanceAdded > 0) text += `Saldo pelanggan bertambah: ${formatRupiah(state.lastCustomerBalanceAdded)}\n`;
  if (state.lastCustomer && state.lastCustomer.Piutang > 0) {
    text += `Total piutang pelanggan: ${formatRupiah(state.lastCustomer.Piutang)}\n`;
  }
  if (state.lastCustomer && state.lastCustomer.Saldo > 0) {
    text += `Saldo pelanggan tersisa: ${formatRupiah(state.lastCustomer.Saldo)}\n`;
  }
  if (state.lastPaymentStatus) text += `Status: ${state.lastPaymentStatus}\n`;
  text += `\n------------------------------\n`;
  text += `\n${state.settings.invoice_footer || 'Terima kasih telah berbelanja!'}\n`;
  text += `Simpan struk ini sebagai bukti transaksi.`;

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
  var element = document.querySelector('#receipt-preview-area .receipt-paper');
  if (!element) {
    showToast('warning', 'Struk belum tersedia untuk diunduh.');
    return;
  }
  html2canvas(element, { scale: 2, backgroundColor: '#ffffff' }).then(function (canvas) {
    var link = document.createElement('a');
    var storeName = (state.settings.store_name || 'Toko_Kita').replace(/\s+/g, '_');
    link.download = 'Struk_' + storeName + '_' + new Date().getTime() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('success', 'Gambar struk berhasil diunduh.');
  }).catch(function (error) {
    console.error('Gagal membuat gambar struk:', error);
    showToast('error', 'Gagal membuat gambar struk.');
  });
}

function downloadReceiptPDF() {
  showToast('info', 'Menyiapkan PDF Struk...');
  var element = document.querySelector('#receipt-preview-area .receipt-paper');
  if (!element) {
    showToast('warning', 'Struk belum tersedia untuk diunduh.');
    return;
  }
  html2canvas(element, { scale: 2, backgroundColor: '#ffffff' }).then(function (canvas) {
    try {
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = Math.max(100, canvas.height * pdfWidth / canvas.width);
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      doc.save('Struk_Transaksi_' + new Date().getTime() + '.pdf');
      showToast('success', 'PDF Struk berhasil diunduh!');
    } catch (error) {
      console.error('Gagal membuat PDF struk:', error);
      showToast('error', 'Gagal membuat PDF Struk.');
    }
  }).catch(function (error) {
    console.error('Gagal menyiapkan struk untuk PDF:', error);
    showToast('error', 'Gagal membuat PDF Struk.');
  });
}

function downloadAllReportsPDF(filterByReportPeriod) {
  if (!state.masterDataLoaded) {
    showToast('warning', 'Data produk masih dimuat. Tunggu sebentar, lalu buat PDF kembali.');
    return;
  }
  var reportRange = filterByReportPeriod ? getSelectedPeriodRange('reports') : null;
  if (filterByReportPeriod && !reportRange) {
    showToast('warning', 'Pilih tanggal awal dan akhir yang valid sebelum mengunduh laporan.');
    return;
  }
  showToast('info', 'Menyiapkan PDF laporan...');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const tableWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 16;
    const colors = {
      primary: [23, 105, 194],
      primaryLight: [232, 241, 252],
      text: [28, 43, 67],
      muted: [64, 81, 107],
      border: [218, 226, 236],
      alternate: [246, 249, 252],
      white: [255, 255, 255]
    };
    const rowsForReportPeriod = function (rows) {
      return (rows || []).filter(function (row) {
        if (!reportRange) return true;
        var timestamp = new Date(row.Date).getTime();
        return Number.isFinite(timestamp) && timestamp >= reportRange.start.getTime() &&
          timestamp < reportRange.endExclusive.getTime();
      });
    };
    const sales = rowsForReportPeriod(state.salesTransactions);
    const purchases = rowsForReportPeriod(state.purchases);
    const products = state.products || [];
    const customers = state.customers || [];
    const suppliers = state.suppliers || [];
    const payments = rowsForReportPeriod(state.paymentHistory);
    const movements = rowsForReportPeriod(state.stockMovements);
    const returns = rowsForReportPeriod(state.returns);
    const sum = function (rows, key) {
      return rows.reduce(function (total, row) { return total + (Number(row[key]) || 0); }, 0);
    };
    const currentReceivables = sum(customers, 'Piutang');
    const currentPayables = sum(suppliers, 'Hutang');
    const inventoryValue = products.reduce(function (total, product) {
      return total + (Number(product.Stock) || 0) * (Number(product.Buy_Price_WAC) || 0);
    }, 0);
    const lowStockCount = products.filter(function (product) {
      return Number(product.Stock) <= (Number(product.Min_Stock) || 5);
    }).length;
    const paymentLabels = {
      CASH: 'Tunai',
      TRANSFER: 'Transfer',
      QRIS: 'QRIS',
      CREDIT: 'Hutang / piutang',
      TUNAI: 'Tunai'
    };
    let cursorY = 0;
    let pageNumber = 0;

    function addReportPage() {
      if (pageNumber > 0) doc.addPage();
      pageNumber += 1;
      doc.setFillColor(...colors.white);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 3, 'F');
      doc.setTextColor(...colors.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(state.settings.store_name || 'Toko Kita', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colors.muted);
      doc.text('LAPORAN OPERASIONAL TOKO', margin, 18);
      doc.text(reportRange ? 'Periode laporan: ' + reportRange.label : 'Periode: semua tanggal',
        margin, 22);
      const generatedAt = new Date().toLocaleString('id-ID');
      doc.text('Dicetak ' + generatedAt + ' | Operator: ' + (state.user ? state.user.full_name : '-'), pageWidth - margin, 12, { align: 'right' });
      doc.setDrawColor(...colors.border);
      doc.line(margin, 26, pageWidth - margin, 26);
      cursorY = 33;
    }

    function ensureReportSpace(height) {
      if (cursorY + height > bottomLimit) addReportPage();
    }

    function formatReportDate(value) {
      if (!value) return '-';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('id-ID');
    }

    function drawSectionTitle(title) {
      ensureReportSpace(13);
      doc.setFillColor(...colors.primaryLight);
      doc.rect(margin, cursorY, tableWidth, 8, 'F');
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(title, margin + 3, cursorY + 5.4);
      cursorY += 11;
    }

    function drawTable(title, columns, rows) {
      drawSectionTitle(title);
      const tableRows = rows.length ? rows : [columns.map(function (column, index) {
        return index === 0 ? 'Belum ada data tercatat' : '';
      })];
      let rowIndex = 0;

      function drawTableHeader() {
        doc.setFillColor(...colors.primary);
        doc.rect(margin, cursorY, tableWidth, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(...colors.white);
        let x = margin;
        columns.forEach(function (column) {
          const align = column.align || 'left';
          const textX = align === 'right' ? x + column.width - 2 : x + 2;
          doc.text(column.label, textX, cursorY + 5.4, { align: align === 'right' ? 'right' : 'left' });
          x += column.width;
        });
        cursorY += 8;
      }

      drawTableHeader();
      tableRows.forEach(function (row) {
        const cells = columns.map(function (column, index) {
          const value = row[index] == null ? '-' : String(row[index]);
          return doc.splitTextToSize(value, column.width - 4);
        });
        const lineCount = Math.max.apply(null, cells.map(function (lines) { return lines.length; }));
        const rowHeight = Math.max(7, lineCount * 3.4 + 3);
        if (cursorY + rowHeight > bottomLimit) {
          addReportPage();
          drawSectionTitle(title + ' (lanjutan)');
          drawTableHeader();
        }
        doc.setFillColor(...(rowIndex % 2 === 0 ? colors.white : colors.alternate));
        doc.rect(margin, cursorY, tableWidth, rowHeight, 'F');
        doc.setDrawColor(...colors.border);
        doc.line(margin, cursorY + rowHeight, margin + tableWidth, cursorY + rowHeight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(...colors.text);
        let x = margin;
        cells.forEach(function (lines, index) {
          const column = columns[index];
          const align = column.align || 'left';
          const textX = align === 'right' ? x + column.width - 2 : x + 2;
          doc.text(lines.slice(0, 3), textX, cursorY + 4.3, { align: align === 'right' ? 'right' : 'left', lineHeightFactor: 1.15 });
          x += column.width;
        });
        cursorY += rowHeight;
        rowIndex += 1;
      });
      cursorY += 7;
    }

    function drawSummaryCards(cards) {
      const gap = 4;
      const cardWidth = (tableWidth - gap * 2) / 3;
      const cardHeight = 20;
      cards.forEach(function (card, index) {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const x = margin + col * (cardWidth + gap);
        const y = cursorY + row * (cardHeight + 4);
        doc.setFillColor(...(index === 0 ? colors.primaryLight : colors.alternate));
        doc.setDrawColor(...colors.border);
        doc.rect(x, y, cardWidth, cardHeight, 'FD');
        doc.setTextColor(...colors.muted);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.text(card.label, x + 3, y + 6);
        doc.setTextColor(...colors.text);
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(card.value, cardWidth - 6)[0], x + 3, y + 14);
      });
      cursorY += Math.ceil(cards.length / 3) * (cardHeight + 4) + 5;
    }

    addReportPage();
    drawSectionTitle('Ringkasan toko');
    drawSummaryCards([
      { label: 'Penjualan tercatat', value: formatRupiah(sum(sales, 'Total')) + ' (' + sales.length + ' transaksi)' },
      { label: 'Pembelian tercatat', value: formatRupiah(sum(purchases, 'Total')) + ' (' + purchases.length + ' transaksi)' },
      { label: 'Nilai persediaan saat ini', value: formatRupiah(inventoryValue) },
      { label: 'Piutang pelanggan saat ini', value: formatRupiah(currentReceivables) },
      { label: 'Hutang supplier saat ini', value: formatRupiah(currentPayables) },
      { label: 'Nilai retur tercatat', value: formatRupiah(sum(returns, 'Total')) }
    ]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    const summaryNote = 'Stok menipis: ' + lowStockCount + ' dari ' + products.length + ' produk. Piutang dari transaksi kasir: ' +
      formatRupiah(sum(sales, 'Amount_Due')) + '. Saldo pelanggan: ' + formatRupiah(sum(customers, 'Saldo')) + '.';
    doc.text(doc.splitTextToSize(summaryNote, tableWidth), margin, cursorY);
    cursorY += 9;

    drawTable('Rincian penjualan', [
      { label: 'Tanggal', width: 34 },
      { label: 'No. invoice', width: 27 },
      { label: 'Pelanggan', width: 38 },
      { label: 'Metode', width: 24 },
      { label: 'Total', width: 31, align: 'right' },
      { label: 'Dibayar', width: 31, align: 'right' },
      { label: 'Saldo digunakan', width: 28, align: 'right' },
      { label: 'Piutang', width: 31, align: 'right' },
      { label: 'Status', width: 24 }
    ], sales.map(function (sale) {
      return [
        formatReportDate(sale.Date),
        sale.Invoice_No,
        sale.Customer_Name,
        paymentLabels[sale.Payment_Method] || sale.Payment_Method,
        formatRupiah(sale.Total || 0),
        formatRupiah(sale.Amount_Paid || 0),
        formatRupiah(sale.Balance_Used || 0),
        formatRupiah(sale.Amount_Due || 0),
        sale.Payment_Status
      ];
    }));

    drawTable('Rincian pembelian supplier', [
      { label: 'Tanggal', width: 31 },
      { label: 'No. pembelian', width: 29 },
      { label: 'Supplier', width: 42 },
      { label: 'Barang (jumlah)', width: 72 },
      { label: 'Metode', width: 25 },
      { label: 'Total', width: 34, align: 'right' },
      { label: 'Status', width: 16 }
    ], purchases.map(function (purchase) {
      const itemSummary = (purchase.Items || []).map(function (item) {
        return item.Product_Name + ' (' + item.Qty + ')';
      }).join(', ') || '-';
      return [
        formatReportDate(purchase.Date),
        purchase.Purchase_No,
        purchase.Supplier_Name,
        itemSummary,
        paymentLabels[purchase.Payment_Method] || purchase.Payment_Method || '-',
        formatRupiah(purchase.Total || 0),
        purchase.Payment_Status || purchase.Status || '-'
      ];
    }));

    drawTable('Daftar stok dan harga produk', [
      { label: 'ID produk', width: 27 },
      { label: 'Nama produk', width: 56 },
      { label: 'Kategori', width: 39 },
      { label: 'Harga beli', width: 34, align: 'right' },
      { label: 'Harga jual', width: 34, align: 'right' },
      { label: 'Stok', width: 24, align: 'right' },
      { label: 'Min. stok', width: 24, align: 'right' },
      { label: 'Kondisi', width: 30 }
    ], products.map(function (product) {
      const stock = Number(product.Stock) || 0;
      const minimum = Number(product.Min_Stock) || 5;
      return [
        product.Product_ID,
        product.Product_Name,
        product.Category_Name || '-',
        formatRupiah(product.Buy_Price_WAC || 0),
        formatRupiah(product.Sell_Price || 0),
        String(stock),
        String(minimum),
        stock <= minimum ? 'Perlu restock' : 'Tersedia'
      ];
    }));

    drawTable('Piutang pelanggan dan saldo', [
      { label: 'ID pelanggan', width: 32 },
      { label: 'Nama pelanggan', width: 58 },
      { label: 'Telepon', width: 40 },
      { label: 'Piutang', width: 40, align: 'right' },
      { label: 'Saldo', width: 40, align: 'right' },
      { label: 'Status', width: 58 }
    ], customers.map(function (customer) {
      const receivable = Number(customer.Piutang) || 0;
      const balance = Number(customer.Saldo) || 0;
      return [
        customer.Customer_ID,
        customer.Customer_Name,
        customer.Phone || '-',
        formatRupiah(receivable),
        formatRupiah(balance),
        receivable > 0 ? 'Belum lunas' : 'Lunas'
      ];
    }));

    drawTable('Hutang supplier', [
      { label: 'ID supplier', width: 32 },
      { label: 'Nama supplier', width: 75 },
      { label: 'Telepon', width: 48 },
      { label: 'Sisa hutang', width: 52, align: 'right' },
      { label: 'Status', width: 61 }
    ], suppliers.map(function (supplier) {
      const debt = Number(supplier.Hutang) || 0;
      return [
        supplier.Supplier_ID,
        supplier.Supplier_Name,
        supplier.Phone || '-',
        formatRupiah(debt),
        debt > 0 ? 'Belum lunas' : 'Lunas'
      ];
    }));

    drawTable('Riwayat pembayaran piutang dan hutang', [
      { label: 'Tanggal', width: 30 },
      { label: 'No. pembayaran', width: 30 },
      { label: 'Jenis', width: 40 },
      { label: 'Pelanggan / supplier', width: 42 },
      { label: 'Metode', width: 20 },
      { label: 'Nominal', width: 28, align: 'right' },
      { label: 'Terbayar ke hutang', width: 32, align: 'right' },
      { label: 'Lebihan ke saldo', width: 25, align: 'right' },
      { label: 'Sisa tagihan', width: 22, align: 'right' }
    ], payments.map(function (payment) {
      return [
        formatReportDate(payment.Date),
        payment.Payment_No,
        payment.Type,
        payment.Party_Name,
        paymentLabels[payment.Method] || payment.Method,
        formatRupiah(payment.Amount || 0),
        formatRupiah(payment.Amount_Applied || 0),
        formatRupiah(payment.Customer_Balance_Added || 0),
        formatRupiah(payment.Remaining_Due || 0)
      ];
    }));

    drawTable('Riwayat pergerakan stok', [
      { label: 'Tanggal', width: 38 },
      { label: 'Nama produk', width: 56 },
      { label: 'Jenis pergerakan', width: 48 },
      { label: 'Stok masuk', width: 28, align: 'right' },
      { label: 'Stok keluar', width: 28, align: 'right' },
      { label: 'Referensi', width: 70 }
    ], movements.map(function (movement) {
      return [
        formatReportDate(movement.Date),
        movement.Product_Name,
        movement.Type,
        Number(movement.In) ? String(movement.In) : '-',
        Number(movement.Out) ? String(movement.Out) : '-',
        movement.Ref || '-'
      ];
    }));

    drawTable('Riwayat retur', [
      { label: 'Tanggal', width: 40 },
      { label: 'No. retur', width: 45 },
      { label: 'No. invoice', width: 45 },
      { label: 'Nilai retur', width: 45, align: 'right' },
      { label: 'Penyelesaian', width: 49 },
      { label: 'Status', width: 45 }
    ], returns.map(function (item) {
      return [
        formatReportDate(item.Date),
        item.Return_No,
        item.Invoice_No,
        formatRupiah(item.Total || 0),
        { CASH: 'Tunai', BALANCE: 'Saldo pelanggan', RECEIVABLE: 'Piutang / saldo' }[item.Settlement_Method] || '-',
        item.Status
      ];
    }));

    const totalPages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...colors.border);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...colors.muted);
      doc.text('Data disusun dari catatan yang tersedia pada perangkat saat PDF dibuat.', margin, pageHeight - 5);
      doc.text('Halaman ' + page + ' dari ' + totalPages, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }

    var reportEndDate = reportRange ? new Date(reportRange.endExclusive) : null;
    if (reportEndDate) reportEndDate.setDate(reportEndDate.getDate() - 1);
    var reportFileName = reportRange
      ? 'Laporan_' + localDateInputValue(reportRange.start) + '_sd_' +
        localDateInputValue(reportEndDate) + '.pdf'
      : 'Laporan_Lengkap_' + new Date().toISOString().slice(0, 10) + '.pdf';
    doc.save(reportFileName);
    showToast('success', reportRange ? 'PDF laporan periode berhasil diunduh.' : 'PDF Laporan berhasil diunduh!');
  } catch (error) {
    console.error('Gagal membuat PDF laporan:', error);
    showToast('error', 'Gagal membuat PDF Laporan.');
  }
}
