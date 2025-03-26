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
                'L1': '#ff4d4d',
                'L2': '#3385ff',
                'DC': '#33cc33'
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
        countInfo.innerHTML = `显示 ${data.length} 个充电站`;
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
        
        // Prepare data: aggregate by year and charger type
        const yearlyData = d3.rollup(data,
            v => v.length,
            d => d['Installation Year'],
            d => d['Charger Type']
        );
        
        // Get all years and types
        const years = Array.from(yearlyData.keys()).filter(year => 
            year && year >= 2010 && year <= 2024
        ).sort();
        const types = ['L1', 'L2', 'DC'];
        
        // Convert to D3 format
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

        // Set container size with larger margins for labels
        const container = document.getElementById('trend-viz');
        const margin = { top: 40, right: 120, bottom: 100, left: 70 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        // Clear previous chart
        d3.select('#trend-viz').selectAll('*').remove();

        // Create SVG
        const svg = d3.select('#trend-viz')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const x = d3.scaleLinear()
            .domain([2010, 2024])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(trendData, d => d.count)])
            .range([height, 0]);

        const color = d3.scaleOrdinal()
            .domain(types)
            .range(['#ff4d4d', '#3385ff', '#33cc33']);

        // Create line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Add X axis with adjusted label position
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

        // Add X axis label
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + 35)
            .attr('text-anchor', 'middle')
            .attr('fill', '#666')
            .style('font-size', '14px')
            .text('Installation Year');

        // Add Y axis with adjusted label position
        svg.append('g')
            .call(d3.axisLeft(y)
                .ticks(5))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .clone()
                .attr('x2', width)
                .attr('stroke-opacity', 0.1));

        // Add Y axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -50)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#666')
            .style('font-size', '14px')
            .text('Number of Installations');

        // Store visibility state for each type
        const visibilityState = {
            'L1': true,
            'L2': true,
            'DC': true
        };

        // Function to update line visibility
        function updateVisibility(type) {
            visibilityState[type] = !visibilityState[type];
            
            // Update line visibility
            svg.select(`.line-${type}`)
                .transition()
                .duration(300)
                .style('opacity', visibilityState[type] ? 0.8 : 0);
            
            // Update dot visibility
            svg.selectAll(`.dot-${type}`)
                .transition()
                .duration(300)
                .style('opacity', visibilityState[type] ? 0.8 : 0)
                .style('pointer-events', visibilityState[type] ? 'all' : 'none');
                
            // Update legend item style
            svg.select(`.legend-item-${type}`)
                .transition()
                .duration(300)
                .style('opacity', visibilityState[type] ? 1 : 0.5);
        }

        // Add lines and dots for each type
        types.forEach(type => {
            const typeData = trendData.filter(d => d.type === type);
            
            // Add line
            svg.append('path')
                .datum(typeData)
                .attr('class', `line-${type}`)
                .attr('fill', 'none')
                .attr('stroke', color(type))
                .attr('stroke-width', 2.5)
                .attr('d', line)
                .style('opacity', 0.8)
                .on('mouseover', function() {
                    if (visibilityState[type]) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .style('opacity', 1)
                            .attr('stroke-width', 3.5);
                    }
                })
                .on('mouseout', function() {
                    if (visibilityState[type]) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .style('opacity', 0.8)
                            .attr('stroke-width', 2.5);
                    }
                });

            // Add dots
            svg.selectAll(`.dot-${type}`)
                .data(typeData)
                .join('circle')
                .attr('class', `dot-${type}`)
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.count))
                .attr('r', 4)
                .attr('fill', color(type))
                .style('opacity', 0.8)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    if (visibilityState[type]) {
                        // Highlight current dot
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('r', 8)
                            .style('opacity', 1)
                            .style('stroke', '#fff')
                            .style('stroke-width', 2);
                        
                        // Highlight corresponding line
                        svg.select(`.line-${type}`)
                            .transition()
                            .duration(200)
                            .style('opacity', 1)
                            .attr('stroke-width', 3.5);
                            
                        // Show tooltip
                        tooltip
                            .style('visibility', 'visible')
                            .style('opacity', 1)
                            .style('left', (event.clientX + 10) + 'px')
                            .style('top', (event.clientY - 10) + 'px')
                            .html(`
                                <div style="background: ${color(type)}; color: white; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px;">
                                    <strong>${d.type} Charger</strong>
                                </div>
                                <div style="padding: 4px 8px;">
                                    <div>Year: ${d.year}</div>
                                    <div>Installations: ${d.count}</div>
                                </div>
                            `);
                    }
                })
                .on('mouseout', function() {
                    if (visibilityState[type] && !d3.select(this).classed('selected-dot')) {
                        // Restore dot style
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('r', 4)
                            .style('opacity', 0.8)
                            .style('stroke', 'none');
                            
                        // Restore line style
                        svg.select(`.line-${type}`)
                            .transition()
                            .duration(200)
                            .style('opacity', 0.8)
                            .attr('stroke-width', 2.5);
                            
                        // Hide tooltip
                        tooltip
                            .style('visibility', 'hidden')
                            .style('opacity', 0);
                    }
                })
                .on('click', function(event, d) {
                    event.stopPropagation();
                    
                    // Get current dot selection state
                    const isSelected = d3.select(this).classed('selected-dot');
                    
                    // Remove all dot selections
                    svg.selectAll('.selected-dot')
                        .classed('selected-dot', false)
                        .transition()
                        .duration(200)
                        .attr('r', 4)
                        .style('stroke', 'none');
                    
                    if (!isSelected) {
                        // Add new selection state
                        d3.select(this)
                            .classed('selected-dot', true)
                            .transition()
                            .duration(200)
                            .attr('r', 8)
                            .style('stroke', '#fff')
                            .style('stroke-width', 2);
                            
                        // Show detailed information
                        tooltip
                            .style('visibility', 'visible')
                            .style('opacity', 1)
                            .style('left', (event.clientX + 10) + 'px')
                            .style('top', (event.clientY - 10) + 'px')
                            .html(`
                                <div style="background: ${color(type)}; color: white; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px;">
                                    <strong>${d.type} Charger Details</strong>
                                </div>
                                <div style="padding: 4px 8px;">
                                    <div>Year: ${d.year}</div>
                                    <div>Installations: ${d.count}</div>
                                </div>
                            `);
                    } else {
                        // Hide tooltip
                        tooltip
                            .style('visibility', 'hidden')
                            .style('opacity', 0);
                    }
                });
        });

        // Add legend with improved positioning and interactivity
        const legend = svg.append('g')
            .attr('transform', `translate(${width + 20}, 10)`);

        // Add legend title
        legend.append('text')
            .attr('x', 0)
            .attr('y', -5)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text('Charger Types');

        // Add legend items with click interaction
        const legendItems = legend.selectAll('.legend-item')
            .data(types)
            .join('g')
            .attr('class', d => `legend-item legend-item-${d}`)
            .attr('transform', (d, i) => `translate(0,${i * 25 + 15})`)
            .style('cursor', 'pointer')
            .on('click', function(event, d) {
                updateVisibility(d);
            })
            .on('mouseover', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('opacity', 0.8);
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('opacity', visibilityState[d] ? 1 : 0.5);
            });

        legendItems.append('circle')
            .attr('r', 6)
            .attr('fill', d => color(d));

        legendItems.append('text')
            .attr('x', 15)
            .attr('y', 4)
            .text(d => d)
            .style('font-size', '12px');

        // Add tooltip
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('position', 'fixed')
            .style('visibility', 'hidden')
            .style('opacity', 0)
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '8px')
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none')
            .style('z-index', '9999');

        // Add click handler to clear selection
        svg.on('click', function() {
            svg.selectAll('.selected-dot')
                .classed('selected-dot', false)
                .transition()
                .duration(200)
                .attr('r', 4)
                .style('stroke', 'none');
                
            tooltip
                .style('visibility', 'hidden')
                .style('opacity', 0);
        });

    } catch (error) {
        console.error('Error loading trend chart:', error);
        document.getElementById('trend-viz').innerHTML = 
            `<p class="error">Error loading trend chart: ${error.message}</p>`;
    }
}

// Create heatmap
async function createHeatmap() {
    try {
        // 加载热力图规范
        const response = await fetch('heatmap_spec.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const spec = await response.json();
        
        // 使用 Vega-Embed 渲染热力图
        await vegaEmbed('#heatmap-viz', spec, {
            actions: false,  // 隐藏 Vega-Lite 操作菜单
            renderer: 'svg'  // 使用 SVG 渲染
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
            { value: 'medium', text: 'Medium (5-15)' },
            { value: 'high', text: 'High (15+)' }
        ];
        
        rangeOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            rangeFilter.appendChild(opt);
        });

        // Add filters to container
        filterContainer.appendChild(typeFilterLabel);
        filterContainer.appendChild(typeFilter);
        filterContainer.appendChild(rangeFilterLabel);
        filterContainer.appendChild(rangeFilter);
        
        // Data processing function
        function processData() {
            const selectedType = typeFilter.value;
            const selectedRange = rangeFilter.value;
            
            return data
                .map(d => ({
                    charger_type: d['Charger Type'],
                    usage: parseFloat(d['Usage Stats (avg users/day)'])
                }))
                .filter(d => {
                    if (isNaN(d.usage) || d.usage < 0) return false;
                    
                    if (selectedType !== 'all' && d.charger_type !== selectedType) return false;
                    
                    switch (selectedRange) {
                        case 'medium':
                            return d.usage > 5 && d.usage <= 15;
                        case 'high':
                            return d.usage > 15;
                        default: // 'all'
                            return true;
                    }
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
                        scale: {
                            domain: ['L1', 'L2', 'DC'],
                            range: ['#ff4d4d', '#3385ff', '#33cc33']
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
                // Calculate and display statistics
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
            });
        }

        // Add event listeners to filters
        typeFilter.addEventListener('change', () => {
            // Clear previous chart and stats
            container.innerHTML = '';
            container.appendChild(filterContainer);
            updateChart();
        });

        rangeFilter.addEventListener('change', () => {
            // Clear previous chart and stats
            container.innerHTML = '';
            container.appendChild(filterContainer);
            updateChart();
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
                width: container.clientWidth - 100,
                height: 400,
                layer: [
                    {
                        mark: {
                            type: 'point',
                            filled: true,
                            opacity: 0.5,
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
                                    range: ['#ff4d4d', '#3385ff', '#33cc33']
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

// Initialize the visualization
async function initialize() {
    try {
        const data = await loadData();

        await createMap(data);
        
        await loadTrendChart();
        
        await createHeatmap();
        
        createCostRatingChart(data);
        createTypeUsageChart(data);
        
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

// Start when page loads
window.addEventListener('load', initialize); 