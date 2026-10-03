const CHART_SCRIPT_SRC = '/vendor/chart.umd.min.js';
const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut'];
const SERIES_COLORS = [
    '#4e79a7', '#f28e2b', '#59a14f', '#e15759',
    '#b07aa1', '#76b7b2', '#edc948', '#ff9da7'
];

let chartScriptPromise = null;

function loadChartScript() {
    if (window.Chart) {
        return Promise.resolve();
    }

    if (chartScriptPromise) {
        return chartScriptPromise;
    }

    chartScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = CHART_SCRIPT_SRC;
        script.onload = () => (window.Chart ? resolve() : reject(new Error('Chart.js failed to initialize.')));
        script.onerror = () => reject(new Error('Failed to load Chart.js.'));
        document.head.appendChild(script);
    });

    return chartScriptPromise;
}

const whiteBackgroundPlugin = {
    id: 'chartWhiteBackground',
    beforeDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
};

function buildChartConfig(spec) {
    const type = CHART_TYPES.includes(spec?.type) ? spec.type : 'bar';
    const isCircular = type === 'pie' || type === 'doughnut';
    const labels = Array.isArray(spec?.labels) ? spec.labels.map((label) => String(label)) : [];
    const title = typeof spec?.title === 'string' ? spec.title : '';

    const datasets = (Array.isArray(spec?.datasets) ? spec.datasets : [])
        .map((dataset, index) => {
            const data = (Array.isArray(dataset?.data) ? dataset.data : [])
                .map(Number)
                .filter((value) => Number.isFinite(value));

            return {
                label: typeof dataset?.label === 'string' && dataset.label ? dataset.label : `Series ${index + 1}`,
                data,
                backgroundColor: isCircular
                    ? data.map((_, pointIndex) => SERIES_COLORS[pointIndex % SERIES_COLORS.length])
                    : SERIES_COLORS[index % SERIES_COLORS.length],
                borderColor: isCircular ? '#ffffff' : SERIES_COLORS[index % SERIES_COLORS.length],
                borderWidth: type === 'line' ? 2 : 1,
                fill: false
            };
        })
        .filter((dataset) => dataset.data.length > 0);

    return {
        type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            color: '#222222',
            plugins: {
                legend: { labels: { color: '#222222' } },
                title: { display: Boolean(title), text: title, color: '#222222' }
            },
            scales: isCircular ? {} : {
                x: { ticks: { color: '#222222' }, grid: { color: '#dddddd' } },
                y: { ticks: { color: '#222222' }, grid: { color: '#dddddd' }, beginAtZero: true }
            }
        },
        plugins: [whiteBackgroundPlugin]
    };
}

function parseChartSpec(raw) {
    try {
        const spec = JSON.parse(raw);
        return spec && typeof spec === 'object' ? spec : null;
    } catch {
        return null;
    }
}

async function renderChartsIn(root) {
    if (!root) {
        return;
    }

    const blocks = Array.from(root.querySelectorAll('code.language-chart'));

    if (blocks.length === 0) {
        return;
    }

    try {
        await loadChartScript();
    } catch (error) {
        console.error('Failed to load Chart.js:', error);
        return;
    }

    blocks.forEach((block) => {
        const spec = parseChartSpec(block.textContent);
        const host = block.closest('pre') || block;

        if (!spec) {
            return;
        }

        const config = buildChartConfig(spec);

        if (config.data.datasets.length === 0) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'chartfigure';
        const canvas = document.createElement('canvas');
        wrapper.appendChild(canvas);
        host.replaceWith(wrapper);

        new window.Chart(canvas, config);
    });
}

export { loadChartScript, buildChartConfig, renderChartsIn, CHART_TYPES, SERIES_COLORS };
