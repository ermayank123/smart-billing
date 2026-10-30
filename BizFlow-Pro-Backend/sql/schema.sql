-- BizFlow Pro database schema for MySQL/MariaDB (XAMPP)
-- Login/register tables are intentionally NOT included.
CREATE DATABASE IF NOT EXISTS bizflow_pro
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bizflow_pro;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) NULL,
  customer_type ENUM('Retail','Wholesale','VIP') NOT NULL DEFAULT 'Retail',
  address TEXT NULL,
  gstin VARCHAR(30) NULL,
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_purchase DECIMAL(12,2) NOT NULL DEFAULT 0,
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_purchase DECIMAL(12,2) NOT NULL DEFAULT 0,
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name),
  INDEX idx_customers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(160) NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) NULL,
  gstin VARCHAR(30) NULL,
  payment_terms_days INT UNSIGNED NOT NULL DEFAULT 0,
  address TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (name),
  INDEX idx_suppliers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  brand VARCHAR(120) NULL,
  model VARCHAR(120) NULL,
  category ENUM('Electronics','Clothing','Food','Home','Other') NOT NULL DEFAULT 'Other',
  unit ENUM('Piece','Kg','Litre','Box','Dozen') NOT NULL DEFAULT 'Piece',
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18,
  current_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_alert_level DECIMAL(12,3) NOT NULL DEFAULT 0,
  hsn_code VARCHAR(30) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_name (name),
  INDEX idx_products_category (category),
  INDEX idx_products_stock (current_stock, min_alert_level)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(160) NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(30) NULL,
  customer_address TEXT NULL,
  customer_email VARCHAR(190) NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method ENUM('Cash','UPI','Card','Credit') NOT NULL DEFAULT 'Cash',
  amount_received DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('Paid','Pending','Cancelled') NOT NULL DEFAULT 'Paid',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_invoice_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(180) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_invoice_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_invoice_items_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category ENUM('Rent','Electricity','Salary','Marketing','Transport','Maintenance','Other') NOT NULL DEFAULT 'Other',
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_mode ENUM('Cash','UPI','Card','Bank Transfer','Other') NOT NULL DEFAULT 'Cash',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expenses_date (expense_date),
  INDEX idx_expenses_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS restocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference_number VARCHAR(40) NULL UNIQUE,
  supplier_id BIGINT UNSIGNED NULL,
  restock_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restock_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  INDEX idx_restocks_date (restock_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS restock_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  restock_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_restock_item_restock FOREIGN KEY (restock_id) REFERENCES restocks(id) ON DELETE CASCADE,
  CONSTRAINT fk_restock_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_restock_item_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('Opening','Purchase','Sale','Adjustment','Return') NOT NULL,
  quantity_change DECIMAL(12,3) NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_stock_movement_product_date (product_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS discount_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_name VARCHAR(180) NOT NULL,
  discount_type ENUM('Percentage','Flat Amount') NOT NULL DEFAULT 'Percentage',
  discount_value DECIMAL(12,2) NOT NULL,
  apply_to_category ENUM('All Products','Electronics','Clothing','Food','Home') NOT NULL DEFAULT 'All Products',
  min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE NULL,
  end_date DATE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warranties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(40) NULL,
  serial_number VARCHAR(120) NOT NULL,
  warranty_months INT UNSIGNED NOT NULL DEFAULT 12,
  customer_name VARCHAR(160) NULL,
  notes TEXT NULL,
  registered_at DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_warranty_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_warranty_serial (serial_number),
  INDEX idx_warranty_invoice (invoice_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Optional demo records for suppliers/products can be added from the UI or API.
