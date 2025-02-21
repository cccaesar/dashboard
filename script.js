document.getElementById("fileInput").addEventListener("change", function (event) {
    const files = event.target.files;
    let allData = [];
    let fileIndex = 0;

    function processNextFile() {
        if (fileIndex >= files.length) {
            console.log("All parsed data:", allData);
            updateChart(allData);
            updateStateAvgEarningsChart(allData);
            citiesThatEarnedTheMost(allData);
            compareICMSByStateAndRegion(allData);
            return;
        }

        const file = files[fileIndex];
        fileIndex++;

        const reader = new FileReader();
        reader.onload = function (e) {
            const parsedData = parseTradeData(e.target.result);
            if (parsedData.length > 0) {
                allData = allData.concat(parsedData);
            }
            setTimeout(processNextFile, 10);  // Small delay for handling the next file
        };
        reader.readAsText(file);
    }

    processNextFile();
});

function parseTradeData(text) {
    const lines = text.split("\n").filter(line => line.trim() !== "");
    const parsedData = [];

    lines.forEach(line => {
        const parts = line.split(/\t+/);
        const totalBruto = parseFloat(parts[9]) || 0;
        const ICMS = parseFloat(parts[10]) || 0;
        // Only keep data where totalBruto > 0
        if (totalBruto > 0 && parts.length >= 11) {
            parsedData.push({
                mesReferencia: parts[0] || null,
                estadoOrigem: parts[1] || "Desconhecido",
                descricaoNCM: parts[6]?.trim() || "Atividade Desconhecida",
                municipioOrigem: parts[2] || "Desconhecido",
                municipioDestino: parts[4] || "Desconhecido",
                totalBruto: totalBruto,
                ICMS: ICMS
            });
        }
    });

    return parsedData;
}

function updateChart(data) {
    console.log("Data passed to updateChart:", data); // Log data

    if (data.length === 0) {
        console.warn("No valid data found for chart.");
        return;
    }

    // Show loading spinner
    document.getElementById("loadingSpinner").style.display = "block";

    // Group the data by estadoOrigem and descricaoNCM
    const groupedData = {}; // Store activities grouped by state
    const totalBrutoByState = {}; // Store total bruto per state

    data.forEach(item => {
        if (!groupedData[item.estadoOrigem]) {
            groupedData[item.estadoOrigem] = {};
            totalBrutoByState[item.estadoOrigem] = 0;
        }

        if (!groupedData[item.estadoOrigem][item.descricaoNCM]) {
            groupedData[item.estadoOrigem][item.descricaoNCM] = 0;
        }

        // Sum the totalBruto for each state-activity combination
        groupedData[item.estadoOrigem][item.descricaoNCM] += item.totalBruto;
        totalBrutoByState[item.estadoOrigem] += item.totalBruto; // Track total bruto per state
    });

    console.log("Grouped Data by Estado and Atividade:", groupedData);

    // Sort states by totalBruto in descending order
    const categories = Object.keys(groupedData)
        .sort((a, b) => totalBrutoByState[b] - totalBrutoByState[a]) // Sort states by totalBruto descending
        .slice(0, 10); // Limit to top 10 states

    const seriesData = [];

    categories.forEach(estado => {
        // Sort activities *within each state* based on the proportion of totalBruto for that state
        const sortedActivities = Object.entries(groupedData[estado])
            .map(([descricaoNCM, totalBruto]) => {
                const percentage = (totalBruto / totalBrutoByState[estado]) * 100; // Calculate percentage
                return { descricaoNCM, totalBruto, percentage }; // Include the percentage
            })
            .sort((a, b) => b.percentage - a.percentage) // Sort by percentage descending
            .slice(0, 10); // Top 10 activities by importance per state

        sortedActivities.forEach(({ descricaoNCM, totalBruto, percentage }, index) => {
            if (!seriesData[index]) {
                seriesData[index] = { name: descricaoNCM, points: new Array(categories.length).fill(0) };
            }
            // Set the correct state position in the points array using totalBruto
            seriesData[index].points[categories.indexOf(estado)] = totalBruto; // Use totalBruto, not percentage
        });
    });

    console.log("Sorted Categories (States):", categories);
    console.log("Series Data for Chart:", seriesData);

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        debug: true,
        defaultSeries_type: 'column',
        title_label_text: 'Top 10 Atividades Mais Lucrativas por Estado (Valor Bruto)',
        yAxis: { label_text: 'Valor Bruto (R$)' },
        xAxis: {
            label_text: 'Estado de Origem',
            categories: categories.sort(), // States as categories
            label_style: { rotation: 45 }
        },
        series: seriesData.map(series => ({
            name: series.name,
            points: series.points,
            defaultPoint: {
                tooltip: '<b>%seriesName</b><br>Estado: %category<br>Valor Bruto: R$ %yValue<br>Percentual: %tooltipPercentage%' // Tooltip with totalBruto and percentage
            }
        }))
    };

    // Render the chart
    JSC.chart('chartDiv', chartConfig);

    // Hide loading spinner once the chart is rendered
    document.getElementById("loadingSpinner").style.display = "none";
}

function updateStateAvgEarningsChart(data) {
    console.log("Data passed to updateStateAvgEarningsChart:", data); // Log data

    if (data.length === 0) {
        console.warn("No valid data found for chart.");
        return;
    }

    // Show loading spinner
    document.getElementById("loadingSpinner2").style.display = "block";

    // Group the data by state
    const stateData = {};

    data.forEach(item => {
        if (!stateData[item.estadoOrigem]) {
            stateData[item.estadoOrigem] = { totalEarnings: 0, count: 0 };
        }

        stateData[item.estadoOrigem].totalEarnings += item.totalBruto;
        stateData[item.estadoOrigem].count += 1;
    });

    // Prepare the data for the chart
    const states = Object.keys(stateData);
    const stateAvgEarnings = [];
    const stateLabels = [];

    states.forEach(state => {
        const stateInfo = stateData[state];
        const avgEarnings = stateInfo ? stateInfo.totalEarnings / stateInfo.count : 0; // Calculate average earnings per state
        stateAvgEarnings.push(avgEarnings);
        stateLabels.push(state); // Add state name as a label
    });

    console.log("Series Data for State Average Earnings Chart:", stateAvgEarnings);

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        debug: true,
        type: 'horizontalColumn',
        title_label_text: 'Ganhos Médios por Estado', // Título traduzido
        yAxis: { label_text: 'Ganhos Médios (R$)' }, // Rótulo do eixo Y traduzido
        xAxis: {
            label_text: 'Estados', // Rótulo do eixo X traduzido
            categories: stateLabels.sort(), // Estado ordenado alfabeticamente
            label_style: { rotation: 45 }, // Rotate state labels for better readability
            stacked: false
        },
        series: [{
            name: 'Ganhos Médios', // Nome da série traduzido
            points: stateAvgEarnings,
            defaultPoint: {
                tooltip: '<b>%seriesName</b><br>Estado: %category<br>Ganhos Médios: R$ %yValue' // Tooltip com nome do estado correto
            }
        }]
    };

    // Render the chart in chartDiv2
    JSC.chart('chartDiv2', chartConfig);

    // Hide loading spinner once the chart is rendered
    document.getElementById("loadingSpinner2").style.display = "none";
}

function citiesThatEarnedTheMost(data) {
    if (data.length === 0) {
        console.warn("No valid data found for cities chart.");
        return;
    }

    document.getElementById("loadingSpinner3").style.display = "block";

    // Agrupar arrecadação total por município
    const earningsByMunicipio = data.reduce((acc, item) => {
        if (!item.municipioOrigem) return acc; // Ignora se não houver município definido

        if (!acc[item.municipioOrigem]) {
            acc[item.municipioOrigem] = 0;
        }
        acc[item.municipioOrigem] += item.totalBruto; // Soma arrecadação do município
        return acc;
    }, {});

    // Ordenar municípios por arrecadação total em ordem decrescente e pegar o top 10
    const topMunicipios = Object.entries(earningsByMunicipio)
        .sort((a, b) => b[1] - a[1]) // Ordena do maior para o menor
        .slice(0, 10) // Pega apenas os 10 primeiros
        .map(([municipioOrigem]) => municipioOrigem); // Extrai apenas os nomes dos municípios

    // Obter lista única e ordenada de meses
    const meses = [...new Set(data.map(d => d.mesReferencia))].sort();

    // Criar série apenas para os top 10 municípios
    const series = topMunicipios.map(municipio => {
        return {
            name: municipio,
            points: meses.map(mes => {
                const item = data.find(d => d.mesReferencia === mes && d.municipioOrigem === municipio);
                return { x: mes, y: item ? item.totalBruto : 0 };
            })
        };
    });

    // Criar gráfico corrigido para mostrar apenas o top 10 municípios
    JSC.Chart("chartDiv3", {
        type: "line",
        title_label_text: "Top 10 Municípios por Arrecadação",
        xAxis: {
            label_text: "Mês de Referência",
            scale_type: "auto", // Evita erro caso os meses sejam strings
        },
        yAxis: {
            label_text: "Arrecadação (R$)",
            formatString: "c0"
        },
        series: series
    });

    document.getElementById("loadingSpinner3").style.display = "none";
}

function compareICMSByStateAndRegion(data) {
    if (data.length === 0) {
        console.warn("Nenhum dado disponível para ICMS.");
        return;
    }

    document.getElementById("loadingSpinner4").style.display = "block";

    // Definir regiões do Brasil por estado
    const regioes = {
        "Norte": ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
        "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
        "Centro-Oeste": ["DF", "GO", "MT", "MS"],
        "Sudeste": ["ES", "MG", "RJ", "SP"],
        "Sul": ["PR", "RS", "SC"]
    };

    // Agrupar ICMS por estado (independentemente do mês)
    const icmsByState = data.reduce((acc, item) => {
        if (!item.estadoOrigem || !item.ICMS) return acc;

        if (!acc[item.estadoOrigem]) {
            acc[item.estadoOrigem] = { totalICMS: 0, count: 0 };
        }

        acc[item.estadoOrigem].totalICMS += item.ICMS;
        acc[item.estadoOrigem].count += 1;

        return acc;
    }, {});

    // Calcular média de ICMS por estado
    const icmsAverageByState = Object.entries(icmsByState).map(([estado, { totalICMS, count }]) => ({
        estado,
        mediaICMS: totalICMS / count
    }));

    // Criar um agrupamento por região
    const icmsByRegion = {};

    icmsAverageByState.forEach(({ estado, mediaICMS }) => {
        const regiao = Object.keys(regioes).find(reg => regioes[reg].includes(estado));

        if (regiao) {
            if (!icmsByRegion[regiao]) {
                icmsByRegion[regiao] = { totalICMS: 0, count: 0 };
            }
            icmsByRegion[regiao].totalICMS += mediaICMS;
            icmsByRegion[regiao].count += 1;
        }
    });

    // Calcular média de ICMS por região
    const icmsAverageByRegion = Object.entries(icmsByRegion).reduce((acc, [regiao, { totalICMS, count }]) => {
        acc[regiao] = totalICMS / count;
        return acc;
    }, {});

    // Criar a série de dados para o gráfico comparativo
    const series = icmsAverageByState.map(({ estado, mediaICMS }) => {
        const regiao = Object.keys(regioes).find(reg => regioes[reg].includes(estado));
        const mediaRegiao = icmsAverageByRegion[regiao] || 0;

        return {
            name: estado,
            points: [
                { x: estado, y: mediaRegiao / 1000, label_align: "left" },  // Valores em milhar
                { x: estado, y: mediaICMS / 1000, label_align: "right" }   // Valores em milhar
            ]
        };
    });

    // Criar gráfico
    JSC.chart("chartDiv4", {
        debug: true,
        title_label: {
            style_fontSize: 16,
            text: "Média de ICMS por Estado vs. Região\n🟠 Região | 🔵 Estado",
            margin_bottom: 10
        },
        type: "horizontal line",
        palette: ["#FF9800", "#29B6F6"],
        legend_visible: false,
        defaultTooltip_enabled: true,
        defaultAxis_defaultTick: {
            gridLine_color: "#E0E0E0",
            line_visible: false
        },
        xAxis_defaultTick: {
            label_maxWidth: 90,
            gridLine_center: true
        },
        yAxis: [
            {
                label_text: "Valor Médio de ICMS (R$) em Milhares"
            }
        ],
        defaultSeries: {
            line: { color: "#E0E0E0", width: 8 },
            mouseTracking_enabled: false,
            defaultPoint: {
                label: {
                    text: "R$ %yValue",
                    verticalAlign: "middle"
                },
                tooltip: "%xValue (%seriesName): <b>R$ %yValue</b>",
                marker: {
                    type: "circle",
                    outline_width: 0,
                    size: 16
                },
                xAxisTick_hoverAction: "highlightSeries"
            },
            firstPoint: { color: "#FF9800" },
            lastPoint: { color: "#29B6F6" }
        },
        series: series
    });

    document.getElementById("loadingSpinner4").style.display = "none";
}
