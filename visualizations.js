// Load and process the data
async function loadData() {
    try {
        const response = await fetch('data/processed_detailed_ev_charging_stations.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        const data = d3.csvParse(csvText);
        
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// D3 Map Visualization
async function createMap(data) {
    try {
        const width = document.getElementById('map-viz').clientWidth;
        const height = 500;
        
        // Clear existing content
        d3.select('#map-viz').selectAll('*').remove();
        
        // Create filter container
        const filterContainer = d3.select('#map-viz')
            .append('div')
            .attr('class', 'filter-container');
        
        // Add charger type filter
        const typeFilter = filterContainer.append('select')
            .attr('class', 'type-filter')
            .style('margin', '10px');
            
        typeFilter.append('option')
            .attr('value', 'all')
            .text('All Types');
            
        ['L1', 'L2', 'DC'].forEach(type => {
            typeFilter.append('option')
                .attr('value', type)
                .text(`${type} Chargers`);
        });
        
        // Add availability filter
        const availabilityFilter = filterContainer.append('select')
            .attr('class', 'availability-filter')
            .style('margin', '10px');
            
        availabilityFilter
            .selectAll('option')
            .data([
                {value: 'all', text: 'All Availability'},
                {value: '24h', text: '24/7 Only'},
                {value: 'limited', text: 'Limited Hours'}
            ])
            .join('option')
            .attr('value', d => d.value)
            .text(d => d.text);

        // Create SVG
        const svg = d3.select('#map-viz')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', '#fff');
        
        // Create a container for zoom
        const g = svg.append('g');
        
        // Create projection
        const projection = d3.geoMercator()
            .scale((width - 3) / (2 * Math.PI))
            .translate([width / 2, height / 2]);
        
        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                g.selectAll('circle')
                    .attr('r', d => getPointRadius(d) / event.transform.k);
            });
        
        svg.call(zoom);
        
        // Load world map
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        
        // Draw countries
        g.append("g")
            .selectAll("path")
            .data(topojson.feature(world, world.objects.countries).features)
            .join("path")
            .attr("d", d3.geoPath(projection))
            .attr("fill", "#f8f9fa")
            .attr("stroke", "#dee2e6")
            .attr("stroke-width", 0.5);

        // Filter data function
        function filterData(data) {
            const selectedType = typeFilter.node().value;
            const selectedAvailability = availabilityFilter.node().value;
            
            return data.filter(d => {
                const typeMatch = selectedType === 'all' || d['Charger Type'] === selectedType;
                const availabilityMatch = selectedAvailability === 'all' || 
                    (selectedAvailability === '24h' && d.Is24Hours) ||
                    (selectedAvailability === 'limited' && !d.Is24Hours);
                return typeMatch && availabilityMatch;
            });
        }

        // Define colors for charger types
        const typeColors = {
            'L1': '#ff4d4d',
            'L2': '#3385ff',
            'DC': '#33cc33'
        };
        
        // Calculate point radius based on rating and power
        function getPointRadius(d) {
            const baseSize = 2;
            const ratingBonus = d['Reviews (Rating)'] ? (d['Reviews (Rating)'] - 1) / 4 : 0;
            const powerBonus = d['IsHighPower'] ? 0.5 : 0;
            return baseSize * (1 + ratingBonus + powerBonus);
        }

        // Update visualization function
        function updateVisualization() {
            const filteredData = filterData(data);
            
            // Remove existing points
            g.selectAll('.station-point').remove();
            
            // Add new points
            g.selectAll('.station-point')
                .data(filteredData)
                .join('circle')
                .attr('class', 'station-point')
                .attr('cx', d => {
                    const coords = projection([+d.Longitude, +d.Latitude]);
                    return coords ? coords[0] : null;
                })
                .attr('cy', d => {
                    const coords = projection([+d.Longitude, +d.Latitude]);
                    return coords ? coords[1] : null;
                })
                .attr('r', getPointRadius)
                .attr('fill', d => typeColors[d['Charger Type']])
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.9)
                .on('mouseover', function(event, d) {
                    d3.select(this)
                        .attr('opacity', 1)
                        .attr('stroke-width', 2)
                        .attr('r', getPointRadius(d) * 1.8);
                    
                    const tooltip = d3.select('body').append('div')
                        .attr('class', 'tooltip')
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');

                    const rating = d['Reviews (Rating)'] ? 
                        `${parseFloat(d['Reviews (Rating)']).toFixed(1)} stars` : 
                        'No rating';
                    
                    const cost = d['Cost (USD/kWh)'] ? 
                        `$${parseFloat(d['Cost (USD/kWh)']).toFixed(2)}/kWh` : 
                        'Not available';

                    tooltip.html(`
                        <div class="tooltip-title">${d['Charger Type']} Charging Station</div>
                        <div class="tooltip-address">${d['Address']}</div>
                        <div class="tooltip-content">
                            <div class="tooltip-row">
                                <span class="label">Rating:</span> 
                                <span class="value">${rating}</span>
                            </div>
                            <div class="tooltip-row">
                                <span class="label">Cost:</span> 
                                <span class="value">${cost}</span>
                            </div>
                            <div class="tooltip-row">
                                <span class="label">Hours:</span> 
                                <span class="value">${d['Is24Hours'] ? '24/7' : 'Limited'}</span>
                            </div>
                            <div class="tooltip-row">
                                <span class="label">Power:</span> 
                                <span class="value">${d['IsHighPower'] ? 'High Power' : 'Standard'}</span>
                            </div>
                        </div>
                    `);
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .attr('opacity', 0.9)
                        .attr('stroke-width', 0.5)
                        .attr('r', d => getPointRadius(d));
                    d3.select('.tooltip').remove();
                });
        }
        
        // Add legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 120}, 20)`);
        
        ['L1', 'L2', 'DC'].forEach((type, i) => {
            const g = legend.append('g')
                .attr('transform', `translate(0, ${i * 25})`);
            
            g.append('circle')
                .attr('r', 4)
                .attr('fill', typeColors[type])
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5);
            
            g.append('text')
                .attr('x', 15)
                .attr('y', 4)
                .style('font-size', '12px')
                .style('fill', '#666')
                .text(`${type} Charger`);
        });
        
        // Add filter event listeners
        typeFilter.on('change', updateVisualization);
        availabilityFilter.on('change', updateVisualization);
        
        // Initialize visualization
        updateVisualization();
        
    } catch (error) {
        console.error('Error creating map:', error);
    }
}

// 加载趋势图
async function loadTrendChart() {
    try {
        const data = await loadData();
        
        // Prepare data: aggregate by year and charger type
        const yearlyData = d3.rollup(data,
            v => v.length,
            d => d['Installation Year'],
            d => d['Charger Type']
        );
        
        // Get all years
        const years = Array.from(yearlyData.keys()).filter(year => 
            year && year >= 2010 && year <= 2024
        ).sort();
        
        // Get all types
        const types = ['L1', 'L2', 'DC'];
        
        // Convert to Vega-Lite format, ensure data points for each year and type
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
        
        // Create Vega-Lite specification
        const spec = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            description: 'EV Charging Station Installation Trends',
            data: { values: trendData },
            width: 'container',
            height: 400,
            padding: { left: 50, right: 50, top: 50, bottom: 40 },
            params: [
                {
                    name: 'highlight',
                    select: {
                        type: 'point',
                        on: 'mouseover',
                        clear: 'mouseout'
                    }
                },
                {
                    name: 'type',
                    select: {
                        type: 'point',
                        fields: ['type'],
                        bind: 'legend'
                    }
                }
            ],
            mark: {
                type: 'line',
                point: {  // Style for points
                    filled: true,
                    size: 100
                },
                interpolate: 'monotone',
                strokeWidth: 3,
                strokeJoin: 'round',
                strokeCap: 'round'
            },
            encoding: {
                x: {
                    field: 'year',
                    type: 'quantitative',
                    title: 'Installation Year',
                    scale: { domain: [2010, 2024] },
                    axis: { 
                        grid: true, 
                        tickCount: 15,  // Show all years
                        labelAngle: 0,
                        gridColor: '#f0f0f0',
                        format: 'd'  // Use integer format
                    }
                },
                y: {
                    field: 'count',
                    type: 'quantitative',
                    title: 'Number of Installations',
                    axis: { 
                        grid: true,
                        gridColor: '#f0f0f0'
                    }
                },
                color: {
                    field: 'type',
                    type: 'nominal',
                    title: 'Charger Type',
                    scale: {
                        domain: ['L1', 'L2', 'DC'],
                        range: ['#ff4d4d', '#3385ff', '#33cc33']
                    },
                    legend: { 
                        title: 'Charger Type (click to filter)',
                        orient: 'top'
                    }
                },
                size: {
                    condition: {
                        param: 'highlight',
                        value: 4,
                        empty: false
                    },
                    value: 2
                },
                opacity: {
                    condition: [
                        {
                            param: 'highlight',
                            value: 1,
                            empty: false
                        },
                        {
                            param: 'type',
                            value: 1
                        }
                    ],
                    value: 0.2
                },
                tooltip: [
                    { field: 'year', type: 'quantitative', title: 'Year' },
                    { field: 'type', type: 'nominal', title: 'Type' },
                    { field: 'count', type: 'quantitative', title: 'Installations' }
                ]
            },
            config: {
                axis: {
                    gridColor: '#f0f0f0',
                    labelFont: 'Arial',
                    titleFont: 'Arial',
                    labelFontSize: 12,
                    titleFontSize: 14
                },
                legend: {
                    labelFont: 'Arial',
                    titleFont: 'Arial',
                    labelFontSize: 12,
                    titleFontSize: 14
                },
                view: { 
                    stroke: null,
                    continuousHeight: 300
                }
            }
        };
        
        // 嵌入图表
        await vegaEmbed('#trend-viz', spec, {
            mode: 'vega-lite',
            actions: {
                export: true,
                source: false,
                compiled: false,
                editor: false
            },
            theme: 'light',
            renderer: 'svg'
        });
        
    } catch (error) {
        console.error('Error loading trend chart:', error);
        document.getElementById('trend-viz').innerHTML = 
            `<p class="error">Error loading trend chart: ${error.message}</p>`;
    }
}

// Initialize the visualization
async function initialize() {
    try {
        const data = await loadData();
        await createMap(data);
        await loadTrendChart();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Start when page loads
window.addEventListener('load', initialize); 