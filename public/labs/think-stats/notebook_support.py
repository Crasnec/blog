"""Browser adapters for the blog notebooks. MIT; see README.txt."""
import numpy as np
import pandas as pd

def read_brfss(filename="brfss-2008.csv.gz", compression="gzip", nrows=None):
    """All rows/six cleaned columns from the pinned reader, stored losslessly."""
    return pd.read_csv("brfss-2008.csv.gz", nrows=nrows, float_precision="round_trip")

class KaplanMeierCurve:
    """The same event/risk-set calculation, without a native fitter dependency."""
    def fit(self, durations, event_observed):
        times = np.asarray(durations, dtype=float)
        events = np.asarray(event_observed, dtype=bool)
        if times.ndim != 1 or len(times) != len(events) or not len(times) or not np.isfinite(times).all() or np.any(times < 0):
            raise ValueError("Supply matching, nonempty nonnegative durations and events")
        rows = [(0., 1., 1., 1.)]
        survival, greenwood = 1., 0.
        for t in np.unique(times):
            risk = np.sum(times >= t)
            deaths = np.sum((times == t) & events)
            survival *= 1 - deaths / risk
            if 0 < survival < 1:
                greenwood += deaths / (risk * (risk - deaths))
                center = np.log(-np.log(survival))
                se = np.sqrt(greenwood) / abs(np.log(survival))
                low = np.exp(-np.exp(center + 1.959963984540054 * se))
                high = np.exp(-np.exp(center - 1.959963984540054 * se))
            else:
                low = high = survival
            rows.append((float(t), survival, low, high))
        self.rows = np.asarray(rows)
        self.survival_function_ = pd.DataFrame({"KM_estimate": self.rows[:, 1]}, index=self.rows[:, 0])
        self.n = len(times)
        return self
    def plot(self):
        import matplotlib.pyplot as plt
        plt.step(self.rows[:, 0], self.rows[:, 1], where="post", label="Kaplan–Meier")
        plt.fill_between(self.rows[:, 0], self.rows[:, 2], self.rows[:, 3], step="post", alpha=.2)
        return plt.gca()
    def __repr__(self):
        return f"KaplanMeierCurve(n={self.n})"
