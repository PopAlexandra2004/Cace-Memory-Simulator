async function configureCache() {
    const addressWidth = parseInt(document.getElementById("addressWidth").value);
    const cacheSize = parseInt(document.getElementById("cacheSize").value);
    const blockSize = parseInt(document.getElementById("blockSize").value);
    const associativityDropdown = document.getElementById("associativity").value;
    const replacementPolicy = document.getElementById("replacementPolicy").value || "LRU";
    const totalMemorySize = Math.pow(2, addressWidth); // Physical memory size

    // Validation for Cache Size and Block Size
    if (cacheSize > totalMemorySize) {
        alert(`Error: Cache size (${cacheSize} bytes) cannot exceed physical memory size (${totalMemorySize} bytes).`);
        return;
    }

    if (blockSize > totalMemorySize) {
        alert(`Error: Block size (${blockSize} bytes) cannot exceed physical memory size (${totalMemorySize} bytes).`);
        return;
    }

    // Validate that Cache Size is divisible by Block Size
    if (cacheSize % blockSize !== 0) {
        alert("Error: Cache size must be a multiple of the block size.");
        return;
    }

    // Calculate Associativity
    const associativity = associativityDropdown === "0" ? cacheSize / blockSize : parseInt(associativityDropdown);
    const numSets = cacheSize / (blockSize * associativity);

    if (!Number.isInteger(numSets)) {
        alert("Error: Number of sets must be an integer. Check cache size, block size, and associativity.");
        return;
    }

    // Prepare payload
    const payload = {
        cache_size: cacheSize,
        block_size: blockSize,
        associativity: associativity,
        address_width: addressWidth,
        replacement_policy: replacementPolicy,
        physical_memory_block_size: 8 // Fixed block size for physical memory
    };

    try {
        // Send the configuration payload
        const response = await fetch('/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.status) {
            alert(result.status);
            await updateCacheContents();
            await updatePhysicalMemory();

            // Trigger explanation steps if "Explain" checkbox is checked
            if (document.getElementById("explainCheckbox").checked) {
                initializeExplanationSteps({
                    addressWidth,
                    cacheSize,
                    blockSize,
                    associativity
                });
            }
        } else {
            alert(result.error || "An unknown error occurred during configuration.");
        }
    } catch (error) {
        console.error("Error during configuration:", error);
        alert("An error occurred while configuring the cache. Please check your input.");
    }

    // Update UI components
    await updateStats();
    await updateCacheContents();
    await updatePhysicalMemory();
    await updateVDTCacheData();
    await updatePerformanceMetrics();
}

async function flushCache() {
    try {
        const response = await fetch('/flush', { method: 'POST' });
        const result = await response.json();

        if (response.ok && result.status) {
            // Clear inputs and UI elements
            document.getElementById("address").value = '';
            document.getElementById("data").value = '';
            document.getElementById("batchInput").value = '';
            document.getElementById("batchResult").innerHTML = '';
            document.getElementById("historyBox").innerHTML = '';
            document.getElementById("hits").innerText = "0";
            document.getElementById("misses").innerText = "0";
            document.getElementById("amatValue").innerText = "N/A";

            // Clear Highlights
            clearHighlights();

            // Clear cache contents table
            const cacheTable = document.getElementById("cacheTable");
            cacheTable.innerHTML = `
                <tr>
                    <th>Set</th>
                    <th>Block</th>
                    <th>Valid</th>
                    <th>Dirty</th>
                    <th>Tag</th>
                </tr>
            `;

            // Clear physical memory table
            const physicalMemoryTable = document.getElementById("physicalMemoryTable");
            physicalMemoryTable.innerHTML = `
                <tr>
                    <th>Address</th>
                </tr>
            `;
            // Reset the chart
            performanceChart.data.labels = [];
            performanceChart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            performanceChart.update();

            // Show success message
            alert(result.status);
        } else {
            alert(result.error || "An unknown error occurred while flushing the cache.");
        }
    } catch (error) {
        console.error("Error flushing cache:", error);
        alert("An error occurred while flushing the cache.");
    }
await updateCacheContents();
await updatePhysicalMemory();
}

// Utility: Clear Highlights
function clearHighlights() {
    // Remove highlights from cache table
    const cacheTable = document.getElementById("cacheTable");
    if (cacheTable) {
        const highlightedCells = cacheTable.querySelectorAll(".highlight-cache-cell");
        highlightedCells.forEach(cell => cell.classList.remove("highlight-cache-cell"));
    }

    // Remove highlights from physical memory table
    const physicalMemoryTable = document.getElementById("physicalMemoryTable");
    if (physicalMemoryTable) {
        const highlightedRows = physicalMemoryTable.querySelectorAll(".highlight-row");
        highlightedRows.forEach(row => row.classList.remove("highlight-row"));
    }

    // Reset stored highlight data
    lastHighlightedCacheCell = { setIndex: null, blockIndex: null, byteOffset: null };
    lastHighlightedRowIndex = null;
}

async function updateStats() {
    try {
        const response = await fetch('/stats');
        const stats = await response.json();

        if (stats.error) {
            console.error("Error fetching stats:", stats.error);
            alert(stats.error);
            return;
        }

        document.getElementById("hits").innerText = stats.hits;
        document.getElementById("misses").innerText = stats.misses;
        const amatValue = stats.amat !== "N/A" ? stats.amat : 0; // Default to 0 if AMAT is "N/A"
        document.getElementById("amatValue").innerText = stats.amat !== "N/A" ? stats.amat.toFixed(2) : "N/A";

        const operationCount = performanceChart.data.labels.length + 1; // Increment operation count
        performanceChart.data.labels.push(`Op ${operationCount}`);
        performanceChart.data.datasets[0].data.push(stats.hits);
        performanceChart.data.datasets[1].data.push(stats.misses);
        performanceChart.data.datasets[2].data.push(stats.amat || 0); // Use 0 if AMAT is "N/A"

        performanceChart.update(); // Refresh the chart
        console.log("Updated stats:", stats); // Debug log to ensure stats are fetched
    } catch (error) {
        console.error("Error updating stats:", error);
        alert("An error occurred while updating stats.");
    }
}

async function accessMemory(mode) {
    try {
        // Get the user input for address and value
        const addressInput = document.getElementById("address").value.trim();
        const valueInput = document.getElementById("data").value.trim();

        // Convert address and value from hexadecimal to decimal if they are valid inputs
        const address = parseInt(addressInput, 16); // Parse hexadecimal input
        const value = mode === 'write' && valueInput ? parseInt(valueInput, 16) : null;

        // Validate the address
        if (isNaN(address)) {
            alert("Invalid address. Please enter a valid hexadecimal address.");
            return;
        }

        // Validate the value (if in write mode)
        if (mode === 'write' && (isNaN(value) || value === null)) {
            alert("Invalid data. Please enter a valid hexadecimal value.");
            return;
        }

        // Send the access request to the server
        const response = await fetch('/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, value })
        });

        const result = await response.json();
        console.log("Access response:", result); // Debug log

        if (result.error) {
            console.error("Error in access response:", result.error);
            alert(result.error);
            return;
        }

        // Add the operation to history
        addToHistory(mode, address, value, result.status);

        // Highlight the affected cache cell and memory row
        if (result.last_set_index !== undefined && result.last_block_index !== undefined && result.byte_offset !== undefined) {
            highlightCacheCell(result.last_set_index, result.last_block_index, result.byte_offset);
        }
        if (result.physical_row_index !== undefined) {
            highlightRow("physicalMemoryTable", result.physical_row_index);
        }

        alert(`Operation: ${mode.toUpperCase()} completed. Status: ${result.status}`);
        await updateCacheContents();
        await updatePhysicalMemory();
        await updateStats();
    } catch (error) {
        console.error("Error accessing memory:", error); // Debug log
        alert("An error occurred while accessing memory.");
    }
}

async function updateCacheContents() {
    try {
        const response = await fetch('/cache_contents');
        const data = await response.json();

        console.log("Cache contents response:", data);

        if (data.error) {
            console.error("Cache contents error:", data.error);
            alert(data.error);
            return;
        }

        // Create table headers dynamically based on block size
        const blockSize = data.block_size;
        const headers = `
            <tr>
                <th>Set</th>
                <th>Block</th>
                <th>Valid</th>
                <th>Dirty</th>
                <th>Tag</th>
                ${Array.from({ length: blockSize }, (_, i) => `<th>Byte ${i + 1}</th>`).join('')}            </tr>
        `;

        const cacheTable = document.getElementById("cacheTable");
        cacheTable.innerHTML = headers;

// Populate table rows
        data.cache_contents.forEach((set, setIndex) => {
            set.forEach((block, blockIndex) => {
                const row = `
                    <tr>
                        <td>${setIndex}</td>
                        <td>${blockIndex}</td>
                        <td>${block.valid ? 'Yes' : 'No'}</td>
                        <td>${block.dirty ? 'Yes' : 'No'}</td>
                        <td>${block.tag !== null ? `0x${block.tag.toString(16).toUpperCase()}` : 'N/A'}</td>
                        ${block.data.map(byte => `<td>${byte !== null ? `0x${byte.toString(16).toUpperCase()}` : 'null'}</td>`).join('')}
                    </tr>
                `;
                cacheTable.innerHTML += row;
            });
        });
        applyCacheHighlight();
        } catch (error) {
        console.error("Error fetching cache contents:", error);
        }
}
async function updatePhysicalMemory() {
    try {
        const response = await fetch('/physical_memory');
        const data = await response.json();

        if (data.error) {
            console.error("Physical memory error:", data.error);
            alert(data.error);
            return;
        }

        const table = document.getElementById("physicalMemoryTable");
        const blockSize = data[0]?.data.length || 0;

        // Create table headers
        const headers = `
            <tr>
                <th>Address</th>
                ${Array.from({ length: blockSize }, (_, i) => `<th>Byte ${i + 1}</th>`).join('')}
            </tr>
        `;
        table.innerHTML = headers;

        // Populate table rows
        data.forEach(block => {
            const row = `
                <tr>
                    <td>${block.address !== null ? `0x${parseInt(block.address, 16).toString(16).toUpperCase()}` : 'N/A'}</td>
                    ${block.data.map(byte => `<td>${byte !== null ? `0x${byte.toString(16).toUpperCase()}` : 'null'}</td>`).join('')}
                    </tr>
            `;
            table.innerHTML += row;
        });
        applyRowHighlight("physicalMemoryTable");
    } catch (error) {
        console.error("Error fetching physical memory:", error);
        alert("An error occurred while fetching physical memory.");
    }
}

function addToHistory(operation, address, value = null, result) {
    console.log("addToHistory called with:", { operation, address, value, result });
    const historyBox = document.getElementById("historyBox");

    // Ensure the history box exists
    if (!historyBox) {
        console.error("History box element not found!");
        return;
    }

    // Format the operation log
    const operationText = `${operation.toUpperCase()} - Address: 0x${address.toString(16).padStart(2, '0')}, `
        + `${value !== null ? `Data: 0x${value.toString(16).padStart(2, '0')}, ` : ''}`
        + `Result: ${result.toUpperCase()}`;

    // Create a new entry
    const entry = document.createElement("div");
    entry.textContent = operationText;

    // Append the log to the history box
    historyBox.appendChild(entry);

    // Auto-scroll to the bottom of the history box
    historyBox.scrollTop = historyBox.scrollHeight;

    console.log("Added to history:", operationText);
}




let performanceChart;

function initializeChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Time or operation labels
            datasets: [
                {
                    label: 'Cache Hits',
                    borderColor: 'green',
                    data: [], // Hits data
                    fill: false,
                    tension: 0.4,
                },
                {
                    label: 'Cache Misses',
                    borderColor: 'red',
                    data: [], // Misses data
                    fill: false,
                    tension: 0.4,
                },
                {
                    label: 'AMAT',
                    borderColor: 'blue',
                    data: [], // AMAT data
                    fill: false,
                    tension: 0.4,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Operations',
                    },
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Metrics',
                    },
                },
            },
        },
    });
}

// Call this function in DOMContentLoaded
document.addEventListener("DOMContentLoaded", initializeChart);

let lastHighlightedCacheCell = { setIndex: null, blockIndex: null, byteOffset: null };
let lastHighlightedRowIndex = null;

function highlightCacheCell(setIndex, blockIndex, byteOffset) {
    const cacheTable = document.getElementById("cacheTable");
    if (!cacheTable) return;

    // Store the last highlighted cell
    lastHighlightedCacheCell = { setIndex, blockIndex, byteOffset };

    // Apply highlight after UI update
    requestAnimationFrame(() => applyCacheHighlight());
}

function applyCacheHighlight() {
    const { setIndex, blockIndex, byteOffset } = lastHighlightedCacheCell;
    const cacheTable = document.getElementById("cacheTable");

    if (!cacheTable || setIndex === null || blockIndex === null || byteOffset === null) return;

    const targetRow = cacheTable.rows[setIndex + 1]; // +1 to skip header row
    if (!targetRow) return;

    // Locate the specific cell for the block's byte offset
    const cellOffset = 5 + byteOffset; // 5 metadata columns before block data
    const targetCell = targetRow.cells[cellOffset];

    if (targetCell) {
        targetCell.classList.add("highlight-cache-cell");
    }
}

function highlightRow(tableId, rowIndex) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // Store the last highlighted row
    lastHighlightedRowIndex = rowIndex;

    // Apply highlight after UI update
    requestAnimationFrame(() => applyRowHighlight(tableId));
}

function applyRowHighlight(tableId) {
    const table = document.getElementById(tableId);
    if (!table || lastHighlightedRowIndex === null) return;

    const targetRow = table.rows[lastHighlightedRowIndex + 1]; // +1 to skip header row
    if (targetRow) {
        targetRow.classList.add("highlight-row");
    }
}
// Initialize explanation steps and the current step index
let explanationSteps = [];
let currentStep = 0;

function initializeExplanationSteps(params) {
    const { addressWidth, cacheSize, blockSize, associativity } = params;

    // Calculate relevant values
    const totalMemorySize = Math.pow(2, addressWidth);
    const offsetWidth = Math.log2(blockSize);
    const numSets = cacheSize / (blockSize * associativity);
    const indexWidth = Math.log2(numSets);
    const tagWidth = addressWidth - indexWidth - offsetWidth;

    // Define the explanation steps
    explanationSteps = [
        `Step 1: Address Width determines the size of physical memory.\n` +
        `With Address Width = 2^${addressWidth} bits, the memory holds ${totalMemorySize} bytes.`,

        `Step 2: Cache Size determines the total cache memory.\nCache Size = ${cacheSize} bytes.`,

        `Step 3: Block Size determines how many bytes are stored in each cache block.\n` +
        `Block Size = ${blockSize} bytes. Offset Width = log2(Block Size) = ${offsetWidth} bits.`,

        `Step 4: Associativity determines how many blocks fit in each set.\n` +
        `Associativity = ${associativity}. Number of Sets = Cache Size / (Block Size * Associativity) = ${numSets}.`,

        `Step 5: Index Width and Tag Width are calculated:\n` +
        `Index Width = log2(Number of Sets) = ${indexWidth} bits.\n` +
        `Tag Width = Address Width - Index Width - Offset Width = ${tagWidth} bits.`,

        "Step 6: Physical memory and cache table are initialized.\n" +
        "The cache table now consists of sets and blocks based on the calculated values."
    ];

    // Reset current step
    currentStep = 0;

    // Update UI for the first explanation step
    document.getElementById("explainText").innerText = explanationSteps[currentStep];
    document.getElementById("nextStepButton").disabled = false;
    document.getElementById("explainMessages").style.display = "block";

    console.log("Explanation steps initialized:", explanationSteps);
}

function showNextExplanationStep() {
    if (currentStep < explanationSteps.length - 1) {
        currentStep++;
        document.getElementById("explainText").innerText = explanationSteps[currentStep];
        console.log(`Showing step ${currentStep}:`, explanationSteps[currentStep]);
    } else {
        // Disable button and indicate completion
        document.getElementById("nextStepButton").disabled = true;
        document.getElementById("explainText").innerText = "Explanation complete!";
        console.log("Explanation complete.");
    }
}

function updateExplanationUI() {
    document.getElementById("explainText").innerText = explanationSteps[currentStep];
    document.getElementById("nextStepButton").disabled = currentStep >= explanationSteps.length - 1;
}

// Attach event listeners when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed.");

    const explainCheckbox = document.getElementById("explainCheckbox");
    const nextStepButton = document.getElementById("nextStepButton");

    if (explainCheckbox) {
        explainCheckbox.addEventListener("change", (event) => {
            const messagesDiv = document.getElementById("explainMessages");
            if (event.target.checked) {
                const addressWidth = parseInt(document.getElementById("addressWidth").value);
                const cacheSize = parseInt(document.getElementById("cacheSize").value);
                const blockSize = parseInt(document.getElementById("blockSize").value);
                const associativity = parseInt(document.getElementById("associativity").value);

                initializeExplanationSteps({ addressWidth, cacheSize, blockSize, associativity });
            } else {
                messagesDiv.style.display = "none";
                document.getElementById("nextStepButton").disabled = true;
            }
        });
    }

    if (nextStepButton) {
        nextStepButton.addEventListener("click", showNextExplanationStep);
    }

    console.log("Event listeners initialized for explanation checkbox and next button.");
});

async function processBatch() {
    try {
        const batchInput = document.getElementById("batchInput").value.trim();
        const batchResultDiv = document.getElementById("batchResult");

        if (!batchInput) {
            alert("Please enter operations for batch processing.");
            return;
        }

        // Parse user input into an array of operations
        const operations = batchInput.split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                type: parts[0].toUpperCase(), // READ or WRITE
                address: parts[1], // Keep as string, will be validated on the server
                value: parts[2] || null, // Optional value for WRITE, also kept as string
            };
        });

        // Send the batch request
        const response = await fetch('/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations })
        });

        const result = await response.json();

        if (result.error) {
            alert(result.error);
            return;
        }

        // Clear the batch result section
        batchResultDiv.innerHTML = '';

        // Process each operation in the batch
        for (const r of result.results) {
            const operation = r.operation.type;
            const address = parseInt(r.operation.address, 16); // Convert from hex
            const value = r.operation.value !== null
                ? parseInt(r.operation.value, 16) // Convert from hex
                : null;

            const status = r.result.status || r.result.error;

            // Add to the batch result display
            batchResultDiv.innerHTML += `
                Operation: ${operation} Address: 0x${address.toString(16).toUpperCase()} ${
                    value !== null ? `Data: 0x${value.toString(16).toUpperCase()}` : ''
                } Result: ${status}<br>
            `;

            // Add to history
            addToHistory(operation, address, value, status);

            // Highlight the affected cache cell and memory row for both READ and WRITE
            if (
                r.result.last_set_index !== undefined &&
                r.result.last_block_index !== undefined &&
                r.result.byte_offset !== undefined
            ) {
                highlightCacheCell(
                    r.result.last_set_index,
                    r.result.last_block_index,
                    r.result.byte_offset
                );
            }

            if (r.result.physical_row_index !== undefined) {
                highlightRow("physicalMemoryTable", r.result.physical_row_index);
            }

            // Add a slight delay between highlights for better visualization
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Update the cache and physical memory tables
        await updateStats();
        await updateCacheContents();
        await updatePhysicalMemory();
    } catch (error) {
        console.error("Error processing batch:", error);
        alert("An error occurred while processing the batch.");
    }
}
