/** Ready-made 24 × 24 outlines. Authors choose names; paths belong to the library. */
export const symbols = {
    rectangle: { group: "Shapes", path: "M3 5H21V19H3Z" },
    rounded: { group: "Shapes", path: "M6 4H18Q21 4 21 7V17Q21 20 18 20H6Q3 20 3 17V7Q3 4 6 4Z" },
    square: { group: "Shapes", path: "M4 4H20V20H4Z" },
    circle: { group: "Shapes", path: "M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12Z" },
    ellipse: { group: "Shapes", path: "M22 12A10 7 0 1 1 2 12A10 7 0 1 1 22 12Z" },
    triangle: { group: "Shapes", path: "M12 3L22 20H2Z" },
    diamond: { group: "Shapes", path: "M12 2L22 12L12 22L2 12Z" },
    pentagon: { group: "Shapes", path: "M12 2L22 9L18 21H6L2 9Z" },
    hexagon: { group: "Shapes", path: "M7 3H17L22 12L17 21H7L2 12Z" },
    octagon: { group: "Shapes", path: "M8 2H16L22 8V16L16 22H8L2 16V8Z" },
    pill: { group: "Shapes", path: "M8 5H16A7 7 0 0 1 16 19H8A7 7 0 0 1 8 5Z" },
    parallelogram: { group: "Shapes", path: "M7 4H22L17 20H2Z" },
    trapezoid: { group: "Shapes", path: "M7 5H17L22 19H2Z" },
    star: { group: "Shapes", path: "M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8Z" },
    arrow: { group: "Shapes", path: "M2 8H13V3L22 12L13 21V16H2Z" },
    cylinder: { group: "Shapes", path: "M3 6C3 1 21 1 21 6C21 11 3 11 3 6V18C3 23 21 23 21 18V6" },
    cube: { group: "Shapes", path: "M12 2L22 7V17L12 22L2 17V7ZM2 7L12 12L22 7M12 12V22" },
    layers: { group: "Shapes", path: "M12 2L22 7L12 12L2 7ZM2 12L12 17L22 12M2 17L12 22L22 17" },
    server: {
        group: "Computing",
        path: "M3 3H21V10H3ZM3 14H21V21H3ZM6 6H7M6 17H7M15 6H18M15 17H18",
    },
    rack: {
        group: "Computing",
        path: "M4 2H20V22H4ZM4 8H20M4 15H20M7 5H8M7 11H8M7 18H8M13 5H17M13 11H17M13 18H17",
    },
    cpu: {
        group: "Computing",
        path: "M5 5H19V19H5ZM9 9H15V15H9ZM8 2V5M12 2V5M16 2V5M8 19V22M12 19V22M16 19V22M2 8H5M2 12H5M2 16H5M19 8H22M19 12H22M19 16H22",
    },
    memory: {
        group: "Computing",
        path: "M2 6H22V17H2ZM5 9H9V14H5ZM15 9H19V14H15ZM5 17V21M9 17V21M15 17V21M19 17V21",
    },
    disk: {
        group: "Computing",
        path: "M4 2H20V22H4ZM18 10A6 6 0 1 1 6 10A6 6 0 1 1 18 10ZM13 10A1 1 0 1 1 11 10A1 1 0 1 1 13 10ZM12 10L18 18M7 19H8",
    },
    ssd: {
        group: "Computing",
        path: "M3 4H21V20H3ZM6 7H18V15H6ZM7 20V22M11 20V22M15 20V22M19 20V22",
    },
    gpu: {
        group: "Computing",
        path: "M2 6H21V18H2ZM11 12A4 4 0 1 1 3 12A4 4 0 1 1 11 12ZM19 12A3 3 0 1 1 13 12A3 3 0 1 1 19 12ZM5 18V21H16V18M21 9H23M21 15H23",
    },
    monitor: { group: "Computing", path: "M2 3H22V17H2ZM12 17V21M7 21H17" },
    laptop: { group: "Computing", path: "M5 3H19V16H5ZM2 20L5 16H19L22 20Z" },
    phone: {
        group: "Computing",
        path: "M7 2H17Q19 2 19 4V20Q19 22 17 22H7Q5 22 5 20V4Q5 2 7 2ZM9 5H15M11 19H13",
    },
    keyboard: {
        group: "Computing",
        path: "M2 6H22V19H2ZM5 9H6M9 9H10M13 9H14M17 9H18M5 12H6M9 12H10M13 12H14M17 12H18M6 16H18",
    },
    terminal: { group: "Computing", path: "M2 3H22V21H2ZM5 8L9 12L5 16M12 16H18" },
    code: { group: "Computing", path: "M7 5L1 12L7 19M17 5L23 12L17 19M14 3L10 21" },
    container: {
        group: "Computing",
        path: "M2 7H22V20H2ZM6 7V20M10 7V20M14 7V20M18 7V20M8 3H16V7H8Z",
    },
    process: { group: "Computing", path: "M3 4H21V20H3ZM3 8H21M6 6H7M10 6H11M9 11L15 14L9 17Z" },
    thread: {
        group: "Computing",
        path: "M4 2V22M12 2V22M20 2V22M2 5H6V9H2ZM10 10H14V14H10ZM18 15H22V19H18Z",
    },
    cloud: { group: "Network", path: "M6 19A5 5 0 0 1 5 9A7 7 0 0 1 18 7A6 6 0 0 1 18 19Z" },
    globe: {
        group: "Network",
        path: "M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12ZM3 12H21M12 3C6 7 6 17 12 21C18 17 18 7 12 3",
    },
    network: {
        group: "Network",
        path: "M8 2H16V8H8ZM2 16H8V22H2ZM16 16H22V22H16ZM12 8V12M5 16V12H19V16",
    },
    router: {
        group: "Network",
        path: "M3 13H21V21H3ZM6 13V3M18 13V3M6 17H7M10 17H11M17 17H18M3 4Q6 1 9 4M15 4Q18 1 21 4",
    },
    switch: {
        group: "Network",
        path: "M2 6H22V19H2ZM5 9H8V13H5ZM10 9H13V13H10ZM15 9H18V13H15ZM5 16H18",
    },
    wifi: { group: "Network", path: "M2 7Q12 -1 22 7M5 11Q12 5 19 11M8 15Q12 11 16 15M11 19H13" },
    packet: { group: "Network", path: "M3 5H21V19H3ZM3 5L12 13L21 5M3 19L9 12M21 19L15 12" },
    port: { group: "Network", path: "M3 4H21V19H17V22H7V19H3ZM7 7V12M10 7V12M14 7V12M17 7V12" },
    antenna: {
        group: "Network",
        path: "M12 8V22M7 22H17M10 8A2 2 0 1 1 14 8A2 2 0 1 1 10 8M7 3Q2 8 7 13M17 3Q22 8 17 13",
    },
    firewall: {
        group: "Network",
        path: "M2 5H22V21H2ZM2 10H22M2 15H22M7 5V10M17 5V10M12 10V15M7 15V21M17 15V21M12 1V4",
    },
    balance: {
        group: "Network",
        path: "M12 2V8M5 12L12 8L19 12M5 12V16M19 12V16M2 16H8V22H2ZM16 16H22V22H16Z",
    },
    link: {
        group: "Network",
        path: "M10 7L13 4A5 5 0 0 1 20 11L17 14M14 17L11 20A5 5 0 0 1 4 13L7 10M8 16L16 8",
    },
    database: {
        group: "Data",
        path: "M3 5C3 1 21 1 21 5C21 9 3 9 3 5V19C3 23 21 23 21 19V5M3 12C3 16 21 16 21 12",
    },
    table: { group: "Data", path: "M2 3H22V21H2ZM2 9H22M2 15H22M9 3V21M16 3V21" },
    array: { group: "Data", path: "M2 7H22V17H2ZM7 7V17M12 7V17M17 7V17" },
    stack: { group: "Data", path: "M4 3H20V8H4ZM4 10H20V15H4ZM4 17H20V22H4Z" },
    queue: {
        group: "Data",
        path: "M1 8H5V16H1ZM7 8H11V16H7ZM13 8H17V16H13ZM19 12H23M21 10L23 12L21 14",
    },
    tree: {
        group: "Data",
        path: "M9 2H15V8H9ZM2 16H8V22H2ZM16 16H22V22H16ZM12 8V12M5 16V12H19V16",
    },
    graph: {
        group: "Data",
        path: "M5 5L19 5L12 19ZM8 5A3 3 0 1 1 2 5A3 3 0 1 1 8 5ZM22 5A3 3 0 1 1 16 5A3 3 0 1 1 22 5ZM15 19A3 3 0 1 1 9 19A3 3 0 1 1 15 19Z",
    },
    file: { group: "Data", path: "M5 2H14L20 8V22H5ZM14 2V8H20M8 12H17M8 16H17M8 19H14" },
    folder: { group: "Data", path: "M2 5H9L12 8H22V20H2ZM2 8H22" },
    archive: { group: "Data", path: "M2 3H22V8H2ZM4 8V22H20V8M9 12H15V16H9Z" },
    document: { group: "Data", path: "M4 3H20V18Q16 15 12 18Q8 21 4 18ZM7 7H17M7 11H17" },
    cache: { group: "Data", path: "M3 4H21V20H3ZM13 6L7 13H12L11 18L17 11H12Z" },
    user: {
        group: "People & actions",
        path: "M16 6A4 4 0 1 1 8 6A4 4 0 1 1 16 6ZM3 22V19C3 10 21 10 21 19V22",
    },
    users: {
        group: "People & actions",
        path: "M13 7A3 3 0 1 1 7 7A3 3 0 1 1 13 7ZM2 22V19C2 11 18 11 18 19V22M16 4C22 4 22 11 17 11M19 14C23 15 23 18 23 22",
    },
    lock: { group: "People & actions", path: "M4 10H20V22H4ZM7 10V6A5 5 0 0 1 17 6V10M12 14V18" },
    key: {
        group: "People & actions",
        path: "M12 8A5 5 0 1 1 2 8A5 5 0 1 1 12 8ZM11 11L21 21M16 16L19 13M19 19L22 16",
    },
    shield: {
        group: "People & actions",
        path: "M12 2L21 6V12Q21 18 12 22Q3 18 3 12V6ZM8 12L11 15L17 9",
    },
    clock: {
        group: "People & actions",
        path: "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12ZM12 6V12L16 15",
    },
    timer: {
        group: "People & actions",
        path: "M20 14A8 8 0 1 1 4 14A8 8 0 1 1 20 14ZM9 2H15M12 2V6M12 9V14L15 16M18 7L21 4",
    },
    search: { group: "People & actions", path: "M16 9A7 7 0 1 1 2 9A7 7 0 1 1 16 9ZM14 14L22 22" },
    filter: { group: "People & actions", path: "M2 3H22L15 12V20L9 22V12Z" },
    funnel: {
        group: "People & actions",
        path: "M2 3H22L18 8H6ZM7 10H17L14 15H10ZM10 17H14V22H10Z",
    },
    download: { group: "People & actions", path: "M12 2V16M6 10L12 16L18 10M3 17V22H21V17" },
    upload: { group: "People & actions", path: "M12 16V2M6 8L12 2L18 8M3 17V22H21V17" },
    browser: { group: "Interface", path: "M2 3H22V21H2ZM2 8H22M5 5H6M9 5H10M13 5H19" },
    window: { group: "Interface", path: "M2 3H22V21H2ZM2 8H22M7 8V21" },
    panel: { group: "Interface", path: "M2 3H22V21H2ZM2 8H22M9 8V21M14 12H19M14 16H19" },
    button: {
        group: "Interface",
        path: "M5 6H19Q22 6 22 9V15Q22 18 19 18H5Q2 18 2 15V9Q2 6 5 6ZM8 12H16",
    },
    toggle: {
        group: "Interface",
        path: "M7 6H17A6 6 0 0 1 17 18H7A6 6 0 0 1 7 6ZM10 12A3 3 0 1 1 4 12A3 3 0 1 1 10 12Z",
    },
    slider: {
        group: "Interface",
        path: "M2 6H8M12 6H22M8 3H12V9H8ZM2 18H14M18 18H22M14 15H18V21H14Z",
    },
    cursor: { group: "Interface", path: "M5 2L20 14L13 15L10 22Z" },
    image: {
        group: "Interface",
        path: "M2 3H22V21H2ZM2 17L8 11L13 16L17 12L22 17M17 7A2 2 0 1 1 13 7A2 2 0 1 1 17 7Z",
    },
    chart: { group: "Interface", path: "M2 2V22H23M6 18V12H9V18ZM12 18V7H15V18ZM18 18V3H21V18Z" },
    check: {
        group: "Interface",
        path: "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12ZM6 12L10 16L18 8",
    },
    warning: { group: "Interface", path: "M12 2L23 21H1ZM12 8V14M12 17V18" },
    flag: { group: "Interface", path: "M4 23V2M4 3H20L16 8L20 13H4" },
} as const;

export type SymbolName = keyof typeof symbols;

export function isSymbolName(name: string): name is SymbolName {
    return Object.hasOwn(symbols, name);
}

export const symbolNames = Object.keys(symbols).filter(isSymbolName);
export const symbolGroups = [...new Set(symbolNames.map((name) => symbols[name].group))];
