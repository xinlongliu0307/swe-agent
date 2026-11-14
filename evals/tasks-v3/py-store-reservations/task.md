Extend the store package (catalog.py, stock.py, notify.py, orders.py):

1. OrderService.place_order must be all-or-nothing. If any line cannot be filled, raise OutOfStock
   with that SKU as its message, take no stock for any line, and do not use up an order id.
2. Add OrderService.cancel_order(order_id), which puts the order's stock back. Cancelling an unknown
   or already cancelled order raises KeyError.
3. Low-stock alerts: when an order leaves a product's available quantity below its reorder_level,
   call notifier.low_stock(sku) once. Do not alert again for that product until its available
   quantity has gone back up to at least reorder_level (by receiving stock or by a cancellation)
   and then dropped below it again.

Do not edit the tests.
