-- Run once in phpMyAdmin only if the customers table already exists from the older schema.
USE bizflow_pro;
ALTER TABLE customers ADD COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN total_purchase DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN loyalty_points INT UNSIGNED NOT NULL DEFAULT 0;
