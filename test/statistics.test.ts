import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefinedFigure } from "../src/figures/kit.ts";
import { statisticsExamples } from "../src/content/posts/build/_figures/statistics-data.ts";
import {
	autocorrelation, binaryCurves, boxSummary, calibrationBins, density,
	densityContours, ecdf, hexBins, histogram, kaplanMeier, linearFit,
	normalCdf, normalQuantile, partialAutocorrelation, quantile, variance,
} from "../src/figures/statistics/math.ts";
import { boxplot, kde, qq } from "../src/figures/statistics/distributions.ts";
import { acf } from "../src/figures/statistics/series.ts";
import { influence } from "../src/figures/statistics/diagnostics.ts";
import { calibration, roc } from "../src/figures/statistics/classification.ts";
import { interval, funnel } from "../src/figures/statistics/estimates.ts";
import { mosaic } from "../src/figures/statistics/categorical.ts";
import { kaplanMeierFigure } from "../src/figures/statistics/survival.ts";

const close = (actual: number, expected: number, tolerance = 1e-10) => { assert.ok(Math.abs(actual - expected) <= tolerance, `${String(actual)} != ${String(expected)}`); };

void test("linear quantiles and Tukey whiskers use observations, not fences", () => {
	close(quantile([1, 2, 3, 4], 0.25), 1.75);
	close(variance([1, 2, 3]), 1);
	assert.deepEqual(boxSummary([1, 2, 3, 4, 100]), { q1: 2, median: 3, q3: 4, low: 1, high: 4, outliers: [100] });
	assert.throws(() => quantile([], 0.5));
});

void test("ECDF ties jump together and finish at one", () => {
	assert.deepEqual(ecdf([1, 1, 2]), [{ x: 1, y: 0 }, { x: 1, y: 2 / 3 }, { x: 2, y: 2 / 3 }, { x: 2, y: 1 }]);
});

void test("Gaussian KDE integrates to one over wide bounds", () => {
	const curve = density([-1, 0, 1], [-5, 5], 0.4, 1001);
	const integral = curve.slice(1).reduce((area, p, i) => area + (p.x - (curve[i]?.x ?? p.x)) * (p.y + (curve[i]?.y ?? p.y)) / 2, 0);
	close(integral, 1, 1e-6);
});

void test("normal reference probabilities agree with known values", () => {
	close(normalCdf(0), 0.5, 1e-7);
	close(normalCdf(1), 0.841344746, 1e-7);
	close(normalQuantile(0.975), 1.95996398454, 2e-6);
	assert.throws(() => normalQuantile(1));
});

void test("OLS fits and diagnostics conserve the known residual sums", () => {
	const fit = linearFit([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 4 }]);
	close(fit.slope, 0.9);
	close(fit.intercept, 0.9);
	close(fit.mse, 0.35);
	close(fit.diagnostics.reduce((a, d) => a + d.leverage, 0), 2);
	close(fit.diagnostics.reduce((a, d) => a + d.residual, 0), 0);
	close(fit.diagnostics[3]?.cook ?? 0, 16 / 9);
	const perfect = linearFit([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
	close(perfect.r2, 1);
	assert.ok(perfect.diagnostics.every((d) => d.residual === 0 && d.cook === 0));
});

void test("ACF uses a common denominator and PACF uses Yule–Walker recursion", () => {
	const acf = autocorrelation([1, 2, 3, 4], 3);
	[1, 0.25, -0.3, -0.45].forEach((value, i) => { close(acf[i] ?? 0, value); });
	const pacf = partialAutocorrelation(acf);
	close(pacf[1] ?? 0, 0.25);
	close(pacf[2] ?? 0, -0.38666666666666666);
	assert.throws(() => autocorrelation([2, 2, 2], 1), /constant/u);
});

void test("tied scores cannot change ROC AUC or average precision by permutation", () => {
	const a = binaryCurves([{ score: 1, positive: true }, { score: 1, positive: false }]);
	const b = binaryCurves([{ score: 1, positive: false }, { score: 1, positive: true }]);
	assert.deepEqual(a, b);
	close(a.auc, 0.5);
	close(a.ap, 0.5);
	const perfect = binaryCurves([{ score: 0.9, positive: true }, { score: 0.8, positive: true }, { score: 0.2, positive: false }]);
	close(perfect.auc, 1);
	close(perfect.ap, 1);
});

void test("calibration omits empty bins and includes probability one", () => {
	const bins = calibrationBins([{ score: 0, positive: false }, { score: 0.1, positive: true }, { score: 1, positive: true }], 5);
	assert.deepEqual(bins, [{ x: 0.05, y: 0.5, count: 2 }, { x: 1, y: 1, count: 1 }]);
});

void test("Kaplan–Meier events use the full tied risk set before censor removals", () => {
	const steps = kaplanMeier([{ time: 1, event: true }, { time: 1, event: false }, { time: 2, event: true }, { time: 3, event: false }]);
	assert.equal(steps[1]?.risk, 4);
	close(steps[1].survival, 0.75);
	assert.equal(steps[2]?.risk, 2);
	close(steps[2].survival, 0.375);
	close(steps[3]?.survival ?? 0, 0.375);
	assert.ok(steps.every((s) => 0 <= s.low && s.low <= s.survival && s.survival <= s.high && s.high <= 1));
	assert.equal(kaplanMeier([{ time: 0, event: true }]).at(-1)?.survival, 0);
	assert.equal(kaplanMeier([{ time: 2, event: false }]).at(-1)?.survival, 1);
});

void test("histogram and hexbin counts include every observation exactly once", () => {
	assert.deepEqual(histogram([0, 0, 0.5, 1], [0, 1], 2), [2, 2]);
	const bins = hexBins([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.3 }], [-0.1, 1.1], [-0.1, 1.1], 8);
	assert.equal(bins.reduce((n, bin) => n + bin.count, 0), 4);
	assert.ok(bins.some((b) => b.count === 2));
});

void test("KDE contours contain finite segments at four increasing density levels", () => {
	const contours = densityContours([{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }], [-3, 3], [-2, 3], 0.6, 0.6);
	assert.equal(contours.length, 4);
	assert.ok(contours.every((c) => c.segments.length > 0 && c.segments.flat().every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))));
	assert.ok((contours[0]?.level ?? 0) < (contours[3]?.level ?? 0));
});

void test("invalid statistical inputs fail at build-time decoding", () => {
	assert.throws(() => boxplot.bind({ groups: [{ label: "A", values: [] }] }), /values/u);
	assert.throws(() => kde.bind({ groups: [{ label: "A", values: [1, 2] }], bandwidth: 0 }), /bandwidth/u);
	assert.throws(() => kde.bind({ groups: [{ label: "A", values: [1, 2] }], bandwidth: 1e-320 }), /bandwidth/u);
	assert.throws(() => qq.bind({ samples: [1, 1, 1] }), /must vary/u);
	assert.doesNotThrow(() => qq.bind({ samples: [1, 1, 1], sd: 1 }));
	assert.throws(() => acf.bind({ values: [1, 1, 1, 1] }), /constant/u);
	assert.throws(() => influence.bind({ points: [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 9 }] }), /unit leverage/u);
	assert.throws(() => calibration.bind({ data: [{ score: 1.1, label: 1 }, { score: 0, label: 0 }] }), /score/u);
	assert.throws(() => roc.bind({ data: [{ score: 0.9, label: 1 }, { score: 0.2, label: 1 }] }), /both/u);
	assert.throws(() => interval.bind({ estimates: [{ label: "A", estimate: 2, low: 3, high: 4 }] }), /low <= estimate/u);
	assert.throws(() => funnel.bind({ studies: [{ estimate: 0, se: 0 }] }), /se/u);
	assert.throws(() => mosaic.bind({ rows: ["A", "B"], cols: ["X", "Y"], counts: [[1, 0], [2, 0]] }), /empty/u);
	assert.throws(() => kaplanMeierFigure.bind({ groups: [{ label: "A", observations: [{ time: 1 }] }] }), /event/u);
});

void test("the gallery has exactly 30 unique kinds", () => {
	assert.equal(statisticsExamples.length, 30);
	assert.equal(new Set(statisticsExamples.map((e) => e.kind)).size, 30);
});

for (const example of statisticsExamples) {
	void test(`${example.kind}: gallery props decode without mutation and empty props fail`, async () => {
		const kind = (await import(`../src/figures/kinds/${example.kind}.ts`) as { default: DefinedFigure }).default;
		const original = JSON.stringify(example.props);
		assert.doesNotThrow(() => kind.bind(example.props));
		assert.equal(JSON.stringify(example.props), original);
		assert.throws(() => kind.bind({}));
	});
}
