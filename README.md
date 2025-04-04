# EV Charging Stations Analysis Dashboard

## Project Overview
This project provides an interactive visualization dashboard for analyzing Electric Vehicle (EV) charging stations across the United States. The dashboard offers insights into charging station distribution, usage patterns, costs, and user ratings through various interactive visualizations.

## Team Members
- Yanzhen Chen
- Nicole Chen
- Yiyang Bai

## Features
1. **Interactive Map Visualization (Leaflet.js)**
   - Geographical distribution of charging stations
   - Cluster view for dense areas
   - Color-coded markers by charger type
   - Detailed popup information for each station

2. **Installation Trends Visualization (D3.js)**
   - Timeline of charging station installations
   - Breakdown by charger type
   - Interactive legend
   - Yearly installation statistics

3. **Cost vs Charger Type Distribution (Altair)**
   - Heatmap showing station distribution
   - Cost range analysis
   - Charger type comparison
   - Interactive tooltips

4. **Feature Comparison Across Charger Types (Vega-Lite)**
   - Boxplot visualization for multiple features
   - Comparison across different cost ranges
   - Interactive feature selection
   - Detailed statistical analysis
   - Comprehensive statistics section

5. **Cost vs Rating Analysis**
   - Scatter plot with trend line
   - Filtering by charger type and availability
   - Statistical analysis
   - Correlation insights

6. **Charger Type Usage Analysis**
   - Usage patterns by charger type
   - Filtering capabilities
   - Average daily usage statistics
   - Sample size information

## Technologies Used
- D3.js for custom visualizations
- Leaflet.js for mapping
- Altair for statistical visualizations
- Vega-Lite for interactive charts
- HTML/CSS for layout and styling

## Data Features
The analysis includes key metrics such as:
- Location data (latitude/longitude)
- Charging costs
- User ratings
- Usage statistics
- Availability hours
- Charger types
- Installation years

## Setup and Usage
1. Clone the repository
2. Open `index.html` in a modern web browser
3. Interact with the visualizations using the provided filters and controls
4. Hover over elements to view detailed information

## Project Structure
```
.
├── index.html              # Main dashboard page
├── styles.css             # Styling definitions
├── visualizations.js      # Visualization logic
├── data/                  # Data directory
│   └── processed_detailed_ev_charging_stations.csv
└── README.md             # Project documentation
```

## Acknowledgments
This project was developed as part of the DS4200 course at Northeastern University.