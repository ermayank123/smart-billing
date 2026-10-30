-- Run once after deploying the updated server.js.
-- Links older invoices to existing customers where customer name + phone match,
-- then rebuilds customer purchase totals and loyalty points from non-cancelled invoices.
UPDATE invoices i
JOIN customers c
  ON c.name = i.customer_name
 AND TRIM(c.phone) = TRIM(i.customer_phone)
SET i.customer_id = c.id
WHERE i.customer_id IS NULL;

UPDATE customers c
LEFT JOIN (
  SELECT customer_id,
         SUM(total_amount) AS purchase_total,
         FLOOR(SUM(total_amount) / 100) AS points_total
  FROM invoices
  WHERE customer_id IS NOT NULL
    AND status <> 'Cancelled'
  GROUP BY customer_id
) totals ON totals.customer_id = c.id
SET c.total_purchase = COALESCE(totals.purchase_total, 0),
    c.loyalty_points = COALESCE(totals.points_total, 0);
