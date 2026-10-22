# Adapted from Think Stats, chapter 1, by Allen B. Downey (MIT).
# Original code license: /labs/think-stats/LICENSE-code.txt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

# Browser-only preparation: fetch the same NSFG files from this site.
for filename in ["2002FemPreg.dct", "2002FemPreg.dat.gz"]:
    response = await pyfetch("/labs/think-stats/" + filename)
    if not response.ok:
        raise RuntimeError(f"Could not read {filename}: HTTP {response.status}")
    with open(filename, "wb") as stream:
        stream.write(await response.bytes())

dct_file = "2002FemPreg.dct"
dat_file = "2002FemPreg.dat.gz"

from statadict import parse_stata_dict


def read_stata(dct_file, dat_file):
    stata_dict = parse_stata_dict(dct_file)
    resp = pd.read_fwf(
        dat_file,
        names=stata_dict.names,
        colspecs=stata_dict.colspecs,
        compression="gzip",
    )
    return resp

# Consolidate pandas blocks before adding the derived weight column.
preg = read_stata(dct_file, dat_file).copy()
print("행과 열:", preg.shape)
print("임신 결과별 빈도:")
print(preg["outcome"].value_counts().sort_index().to_string())

preg["birthwgt_lb"] = preg["birthwgt_lb"].replace([51, 97, 98, 99], np.nan)
preg["birthwgt_oz"] = preg["birthwgt_oz"].replace([97, 98, 99], np.nan)
preg["agepreg"] /= 100.0
preg["totalwgt_lb"] = preg["birthwgt_lb"] + preg["birthwgt_oz"] / 16.0
weights = preg["totalwgt_lb"]
print("체중 자료 수:", weights.count())
print(f"평균: {weights.mean():.6f} lb")
print(f"분산 (ddof=0): {weights.var(ddof=0):.6f} lb²")
print(f"표준편차 (ddof=0): {weights.std(ddof=0):.6f} lb")

# Write your exercise code below; preg is available in this execution.
