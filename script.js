let allData = [];

const filePaths = [
    'ComprasBA-2019-1/Compra_2019_01.txt',
    'ComprasBA-2019-1/Compra_2019_02.txt',
    'ComprasBA-2019-1/Compra_2019_03.txt',
    'ComprasBA-2019-1/Compra_2019_04.txt',
    'ComprasBA-2019-1/Compra_2019_05.txt',
    'ComprasBA-2019-1/Compra_2019_06.txt'
];

Promise.all(filePaths.map(filePath => loadAndProcessFile(filePath)))
    .then(() => {
        // Após todos os arquivos serem processados, combinamos os dados
        allData = allData.flat(); // Combinamos os dados em um único array

        updateChart(allData);
        populateActivitySelect(allData);
        updateStateAvgEarningsChart(allData);
        statesThatEarnedTheMost(allData);
        compareICMSByStateAndRegion(allData);
        document.getElementById("loadingScreen").style.display = "none";
    })
    .catch((error) => {
        console.error("Erro ao carregar ou processar arquivos:", error);
    });

async function loadAndProcessFile(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error("Falha ao carregar o arquivo");

        const fileContent = await response.text();
        parseTradeData(fileContent); // Função para processar o conteúdo
    } catch (error) {
        console.error("Erro ao carregar o arquivo:", error);
    }
}

// Função para processar o conteúdo do arquivo

document.getElementById('activitySelect').addEventListener('change', function (event) {
    const selectedActivity = event.target.value;
    updatePieChart(allData, selectedActivity);
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
            allData.push({
                mesReferencia: parts[0] || null,
                estadoOrigem: parts[1] || "Desconhecido",
                estadoDestino: parts[3] || "Desconhecido",
                descricaoNCM: parts[6]?.trim() || "Atividade Desconhecida",
                municipioOrigem: parts[2] || "Desconhecido",
                municipioDestino: parts[4] || "Desconhecido",
                totalBruto: totalBruto,
                ICMS: ICMS
            });
        }
    });

    allData.push(parsedData);
}

function populateActivitySelect(data) {
    const activities = [...new Set(data.map(item => item.descricaoNCM))];
    const select = document.getElementById('activitySelect');
    activities.sort().forEach(activity => {
        const option = document.createElement('option');
        option.value = activity;
        option.textContent = activity;
        select.appendChild(option);
    });
}


function updateChart(data) {
    console.log("Data passed to updateChart:", data); // Log data

    if (data.length === 0) {
        console.warn("No valid data found for chart.");
        return;
    }

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
                tooltip: '<b>%seriesName</b><br>Valor Bruto: R$ %yValue' // Tooltip with totalBruto and percentage
            }
        }))
    };

    // Render the chart
    JSC.chart('chartDiv', chartConfig);
}

function updateStateAvgEarningsChart(data) {
    console.log("Data passed to updateStateAvgEarningsChart:", data); // Log data

    if (data.length === 0) {
        console.warn("No valid data found for chart.");
        return;
    }

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

    // Sort the state labels and earnings by average earnings in descending order
    const sortedData = stateAvgEarnings
        .map((avgEarnings, index) => ({ avgEarnings, state: stateLabels[index] }))
        .sort((a, b) => b.avgEarnings - a.avgEarnings); // Sort by average earnings, descending

    // Extract sorted states and earnings after sorting
    const sortedStateLabels = sortedData.map(item => item.state);
    const sortedStateAvgEarnings = sortedData.map(item => item.avgEarnings);

    console.log("Sorted Series Data for State Average Earnings Chart:", sortedStateAvgEarnings);

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        type: 'horizontalColumn',
        title_label_text: 'Ganhos Médios por Estado', // Título traduzido
        yAxis: { label_text: 'Ganhos Médios (R$)' }, // Rótulo do eixo Y traduzido
        xAxis: {
            label_text: 'Estados', // Rótulo do eixo X traduzido
            categories: sortedStateLabels, // Sorted states by average earnings
            label_style: { rotation: 45 }, // Rotate state labels for better readability
            stacked: false
        },
        series: [{
            name: 'Ganhos Médios', // Nome da série traduzido
            points: sortedStateAvgEarnings,
            defaultPoint: {
                tooltip: '<b>%seriesName</b><br>Estado: %category<br>Ganhos Médios: R$ %yValue' // Tooltip com nome do estado correto
            }
        }]
    };

    // Render the chart in chartDiv2
    JSC.chart('chartDiv2', chartConfig);
}

function statesThatEarnedTheMost(data) {
    if (data.length === 0) {
        console.warn("No valid data found for states chart.");
        return;
    }

    // Agrupar arrecadação total por estado
    const earningsByState = data.reduce((acc, item) => {
        if (!item.estadoOrigem) return acc; // Ignora se não houver estado definido

        if (!acc[item.estadoOrigem]) {
            acc[item.estadoOrigem] = 0;
        }
        acc[item.estadoOrigem] += item.totalBruto; // Soma arrecadação do estado
        return acc;
    }, {});

    // Ordenar estados por arrecadação total em ordem decrescente e pegar o top 10
    const topStates = Object.entries(earningsByState)
        .sort((a, b) => b[1] - a[1]) // Ordena do maior para o menor
        .slice(0, 10) // Pega apenas os 10 primeiros
        .map(([estadoOrigem]) => estadoOrigem); // Extrai apenas os nomes dos estados

    // Obter lista única e ordenada de meses e converter para formato "Mês/Ano"
    const meses = [...new Set(data.map(d => d.mesReferencia))].sort().map(mes => {
        const ano = mes.toString().slice(0, 4); // Extrai o ano
        const mesNumero = mes.toString().slice(4, 6); // Extrai o mês
        return `${mesNumero}/${ano}`; // Formata como Mês/Ano
    });

    // Criar série apenas para os top 10 estados
    const series = topStates.map(estado => {
        return {
            name: estado,
            points: meses.map(mes => {
                const mesNumero = mes.split('/')[0]; // Pega o mês
                const ano = mes.split('/')[1]; // Pega o ano
                const mesReferencia = `${ano}${mesNumero.padStart(2, '0')}`; // Converte de volta para "yyyymm"
                const item = data.find(d => d.mesReferencia === mesReferencia && d.estadoOrigem === estado);
                return { x: mes, y: item ? item.totalBruto : 0 };
            })
        };
    });

    // Criar gráfico corrigido para mostrar apenas o top 10 estados
    JSC.Chart("chartDiv3", {
        type: "line",
        title_label_text: "Top 10 Estados por Arrecadação",
        xAxis: {
            label_text: "Mês de Referência",
            scale_type: "auto", // Evita erro caso os meses sejam strings
        },
        yAxis: {
            label_text: "Arrecadação (R$)",
            defaultCultureName: 'pt-BR',
        },
        series: series
    });

}

function compareICMSByStateAndRegion(data) {
    if (data.length === 0) {
        console.warn("Nenhum dado disponível para ICMS.");
        return;
    }

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
    let icmsAverageByState = Object.entries(icmsByState).map(([estado, { totalICMS, count }]) => ({
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

    // Ordenar estados dentro de cada região por média de ICMS (do maior para o menor)
    icmsAverageByState.sort((a, b) => b.mediaICMS - a.mediaICMS);

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
}

let pieChart;  // Variable to store the chart instance

function updatePieChart(data, selectedActivity) {
    const filteredData = data.filter(item => item.descricaoNCM === selectedActivity);

    if (filteredData.length === 0) {
        console.warn("No data found for the selected activity:", selectedActivity);
        return;
    }

    const stateData = {};
    let totalEarnings = 0;

    // Agrupar os valores totais por estado
    filteredData.forEach(item => {
        const { estadoOrigem, totalBruto } = item;
        if (!stateData[estadoOrigem]) {
            stateData[estadoOrigem] = 0;
        }
        stateData[estadoOrigem] += totalBruto;
        totalEarnings += totalBruto; // Acumular o total geral
    });

    let pieChartData = Object.keys(stateData).map(state => ({
        name: state,
        y: stateData[state],
        percentage: (stateData[state] / totalEarnings) * 100
    }));

    let othersData = 0;

    // Agrupar estados com menos de 5% na categoria "Outros"
    pieChartData = pieChartData.filter(state => {
        if (state.percentage < 5) {
            othersData += state.y;
            return false; // Remove o estado da lista principal
        }
        return true;
    });

    // Adiciona "Outros" se houver estados com menos de 5%
    if (othersData > 0) {
        pieChartData.push({
            name: 'Outros',
            y: othersData,
            percentage: (othersData / totalEarnings) * 100
        });
    }

    // Ordena de forma decrescente pela porcentagem
    pieChartData.sort((a, b) => b.percentage - a.percentage);

    // Cria ou atualiza o gráfico de pizza
    if (!pieChart) {
        pieChart = new JSC.Chart('chartDiv5', {
            title_position: 'center',
            title_label_text: `Contribuição dos Estados para a Atividade: ${selectedActivity}`,
            legend_position: 'inside left bottom',
            defaultSeries: {
                type: 'pie',
                pointSelection: true
            },
            defaultPoint_label: {
                text: '<b>%name</b>',
                placement: 'auto',
                autoHide: false
            },
            chart: {
                renderTo: 'chartDiv5',
                height: '600px',
                width: '100%'
            },
            series: [{
                name: 'Estados',
                points: pieChartData,
                tooltip: {
                    enabled: true,
                    text: '%name: <b>%percentage% do total arrecadado</b>'
                }
            }]
        });
    } else {
        pieChart.options({
            series: [{
                name: 'Estados',
                points: pieChartData,
                tooltip: {
                    enabled: true,
                    text: '%name: <b>%percentage% do total arrecadado</b>'
                }
            }],
            title: {
                label_text: `Contribuição dos Estados para a Atividade: ${selectedActivity}`
            }
        });
    }
}
