import { insertTextAtCursor } from './core/dom.js';
import { loadChartScript, buildChartConfig } from './chart-render.js';

const CHART_TYPE_TABS = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'pie', label: 'Pie' },
    { value: 'doughnut', label: 'Doughnut' }
];

function resolveChartTargetTextarea(button) {
    const targetId = button.dataset.chartTarget;
    if (targetId) {
        return document.getElementById(targetId);
    }

    const item = button.closest('.problemtakeitem');
    return item ? item.querySelector('.problem-prompt') : null;
}

function splitList(value) {
    return String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '');
}

function closeChartModal() {
    const existing = document.querySelector('.chartmodaloverlay');
    if (existing) {
        existing.remove();
    }
}

function buildDatasetRow(index) {
    const row = document.createElement('div');
    row.className = 'chartdatasetrow';
    row.innerHTML = `
        <input class="inputs chartdatasetlabel" type="text" placeholder="Series ${index + 1}">
        <input class="inputs chartdatasetvalues" type="text" placeholder="e.g. 10, 20, 30">
        <button type="button" class="authsubmit chartdatasetremove" aria-label="Remove series">&times;</button>
    `;
    return row;
}

function openChartModal(targetTextarea) {
    closeChartModal();

    const overlay = document.createElement('div');
    overlay.className = 'chartmodaloverlay';
    overlay.innerHTML = `
        <div class="chartmodal">
            <div class="chartmodalheader">
                <div class="chartmodaltabs">
                    ${CHART_TYPE_TABS.map((type, index) => `
                        <button type="button" class="chartmodaltab${index === 0 ? ' chartmodaltabactive' : ''}" data-chart-type="${type.value}">${type.label}</button>
                    `).join('')}
                </div>
                <button type="button" class="chartmodalclose" aria-label="Close">&times;</button>
            </div>
            <div class="chartmodalpreview"><canvas id="chartToolCanvas"></canvas></div>
            <div class="chartmodalfields">
                <label class="aboutustitle" for="chartToolTitle">Chart title</label>
                <input id="chartToolTitle" class="inputs" type="text" placeholder="Optional title">
                <label class="aboutustitle" for="chartToolLabels">Labels</label>
                <input id="chartToolLabels" class="inputs" type="text" placeholder="e.g. Jan, Feb, Mar" value="Jan, Feb, Mar">
                <span class="aboutustitle">Series</span>
                <div id="chartToolDatasets" class="chartdatasets"></div>
                <button type="button" class="authsubmit" id="chartToolAddDataset">Add series</button>
            </div>
            <div class="chartmodalstatus" id="chartToolStatus"></div>
            <div class="chartmodalactions">
                <button type="button" class="authsubmit" id="chartToolInsert">Insert into problem</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const datasetsContainer = overlay.querySelector('#chartToolDatasets');
    const statusEl = overlay.querySelector('#chartToolStatus');
    const canvas = overlay.querySelector('#chartToolCanvas');
    let chart = null;
    let chartType = CHART_TYPE_TABS[0].value;

    function readSpec() {
        return {
            type: chartType,
            title: overlay.querySelector('#chartToolTitle').value.trim(),
            labels: splitList(overlay.querySelector('#chartToolLabels').value),
            datasets: Array.from(datasetsContainer.querySelectorAll('.chartdatasetrow')).map((row, index) => ({
                label: row.querySelector('.chartdatasetlabel').value.trim() || `Series ${index + 1}`,
                data: splitList(row.querySelector('.chartdatasetvalues').value).map(Number)
            }))
        };
    }

    function renderPreview() {
        if (!window.Chart) {
            return;
        }

        const config = buildChartConfig(readSpec());

        if (chart) {
            chart.destroy();
            chart = null;
        }

        if (config.data.datasets.length === 0) {
            statusEl.textContent = 'Add at least one series with numeric values.';
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        statusEl.textContent = '';
        chart = new window.Chart(canvas, config);
    }

    function addDatasetRow() {
        const row = buildDatasetRow(datasetsContainer.children.length);
        datasetsContainer.appendChild(row);

        row.querySelector('.chartdatasetremove').addEventListener('click', () => {
            if (datasetsContainer.children.length <= 1) {
                return;
            }
            row.remove();
            renderPreview();
        });

        row.querySelectorAll('input').forEach((input) => input.addEventListener('input', renderPreview));
    }

    overlay.querySelectorAll('.chartmodaltab').forEach((tab) => {
        tab.addEventListener('click', () => {
            overlay.querySelectorAll('.chartmodaltab').forEach((other) => other.classList.remove('chartmodaltabactive'));
            tab.classList.add('chartmodaltabactive');
            chartType = tab.dataset.chartType;
            renderPreview();
        });
    });

    overlay.querySelector('.chartmodalclose').addEventListener('click', closeChartModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeChartModal();
        }
    });

    overlay.querySelector('#chartToolAddDataset').addEventListener('click', () => {
        addDatasetRow();
        renderPreview();
    });

    overlay.querySelectorAll('#chartToolTitle, #chartToolLabels').forEach((input) => {
        input.addEventListener('input', renderPreview);
    });

    overlay.querySelector('#chartToolInsert').addEventListener('click', () => {
        const spec = readSpec();

        if (buildChartConfig(spec).data.datasets.length === 0) {
            statusEl.textContent = 'Add at least one series with numeric values.';
            return;
        }

        insertTextAtCursor(targetTextarea, `\n\`\`\`chart\n${JSON.stringify(spec)}\n\`\`\`\n`);
        closeChartModal();
    });

    addDatasetRow();
    datasetsContainer.querySelector('.chartdatasetvalues').value = '10, 20, 30';

    statusEl.textContent = 'Loading Chart.js...';
    loadChartScript()
        .then(() => renderPreview())
        .catch((error) => {
            console.error('Failed to load Chart.js:', error);
            statusEl.textContent = 'Unable to load the chart builder right now.';
        });
}

function initChartTool() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('.charttoolbutton');
        if (!button) {
            return;
        }

        const textarea = resolveChartTargetTextarea(button);
        if (textarea) {
            openChartModal(textarea);
        }
    });
}

export { initChartTool };
