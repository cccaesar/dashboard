document.getElementById("fileInput").addEventListener("change", function (event) {
    const files = event.target.files;
    let allData = [];
    let fileIndex = 0;

    function processNextFile() {
        if (fileIndex >= files.length) {
            console.log("All parsed data:", allData);
            updateChart(allData);
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
                estadoOrigem: parts[1] || "Desconhecido",
                descricaoNCM: parts[6]?.trim() || "Atividade Desconhecida",
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
    const groupedData = {};
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
    let categories = Object.keys(groupedData)
        .sort((a, b) => totalBrutoByState[b] - totalBrutoByState[a]) // Sort states by totalBruto descending
        .slice(0, 10); // Limit to top 10 states

    const seriesData = [];

    categories.forEach(estado => {
        // Sort activities *within each state* based on total bruto for that state
        const sortedActivities = Object.entries(groupedData[estado])
            .sort((a, b) => b[1] - a[1]) // Sort by totalBruto descending
            .slice(0, 10); // Top 10 activities per state

        sortedActivities.forEach(([descricaoNCM, totalBruto], index) => {
            if (!seriesData[index]) {
                seriesData[index] = { name: descricaoNCM, points: new Array(categories.length).fill(0) };
            }
            seriesData[index].points[categories.indexOf(estado)] = totalBruto; // Set the correct state position
        });
    });

    console.log("Sorted Categories (States):", categories);
    console.log("Series Data for Chart:", seriesData);

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        debug: true,
        defaultSeries_type: 'column',
        title_label_text: 'Total Bruto por Atividade e Estado',
        yAxis: { label_text: 'Total Bruto (R$)' },
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
