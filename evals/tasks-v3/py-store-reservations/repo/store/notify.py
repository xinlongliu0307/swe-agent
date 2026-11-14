class Notifier(object):
    """Collects alerts. Production code would send e-mails instead."""

    def __init__(self):
        self.alerts = []

    def low_stock(self, sku):
        self.alerts.append(sku)
