-- ----------------------------------------------------
-- SUPABASE POSTGRESQL SCHEMA UNTUK TOKO KELONTONG BERKAH
-- Silakan copy-paste seluruh kode ini ke Supabase > SQL Editor lalu jalankan (Run).
-- ----------------------------------------------------

-- Tabel Pengaturan
CREATE TABLE SETTINGS (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tabel Pengguna (Admin/Kasir)
CREATE TABLE USERS (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kasir',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Kategori
CREATE TABLE CATEGORIES (
    category_id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Satuan
CREATE TABLE UNITS (
    unit_id TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    base_unit TEXT,
    conversion_factor NUMERIC DEFAULT 1,
    description TEXT
);

-- Tabel Master Produk
CREATE TABLE PRODUCTS (
    product_id TEXT PRIMARY KEY,
    barcode TEXT,
    product_name TEXT NOT NULL,
    category_id TEXT REFERENCES CATEGORIES(category_id),
    base_unit TEXT,
    buy_price_wac NUMERIC DEFAULT 0,
    sell_price NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Pelanggan
CREATE TABLE CUSTOMERS (
    customer_id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    total_piutang NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Penjualan (Invoice)
CREATE TABLE SALES (
    invoice_no TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id TEXT REFERENCES CUSTOMERS(customer_id),
    payment_method TEXT NOT NULL,
    subtotal NUMERIC DEFAULT 0,
    discount_total NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    cash_received NUMERIC DEFAULT 0,
    cash_change NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'LUNAS',
    piutang_balance NUMERIC DEFAULT 0,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Item Penjualan
CREATE TABLE SALES_ITEMS (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT REFERENCES SALES(invoice_no),
    product_id TEXT REFERENCES PRODUCTS(product_id),
    product_name TEXT NOT NULL,
    unit TEXT,
    qty NUMERIC NOT NULL,
    sell_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL
);

-- ----------------------------------------------------
-- SEED DATA AWAL (DUMMY DATA)
-- Menambahkan data awal agar aplikasi tidak kosong.
-- ----------------------------------------------------
INSERT INTO SETTINGS (key, value) VALUES 
('store_name', 'Toko Kelontong Berkah'),
('store_address', 'Jl. Merdeka No. 45, Karanganyar'),
('store_phone', '0812-3456-7890');

INSERT INTO USERS (user_id, username, password_hash, full_name, role) VALUES 
('USR-001', 'admin', 'admin123', 'Administrator Toko', 'admin');

INSERT INTO CATEGORIES (category_id, category_name, description) VALUES 
('CAT-001', 'Makanan', 'Makanan ringan, mi instan, dll'),
('CAT-002', 'Minuman', 'Air mineral, kopi, teh, dll'),
('CAT-003', 'Bahan Pokok', 'Beras, gula, minyak goreng, dll');

INSERT INTO PRODUCTS (product_id, barcode, product_name, category_id, base_unit, buy_price_wac, sell_price, stock, min_stock) VALUES 
('PRD-001', '8991001001', 'Aqua 600ml', 'CAT-002', 'PCS', 3000, 4000, 50, 10),
('PRD-002', '8991001002', 'Indomie Goreng 85g', 'CAT-001', 'PCS', 2800, 3500, 100, 20),
('PRD-003', '8991001003', 'Minyak Goreng Bimoli 1L', 'CAT-003', 'PCS', 14000, 16500, 30, 5);

INSERT INTO CUSTOMERS (customer_id, customer_name) VALUES 
('CUST-001', 'Pelanggan Umum');
