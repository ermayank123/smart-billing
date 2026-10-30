# BizFlow Pro Backend — Setup A to Z (Hindi)

यह Node.js + Express + MySQL/MariaDB backend है। इसमें Login/Register नहीं है। यह frontend को बाद में API के माध्यम से database से जोड़ने के लिए तैयार किया गया है।

## 1. जरूरी चीजें
- Windows
- Node.js (आपके सिस्टम पर पहले से Node.js/npm उपलब्ध है)
- XAMPP Control Panel
- VS Code या कोई text editor

## 2. XAMPP में Database बनाएं
1. XAMPP Control Panel खोलें।
2. `MySQL` के सामने **Start** दबाएं। Apache केवल phpMyAdmin के लिए चाहिए हो सकता है।
3. Browser में `http://localhost/phpmyadmin` खोलें।
4. ऊपर **Import** चुनें।
5. इस प्रोजेक्ट की `sql/schema.sql` फाइल चुनें और **Import/Go** दबाएं।
6. बाईं तरफ `bizflow_pro` database दिखना चाहिए। इसमें tables बनेंगी।

> यदि XAMPP का MySQL port 3306 नहीं है, तो `.env` में `DB_PORT` को अपने वास्तविक port पर बदलें। XAMPP में यह MariaDB हो सकता है; यह schema आम तौर पर MySQL/MariaDB दोनों के साथ चलता है।

## 3. Backend फोल्डर खोलें
ZIP extract करें। CMD/Terminal में उस folder तक जाएं, जहां `package.json` है:
```bat
cd %USERPROFILE%\Downloads\BizFlow-Pro-Backend
```
यदि आपने ZIP किसी और जगह extract की है तो उस path का उपयोग करें।

## 4. Dependencies इंस्टॉल करें
```bat
npm install
```

## 5. Environment file बनाएं
Windows CMD में:
```bat
copy .env.example .env
```
अब `.env` खोलें। सामान्य XAMPP local setup के लिए:
```env
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=bizflow_pro
FRONTEND_ORIGIN=http://127.0.0.1:5500
```
अगर MySQL root user का password सेट किया है तो `DB_PASSWORD` में डालें। `.env` को किसी के साथ share न करें।

## 6. Backend चलाएं
Development mode:
```bat
npm run dev
```
या:
```bat
npm start
```
सही होने पर terminal में `MySQL/MariaDB connection successful.` और `BizFlow Pro API running at http://localhost:3000` दिखेगा।

## 7. Connection जांचें
Browser में खोलें:
- `http://localhost:3000/`
- `http://localhost:3000/api/health`

Health endpoint में `database: "connected"` आना चाहिए।

## 8. API endpoints
सभी responses JSON में आते हैं।

| Method | Endpoint | काम |
|---|---|---|
| GET | `/api/health` | API और DB health |
| GET/POST | `/api/products` | Products list/add |
| GET/PUT/DELETE | `/api/products/:id` | Product read/update/delete |
| POST | `/api/products/:id/adjust-stock` | Stock adjustment |
| GET/POST | `/api/customers` | Customers list/add |
| GET/PUT/DELETE | `/api/customers/:id` | Customer read/update/delete |
| GET/POST | `/api/suppliers` | Suppliers list/add |
| GET/PUT/DELETE | `/api/suppliers/:id` | Supplier read/update/delete |
| GET/POST | `/api/expenses` | Expenses list/add |
| GET/PUT/DELETE | `/api/expenses/:id` | Expense read/update/delete |
| GET/POST | `/api/discounts` | Discount campaign list/add |
| GET/PUT/DELETE | `/api/discounts/:id` | Campaign read/update/delete |
| GET/POST | `/api/warranties` | Warranty list/add |
| GET/PUT/DELETE | `/api/warranties/:id` | Warranty read/update/delete |
| GET/POST | `/api/restocks` | Restocks list/create |
| GET | `/api/restocks/:id` | Restock with items |
| GET/POST | `/api/invoices` | Invoices list/create |
| GET | `/api/invoices/:id` | Invoice with items |
| GET | `/api/dashboard` | Dashboard totals/low stock |
| GET | `/api/cashflow` | Cash flow totals |
| GET | `/api/reports?type=daily` | Daily sales report |
| GET | `/api/reports?type=monthly` | Monthly sales report |
| GET | `/api/reports?type=yearly` | Yearly sales report |
| GET | `/api/reports?type=product-wise` | Product-wise sales |
| GET | `/api/reports?type=pnl` | Sales, purchases and expenses |
| GET/PUT | `/api/settings` | Key-value settings |

## 9. API test examples

### Add a product
POST `http://localhost:3000/api/products`
Header: `Content-Type: application/json`
```json
{
  "name": "Boat Rockerz 450",
  "brand": "boAt",
  "model": "Rockerz 450",
  "category": "Electronics",
  "unit": "Piece",
  "purchase_price": 1200,
  "selling_price": 1499,
  "discount_percent": 0,
  "gst_rate": 18,
  "current_stock": 45,
  "min_alert_level": 5,
  "hsn_code": "8518"
}
```

### Add a customer
POST `/api/customers`
```json
{
  "name": "Walk-in Customer",
  "phone": "9999999999",
  "email": "customer@example.com",
  "customer_type": "Retail",
  "address": "Sagar, Madhya Pradesh",
  "gstin": "",
  "credit_limit": 0
}
```

### Create a restock
POST `/api/restocks`
```json
{
  "supplier_id": 1,
  "restock_date": "2026-10-26",
  "notes": "Initial purchase",
  "items": [
    { "product_id": 1, "quantity": 5, "unit_cost": 1200 }
  ]
}
```
A successful restock increases stock and records a stock movement.

### Create an invoice
POST `/api/invoices`
```json
{
  "customer_name": "Walk-in Customer",
  "payment_method": "Cash",
  "amount_received": 1768.82,
  "items": [
    { "product_id": 1, "quantity": 1, "unit_price": 1499, "gst_rate": 18 }
  ]
}
```
A successful invoice decreases stock. Do not send a `product_id` that does not exist. Server checks stock and calculates item GST/total.

### Query examples
- `GET /api/products?q=boat`
- `GET /api/invoices?q=INV-`
- `GET /api/cashflow?from=2026-10-01&to=2026-10-31`

## 10. Frontend integration
The frontend is already wired to the Express API in `public/BizFlow-Pro-v2.html`. It loads data from MySQL, and saves product/customer/supplier/expense/discount/warranty changes, invoices, restocks and settings through API calls.

## 11. Common errors
- **ECONNREFUSED / Can't connect:** XAMPP MySQL not running, wrong port, or wrong host.
- **Access denied for root:** check DB_USER and DB_PASSWORD in `.env`.
- **Unknown database:** import `sql/schema.sql` in phpMyAdmin.
- **Port 3000 already in use:** change `PORT=3001` in `.env` and restart.
- **CORS error:** set `FRONTEND_ORIGIN` to the exact origin used to open the frontend; local development origins on localhost/127.0.0.1 are allowed by the current config.
- **Duplicate invoice number/reference:** use a unique invoice/reference number.

## 12. Security and production note
This is a local development starter backend, not yet a production deployment. Before public internet deployment, add authentication/authorization if multiple people can access it, backups, input validation/audit logging, HTTPS, and review tax/accounting logic with real requirements. Login/Register are intentionally omitted as requested.


## Frontend + API integration (same design)
- Frontend file: `public/BizFlow-Pro-v2.html` (original dark UI/styles are retained).
- Preferred: start the API and open `http://localhost:3000/BizFlow-Pro-v2.html`; Express serves the frontend and `/api/*`.
- Alternative: use VS Code Live Server on port 5500; the frontend calls `http://localhost:3000/api`.
- The page no longer seeds sample data into localStorage. It loads data from MySQL through the API and shows a connection error if the API is unavailable.
- If you already imported an earlier schema, run `sql/migration-v2-customer-ledger.sql` once. For a fresh database, import the updated `sql/schema.sql` instead (do not run both).
- API integration covers product/customer/supplier CRUD, expenses, discounts, warranties, invoices, restocks, dashboard/report data and settings. Invoice creation and stock reduction are handled transactionally by the API; later payment-status updates and restock entries are also saved through API endpoints.


