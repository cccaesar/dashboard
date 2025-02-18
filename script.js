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
    console.log("Data passed to updateChart:", data);  // Log data

    if (data.length === 0) {
        console.warn("No valid data found for chart.");
        return;
    }

    // Show loading spinner
    document.getElementById("loadingSpinner").style.display = "block";

    // Group the data by estadoOrigem and descricaoNCM
    const groupedData = {};

    data.forEach(item => {
        if (!groupedData[item.estadoOrigem]) {
            groupedData[item.estadoOrigem] = {};
        }

        if (!groupedData[item.estadoOrigem][item.descricaoNCM]) {
            groupedData[item.estadoOrigem][item.descricaoNCM] = 0;
        }

        // Sum the totalBruto for each state-activity combination
        groupedData[item.estadoOrigem][item.descricaoNCM] += item.totalBruto;
    });

    console.log("Grouped Data by Estado and Atividade:", groupedData); // Debugging line

    // Prepare chart categories (states) and series data (totalBruto by activity)
    let categories = Object.keys(groupedData).sort();  // Sort states alphabetically
    categories = categories.slice(0, 10); // Limit to top 10 states (modify as needed)

    const seriesData = [];
    const allActivities = new Set();

    // Collect all unique activities (descricaoNCM)
    categories.forEach(estado => {
        Object.keys(groupedData[estado]).forEach(descricaoNCM => {
            allActivities.add(descricaoNCM);
        });
    });

    const activities = Array.from(allActivities).slice(0, 10);  // Limit to top 10 activities (modify as needed)
    console.log("All Unique Activities:", activities); // Debugging line

    // Create series data for each activity
    activities.forEach(descricaoNCM => {
        const points = categories.map(estado => {
            return groupedData[estado][descricaoNCM] || 0; // If no data for the state-activity pair, use 0
        });
        seriesData.push({
            name: descricaoNCM,
            points: points
        });
    });

    console.log("Series Data for Chart:", seriesData); // Debugging line

    // Prepare chartConfig with the series and categories
    const chartConfig = {
        debug: true,
        defaultSeries_type: 'column',
        title_label_text: 'Total Bruto por Atividade e Estado',
        yAxis: { label_text: 'Total Bruto (R$)' },
        xAxis: { 
            label_text: 'Estado de Origem', 
            categories: categories, // States as categories
            label_style: { rotation: 45 }  // Rotate X-axis labels for better readability
        },
        series: seriesData // Series for each activity
    };

    // Render the chart
    JSC.chart('chartDiv', chartConfig);

    // Hide loading spinner once the chart is rendered
    document.getElementById("loadingSpinner").style.display = "none";
}
