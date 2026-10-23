import type { JsonObject, JsonValue } from "#src/utils/json.ts";
import { str, num, arr, obj, tone } from "#src/figures/kit.ts";
import type {
    Options,
    Series,
    BarModel,
    AreaModel,
    PieModel,
} from "#src/figures/charts/types.ts";
import { segments, dataDomain } from "#src/figures/charts/geometry.ts";

const commonKeys = ["title", "unit", "showLegend", "showValues"];

function fields(p: JsonObject, allowed: string[], path = "props"): void {
    for (const key of Object.keys(p)) {
        if (!allowed.includes(key)) {
            throw new Error(`${path}.${key} is not a supported option`);
        }
    }
}

function label(value: JsonValue | undefined, path: string): string {
    const result = str(value, path);
    if (!result.trim() || result.length > 120) {
        throw new Error(`${path} must contain 1–120 characters`);
    }
    return result;
}

function optionalLabel(value: JsonValue | undefined, path: string): string {
    return value === undefined ? "" : label(value, path);
}

function flag(value: JsonValue | undefined, path: string): boolean {
    if (value === undefined) {
        return true;
    }
    if (typeof value !== "boolean") {
        throw new Error(`${path} must be a boolean`);
    }
    return value;
}

function choice<T extends string>(
    value: JsonValue | undefined,
    path: string,
    choices: readonly T[],
    fallback: T,
): T {
    if (value === undefined) {
        return fallback;
    }
    const found = choices.find((item) => item === value);
    if (found === undefined) {
        throw new Error(`${path} must be one of ${choices.join(", ")}`);
    }
    return found;
}

function bounded(value: JsonValue | undefined, path: string): number {
    const result = num(value, path);
    if (Math.abs(result) > 1e12 || (result !== 0 && Math.abs(result) < 1e-12)) {
        throw new Error(`${path} must be zero or have magnitude between 1e-12 and 1e12`);
    }
    return result;
}

function list(value: JsonValue | undefined, path: string, min: number, max: number): JsonValue[] {
    const result = arr(value, path);
    if (result.length < min || result.length > max) {
        throw new Error(`${path} must contain ${String(min)}–${String(max)} entries`);
    }
    return result;
}

function unique(labels: string[], path: string): void {
    if (new Set(labels).size !== labels.length) {
        throw new Error(`${path} must have distinct labels`);
    }
}

function options(p: JsonObject): Options {
    return {
        title: optionalLabel(p.title, "props.title"),
        unit: optionalLabel(p.unit, "props.unit"),
        showLegend: flag(p.showLegend, "props.showLegend"),
        showValues: flag(p.showValues, "props.showValues"),
    };
}

function readSeries(raw: JsonValue | undefined, count: number): Series[] {
    const series = list(raw, "props.series", 1, 6).map((item, i) => {
        const path = `props.series[${String(i)}]`;
        const p = obj(item, path);
        fields(p, ["label", "values", "tone"], path);
        const values = arr(p.values, `${path}.values`);
        if (values.length !== count) {
            throw new Error(`${path}.values must contain ${String(count)} values`);
        }
        return {
            label: label(p.label, `${path}.label`),
            values: values.map((v, j) => bounded(v, `${path}.values[${String(j)}]`)),
            tone: tone(p.tone, `${path}.tone`, i === 0 ? "marker" : "ink"),
        };
    });
    unique(
        series.map((s) => s.label),
        "props.series",
    );
    return series;
}

function nonnegative(series: Series[], reason: string): void {
    if (series.some((s) => s.values.some((v) => v < 0))) {
        throw new Error(`${reason} requires nonnegative values`);
    }
}

export function decodeBar(raw: JsonValue): BarModel {
    const p = obj(raw, "props");
    fields(p, [
        ...commonKeys,
        "categories",
        "series",
        "orientation",
        "mode",
        "categoryLabel",
        "valueLabel",
    ]);
    const categories = list(p.categories, "props.categories", 1, 24).map((v, i) =>
        label(v, `props.categories[${String(i)}]`),
    );
    unique(categories, "props.categories");
    const series = readSeries(p.series, categories.length);
    const mode = choice(p.mode, "props.mode", ["grouped", "stacked", "percent"], "grouped");
    if (mode === "percent") {
        nonnegative(series, "props.mode percent");
    }
    const data = segments(series, mode !== "grouped", mode === "percent");
    return {
        ...options(p),
        categories,
        series,
        segments: data,
        domain: dataDomain(data, mode === "percent"),
        mode,
        orientation: choice(
            p.orientation,
            "props.orientation",
            ["vertical", "horizontal"],
            "vertical",
        ),
        categoryLabel: optionalLabel(p.categoryLabel, "props.categoryLabel"),
        valueLabel: optionalLabel(p.valueLabel, "props.valueLabel"),
    };
}

export function decodeArea(raw: JsonValue): AreaModel {
    const p = obj(raw, "props");
    fields(p, [...commonKeys, "x", "series", "mode", "xLabel", "yLabel"]);
    const x = list(p.x, "props.x", 2, 500).map((v, i) => bounded(v, `props.x[${String(i)}]`));
    if (x.some((v, i) => i > 0 && v <= (x[i - 1] ?? v))) {
        throw new Error("props.x must be strictly increasing");
    }
    const series = readSeries(p.series, x.length);
    const mode = choice(p.mode, "props.mode", ["overlay", "stacked", "percent"], "overlay");
    if (mode !== "overlay") {
        nonnegative(series, `props.mode ${mode}`);
    }
    const data = segments(series, mode !== "overlay", mode === "percent");
    return {
        ...options(p),
        x,
        series,
        segments: data,
        domain: dataDomain(data, mode === "percent"),
        mode,
        xLabel: optionalLabel(p.xLabel, "props.xLabel"),
        yLabel: optionalLabel(p.yLabel, "props.yLabel"),
    };
}

export function decodePie(raw: JsonValue): PieModel {
    const p = obj(raw, "props");
    fields(p, [...commonKeys, "slices", "variant", "totalLabel"]);
    const slices = list(p.slices, "props.slices", 1, 8).map((item, i) => {
        const path = `props.slices[${String(i)}]`;
        const s = obj(item, path);
        fields(s, ["label", "value", "tone"], path);
        const value = bounded(s.value, `${path}.value`);
        if (value < 0) {
            throw new Error(`${path}.value must be nonnegative`);
        }
        return {
            label: label(s.label, `${path}.label`),
            value,
            tone: tone(s.tone, `${path}.tone`, i === 0 ? "marker" : "ink"),
        };
    });
    unique(
        slices.map((s) => s.label),
        "props.slices",
    );
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
        throw new Error("props.slices must have a positive total");
    }
    let end = 0;
    return {
        ...options(p),
        total,
        variant: choice(p.variant, "props.variant", ["pie", "donut"], "pie"),
        totalLabel: optionalLabel(p.totalLabel, "props.totalLabel"),
        slices: slices.map((s) => {
            const from = end / total;
            end += s.value;
            return { ...s, from, to: end / total, percent: (s.value / total) * 100 };
        }),
    };
}
