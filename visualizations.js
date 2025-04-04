// Load and process the data
async function loadData() {
    try {
        console.log('Starting data loading...');
        const response = await fetch('data/processed_detailed_ev_charging_stations.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('CSV text loaded successfully, first 100 characters:', csvText.substring(0, 100));
        
        const data = d3.csvParse(csvText);
        console.log('Parsed data example:', data.slice(0, 2));
        console.log('Total data count:', data.length);
        console.log('Data fields:', Object.keys(data[0]));
        
        // Validate required fields
        const requiredFields = ['Cost (USD/kWh)', 'Usage Stats (avg users/day)', 'Is24Hours'];
        const missingFields = requiredFields.filter(field => !Object.keys(data[0]).includes(field));
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Log sample values
        console.log('Sample values for required fields:', data.slice(0, 2).map(d => ({
            cost: d['Cost (USD/kWh)'],
            usage: d['Usage Stats (avg users/day)'],
            is24Hours: d['Is24Hours']
        })));
        
        // Validate data values
        const invalidData = data.filter(d => {
            const cost = parseFloat(d['Cost (USD/kWh)']);
            const usage = parseFloat(d['Usage Stats (avg users/day)']);
            return isNaN(cost) || isNaN(usage) || cost <= 0 || usage < 0;
        });
        
        if (invalidData.length > 0) {
            console.log('Found invalid data points:', invalidData.slice(0, 2));
        }
        
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// D3 Map Visualization
async function createMap(data) {
    try {
        // Initialize map
        const map = L.map('map-viz').setView([39.8283, -98.5795], 4);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Initialize marker cluster group
        const markerClusterGroup = L.markerClusterGroup({
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let size = 40;
                if (count > 100) size = 60;
                else if (count > 50) size = 50;
                
                return L.divIcon({
                    html: `<div style="width:${size}px;height:${size}px;line-height:${size}px;">${count}</div>`,
                    className: 'cluster-icon',
                    iconSize: L.point(size, size)
                });
            },
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
            animate: true
        });

        // Create markers for each charging station
        data.forEach(d => {
            const color = {
                'L1': '#FF6B6B',  
                'L2': '#4ECDC4',  
                'DC': '#45B7D1'   
            }[d['Charger Type']] || '#999';

            const marker = L.circleMarker([+d.Latitude, +d.Longitude], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });

                    const rating = d['Reviews (Rating)'] ? 
                        `${parseFloat(d['Reviews (Rating)']).toFixed(1)} stars` : 
                        'No rating';
                    
                    const cost = d['Cost (USD/kWh)'] ? 
                        `$${parseFloat(d['Cost (USD/kWh)']).toFixed(2)}/kWh` : 
                        'Not available';

            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 10px 0;">${d['Charger Type']} Charging Station</h3>
                    <p style="margin: 5px 0;"><strong>Address:</strong> ${d.Address}</p>
                    <p style="margin: 5px 0;"><strong>Rating:</strong> ${rating}</p>
                    <p style="margin: 5px 0;"><strong>Cost:</strong> ${cost}</p>
                    <p style="margin: 5px 0;"><strong>Hours:</strong> ${d.Is24Hours === 'True' ? '24/7' : 'Limited'}</p>
                    <p style="margin: 5px 0;"><strong>Power:</strong> ${d.IsHighPower === 'True' ? 'High Power' : 'Standard'}</p>
                        </div>
                    `);

            markerClusterGroup.addLayer(marker);
        });

        // Add marker cluster group to map
        map.addLayer(markerClusterGroup);

        // Add station count
        const countInfo = document.createElement('div');
        countInfo.style.position = 'absolute';
        countInfo.style.bottom = '20px';
        countInfo.style.left = '20px';
        countInfo.style.backgroundColor = 'white';
        countInfo.style.padding = '10px';
        countInfo.style.borderRadius = '4px';
        countInfo.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        countInfo.style.zIndex = 1000;
        countInfo.innerHTML = `Showing ${data.length} charging stations`;
        countInfo.className = 'station-count-info';
        document.getElementById('map-viz').appendChild(countInfo);
        
    } catch (error) {
        console.error('Error creating map:', error);
        document.getElementById('map-viz').innerHTML = 
            `<p class="error">Error creating map: ${error.message}</p>`;
    }
}

// Load trend chart
async function loadTrendChart() {
    try {
        const data = await loadData();
        
        // create filter container
        const container = document.getElementById('trend-viz');
        const filterContainer = document.createElement('div');
        filterContainer.style.marginBottom = '20px';
        filterContainer.style.display = 'flex';
        filterContainer.style.alignItems = 'center';
        filterContainer.style.gap = '10px';
        container.appendChild(filterContainer);

        // add availability filter
        const availabilityLabel = document.createElement('label');
        availabilityLabel.textContent = 'Availability: ';
        availabilityLabel.style.fontSize = '14px';
        availabilityLabel.style.color = '#555';

        const availabilitySelect = document.createElement('select');
        availabilitySelect.style.padding = '5px 10px';
        availabilitySelect.style.borderRadius = '4px';
        availabilitySelect.style.border = '1px solid #ddd';
        
        const options = [
            { value: 'all', text: 'All Hours' },
            { value: '24/7', text: '24/7 Only' },
            { value: 'limited', text: 'Limited Hours' }
        ];
        
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            availabilitySelect.appendChild(opt);
        });

        filterContainer.appendChild(availabilityLabel);
        filterContainer.appendChild(availabilitySelect);

        // update chart function
        function updateChart(selectedAvailability) {
            // filter data based on selection
            const filteredData = data.filter(d => {
                if (selectedAvailability === 'all') return true;
                if (selectedAvailability === '24/7') return d['Is24Hours'] === 'True';
                if (selectedAvailability === 'limited') return d['Is24Hours'] === 'False';
                return true;
            });
            
            // prepare data: aggregate by year and charger type
            const yearlyData = d3.rollup(filteredData,
                v => v.length,
                d => d['Installation Year'],
                d => d['Charger Type']
            );
            
            // get all years and types
            const years = Array.from(yearlyData.keys()).filter(year => 
                year && year >= 2010 && year <= 2024
            ).sort();
            const types = ['L1', 'L2', 'DC'];
            
            // convert to D3 format
            const trendData = [];
            years.forEach(year => {
                types.forEach(type => {
                    trendData.push({
                        year: +year,
                        type: type,
                        count: yearlyData.get(year)?.get(type) || 0
                    });
                });
            });

            // clear previous chart
            d3.select('#trend-viz').selectAll('svg').remove();

            // set container size
            const margin = { top: 40, right: 120, bottom: 100, left: 70 };
            const width = container.clientWidth - margin.left - margin.right;
            const height = 450 - margin.top - margin.bottom;

            // create SVG
            const svg = d3.select('#trend-viz')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // create scales
            const x = d3.scaleLinear()
                .domain([2010, 2024])
                .range([0, width]);

            const y = d3.scaleLinear()
                .domain([10, d3.max(trendData, d => d.count)])
                .range([height, 0]);

            const color = d3.scaleOrdinal()
                .domain(types)
                .range(['#91bad6', '#528AAE', '#1E3f66']);

            // create line generator
            const line = d3.line()
                .x(d => x(d.year))
                .y(d => y(d.count))
                .curve(d3.curveMonotoneX);

            // add X axis
            svg.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(x)
                    .ticks(15)
                    .tickFormat(d3.format('d')))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .clone()
                    .attr('y2', -height)
                    .attr('stroke-opacity', 0.1));

            // add X axis label
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height + 35)
                .attr('text-anchor', 'middle')
                .attr('fill', '#666')
                .style('font-size', '14px')
                .text('Installation Year');

            // add annotations
            const annotations = [
                { year: 2012, text: 'Tesla Model S Launch', y: 15 },
                { year: 2015, text: 'Paris Agreement', y: 20 },
                { year: 2018, text: 'EV Tax Credit Extension', y: 25 },
                { year: 2020, text: 'COVID-19 Impact', y: 30 },
                { year: 2022, text: 'Inflation Reduction Act', y: 35 }
            ];

            // add annotations
            annotations.forEach(anno => {
                svg.append('line')
                    .attr('x1', x(anno.year))
                    .attr('y1', y(anno.y))
                    .attr('x2', x(anno.year))
                    .attr('y2', height)
                    .attr('stroke', '#ddd')
                    .attr('stroke-dasharray', '4,4')
                    .attr('opacity', 0.5);

                svg.append('text')
                    .attr('x', x(anno.year))
                    .attr('y', y(anno.y) - 5)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '10px')
                    .attr('fill', '#666')
                    .text(anno.text);
            });

            // add Y axis
            svg.append('g')
                .call(d3.axisLeft(y)
                    .ticks(5))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .clone()
                    .attr('x2', width)
                    .attr('stroke-opacity', 0.1));

            // add Y axis label
            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -50)
                .attr('x', -height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#666')
                .style('font-size', '14px')
                .text('Number of Installations');

            // add lines and points for each type
            types.forEach(type => {
                const typeData = trendData.filter(d => d.type === type);
                
                // add lines
                svg.append('path')
                    .datum(typeData)
                    .attr('class', `line-${type}`)
                    .attr('fill', 'none')
                    .attr('stroke', color(type))
                    .attr('stroke-width', 2.5)
                    .attr('d', line)
                    .style('opacity', 0.8);

                // add points
                svg.selectAll(`.dot-${type}`)
                    .data(typeData)
                    .join('circle')
                    .attr('class', `dot-${type}`)
                    .attr('cx', d => x(d.year))
                    .attr('cy', d => y(d.count))
                    .attr('r', 4)
                    .attr('fill', color(type))
                    .style('opacity', 0.8);
            });

            // add legend
            const legend = svg.append('g')
                .attr('transform', `translate(${width + 20}, 10)`);

            legend.append('text')
                .attr('x', 0)
                .attr('y', -5)
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .text('Charger Types');

            types.forEach((type, i) => {
                const g = legend.append('g')
                    .attr('transform', `translate(0,${i * 25 + 15})`);

                g.append('circle')
                    .attr('r', 6)
                    .attr('fill', color(type));

                g.append('text')
                    .attr('x', 15)
                    .attr('y', 4)
                    .text(type)
                    .style('font-size', '12px');
            });
        }

        // add filter change event listener
        availabilitySelect.addEventListener('change', (event) => {
            updateChart(event.target.value);
        });

        // initialize chart
        updateChart('all');
        
    } catch (error) {
        console.error('Error loading trend chart:', error);
        document.getElementById('trend-viz').innerHTML = 
            `<p class="error">Error loading trend chart: ${error.message}</p>`;
    }
}

// Create heatmap
async function createHeatmap() {
    try {
        const response = await fetch('heatmap_spec.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const spec = await response.json();
        
        await vegaEmbed('#heatmap-viz', spec, {
            actions: false,  
            renderer: 'svg' 
        });
        
    } catch (error) {
        console.error('Error creating heatmap:', error);
        document.getElementById('heatmap-viz').innerHTML = 
            `<p class="error">Error creating heatmap: ${error.message}</p>`;
    }
}

function createTypeUsageChart(data) {
    try {
        console.log('Starting charger type vs usage chart creation...');
        
        const container = document.getElementById('type-usage-viz');
        if (!container) {
            throw new Error('Container element not found');
        }
        
        container.style.minHeight = '400px';
        container.style.width = '100%';

        // Add filter container
        const filterContainer = document.createElement('div');
        filterContainer.style.marginBottom = '20px';
        filterContainer.style.display = 'flex';
        filterContainer.style.gap = '20px';
        filterContainer.style.flexWrap = 'wrap';
        filterContainer.style.alignItems = 'center';
        container.appendChild(filterContainer);

        // Add type filter
        const typeFilterLabel = document.createElement('label');
        typeFilterLabel.textContent = 'Charger Type: ';
        typeFilterLabel.style.fontSize = '14px';
        typeFilterLabel.style.color = '#555';
        
        const typeFilter = document.createElement('select');
        typeFilter.style.padding = '5px 10px';
        typeFilter.style.borderRadius = '4px';
        typeFilter.style.border = '1px solid #ddd';
        
        const typeOptions = [
            { value: 'all', text: 'All Types' },
            { value: 'L1', text: 'L1 Only' },
            { value: 'L2', text: 'L2 Only' },
            { value: 'DC', text: 'DC Only' }
        ];

        // Add power level filter
        const powerFilterLabel = document.createElement('label');
        powerFilterLabel.textContent = 'Power Level: ';
        powerFilterLabel.style.fontSize = '14px';
        powerFilterLabel.style.color = '#555';
        
        const powerFilter = document.createElement('select');
        powerFilter.style.padding = '5px 10px';
        powerFilter.style.borderRadius = '4px';
        powerFilter.style.border = '1px solid #ddd';
        
        const powerOptions = [
            { value: 'all', text: 'All Power Levels' },
            { value: 'high', text: 'High Power' },
            { value: 'standard', text: 'Standard Power' }
        ];

        // Add cost range filter
        const costFilterLabel = document.createElement('label');
        costFilterLabel.textContent = 'Cost Range: ';
        costFilterLabel.style.fontSize = '14px';
        costFilterLabel.style.color = '#555';
        
        const costFilter = document.createElement('select');
        costFilter.style.padding = '5px 10px';
        costFilter.style.borderRadius = '4px';
        costFilter.style.border = '1px solid #ddd';
        
        const costOptions = [
            { value: 'all', text: 'All Cost Ranges' },
            { value: 'low', text: 'Low (< $0.15/kWh)' },
            { value: 'medium', text: 'Medium ($0.15-0.30/kWh)' },
            { value: 'high', text: 'High (> $0.30/kWh)' }
        ];

        // Add renewable energy filter
        const renewableFilterLabel = document.createElement('label');
        renewableFilterLabel.textContent = 'Renewable Energy: ';
        renewableFilterLabel.style.fontSize = '14px';
        renewableFilterLabel.style.color = '#555';
        
        const renewableFilter = document.createElement('select');
        renewableFilter.style.padding = '5px 10px';
        renewableFilter.style.borderRadius = '4px';
        renewableFilter.style.border = '1px solid #ddd';
        
        const renewableOptions = [
            { value: 'all', text: 'All Sources' },
            { value: 'yes', text: 'Renewable Only' },
            { value: 'no', text: 'Non-Renewable Only' }
        ];

        // Add usage range filter
        const rangeFilterLabel = document.createElement('label');
        rangeFilterLabel.textContent = 'Usage Range: ';
        rangeFilterLabel.style.fontSize = '14px';
        rangeFilterLabel.style.color = '#555';
        
        const rangeFilter = document.createElement('select');
        rangeFilter.style.padding = '5px 10px';
        rangeFilter.style.borderRadius = '4px';
        rangeFilter.style.border = '1px solid #ddd';
        
        const rangeOptions = [
            { value: 'all', text: 'All Usage' },
            { value: 'low', text: 'Low (≤ 10)' },
            { value: 'medium', text: 'Medium (11-20)' },
            { value: 'high', text: 'High (> 20)' }
        ];

        // Add options to filters
        [typeOptions, powerOptions, costOptions, renewableOptions, rangeOptions].forEach((options, index) => {
            const filter = [typeFilter, powerFilter, costFilter, renewableFilter, rangeFilter][index];
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.text;
                filter.appendChild(opt);
            });
        });

        // Add filters to container
        [
            [typeFilterLabel, typeFilter],
            [powerFilterLabel, powerFilter],
            [costFilterLabel, costFilter],
            [renewableFilterLabel, renewableFilter],
            [rangeFilterLabel, rangeFilter]
        ].forEach(([label, filter]) => {
            const filterGroup = document.createElement('div');
            filterGroup.style.display = 'flex';
            filterGroup.style.flexDirection = 'column';
            filterGroup.style.gap = '5px';
            filterGroup.appendChild(label);
            filterGroup.appendChild(filter);
            filterContainer.appendChild(filterGroup);
        });
        
        // Data processing function
        function processData() {
            const selectedType = typeFilter.value;
            const selectedPower = powerFilter.value;
            const selectedCost = costFilter.value;
            const selectedRenewable = renewableFilter.value;
            const selectedRange = rangeFilter.value;
            
            return data
                .map(d => ({
                    charger_type: d['Charger Type'],
                    usage: parseFloat(d['Usage Stats (avg users/day)']),
                    is_high_power: d['IsHighPower'] === 'True',
                    cost: parseFloat(d['Cost (USD/kWh)']),
                    renewable: d['Renewable Energy Source'],
                    hours: d['Is24Hours'] === 'True' ? '24/7' : 'Limited'
                }))
                .filter(d => {
                    if (isNaN(d.usage) || d.usage < 0) return false;
                    
                    if (selectedType !== 'all' && d.charger_type !== selectedType) return false;
                    
                    if (selectedPower !== 'all') {
                        if (selectedPower === 'high' && !d.is_high_power) return false;
                        if (selectedPower === 'standard' && d.is_high_power) return false;
                    }

                    if (selectedCost !== 'all') {
                        if (selectedCost === 'low' && d.cost >= 0.15) return false;
                        if (selectedCost === 'medium' && (d.cost < 0.15 || d.cost > 0.30)) return false;
                        if (selectedCost === 'high' && d.cost <= 0.30) return false;
                    }

                    if (selectedRenewable !== 'all') {
                        if (selectedRenewable === 'yes' && d.renewable !== 'Yes') return false;
                        if (selectedRenewable === 'no' && d.renewable === 'Yes') return false;
                    }
                    
                    switch (selectedRange) {
                        case 'low':
                            return d.usage <= 10;
                        case 'medium':
                            return d.usage > 10 && d.usage <= 20;
                        case 'high':
                            return d.usage > 20;
                        default: // 'all'
                            return true;
                    }
                });
        }

        // Update chart function
        function updateChart() {
            const processedData = processData();
            
            // even if there is no data, create chart
            const spec = {
                $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                data: { values: processedData },
                width: container.clientWidth - 100,
                height: 600,  
                mark: {
                    type: 'bar',
                    cornerRadius: 4,
                    tooltip: true
                },
                encoding: {
                    x: {
                        field: 'charger_type',
                        type: 'nominal',
                        title: 'Charger Type',
                        sort: ['L1', 'L2', 'DC'],
                        axis: {
                            labelFontSize: 12,
                            titleFontSize: 14,
                            labelPadding: 10,
                            titlePadding: 15
                        }
                    },
                    y: {
                        aggregate: 'mean',
                        field: 'usage',
                        type: 'quantitative',
                        title: 'Average Daily Usage',
                        scale: {
                            domain: [0, 60],
                            nice: true
                        },
                        axis: {
                            grid: true,
                            labelFontSize: 12,
                            titleFontSize: 14,
                            labelPadding: 10,
                            titlePadding: 15,
                            gridColor: '#f0f0f0',
                            labelColor: '#666',
                            titleColor: '#333'
                        }
                    },
                    color: {
                        field: 'charger_type',
                        type: 'nominal',
                        scale: {
                            domain: ['L1', 'L2', 'DC'],
                            range: ['#91bad6', '#528AAE', '#1E3f66']
                        },
                        legend: null
                    },
                    tooltip: [
                        {field: 'charger_type', title: 'Type'},
                        {aggregate: 'mean', field: 'usage', title: 'Avg Daily Usage', format: '.1f'},
                        {aggregate: 'count', title: 'Number of Stations'}
                    ]
                },
                config: {
                    view: { stroke: 'transparent' },
                    axis: {
                        domainColor: '#ddd',
                        tickColor: '#ddd'
                    },
                    style: {
                        "guide-label": {
                            fontSize: 12,
                            fill: '#555'
                        },
                        "guide-title": {
                            fontSize: 14,
                            fill: '#333'
                        }
                    }
                }
            };

            // Clear previous chart
            const chartContainer = document.createElement('div');
            chartContainer.id = 'type-usage-chart';
            container.appendChild(chartContainer);

            // Embed chart
            vegaEmbed('#type-usage-chart', spec, {
                mode: 'vega-lite',
                actions: false,
                theme: 'light',
                renderer: 'svg'
            }).then(result => {
                // only show stats info when there is data
                if (processedData.length > 0) {
                    const stats = d3.rollup(processedData,
                        v => ({
                            mean: d3.mean(v.map(d => d.usage)),
                            median: d3.median(v.map(d => d.usage)),
                            count: v.length
                        }),
                        d => d.charger_type
                    );

                    // Add statistics information
                    const statsDiv = document.createElement('div');
                    statsDiv.className = 'stats-info';
                    statsDiv.style.marginTop = '20px';
                    statsDiv.style.padding = '15px';
                    statsDiv.style.backgroundColor = '#f8f9fa';
                    statsDiv.style.borderRadius = '8px';
                    statsDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    statsDiv.style.fontFamily = 'Arial, sans-serif';
                    
                    statsDiv.innerHTML = '<h4 style="margin-top: 0; color: #333; font-size: 16px;">Usage Statistics</h4>' +
                        Array.from(stats.entries()).map(([type, stat]) => 
                            `<div style="margin-bottom: 8px; color: #555; font-size: 14px;">
                                <strong>${type} Chargers</strong>: 
                                Average ${stat.mean.toFixed(1)} uses/day, 
                                Median ${stat.median.toFixed(1)} uses/day, 
                                Sample size ${stat.count}
                            </div>`
                        ).join('');
                    
                    container.appendChild(statsDiv);
                }
            });
        }

        // Add event listeners to all filters
        [typeFilter, powerFilter, costFilter, renewableFilter, rangeFilter].forEach(filter => {
            filter.addEventListener('change', () => {
                container.innerHTML = '';
                container.appendChild(filterContainer);
                updateChart();
            });
        });

        // Initial chart creation
        updateChart();

    } catch (error) {
        console.error('Error creating charger type vs usage chart:', error);
        document.getElementById('type-usage-viz').innerHTML = 
            `<p class="error">Error creating chart: ${error.message}</p>`;
    }
}

// Create Cost vs Rating Chart
function createCostRatingChart(data) {
    try {
        console.log('Starting cost vs rating chart creation...');
        
        const container = document.getElementById('cost-rating-viz');
        if (!container) {
            throw new Error('Container element not found');
        }
        
        container.style.minHeight = '400px';
        container.style.width = '100%';

        // Add filter container
        const filterContainer = document.createElement('div');
        filterContainer.style.marginBottom = '20px';
        filterContainer.style.display = 'flex';
        filterContainer.style.gap = '20px';
        filterContainer.style.alignItems = 'center';
        container.appendChild(filterContainer);

        // Add type filter
        const typeFilterLabel = document.createElement('label');
        typeFilterLabel.textContent = 'Charger Type: ';
        typeFilterLabel.style.fontSize = '14px';
        typeFilterLabel.style.color = '#555';
        
        const typeFilter = document.createElement('select');
        typeFilter.style.padding = '5px 10px';
        typeFilter.style.borderRadius = '4px';
        typeFilter.style.border = '1px solid #ddd';
        
        const typeOptions = [
            { value: 'all', text: 'All Types' },
            { value: 'L1', text: 'L1 Only' },
            { value: 'L2', text: 'L2 Only' },
            { value: 'DC', text: 'DC Only' }
        ];
        
        typeOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            typeFilter.appendChild(opt);
        });

        // Add availability filter
        const availabilityFilterLabel = document.createElement('label');
        availabilityFilterLabel.textContent = 'Availability: ';
        availabilityFilterLabel.style.fontSize = '14px';
        availabilityFilterLabel.style.color = '#555';
        
        const availabilityFilter = document.createElement('select');
        availabilityFilter.style.padding = '5px 10px';
        availabilityFilter.style.borderRadius = '4px';
        availabilityFilter.style.border = '1px solid #ddd';
        
        const availabilityOptions = [
            { value: 'all', text: 'All Hours' },
            { value: '24h', text: '24/7 Only' },
            { value: 'limited', text: 'Limited Hours' }
        ];
        
        availabilityOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            availabilityFilter.appendChild(opt);
        });

        // Add filters to container
        filterContainer.appendChild(typeFilterLabel);
        filterContainer.appendChild(typeFilter);
        filterContainer.appendChild(availabilityFilterLabel);
        filterContainer.appendChild(availabilityFilter);
        
        // Data processing function
        function processData() {
            const selectedType = typeFilter.value;
            const selectedAvailability = availabilityFilter.value;
            
            return data
                .map(d => ({
                    charger_type: d['Charger Type'],
                    cost: parseFloat(d['Cost (USD/kWh)']),
                    rating: parseFloat(d['Reviews (Rating)']),
                    is24Hours: d['Is24Hours'] === 'True'
                }))
                .filter(d => {
                    if (isNaN(d.cost) || isNaN(d.rating) || d.cost <= 0 || d.rating < 0) return false;
                    
                    if (selectedType !== 'all' && d.charger_type !== selectedType) return false;
                    
                    if (selectedAvailability === '24h' && !d.is24Hours) return false;
                    if (selectedAvailability === 'limited' && d.is24Hours) return false;
                    
                    return true;
                });
        }

        // Update chart function
        function updateChart() {
            const processedData = processData();
            
            if (processedData.length === 0) {
                container.innerHTML = '<p class="error">No data available for selected filters</p>';
                return;
            }

            const spec = {
                $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                data: { values: processedData },
                width: 950,  
                height: 400,
                layer: [
                    {
            mark: {
                            type: 'point',
                    filled: true,
                            opacity: 0.8,
                            size: 80
            },
            encoding: {
                x: {
                                field: 'cost',
                    type: 'quantitative',
                                title: 'Cost (USD/kWh)',
                                scale: {
                                    type: 'linear',
                                    domain: [0, 0.6],
                                    nice: true
                                },
                    axis: { 
                        grid: true, 
                                    labelFontSize: 12,
                                    titleFontSize: 14,
                                    labelPadding: 10,
                                    titlePadding: 15,
                                    gridColor: '#f0f0f0'
                    }
                },
                y: {
                                field: 'rating',
                    type: 'quantitative',
                                title: 'User Rating',
                                scale: {
                                    domain: [2.5, 5],
                                    nice: true
                                },
                    axis: { 
                        grid: true,
                                    labelFontSize: 12,
                                    titleFontSize: 14,
                                    labelPadding: 10,
                                    titlePadding: 15,
                        gridColor: '#f0f0f0'
                    }
                },
                color: {
                                field: 'charger_type',
                    type: 'nominal',
                    title: 'Charger Type',
                    scale: {
                        domain: ['L1', 'L2', 'DC'],
                        range: ['#91bad6', '#528AAE', '#1E3f66']
                    }
                },
                tooltip: [
                    {field: 'charger_type', title: 'Type'},
                    {field: 'cost', title: 'Cost (USD/kWh)', format: '.2f'},
                    {field: 'rating', title: 'Rating', format: '.1f'},
                    {field: 'is24Hours', title: 'Available 24/7'}
                ]
            }
        },
                    {
                        transform: [{
                            regression: 'rating',
                            on: 'cost',
                            method: 'log'
                        }],
                        mark: {
                            type: 'line',
                            color: '#666',
                            strokeDash: [6, 4],
                            opacity: 0.8,
                            size: 2
                        },
                        encoding: {
                            x: {field: 'cost', type: 'quantitative'},
                            y: {field: 'rating', type: 'quantitative'}
                        }
                    }
                ],
            config: {
                    view: { stroke: 'transparent' },
                axis: {
                        domainColor: '#ddd',
                        tickColor: '#ddd'
                    }
                }
            };

            // Clear previous chart
            const chartContainer = document.createElement('div');
            chartContainer.id = 'cost-rating-chart';
            container.appendChild(chartContainer);

            // Embed chart
            vegaEmbed('#cost-rating-chart', spec, {
            mode: 'vega-lite',
                actions: false,
            theme: 'light',
            renderer: 'svg'
            }).then(result => {
                // Calculate and display statistics
                const stats = d3.rollup(processedData,
                    v => ({
                        meanCost: d3.mean(v.map(d => d.cost)),
                        meanRating: d3.mean(v.map(d => d.rating)),
                        correlation: d3.correlation(v.map(d => d.cost), v.map(d => d.rating)),
                        count: v.length
                    }),
                    d => d.charger_type
                );

                // Add statistics information
                const statsDiv = document.createElement('div');
                statsDiv.className = 'stats-info';
                statsDiv.style.marginTop = '20px';
                statsDiv.style.padding = '15px';
                statsDiv.style.backgroundColor = '#f8f9fa';
                statsDiv.style.borderRadius = '8px';
                statsDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                statsDiv.style.fontFamily = 'Arial, sans-serif';
                
                statsDiv.innerHTML = '<h4 style="margin-top: 0; color: #333; font-size: 16px;">Cost-Rating Statistics</h4>' +
                    Array.from(stats.entries()).map(([type, stat]) => 
                        `<div style="margin-bottom: 8px; color: #555; font-size: 14px;">
                            <strong>${type} Chargers</strong>: 
                            Average Cost $${stat.meanCost.toFixed(2)}/kWh, 
                            Average Rating ${stat.meanRating.toFixed(1)}, 
                            Correlation ${(stat.correlation || 0).toFixed(2)},
                            Sample size ${stat.count}
                        </div>`
                    ).join('');
                
                container.appendChild(statsDiv);
            });
        }

        // Add event listeners to filters
        typeFilter.addEventListener('change', () => {
            // Clear previous chart and stats
            container.innerHTML = '';
            container.appendChild(filterContainer);
            updateChart();
        });

        availabilityFilter.addEventListener('change', () => {
            // Clear previous chart and stats
            container.innerHTML = '';
            container.appendChild(filterContainer);
            updateChart();
        });

        // Initial chart creation
        updateChart();

    } catch (error) {
        console.error('Error creating cost vs rating chart:', error);
        document.getElementById('cost-rating-viz').innerHTML = 
            `<p class="error">Error creating chart: ${error.message}</p>`;
    }
}

// Create boxplot comparison
function createBoxplotComparison(data) {
    try {
        console.log('Starting boxplot comparison creation...');
        
        const container = document.getElementById('boxplot-viz');
        if (!container) {
            throw new Error('Container element not found');
        }
        
        container.style.minHeight = '600px';
        container.style.width = '100%';

        // add feature selector
        const filterContainer = document.createElement('div');
        filterContainer.style.marginBottom = '20px';
        filterContainer.style.display = 'flex';
        filterContainer.style.gap = '20px';
        filterContainer.style.alignItems = 'center';
        container.appendChild(filterContainer);

        const featureLabel = document.createElement('label');
        featureLabel.textContent = 'Compare by: ';
        featureLabel.style.fontSize = '14px';
        featureLabel.style.color = '#555';
        
        const featureSelect = document.createElement('select');
        featureSelect.style.padding = '5px 10px';
        featureSelect.style.borderRadius = '4px';
        featureSelect.style.border = '1px solid #ddd';
        
        const features = [
            { value: 'rating', text: 'User Rating', field: 'Reviews (Rating)' },
            { value: 'usage', text: 'Daily Users', field: 'Usage Stats (avg users/day)' },
            { value: 'capacity', text: 'Charging Capacity', field: 'Charging Capacity (kW)' },
            { 
                value: 'maintenance', 
                text: 'Maintenance Score', 
                field: 'Maintenance Frequency',
                transform: (value) => {
                    // convert maintenance frequency to numerical score
                    const scores = {
                        'Monthly': 3,
                        'Quarterly': 2,
                        'Annually': 1
                    };
                    return scores[value] || 0;
                }
            }
        ];
        
        features.forEach(feature => {
            const opt = document.createElement('option');
            opt.value = feature.value;
            opt.textContent = feature.text;
            featureSelect.appendChild(opt);
        });

        filterContainer.appendChild(featureLabel);
        filterContainer.appendChild(featureSelect);

        // update chart function
        function updateChart(selectedFeature) {
            const feature = features.find(f => f.value === selectedFeature);
            
            // prepare data
            const processedData = data
                .map(d => ({
                    type: d['Charger Type'],
                    value: feature.transform ? 
                        feature.transform(d[feature.field]) : 
                        parseFloat(d[feature.field]),
                    costRange: d['Cost_Range'],
                    operator: d['Station Operator'],
                    renewable: d['Renewable Energy Source'],
                    connectors: d['Connector Types']
                }))
                .filter(d => !isNaN(d.value));

            const spec = {
                $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                data: { values: processedData },
                width: 950,
                height: 500,
                mark: {
                    type: 'boxplot',
                    extent: 1.5
                },
                encoding: {
                    x: {
                        field: 'type',
                        type: 'nominal',
                        title: 'Charger Type',
                        axis: {
                            labelAngle: 0,
                            labelFontSize: 12,
                            titleFontSize: 14
                        }
                    },
                    y: {
                        field: 'value',
                        type: 'quantitative',
                        title: feature.text,
                        scale: { zero: false },
                        axis: {
                            labelFontSize: 12,
                            titleFontSize: 14
                        }
                    },
                    color: {
                        field: 'type',
                        type: 'nominal',
                        scale: {
                            domain: ['L1', 'L2', 'DC'],
                            range: ['#91bad6', '#528AAE', '#1E3f66']
                        },
                        title: 'Charger Type'
                    },
                    column: {
                        field: 'costRange',
                        type: 'nominal',
                        title: 'Cost Range (USD/kWh)',
                        header: {
                            labelAngle: -45,
                            labelAlign: 'right',
                            labelFontSize: 11,
                            labels: true,
                            labelExpr: "datum.value == 'undefined' ? '' : datum.value"
                        }
                    }
                },
                config: {
                    boxplot: {
                        median: { color: 'white' },
                        ticks: true
                    },
                    view: { stroke: null }
                }
            };

            // clear previous chart
            container.innerHTML = '';
            container.appendChild(filterContainer);

            // create new chart container
            const chartContainer = document.createElement('div');
            chartContainer.id = 'boxplot-chart';
            container.appendChild(chartContainer);

            // render chart
            vegaEmbed('#boxplot-chart', spec, {
                actions: false,
                theme: 'light'
            }).then(result => {
                // calculate stats info
                const stats = d3.rollup(processedData,
                    v => ({
                        mean: d3.mean(v.map(d => d.value)),
                        median: d3.median(v.map(d => d.value)),
                        q1: d3.quantile(v.map(d => d.value).sort(d3.ascending), 0.25),
                        q3: d3.quantile(v.map(d => d.value).sort(d3.ascending), 0.75),
                        count: v.length
                    }),
                    d => d.type,
                    d => d.costRange
                );

                // add stats info
                const statsDiv = document.createElement('div');
                statsDiv.className = 'stats-info';
                statsDiv.style.marginTop = '20px';
                statsDiv.style.padding = '15px';
                statsDiv.style.backgroundColor = '#f8f9fa';
                statsDiv.style.borderRadius = '8px';
                statsDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                
                let statsHtml = `<h4 style="margin-top: 0; color: #333; font-size: 16px;">Statistics for ${feature.text}</h4>`;
                
                for (const [type, costRanges] of stats.entries()) {
                    statsHtml += `<div style="margin-top: 10px;"><strong>${type} Chargers:</strong></div>`;
                    for (const [costRange, stat] of costRanges.entries()) {
                        statsHtml += `
                            <div style="margin-left: 20px; margin-bottom: 8px; color: #555; font-size: 14px;">
                                <strong>${costRange}:</strong>
                                Mean: ${stat.mean.toFixed(2)},
                                Median: ${stat.median.toFixed(2)},
                                Q1: ${stat.q1.toFixed(2)},
                                Q3: ${stat.q3.toFixed(2)},
                                Count: ${stat.count}
                            </div>`;
                    }
                }
                
                statsDiv.innerHTML = statsHtml;
                container.appendChild(statsDiv);
            });
        }

        // add selector event listener
        featureSelect.addEventListener('change', (event) => {
            updateChart(event.target.value);
        });

        // initialize chart
        updateChart('rating');
        
    } catch (error) {
        console.error('Error creating boxplot comparison:', error);
        document.getElementById('boxplot-viz').innerHTML = 
            `<p class="error">Error creating boxplot comparison: ${error.message}</p>`;
    }
}

// Create operator analysis
function createOperatorAnalysis(data) {
    try {
        console.log('Starting operator analysis creation...');
        
        const container = document.getElementById('operator-viz');
        if (!container) {
            throw new Error('Container element not found');
        }
        
        container.style.minHeight = '600px';
        container.style.width = '100%';

        // prepare data
        const processedData = data
            .map(d => ({
                operator: d['Station Operator'],
                rating: parseFloat(d['Reviews (Rating)']),
                usage: parseFloat(d['Usage Stats (avg users/day)']),
                renewable: d['Renewable Energy Source'],
                chargerType: d['Charger Type'],
                capacity: parseFloat(d['Charging Capacity (kW)'])
            }))
            .filter(d => !isNaN(d.rating) && !isNaN(d.usage) && !isNaN(d.capacity));

        // create operator analysis chart
        const spec = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            data: { values: processedData },
            vconcat: [
                {
                    width: 800,
                    height: 300,
                    mark: { type: 'bar', tooltip: true },
                    encoding: {
                        x: {
                            field: 'operator',
                            type: 'nominal',
                            title: 'Station Operator',
                            axis: {
                                labelAngle: -45,
                                labelFontSize: 12,
                                titleFontSize: 14
                            }
                        },
                        y: {
                            aggregate: 'mean',
                            field: 'rating',
                            type: 'quantitative',
                            title: 'Average Rating',
                            scale: { domain: [0, 5] }
                        },
                        color: {
                            field: 'renewable',
                            type: 'nominal',
                            title: 'Renewable Energy',
                            scale: {
                                domain: ['Yes', 'No'],
                                range: ['#2ecc71', '#e74c3c']
                            }
                        }
                    },
                    title: 'Average Rating by Operator and Renewable Energy Usage'
                },
                {
                    width: 800,
                    height: 300,
                    mark: { type: 'bar', tooltip: true },
                    encoding: {
                        x: {
                            field: 'operator',
                            type: 'nominal',
                            title: 'Station Operator',
                            axis: {
                                labelAngle: -45,
                                labelFontSize: 12,
                                titleFontSize: 14
                            }
                        },
                        y: {
                            aggregate: 'mean',
                            field: 'usage',
                            type: 'quantitative',
                            title: 'Average Daily Users'
                        },
                        color: {
                            field: 'chargerType',
                            type: 'nominal',
                            title: 'Charger Type',
                            scale: {
                                domain: ['L1', 'L2', 'DC'],
                                range: ['#91bad6', '#528AAE', '#1E3f66']
                            }
                        }
                    },
                    title: 'Average Daily Users by Operator and Charger Type'
                }
            ]
        };

        // render chart
        vegaEmbed('#operator-viz', spec, {
            actions: false,
            theme: 'light'
        }).then(result => {
            // calculate stats info
            const operatorStats = d3.rollup(processedData,
                v => ({
                    avgRating: d3.mean(v.map(d => d.rating)),
                    avgUsage: d3.mean(v.map(d => d.usage)),
                    renewableCount: d3.sum(v.map(d => d.renewable === 'Yes' ? 1 : 0)),
                    totalCount: v.length,
                    avgCapacity: d3.mean(v.map(d => d.capacity))
                }),
                d => d.operator
            );

            // add stats info
            const statsDiv = document.createElement('div');
            statsDiv.className = 'stats-info';
            statsDiv.style.marginTop = '20px';
            statsDiv.style.padding = '15px';
            statsDiv.style.backgroundColor = '#f8f9fa';
            statsDiv.style.borderRadius = '8px';
            statsDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            
            let statsHtml = '<h4 style="margin-top: 0; color: #333; font-size: 16px;">Operator Statistics</h4>';
            
            for (const [operator, stats] of operatorStats.entries()) {
                statsHtml += `
                    <div style="margin-bottom: 12px;">
                        <strong>${operator}</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>Average Rating: ${stats.avgRating.toFixed(2)}</li>
                            <li>Average Daily Users: ${stats.avgUsage.toFixed(1)}</li>
                            <li>Renewable Energy Stations: ${stats.renewableCount} of ${stats.totalCount} (${((stats.renewableCount/stats.totalCount)*100).toFixed(1)}%)</li>
                            <li>Average Charging Capacity: ${stats.avgCapacity.toFixed(1)} kW</li>
                        </ul>
                    </div>`;
            }
            
            statsDiv.innerHTML = statsHtml;
            container.appendChild(statsDiv);
        });
        
    } catch (error) {
        console.error('Error creating operator analysis:', error);
        document.getElementById('operator-viz').innerHTML = 
            `<p class="error">Error creating operator analysis: ${error.message}</p>`;
    }
}

// Initialize the visualization
async function initialize() {
    try {
        const data = await loadData();

        await createMap(data);
        
        await loadTrendChart();
        
        await createHeatmap();
        
        createCostRatingChart(data);
        createTypeUsageChart(data);
        createBoxplotComparison(data);
        createOperatorAnalysis(data);
        
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

// Start when page loads
window.addEventListener('load', initialize); 
