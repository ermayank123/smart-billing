require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { toNumber, requiredString, asDate, asyncRoute } = require('./helpers');

const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------
// 1. CORS — explicit whitelist (works with credentials: true)
//    Handles localhost:3000, 127.0.0.1:3000, :5500, :5501, file://
// ---------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'https://smart-billing-frontend.vercel.app'
  'null',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    console.warn('[CORS BLOCKED]', origin);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));

app.options('*', cors());

// ---------------------------------------------------------------
// 2. Helmet — relaxed for cross-origin dev
// ---------------------------------------------------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
}));

// ---------------------------------------------------------------
// 3. JSON parser — declare ONCE
// ---------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------
// 4. Static frontend — auto-detect the folder
//    Works from backend/src → ../../frontend, ../frontend, cwd/frontend
// ---------------------------------------------------------------
const frontendCandidates = [
  path.join(__dirname, '..', '..', 'frontend'),
  path.join(__dirname, '..', 'frontend'),
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'frontend'),
  path.join(process.cwd(), '..', 'frontend'),
];
const frontendRoot = frontendCandidates.find(p => {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
});
if (frontendRoot) {
  console.log('Serving frontend from:', frontendRoot);
  app.use(express.static(frontendRoot));
} else {
  console.warn('WARNING: no frontend directory found. Checked:', frontendCandidates);
}

// ---------------------------------------------------------------
// 5. Rate limit — skip OPTIONS preflight, mount ONCE
// ---------------------------------------------------------------
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
}));

// ---------------------------------------------------------------
// 6. Health / info
// ---------------------------------------------------------------
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'BizFlow Pro Backend is running',
    api: '/api',
    health: '/api/health'
  });
});

app.get('/api/health', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT 1 AS db_ok');
  res.json({
    ok: true,
    service: 'BizFlow Pro API',
    database: rows[0].db_ok === 1 ? 'connected' : 'unknown',
    time: new Date().toISOString(),
  });
}));

// ---------------------------------------------------------------
// 7. Generic CRUD
// ---------------------------------------------------------------
function registerCrud({ path: routePath, table, fields, required = [], orderBy = 'id DESC', searchable = [] }) {
  app.get(`/api/${routePath}`, asyncRoute(async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    let sql = `SELECT * FROM ${table}`;
    const params = [];
    if (q && searchable.length) {
      sql += ' WHERE ' + searchable.map(col => `${col} LIKE ?`).join(' OR ');
      searchable.forEach(() => params.push(`%${q}%`));
    }
    sql += ` ORDER BY ${orderBy} LIMIT 1000`;
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  }));

  app.get(`/api/${routePath}/:id`, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  }));

  app.post(`/api/${routePath}`, asyncRoute(async (req, res) => {
    for (const field of required) requiredString(String(req.body[field] ?? ''), field);
    const data = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        data[field] = req.body[field] === '' ? null : req.body[field];
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No supported fields supplied' });
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(',');
    const [result] = await pool.execute(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
      cols.map(c => data[c])
    );
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ data: rows[0] });
  }));

  app.put(`/api/${routePath}/:id`, asyncRoute(async (req, res) => {
    const data = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        data[field] = req.body[field] === '' ? null : req.body[field];
      }
    }
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'No supported fields supplied' });
    const [result] = await pool.execute(
      `UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map(c => data[c]), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found' });
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  }));

  app.delete(`/api/${routePath}/:id`, asyncRoute(async (req, res) => {
    const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found' });
    res.json({ ok: true, message: 'Deleted' });
  }));
}

registerCrud({
  path: 'products', table: 'products',
  fields: ['name','brand','model','category','unit','purchase_price','selling_price','discount_percent','gst_rate','current_stock','min_alert_level','hsn_code','active'],
  required: ['name'], searchable: ['name','brand','model','hsn_code'],
});
registerCrud({
  path: 'customers', table: 'customers',
  fields: ['name','phone','email','customer_type','address','gstin','credit_limit','balance','total_purchase','loyalty_points'],
  required: ['name','phone'], searchable: ['name','phone','email','gstin'],
});
registerCrud({
  path: 'suppliers', table: 'suppliers',
  fields: ['name','contact_person','phone','email','gstin','payment_terms_days','address'],
  required: ['name','phone'], searchable: ['name','phone','email','gstin'],
});
registerCrud({
  path: 'expenses', table: 'expenses',
  fields: ['category','description','amount','expense_date','payment_mode','notes'],
  required: ['description','amount'], searchable: ['description','category'],
});
registerCrud({
  path: 'discounts', table: 'discount_campaigns',
  fields: ['campaign_name','discount_type','discount_value','apply_to_category','min_order_value','start_date','end_date','active'],
  required: ['campaign_name','discount_value'], searchable: ['campaign_name','apply_to_category'],
});
registerCrud({
  path: 'warranties', table: 'warranties',
  fields: ['product_id','invoice_number','serial_number','warranty_months','customer_name','notes','registered_at'],
  required: ['product_id','serial_number'], searchable: ['serial_number','invoice_number','customer_name'],
});

// ---------------------------------------------------------------
// 8. Stock adjustment
// ---------------------------------------------------------------
app.post('/api/products/:id/adjust-stock', asyncRoute(async (req, res) => {
  const delta = toNumber(req.body.quantity_change, NaN);
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'quantity_change must be a non-zero number' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, current_stock FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw Object.assign(new Error('Product not found'), { status: 404 });
    const nextStock = Number(rows[0].current_stock) + delta;
    if (nextStock < 0) throw Object.assign(new Error('Stock cannot become negative'), { status: 409 });
    await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [nextStock, req.params.id]);
    await conn.execute(
      `INSERT INTO stock_movements (product_id, movement_type, quantity_change, reference_type, note)
       VALUES (?, 'Adjustment', ?, 'manual', ?)`,
      [req.params.id, delta, req.body.note || null]
    );
    await conn.commit();
    res.json({ ok: true, product_id: Number(req.params.id), current_stock: nextStock });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}));

// ---------------------------------------------------------------
// 9. Restocks
// ---------------------------------------------------------------
app.get('/api/restocks', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, s.name AS supplier_name,
      (SELECT COUNT(*) FROM restock_items ri WHERE ri.restock_id = r.id) AS item_count
     FROM restocks r LEFT JOIN suppliers s ON s.id = r.supplier_id
     ORDER BY r.id DESC LIMIT 1000`
  );
  res.json({ data: rows });
}));

app.get('/api/restocks/:id', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM restocks WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Restock not found' });
  const [items] = await pool.execute('SELECT * FROM restock_items WHERE restock_id = ?', [req.params.id]);
  res.json({ data: { ...rows[0], items } });
}));

app.post('/api/restocks', asyncRoute(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'At least one restock item is required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    const normalized = [];
    for (const item of items) {
      const qty = toNumber(item.quantity, NaN);
      const cost = toNumber(item.unit_cost, NaN);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
        throw Object.assign(new Error('Each item needs a valid product_id, positive quantity and non-negative unit_cost'), { status: 400 });
      }
      const [p] = await conn.execute('SELECT id, name FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!p.length) throw Object.assign(new Error(`Product ${item.product_id} not found`), { status: 404 });
      const line = qty * cost;
      total += line;
      normalized.push({ product_id: Number(item.product_id), quantity: qty, unit_cost: cost, line_total: line, name: p[0].name });
    }
    const restockDate = asDate(req.body.restock_date);
    const ref = req.body.reference_number || `RST-${Date.now()}`;
    const [header] = await conn.execute(
      'INSERT INTO restocks (reference_number,supplier_id,restock_date,total_amount,notes) VALUES (?,?,?,?,?)',
      [ref, req.body.supplier_id || null, restockDate, total, req.body.notes || null]
    );
    for (const item of normalized) {
      await conn.execute(
        'INSERT INTO restock_items (restock_id,product_id,quantity,unit_cost,line_total) VALUES (?,?,?,?,?)',
        [header.insertId, item.product_id, item.quantity, item.unit_cost, item.line_total]
      );
      await conn.execute(
        'UPDATE products SET current_stock = current_stock + ?, purchase_price = ? WHERE id = ?',
        [item.quantity, item.unit_cost, item.product_id]
      );
      await conn.execute(
        `INSERT INTO stock_movements (product_id,movement_type,quantity_change,reference_type,reference_id,note)
         VALUES (?,'Purchase',?,'restock',?,?)`,
        [item.product_id, item.quantity, header.insertId, `Restock ${ref}`]
      );
    }
    await conn.commit();
    res.status(201).json({
      data: { id: header.insertId, reference_number: ref, restock_date: restockDate, total_amount: total, items: normalized },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}));

// ---------------------------------------------------------------
// 10. Invoices
// ---------------------------------------------------------------
app.get('/api/invoices', asyncRoute(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  let sql = `SELECT i.*, (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id=i.id) AS item_count
             FROM invoices i`;
  const params = [];
  if (q) {
    sql += ' WHERE i.invoice_number LIKE ? OR i.customer_name LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY i.id DESC LIMIT 1000';
  const [rows] = await pool.query(sql, params);
  res.json({ data: rows });
}));

app.get('/api/invoices/:id', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  const [items] = await pool.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
  res.json({ data: { ...rows[0], items } });
}));

app.post('/api/invoices', asyncRoute(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Invoice must contain at least one item' });
  const paymentMethod = ['Cash','UPI','Card','Credit'].includes(req.body.payment_method) ? req.body.payment_method : 'Cash';
  const status = ['Paid','Pending','Cancelled'].includes(req.body.status) ? req.body.status : (paymentMethod === 'Credit' ? 'Pending' : 'Paid');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const normalized = [];
    let subtotal = 0, gstAmount = 0;
    let discountAmount = toNumber(req.body.discount_amount, 0);
    for (const item of items) {
      const qty = toNumber(item.quantity, NaN);
      if (!Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Item quantity must be greater than zero'), { status: 400 });
      const [products] = await conn.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!products.length) throw Object.assign(new Error(`Product ${item.product_id} not found`), { status: 404 });
      const p = products[0];
      if (Number(p.current_stock) < qty) throw Object.assign(new Error(`Insufficient stock for ${p.name}. Available: ${p.current_stock}`), { status: 409 });
      const unitPrice = toNumber(item.unit_price, Number(p.selling_price));
      const gstRate = toNumber(item.gst_rate, Number(p.gst_rate));
      const lineDiscount = toNumber(item.discount_amount, 0);
      if (unitPrice < 0 || gstRate < 0 || lineDiscount < 0) throw Object.assign(new Error('Price, GST and discount must not be negative'), { status: 400 });
      const lineSubtotal = Math.max(0, qty * unitPrice - lineDiscount);
      const lineGst = lineSubtotal * gstRate / 100;
      const lineTotal = lineSubtotal + lineGst;
      subtotal += qty * unitPrice;
      discountAmount += lineDiscount;
      gstAmount += lineGst;
      normalized.push({
        product_id: p.id, product_name: p.name, quantity: qty,
        unit_price: unitPrice, gst_rate: gstRate, discount_amount: lineDiscount,
        line_subtotal: lineSubtotal, line_gst: lineGst, line_total: lineTotal,
      });
    }
    const billDiscount = toNumber(req.body.bill_discount_amount, 0);
    discountAmount = Math.max(0, discountAmount - toNumber(req.body.discount_amount, 0)) + billDiscount;
    const total = Math.max(0, subtotal - discountAmount + gstAmount);
    const received = Math.max(0, toNumber(req.body.amount_received, paymentMethod === 'Credit' ? 0 : total));
    const invoiceNo = req.body.invoice_number || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const invoiceDate = req.body.invoice_date ? new Date(req.body.invoice_date) : new Date();
    if (Number.isNaN(invoiceDate.getTime())) throw Object.assign(new Error('Invalid invoice_date'), { status: 400 });
    const customerName = (req.body.customer_name || 'Walk-in Customer').toString().slice(0, 160);

    let customerId = req.body.customer_id ? Number(req.body.customer_id) : null;
    if (customerId) {
      const [matchedCustomer] = await conn.execute('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId]);
      if (!matchedCustomer.length) customerId = null;
    }
    if (!customerId && req.body.customer_phone) {
      const [matchedCustomer] = await conn.execute(
        'SELECT id FROM customers WHERE name = ? AND phone = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
        [customerName, String(req.body.customer_phone)]
      );
      if (matchedCustomer.length) customerId = Number(matchedCustomer[0].id);
    }

    const [header] = await conn.execute(
      `INSERT INTO invoices (invoice_number,invoice_date,customer_id,customer_name,customer_phone,customer_address,customer_email,
        subtotal,gst_amount,discount_amount,total_amount,payment_method,amount_received,status,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invoiceNo, invoiceDate, customerId, customerName,
        req.body.customer_phone || null, req.body.customer_address || null, req.body.customer_email || null,
        subtotal, gstAmount, discountAmount, total, paymentMethod, received, status, req.body.notes || null,
      ]
    );

    for (const item of normalized) {
      await conn.execute(
        `INSERT INTO invoice_items (invoice_id,product_id,product_name,quantity,unit_price,gst_rate,discount_amount,line_subtotal,line_gst,line_total)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [header.insertId, item.product_id, item.product_name, item.quantity, item.unit_price, item.gst_rate, item.discount_amount, item.line_subtotal, item.line_gst, item.line_total]
      );
      await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      await conn.execute(
        `INSERT INTO stock_movements (product_id,movement_type,quantity_change,reference_type,reference_id,note)
         VALUES (?,'Sale',?,'invoice',?,?)`,
        [item.product_id, -item.quantity, header.insertId, `Invoice ${invoiceNo}`]
      );
    }

    if (customerId && status !== 'Cancelled') {
      const points = Math.floor(total / 100);
      await conn.execute(
        'UPDATE customers SET total_purchase = total_purchase + ?, loyalty_points = loyalty_points + ? WHERE id = ?',
        [total, points, customerId]
      );
      if (paymentMethod === 'Credit' || status === 'Pending') {
        const outstanding = Math.max(0, total - received);
        if (outstanding > 0) {
          await conn.execute('UPDATE customers SET balance = balance + ? WHERE id = ?', [outstanding, customerId]);
        }
      }
    }

    await conn.commit();
    res.status(201).json({
      data: {
        id: header.insertId, invoice_number: invoiceNo, invoice_date: invoiceDate,
        customer_id: customerId, customer_name: customerName,
        subtotal, gst_amount: gstAmount, discount_amount: discountAmount, total_amount: total,
        payment_method: paymentMethod, amount_received: received, status, items: normalized,
      },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}));

app.put('/api/invoices/:id/status', asyncRoute(async (req, res) => {
  const status = ['Paid','Pending','Cancelled'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid invoice status' });
  const amountReceived = Math.max(0, toNumber(req.body.amount_received, 0));
  const [result] = await pool.execute(
    'UPDATE invoices SET status = ?, amount_received = ? WHERE id = ?',
    [status, amountReceived, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Invoice not found' });
  const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  res.json({ data: rows[0] });
}));

// ---------------------------------------------------------------
// 11. Dashboard
// ---------------------------------------------------------------
app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [[productStats]] = await pool.query(`
    SELECT COUNT(*) AS product_count,
           COALESCE(SUM(current_stock),0) AS stock_units,
           SUM(CASE WHEN current_stock <= min_alert_level THEN 1 ELSE 0 END) AS low_stock_count
    FROM products WHERE active=1`);
  const [[customerStats]] = await pool.query('SELECT COUNT(*) AS customer_count FROM customers');
  const [[salesStats]] = await pool.query(`
    SELECT COALESCE(SUM(total_amount),0) AS sales_total, COUNT(*) AS invoice_count
    FROM invoices WHERE status <> 'Cancelled' AND DATE(invoice_date)=CURDATE()`);
  const [[expenseStats]] = await pool.query(`
    SELECT COALESCE(SUM(amount),0) AS expenses_total FROM expenses
    WHERE MONTH(expense_date)=MONTH(CURDATE()) AND YEAR(expense_date)=YEAR(CURDATE())`);
  const [lowStock] = await pool.query(`
    SELECT id,name,current_stock,min_alert_level FROM products
    WHERE active=1 AND current_stock <= min_alert_level
    ORDER BY current_stock ASC LIMIT 10`);
  res.json({ data: { ...productStats, ...customerStats, ...salesStats, ...expenseStats, low_stock: lowStock } });
}));

// ---------------------------------------------------------------
// 12. Cash flow
// ---------------------------------------------------------------
app.get('/api/cashflow', asyncRoute(async (req, res) => {
  const from = req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const to = req.query.to || new Date().toISOString().slice(0,10);
  const [[sales]] = await pool.execute(`
    SELECT COALESCE(SUM(CASE WHEN payment_method='Credit' THEN amount_received ELSE total_amount END),0) AS cash_in
    FROM invoices WHERE status <> 'Cancelled' AND DATE(invoice_date) BETWEEN ? AND ?`, [from, to]);
  const [[purchases]] = await pool.execute(`
    SELECT COALESCE(SUM(total_amount),0) AS purchase_out FROM restocks WHERE restock_date BETWEEN ? AND ?`, [from, to]);
  const [[expenses]] = await pool.execute(`
    SELECT COALESCE(SUM(amount),0) AS expense_out FROM expenses WHERE expense_date BETWEEN ? AND ?`, [from, to]);
  const [inflows] = await pool.execute(`
    SELECT payment_method AS source,
           SUM(CASE WHEN payment_method='Credit' THEN amount_received ELSE total_amount END) AS amount
    FROM invoices WHERE status <> 'Cancelled' AND DATE(invoice_date) BETWEEN ? AND ?
    GROUP BY payment_method`, [from, to]);
  const [expenseBreakdown] = await pool.execute(`
    SELECT category AS source, SUM(amount) AS amount FROM expenses
    WHERE expense_date BETWEEN ? AND ? GROUP BY category`, [from, to]);
  const cashIn = Number(sales.cash_in || 0);
  const cashOut = Number(purchases.purchase_out || 0) + Number(expenses.expense_out || 0);
  res.json({
    data: {
      from, to, cash_in: cashIn,
      purchase_out: Number(purchases.purchase_out || 0),
      expense_out: Number(expenses.expense_out || 0),
      cash_out: cashOut, net: cashIn - cashOut,
      inflows, expenses: expenseBreakdown,
    },
  });
}));

// ---------------------------------------------------------------
// 13. Reports
// ---------------------------------------------------------------
app.get('/api/reports', asyncRoute(async (req, res) => {
  const type = (req.query.type || 'daily').toString();
  let data;
  if (type === 'product-wise') {
    const [rows] = await pool.query(`
      SELECT ii.product_id, ii.product_name,
             SUM(ii.quantity) AS quantity_sold, SUM(ii.line_total) AS sales_total
      FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
      WHERE i.status <> 'Cancelled'
      GROUP BY ii.product_id,ii.product_name ORDER BY sales_total DESC LIMIT 500`);
    data = rows;
  } else if (type === 'pnl') {
    const [rows] = await pool.query(`
      SELECT 'Sales' AS label, COALESCE(SUM(total_amount),0) AS amount FROM invoices WHERE status <> 'Cancelled'
      UNION ALL SELECT 'Expenses', COALESCE(SUM(amount),0) FROM expenses
      UNION ALL SELECT 'Purchases', COALESCE(SUM(total_amount),0) FROM restocks`);
    data = rows;
  } else {
    const format = type === 'yearly' ? '%Y' : type === 'monthly' ? '%Y-%m' : '%Y-%m-%d';
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(invoice_date, ?) AS period, COUNT(*) AS invoice_count,
             COALESCE(SUM(total_amount),0) AS sales_total
      FROM invoices WHERE status <> 'Cancelled'
      GROUP BY DATE_FORMAT(invoice_date, ?) ORDER BY period DESC LIMIT 500`, [format, format]);
    data = rows;
  }
  res.json({ data });
}));

// ---------------------------------------------------------------
// 14. Settings
// ---------------------------------------------------------------
app.get('/api/settings', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key');
  res.json({ data: Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value])) });
}));

app.put('/api/settings', asyncRoute(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected a JSON object' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(req.body)) {
      if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) {
        throw Object.assign(new Error(`Invalid setting key: ${key}`), { status: 400 });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key,setting_value) VALUES (?,?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
        [key, value == null ? null : String(value)]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}));

// ---------------------------------------------------------------
// 15. 404 + error handler
// ---------------------------------------------------------------
app.use((req, res) => res.status(404).json({ error: 'API route not found', path: req.originalUrl }));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err.status) || (err.code === 'ER_DUP_ENTRY' ? 409 : 500);
  const message = status === 500 ? 'Internal server error. Check backend terminal logs.' : err.message;
  res.status(status).json({ error: message });
});

// ---------------------------------------------------------------
// 16. Start
// ---------------------------------------------------------------
const port = Number(process.env.PORT || 3000);
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL/MariaDB connection successful.');
    app.listen(port, '0.0.0.0', () => {
  console.log(`BizFlow Pro API running at http://localhost:${port}`);
  console.log(`                              http://127.0.0.1:${port}`);
});
  } catch (err) {
    console.error('Could not connect to MySQL/MariaDB. Check XAMPP, .env, and sql/schema.sql.', err.message);
    process.exit(1);
  }
}
start();
