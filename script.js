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

        // Only keep data where totalBruto > 0
        if (totalBruto > 0 && parts.length >= 11) {
            parsedData.push({
                mesReferencia: parts[0] || null,
                estadoOrigem: parts[1] || "Desconhecido",
                descricaoNCM: parts[6]?.trim() || "Atividade Desconhecida",
                municipio: parts[4] || "Desconhecido",
                totalBruto: totalBruto
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

        sortedActivities.forEach(({ descricaoNCM, percentage }, index) => {
            if (!seriesData[index]) {
                seriesData[index] = { name: descricaoNCM, points: new Array(categories.length).fill(0) };
            }
            // Set the correct state position in the points array using percentage
            seriesData[index].points[categories.indexOf(estado)] = percentage;
        });
    });

    console.log("Sorted Categories (States):", categories);
    console.log("Series Data for Chart:", seriesData);

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        debug: true,
        defaultSeries_type: 'column',
        title_label_text: 'Top 10 Atividades Mais Lucrativas por Estado (Proporção Percentual)',
        yAxis: { label_text: 'Proporção (%)' },
        xAxis: {
            label_text: 'Estado de Origem',
            categories: categories, // States as categories
            label_style: { rotation: 45 }
        },
        series: seriesData
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
        title_label_text: 'Average Earnings by State',
        yAxis: { label_text: 'Average Earnings (R$)' },
        xAxis: {
            label_text: 'States',
            categories: stateLabels, // State names as categories
            label_style: { rotation: 45 }, // Rotate state labels for better readability
            stacked: false
        },
        series: [{
            name: 'Average Earnings',
            points: stateAvgEarnings,
            defaultPoint: {
                tooltip: '<b>%seriesName</b><br>State: %category<br>Average Earnings: R$ %yValue' // Show total earnings without percentage
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
        if (!item.municipio) return acc; // Ignora se não houver município definido

        if (!acc[item.municipio]) {
            acc[item.municipio] = 0;
        }
        acc[item.municipio] += item.totalBruto; // Soma arrecadação do município
        return acc;
    }, {});

    // Ordenar municípios por arrecadação total em ordem decrescente e pegar o top 10
    const topMunicipios = Object.entries(earningsByMunicipio)
        .sort((a, b) => b[1] - a[1]) // Ordena do maior para o menor
        .slice(0, 10) // Pega apenas os 10 primeiros
        .map(([municipio]) => municipio); // Extrai apenas os nomes dos municípios

    // Obter lista única e ordenada de meses
    const meses = [...new Set(data.map(d => d.mesReferencia))].sort();

    // Criar série apenas para os top 10 municípios
    const series = topMunicipios.map(municipio => {
        return {
            name: municipio,
            points: meses.map(mes => {
                const item = data.find(d => d.mesReferencia === mes && d.municipio === municipio);
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
