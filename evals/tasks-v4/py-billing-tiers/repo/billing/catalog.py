class Plan(object):
    def __init__(self, name, tiers):
        self.name = name
        self.tiers = tiers


PLANS = {
    "starter": Plan("starter", [(1000, 0), (5000, 2), (None, 1)]),
    "team": Plan("team", [(100, 50), (1000, 30), (None, 20)]),
    "capped": Plan("capped", [(500, 10), (2000, 8)]),
}


def get_plan(name):
    """The Plan called name. Raises KeyError for an unknown plan."""
    return PLANS[name]
