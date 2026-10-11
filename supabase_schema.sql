-- Toko Kita POS schema and security policies.
-- Run in Supabase SQL Editor on a staging project first.
-- Browser clients use only the Supabase anon/publishable key. Never use service_role here.
-- Create staff accounts with Supabase Auth, then insert their UUID into staff_profiles.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.staff_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    role text not null default 'cashier' check (role in ('admin', 'cashier')),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.categories (
    category_id text primary key,
    category_name text not null unique,
    description text,
    created_at timestamptz not null default now()
);

create table if not exists public.units (
    unit_id text primary key,
    unit_name text not null unique,
    base_unit text,
    conversion_factor numeric not null default 1 check (conversion_factor > 0),
    description text,
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    product_id text primary key,
    barcode text,
    product_name text not null,
    category_id text references public.categories(category_id) on delete set null,
    base_unit text not null default 'PCS',
    buy_price_wac numeric(14,2) not null default 0 check (buy_price_wac >= 0),
    sell_price numeric(14,2) not null default 0 check (sell_price >= 0),
    stock numeric(14,3) not null default 0 check (stock >= 0),
    min_stock numeric(14,3) not null default 5 check (min_stock >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists products_barcode_unique
    on public.products(barcode) where barcode is not null and barcode <> '';

create table if not exists public.customers (
    customer_id text primary key,
    customer_name text not null,
    phone text,
    address text,
    total_piutang numeric(14,2) not null default 0 check (total_piutang >= 0),
    saldo_pelanggan numeric(14,2) not null default 0 check (saldo_pelanggan >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists customers_name_unique
    on public.customers(lower(trim(customer_name)));

create table if not exists public.suppliers (
    supplier_id text primary key,
    supplier_name text not null,
    phone text,
    address text,
    total_hutang numeric(14,2) not null default 0 check (total_hutang >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_name_unique
    on public.suppliers(lower(trim(supplier_name)));

create table if not exists public.sales (
    invoice_no text primary key,
    created_at timestamptz not null default now(),
    customer_id text references public.customers(customer_id) on delete set null,
    cashier_id uuid references public.staff_profiles(user_id) on delete set null,
    payment_method text not null check (payment_method in ('CASH', 'TRANSFER', 'QRIS', 'CREDIT')),
    subtotal numeric(14,2) not null check (subtotal >= 0),
    discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
    grand_total numeric(14,2) not null check (grand_total >= 0),
    balance_used numeric(14,2) not null default 0 check (balance_used >= 0),
    amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
    amount_due numeric(14,2) not null default 0 check (amount_due >= 0),
    cash_received numeric(14,2) not null default 0 check (cash_received >= 0),
    cash_change numeric(14,2) not null default 0 check (cash_change >= 0),
    debt_payment numeric(14,2) not null default 0 check (debt_payment >= 0),
    balance_added numeric(14,2) not null default 0 check (balance_added >= 0),
    status text not null default 'LUNAS' check (status in ('LUNAS', 'PIUTANG')),
    notes text
);

create table if not exists public.sales_items (
    item_id uuid primary key default gen_random_uuid(),
    invoice_no text not null references public.sales(invoice_no) on delete cascade,
    product_id text not null references public.products(product_id) on delete restrict,
    product_name text not null,
    unit text,
    qty numeric(14,3) not null check (qty > 0),
    sell_price numeric(14,2) not null check (sell_price >= 0),
    subtotal numeric(14,2) not null check (subtotal >= 0)
);

create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sales_customer_idx on public.sales(customer_id);
create index if not exists sales_items_invoice_idx on public.sales_items(invoice_no);

create table if not exists public.purchases (
    purchase_no text primary key,
    created_at timestamptz not null default now(),
    supplier_id text not null references public.suppliers(supplier_id) on delete restrict,
    created_by uuid references public.staff_profiles(user_id) on delete set null,
    total numeric(14,2) not null check (total >= 0),
    payment_method text not null check (payment_method in ('CASH', 'TRANSFER', 'CREDIT')),
    payment_status text not null default 'LUNAS' check (payment_status in ('LUNAS', 'BELUM LUNAS')),
    debt_added numeric(14,2) not null default 0 check (debt_added >= 0),
    status text not null default 'SELESAI'
);

create table if not exists public.purchase_items (
    item_id uuid primary key default gen_random_uuid(),
    purchase_no text not null references public.purchases(purchase_no) on delete cascade,
    product_id text not null references public.products(product_id) on delete restrict,
    product_name text not null,
    qty numeric(14,3) not null check (qty > 0),
    unit_price numeric(14,2) not null check (unit_price >= 0),
    subtotal numeric(14,2) not null check (subtotal >= 0)
);

create index if not exists purchases_created_at_idx on public.purchases(created_at desc);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_no);

create table if not exists public.payments (
    payment_no text primary key,
    created_at timestamptz not null default now(),
    payment_type text not null check (payment_type in ('CUSTOMER_RECEIVABLE', 'SUPPLIER_PAYABLE')),
    customer_id text references public.customers(customer_id) on delete restrict,
    supplier_id text references public.suppliers(supplier_id) on delete restrict,
    party_name text not null,
    method text not null check (method in ('TUNAI', 'TRANSFER', 'QRIS')),
    amount numeric(14,2) not null check (amount > 0),
    amount_applied numeric(14,2) not null check (amount_applied >= 0),
    remaining_due numeric(14,2) not null check (remaining_due >= 0),
    customer_balance_added numeric(14,2) not null default 0 check (customer_balance_added >= 0),
    note text,
    created_by uuid references public.staff_profiles(user_id) on delete set null,
    check (
        (payment_type = 'CUSTOMER_RECEIVABLE' and customer_id is not null and supplier_id is null)
        or (payment_type = 'SUPPLIER_PAYABLE' and supplier_id is not null and customer_id is null)
    )
);

create table if not exists public.stock_movements (
    movement_id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    product_id text not null references public.products(product_id) on delete restrict,
    product_name text not null,
    movement_type text not null,
    qty_in numeric(14,3) not null default 0 check (qty_in >= 0),
    qty_out numeric(14,3) not null default 0 check (qty_out >= 0),
    reference_no text not null,
    created_by uuid references public.staff_profiles(user_id) on delete set null,
    check (qty_in > 0 or qty_out > 0),
    check (qty_in = 0 or qty_out = 0)
);

create index if not exists stock_movements_created_at_idx on public.stock_movements(created_at desc);
create index if not exists stock_movements_reference_idx on public.stock_movements(reference_no);

create table if not exists public.returns (
    return_no text primary key,
    created_at timestamptz not null default now(),
    invoice_no text not null references public.sales(invoice_no) on delete restrict,
    customer_id text not null references public.customers(customer_id) on delete restrict,
    total numeric(14,2) not null check (total > 0),
    settlement_method text not null check (settlement_method in ('CASH', 'BALANCE', 'RECEIVABLE')),
    status text not null default 'SELESAI',
    created_by uuid references public.staff_profiles(user_id) on delete set null
);

alter table public.returns drop constraint if exists returns_total_check;
alter table public.returns drop constraint if exists returns_total_nonnegative;
alter table public.returns add constraint returns_total_nonnegative check (total >= 0);

create table if not exists public.return_items (
    item_id uuid primary key default gen_random_uuid(),
    return_no text not null references public.returns(return_no) on delete cascade,
    sales_item_id uuid not null references public.sales_items(item_id) on delete restrict,
    product_id text not null references public.products(product_id) on delete restrict,
    product_name text not null,
    qty numeric(14,3) not null check (qty > 0),
    unit_price numeric(14,2) not null check (unit_price >= 0),
    subtotal numeric(14,2) not null check (subtotal >= 0)
);

create index if not exists returns_created_at_idx on public.returns(created_at desc);

alter table public.settings add column if not exists updated_at timestamptz not null default now();
alter table public.units add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists is_active boolean not null default true;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists saldo_pelanggan numeric(14,2) not null default 0
    check (saldo_pelanggan >= 0);
alter table public.suppliers add column if not exists total_hutang numeric(14,2) not null default 0;
alter table public.suppliers add column if not exists is_active boolean not null default true;
alter table public.suppliers add column if not exists updated_at timestamptz not null default now();
alter table public.sales add column if not exists cashier_id uuid references public.staff_profiles(user_id) on delete set null;
alter table public.sales add column if not exists balance_used numeric(14,2) not null default 0;
alter table public.sales add column if not exists amount_paid numeric(14,2) not null default 0;
alter table public.sales add column if not exists amount_due numeric(14,2) not null default 0;
alter table public.sales add column if not exists debt_payment numeric(14,2) not null default 0;
alter table public.sales add column if not exists balance_added numeric(14,2) not null default 0;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.staff_profiles
        where user_id = (select auth.uid()) and is_active
    );
$$;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.staff_profiles
        where user_id = (select auth.uid()) and is_active and role = 'admin'
    );
$$;

alter table public.staff_profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sales_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;

drop policy if exists staff_profiles_select_self_or_admin on public.staff_profiles;
create policy staff_profiles_select_self_or_admin on public.staff_profiles
    for select to authenticated using (user_id = (select auth.uid()) or public.is_store_admin());
drop policy if exists staff_profiles_admin_write on public.staff_profiles;
create policy staff_profiles_admin_write on public.staff_profiles
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists settings_staff_read on public.settings;
create policy settings_staff_read on public.settings
    for select to authenticated using (public.is_active_staff());
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists categories_staff_read on public.categories;
create policy categories_staff_read on public.categories
    for select to authenticated using (public.is_active_staff());
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists units_staff_read on public.units;
create policy units_staff_read on public.units
    for select to authenticated using (public.is_active_staff());
drop policy if exists units_admin_write on public.units;
create policy units_admin_write on public.units
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists products_staff_read on public.products;
create policy products_staff_read on public.products
    for select to authenticated using (public.is_active_staff());
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists customers_staff_read on public.customers;
create policy customers_staff_read on public.customers
    for select to authenticated using (public.is_active_staff());
drop policy if exists customers_admin_write on public.customers;
create policy customers_admin_write on public.customers
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists suppliers_staff_read on public.suppliers;
create policy suppliers_staff_read on public.suppliers
    for select to authenticated using (public.is_active_staff());
drop policy if exists suppliers_admin_write on public.suppliers;
create policy suppliers_admin_write on public.suppliers
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists sales_staff_read on public.sales;
create policy sales_staff_read on public.sales
    for select to authenticated using (public.is_active_staff());
drop policy if exists sales_admin_write on public.sales;
create policy sales_admin_write on public.sales
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists sales_items_staff_read on public.sales_items;
create policy sales_items_staff_read on public.sales_items
    for select to authenticated using (public.is_active_staff());
drop policy if exists sales_items_admin_write on public.sales_items;
create policy sales_items_admin_write on public.sales_items
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists purchases_staff_read on public.purchases;
create policy purchases_staff_read on public.purchases
    for select to authenticated using (public.is_active_staff());
drop policy if exists purchases_admin_write on public.purchases;
create policy purchases_admin_write on public.purchases
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists purchase_items_staff_read on public.purchase_items;
create policy purchase_items_staff_read on public.purchase_items
    for select to authenticated using (public.is_active_staff());
drop policy if exists purchase_items_admin_write on public.purchase_items;
create policy purchase_items_admin_write on public.purchase_items
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists payments_staff_read on public.payments;
create policy payments_staff_read on public.payments
    for select to authenticated using (public.is_active_staff());
drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists stock_movements_staff_read on public.stock_movements;
create policy stock_movements_staff_read on public.stock_movements
    for select to authenticated using (public.is_active_staff());
drop policy if exists stock_movements_admin_write on public.stock_movements;
create policy stock_movements_admin_write on public.stock_movements
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists returns_staff_read on public.returns;
create policy returns_staff_read on public.returns
    for select to authenticated using (public.is_active_staff());
drop policy if exists returns_admin_write on public.returns;
create policy returns_admin_write on public.returns
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists return_items_staff_read on public.return_items;
create policy return_items_staff_read on public.return_items
    for select to authenticated using (public.is_active_staff());
drop policy if exists return_items_admin_write on public.return_items;
create policy return_items_admin_write on public.return_items
    for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create or replace function public.process_sale(
    p_customer_name text,
    p_customer_phone text,
    p_payment_method text,
    p_discount numeric,
    p_cash_received numeric,
    p_retain_change boolean,
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_customer public.customers%rowtype;
    v_item jsonb;
    v_product public.products%rowtype;
    v_qty numeric(14,3);
    v_subtotal numeric(14,2) := 0;
    v_discount numeric(14,2) := greatest(coalesce(p_discount, 0), 0);
    v_total numeric(14,2);
    v_balance_used numeric(14,2) := 0;
    v_amount_due numeric(14,2);
    v_cash numeric(14,2) := greatest(coalesce(p_cash_received, 0), 0);
    v_change numeric(14,2) := 0;
    v_debt_payment numeric(14,2) := 0;
    v_balance_added numeric(14,2) := 0;
    v_invoice text := 'INV-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 6);
    v_status text;
begin
    if not public.is_active_staff() then raise exception 'Akun tidak aktif atau tidak memiliki akses kasir.'; end if;
    if p_customer_name is null or trim(p_customer_name) = '' then raise exception 'Nama pelanggan wajib diisi.'; end if;
    if p_payment_method is null or p_payment_method not in ('CASH', 'TRANSFER', 'QRIS', 'CREDIT') then raise exception 'Metode pembayaran tidak valid.'; end if;
    if p_discount is null or p_discount < 0 or p_cash_received is null or p_cash_received < 0 then
        raise exception 'Diskon atau nominal tunai tidak valid.';
    end if;
    if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Keranjang penjualan kosong.';
    end if;

    insert into public.customers(customer_id, customer_name, phone)
    values ('CUST-' || substr(gen_random_uuid()::text, 1, 12), trim(p_customer_name), nullif(trim(p_customer_phone), ''))
    on conflict (lower(trim(customer_name))) do nothing;

    select * into v_customer from public.customers
    where lower(trim(customer_name)) = lower(trim(p_customer_name))
    for update;
    if not found or not v_customer.is_active then raise exception 'Pelanggan tidak tersedia.'; end if;
    if coalesce(p_customer_phone, '') <> '' and (v_customer.phone is null or v_customer.phone = '') then
        update public.customers set phone = trim(p_customer_phone), updated_at = now()
        where customer_id = v_customer.customer_id;
    end if;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        v_qty := (v_item->>'Qty')::numeric;
        if v_qty is null or v_qty <= 0 then raise exception 'Jumlah barang harus lebih dari nol.'; end if;
        select * into v_product from public.products
        where product_id = v_item->>'Product_ID' and is_active
        for update;
        if not found then raise exception 'Produk % tidak tersedia.', v_item->>'Product_ID'; end if;
        if v_product.stock < v_qty then raise exception 'Stok % tidak mencukupi.', v_product.product_name; end if;
        v_subtotal := v_subtotal + round(v_qty * v_product.sell_price, 2);
    end loop;

    if v_discount > v_subtotal then raise exception 'Diskon tidak boleh melebihi subtotal.'; end if;
    v_total := v_subtotal - v_discount;
    v_balance_used := least(v_total, v_customer.saldo_pelanggan);
    v_amount_due := v_total - v_balance_used;

    if p_payment_method = 'CASH' then
        if v_cash < v_amount_due then raise exception 'Uang tunai belum mencukupi.'; end if;
        v_change := v_cash - v_amount_due;
        if coalesce(p_retain_change, false) then
            v_debt_payment := least(v_customer.total_piutang, v_change);
            v_balance_added := v_change - v_debt_payment;
            v_change := 0;
        end if;
    elsif p_payment_method <> 'CREDIT' and v_amount_due > 0 then
        v_cash := v_amount_due;
    end if;

    v_status := case when p_payment_method = 'CREDIT' and v_amount_due > 0 then 'PIUTANG' else 'LUNAS' end;
    insert into public.sales(
        invoice_no, customer_id, cashier_id, payment_method, subtotal, discount_total,
        grand_total, balance_used, amount_paid, amount_due, cash_received, cash_change,
        debt_payment, balance_added, status
    ) values (
        v_invoice, v_customer.customer_id, auth.uid(), p_payment_method, v_subtotal, v_discount,
        v_total, v_balance_used, case when p_payment_method = 'CREDIT' then 0 else v_amount_due end,
        case when p_payment_method = 'CREDIT' then v_amount_due else 0 end,
        case when p_payment_method = 'CASH' then v_cash else 0 end,
        v_change, v_debt_payment, v_balance_added, v_status
    );

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        v_qty := (v_item->>'Qty')::numeric;
        select * into v_product from public.products where product_id = v_item->>'Product_ID' for update;
        insert into public.sales_items(invoice_no, product_id, product_name, unit, qty, sell_price, subtotal)
        values (v_invoice, v_product.product_id, v_product.product_name, v_product.base_unit, v_qty,
            v_product.sell_price, round(v_qty * v_product.sell_price, 2));
        update public.products set stock = stock - v_qty, updated_at = now() where product_id = v_product.product_id;
        insert into public.stock_movements(product_id, product_name, movement_type, qty_out, reference_no, created_by)
        values (v_product.product_id, v_product.product_name, 'Penjualan Kasir', v_qty, v_invoice, auth.uid());
    end loop;

    update public.customers
    set saldo_pelanggan = saldo_pelanggan - v_balance_used + v_balance_added,
        total_piutang = total_piutang - v_debt_payment +
            case when p_payment_method = 'CREDIT' then v_amount_due else 0 end,
        updated_at = now()
    where customer_id = v_customer.customer_id;

    return jsonb_build_object(
        'success', true, 'invoice_no', v_invoice, 'customer_id', v_customer.customer_id,
        'subtotal', v_subtotal, 'discount_total', v_discount, 'grand_total', v_total,
        'balance_used', v_balance_used, 'amount_due', v_amount_due, 'cash_received', v_cash,
        'cash_change', v_change, 'debt_payment', v_debt_payment, 'balance_added', v_balance_added,
        'status', v_status, 'message', 'Transaksi berhasil disimpan.'
    );
end;
$$;

create or replace function public.create_purchase(
    p_supplier_id text, p_payment_method text, p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_supplier public.suppliers%rowtype;
    v_product public.products%rowtype;
    v_item jsonb;
    v_qty numeric(14,3);
    v_price numeric(14,2);
    v_line_total numeric(14,2);
    v_total numeric(14,2) := 0;
    v_purchase_no text := 'PO-' || to_char(clock_timestamp(), 'YYYY') || '-' || substr(gen_random_uuid()::text, 1, 12);
begin
    if not public.is_active_staff() then raise exception 'Akun tidak aktif atau tidak memiliki akses pembelian.'; end if;
    if p_payment_method is null or p_payment_method not in ('CASH', 'TRANSFER', 'CREDIT') then raise exception 'Metode pembayaran pembelian tidak valid.'; end if;
    if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Daftar barang pembelian kosong.';
    end if;
    select * into v_supplier from public.suppliers where supplier_id = p_supplier_id and is_active for update;
    if not found then raise exception 'Supplier tidak tersedia.'; end if;

    insert into public.purchases(purchase_no, supplier_id, created_by, total, payment_method, payment_status, debt_added)
    values (v_purchase_no, p_supplier_id, auth.uid(), 0, p_payment_method,
        case when p_payment_method = 'CREDIT' then 'BELUM LUNAS' else 'LUNAS' end, 0);

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        v_qty := (v_item->>'Qty')::numeric;
        v_price := (v_item->>'Unit_Price')::numeric;
        if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then
            raise exception 'Jumlah atau harga beli tidak valid.';
        end if;
        select * into v_product from public.products where product_id = v_item->>'Product_ID' and is_active for update;
        if not found then raise exception 'Produk % tidak tersedia.', v_item->>'Product_ID'; end if;
        v_line_total := round(v_qty * v_price, 2);
        v_total := v_total + v_line_total;
        insert into public.purchase_items(purchase_no, product_id, product_name, qty, unit_price, subtotal)
        values (v_purchase_no, v_product.product_id, v_product.product_name, v_qty, v_price, v_line_total);
        update public.products
        set buy_price_wac = case when stock + v_qty > 0
                then ((stock * buy_price_wac) + v_line_total) / (stock + v_qty) else 0 end,
            stock = stock + v_qty, updated_at = now()
        where product_id = v_product.product_id;
        insert into public.stock_movements(product_id, product_name, movement_type, qty_in, reference_no, created_by)
        values (v_product.product_id, v_product.product_name, 'Pembelian Supplier', v_qty, v_purchase_no, auth.uid());
    end loop;

    update public.purchases set total = v_total, debt_added = case when p_payment_method = 'CREDIT' then v_total else 0 end
    where purchase_no = v_purchase_no;
    if p_payment_method = 'CREDIT' then
        update public.suppliers set total_hutang = total_hutang + v_total, updated_at = now()
        where supplier_id = p_supplier_id;
    end if;
    return jsonb_build_object('success', true, 'purchase_no', v_purchase_no, 'total', v_total);
end;
$$;

create or replace function public.delete_purchase(p_purchase_no text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_purchase public.purchases%rowtype;
    v_item record;
    v_value numeric(16,2);
begin
    if not public.is_store_admin() then raise exception 'Hanya admin yang dapat menghapus pembelian.'; end if;
    select * into v_purchase from public.purchases where purchase_no = p_purchase_no for update;
    if not found then raise exception 'Pembelian tidak ditemukan.'; end if;
    if v_purchase.debt_added > 0 then
        perform 1 from public.suppliers where supplier_id = v_purchase.supplier_id for update;
        if exists (
            select 1 from public.payments
            where supplier_id = v_purchase.supplier_id and created_at > v_purchase.created_at
        ) then
            raise exception 'Pembayaran supplier sudah dicatat setelah pembelian ini; pembatalan tidak dapat dialokasikan dengan aman.';
        end if;
        if (select total_hutang from public.suppliers where supplier_id = v_purchase.supplier_id) < v_purchase.debt_added then
            raise exception 'Hutang supplier sudah dibayar sebagian; pembelian tidak dapat dihapus.';
        end if;
    end if;
    for v_item in select product_id, sum(qty) qty, sum(subtotal) cost from public.purchase_items
        where purchase_no = p_purchase_no group by product_id
    loop
        perform 1 from public.products where product_id = v_item.product_id for update;
        if (select stock from public.products where product_id = v_item.product_id) < v_item.qty then
            raise exception 'Stok sudah berkurang; pembelian tidak dapat dibatalkan.';
        end if;
        select (stock * buy_price_wac) - v_item.cost into v_value
        from public.products where product_id = v_item.product_id;
        if v_value < 0 then raise exception 'Nilai persediaan berubah; pembelian tidak aman untuk dibatalkan.'; end if;
        update public.products
        set stock = stock - v_item.qty,
            buy_price_wac = case when stock - v_item.qty > 0 then v_value / (stock - v_item.qty) else 0 end,
            updated_at = now()
        where product_id = v_item.product_id;
    end loop;
    if v_purchase.debt_added > 0 then
        update public.suppliers set total_hutang = total_hutang - v_purchase.debt_added, updated_at = now()
        where supplier_id = v_purchase.supplier_id;
    end if;
    delete from public.stock_movements where reference_no = p_purchase_no;
    delete from public.purchases where purchase_no = p_purchase_no;
    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.record_payment(
    p_payment_type text, p_party_id text, p_method text, p_amount numeric, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_customer public.customers%rowtype;
    v_supplier public.suppliers%rowtype;
    v_applied numeric(14,2);
    v_excess numeric(14,2) := 0;
    v_remaining numeric(14,2);
    v_payment_no text := 'PAY-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 6);
begin
    if not public.is_active_staff() then raise exception 'Akun tidak aktif atau tidak memiliki akses pembayaran.'; end if;
    if p_amount is null or p_amount <= 0 or p_method is null or p_method not in ('TUNAI', 'TRANSFER', 'QRIS') then
        raise exception 'Nominal atau metode pembayaran tidak valid.';
    end if;

    if p_payment_type = 'CUSTOMER_RECEIVABLE' then
        select * into v_customer from public.customers where customer_id = p_party_id for update;
        if not found then raise exception 'Pelanggan tidak ditemukan.'; end if;
        v_applied := least(v_customer.total_piutang, p_amount);
        v_excess := p_amount - v_applied;
        v_remaining := v_customer.total_piutang - v_applied;
        update public.customers set total_piutang = v_remaining,
            saldo_pelanggan = saldo_pelanggan + v_excess, updated_at = now()
        where customer_id = p_party_id;
        insert into public.payments(payment_no, payment_type, customer_id, party_name, method,
            amount, amount_applied, remaining_due, customer_balance_added, note, created_by)
        values (v_payment_no, p_payment_type, p_party_id, v_customer.customer_name, p_method,
            p_amount, v_applied, v_remaining, v_excess, p_note, auth.uid());
    elsif p_payment_type = 'SUPPLIER_PAYABLE' then
        select * into v_supplier from public.suppliers where supplier_id = p_party_id for update;
        if not found then raise exception 'Supplier tidak ditemukan.'; end if;
        if p_amount > v_supplier.total_hutang then raise exception 'Pembayaran melebihi hutang supplier.'; end if;
        v_applied := p_amount;
        v_remaining := v_supplier.total_hutang - v_applied;
        update public.suppliers set total_hutang = v_remaining, updated_at = now() where supplier_id = p_party_id;
        insert into public.payments(payment_no, payment_type, supplier_id, party_name, method,
            amount, amount_applied, remaining_due, note, created_by)
        values (v_payment_no, p_payment_type, p_party_id, v_supplier.supplier_name, p_method,
            p_amount, v_applied, v_remaining, p_note, auth.uid());
    else
        raise exception 'Jenis pembayaran tidak valid.';
    end if;
    return jsonb_build_object('success', true, 'payment_no', v_payment_no,
        'amount_applied', v_applied, 'remaining_due', v_remaining, 'customer_balance_added', v_excess);
end;
$$;

create or replace function public.adjust_stock(p_product_id text, p_quantity numeric, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_product public.products%rowtype;
    v_reference text := 'ADJ-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 6);
begin
    if not public.is_store_admin() then raise exception 'Hanya admin yang dapat menyesuaikan stok.'; end if;
    if p_quantity is null or p_quantity = 0 then raise exception 'Jumlah penyesuaian tidak boleh nol.'; end if;
    select * into v_product from public.products where product_id = p_product_id for update;
    if not found then raise exception 'Produk tidak ditemukan.'; end if;
    if v_product.stock + p_quantity < 0 then raise exception 'Stok hasil penyesuaian tidak boleh negatif.'; end if;
    update public.products set stock = stock + p_quantity, updated_at = now() where product_id = p_product_id;
    insert into public.stock_movements(product_id, product_name, movement_type, qty_in, qty_out, reference_no, created_by)
    values (p_product_id, v_product.product_name, coalesce(nullif(p_note, ''), 'Penyesuaian Manual'),
        greatest(p_quantity, 0), greatest(-p_quantity, 0), v_reference, auth.uid());
    return jsonb_build_object('success', true, 'reference_no', v_reference);
end;
$$;

create or replace function public.create_return(
    p_invoice_no text, p_sales_item_id uuid, p_quantity numeric, p_settlement_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_sale public.sales%rowtype;
    v_sale_item public.sales_items%rowtype;
    v_product public.products%rowtype;
    v_returned numeric(14,3);
    v_amount numeric(14,2);
    v_debt_reduced numeric(14,2) := 0;
    v_return_no text := 'RET-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 6);
    v_customer public.customers%rowtype;
begin
    if not public.is_active_staff() then raise exception 'Akun tidak aktif atau tidak memiliki akses retur.'; end if;
    if p_quantity is null or p_quantity <= 0 or p_settlement_method is null
        or p_settlement_method not in ('CASH', 'BALANCE', 'RECEIVABLE') then
        raise exception 'Jumlah atau metode penyelesaian retur tidak valid.';
    end if;
    select * into v_sale from public.sales where invoice_no = p_invoice_no for update;
    if not found or v_sale.customer_id is null then raise exception 'Invoice tidak ditemukan atau tidak memiliki pelanggan.'; end if;
    select * into v_sale_item from public.sales_items
    where item_id = p_sales_item_id and invoice_no = p_invoice_no for update;
    if not found then raise exception 'Barang tidak ditemukan pada invoice.'; end if;
    select coalesce(sum(ri.qty), 0) into v_returned
    from public.return_items ri join public.returns r using(return_no)
    where ri.sales_item_id = p_sales_item_id;
    if v_returned + p_quantity > v_sale_item.qty then raise exception 'Jumlah retur melebihi jumlah yang dibeli.'; end if;
    v_amount := round(
        p_quantity * v_sale_item.sell_price *
        case when v_sale.subtotal > 0 then v_sale.grand_total / v_sale.subtotal else 0 end,
        2
    );
    select * into v_customer from public.customers where customer_id = v_sale.customer_id for update;
    select * into v_product from public.products where product_id = v_sale_item.product_id for update;

    insert into public.returns(return_no, invoice_no, customer_id, total, settlement_method, created_by)
    values (v_return_no, p_invoice_no, v_sale.customer_id, v_amount, p_settlement_method, auth.uid());
    insert into public.return_items(return_no, sales_item_id, product_id, product_name, qty, unit_price, subtotal)
    values (v_return_no, v_sale_item.item_id, v_product.product_id, v_product.product_name,
        p_quantity, v_sale_item.sell_price, v_amount);
    update public.products set stock = stock + p_quantity, updated_at = now() where product_id = v_product.product_id;
    insert into public.stock_movements(product_id, product_name, movement_type, qty_in, reference_no, created_by)
    values (v_product.product_id, v_product.product_name, 'Retur Penjualan', p_quantity, v_return_no, auth.uid());

    if p_settlement_method = 'BALANCE' then
        update public.customers set saldo_pelanggan = saldo_pelanggan + v_amount, updated_at = now()
        where customer_id = v_sale.customer_id;
    elsif p_settlement_method = 'RECEIVABLE' then
        v_debt_reduced := least(v_customer.total_piutang, v_amount);
        update public.customers set total_piutang = total_piutang - v_debt_reduced,
            saldo_pelanggan = saldo_pelanggan + (v_amount - v_debt_reduced),
            updated_at = now()
        where customer_id = v_sale.customer_id
        ;
    end if;
    return jsonb_build_object('success', true, 'return_no', v_return_no, 'total', v_amount,
        'debt_reduced', v_debt_reduced, 'settlement_method', p_settlement_method);
end;
$$;

create or replace function public.reset_store_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.is_store_admin() then
        raise exception 'Hanya admin aktif yang dapat mereset data toko.';
    end if;

    delete from public.return_items;
    delete from public.returns;
    delete from public.payments;
    delete from public.stock_movements;
    delete from public.purchase_items;
    delete from public.sales_items;
    delete from public.purchases;
    delete from public.sales;
    delete from public.customers;
    delete from public.suppliers;
    delete from public.products;
    delete from public.categories;
    delete from public.units;

    return jsonb_build_object('success', true);
end;
$$;

do $$
declare
    v_table text;
begin
    foreach v_table in array array[
        'staff_profiles', 'settings', 'categories', 'units', 'products', 'customers', 'suppliers',
        'sales', 'sales_items', 'purchases', 'purchase_items', 'payments', 'stock_movements',
        'returns', 'return_items'
    ] loop
        execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    end loop;
end;
$$;

grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_store_admin() to authenticated;
grant execute on function public.process_sale(text, text, text, numeric, numeric, boolean, jsonb) to authenticated;
grant execute on function public.create_purchase(text, text, jsonb) to authenticated;
grant execute on function public.delete_purchase(text) to authenticated;
grant execute on function public.record_payment(text, text, text, numeric, text) to authenticated;
grant execute on function public.adjust_stock(text, numeric, text) to authenticated;
grant execute on function public.create_return(text, uuid, numeric, text) to authenticated;
grant execute on function public.reset_store_data() to authenticated;

revoke all on function public.is_active_staff() from public, anon;
revoke all on function public.is_store_admin() from public, anon;
revoke all on function public.process_sale(text, text, text, numeric, numeric, boolean, jsonb) from public, anon;
revoke all on function public.create_purchase(text, text, jsonb) from public, anon;
revoke all on function public.delete_purchase(text) from public, anon;
revoke all on function public.record_payment(text, text, text, numeric, text) from public, anon;
revoke all on function public.adjust_stock(text, numeric, text) from public, anon;
revoke all on function public.create_return(text, uuid, numeric, text) from public, anon;
revoke all on function public.reset_store_data() from public, anon;

do $$
begin
    if to_regclass('public.users') is not null then
        execute 'revoke all on public.users from anon, authenticated';
        execute 'alter table public.users enable row level security';
    end if;
end;
$$;

insert into public.categories(category_id, category_name, description) values
    ('CAT-001', 'Makanan', 'Makanan ringan dan kebutuhan makanan'),
    ('CAT-002', 'Minuman', 'Minuman'),
    ('CAT-003', 'Bahan Pokok', 'Kebutuhan bahan pokok')
on conflict (category_id) do nothing;

insert into public.units(unit_id, unit_name, base_unit, conversion_factor) values
    ('UNIT-PCS', 'PCS', 'PCS', 1)
on conflict (unit_id) do nothing;

insert into public.settings(key, value) values
    ('store_name', 'Toko Kita'),
    ('store_address', ''),
    ('store_phone', ''),
    ('invoice_footer', 'Terima kasih telah berbelanja!')
on conflict (key) do nothing;

commit;
