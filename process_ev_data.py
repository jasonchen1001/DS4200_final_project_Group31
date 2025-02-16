import pandas as pd
import os
import re
import altair as alt

def is_valid_coordinate(lat, lon):
    """
    Check if coordinates are within valid range
    """
    try:
        lat = float(lat)
        lon = float(lon)
        
        # Basic range check
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return False
            
        # Check for 0,0 (common default value)
        if lat == 0 and lon == 0:
            return False
            
        # Check for integer coordinates (likely placeholder data)
        if lat.is_integer() and lon.is_integer():
            return False
        
        return True
        
    except (ValueError, TypeError):
        return False

def is_valid_address(address):
    """
    Check if address is valid
    """
    if not isinstance(address, str):
        return False
        
    invalid_patterns = [
        'Random',
        'City \d+',
        'Country$',
        '^\d+ \d+$',
        'Unknown',
        'Test',
        'Sample'
    ]
    
    address = address.strip().lower()
    
    # Check invalid patterns
    for pattern in invalid_patterns:
        if re.search(pattern.lower(), address):
            return False
            
    # Check minimum length
    if len(address) < 10:  # Valid addresses typically have at least street number and name
        return False
        
    # Check if contains numbers (valid addresses usually have house numbers)
    if not any(c.isdigit() for c in address):
        return False
        
    return True

def create_trend_chart(df):
    """
    Create interactive installation trend chart
    """
    # Prepare data
    yearly_data = df.groupby(['Installation Year', 'Charger Type']).size().reset_index(name='count')
    
    # Create base chart
    base = alt.Chart(yearly_data).encode(
        x=alt.X('Installation Year:Q',
                scale=alt.Scale(domain=[2010, 2024]),
                axis=alt.Axis(title='Installation Year', grid=True)),
        tooltip=[
            alt.Tooltip('Installation Year:Q', title='Year'),
            alt.Tooltip('Charger Type:N', title='Type'),
            alt.Tooltip('count:Q', title='Installations')
        ]
    )
    
    # Create line chart
    lines = base.mark_line(point=True).encode(
        y=alt.Y('count:Q',
                axis=alt.Axis(title='Number of Installations', grid=True)),
        color=alt.Color('Charger Type:N',
                       scale=alt.Scale(
                           domain=['L1', 'L2', 'DC'],
                           range=['#ff4d4d', '#3385ff', '#33cc33']
                       ))
    )
    
    # Add interactive selection
    selection = alt.selection_multi(fields=['Charger Type'], bind='legend')
    
    # Combine chart and add interaction
    chart = lines.add_selection(
        selection
    ).transform_filter(
        selection
    ).properties(
        width=800,
        height=400,
        title='EV Charging Station Installation Trends'
    ).configure_axis(
        grid=True,
        gridColor='#f0f0f0'
    ).configure_view(
        strokeWidth=0
    )
    
    return chart

def process_ev_data(file_path):
    # Read CSV file
    df = pd.read_csv(file_path)
    print(f"Initial data shape: {df.shape}")
    
    # 1. Basic cleaning
    df = df.drop_duplicates()
    print(f"\nShape after removing duplicates: {df.shape}")
    
    # 2. Filter invalid addresses
    print("\nFiltering invalid addresses...")
    df['has_valid_address'] = df['Address'].apply(is_valid_address)
    invalid_addresses = df[~df['has_valid_address']]
    print(f"Found {len(invalid_addresses)} records with invalid addresses")
    
    if len(invalid_addresses) > 0:
        print("\nSample of invalid addresses:")
        print(invalid_addresses['Address'].head())
    
    # Keep only records with valid addresses
    df = df[df['has_valid_address']].drop('has_valid_address', axis=1)
    print(f"\nRecords with valid addresses: {len(df)}")
    
    # 3. Basic coordinate validation
    print("\nValidating coordinates...")
    valid_coords = df.apply(
        lambda row: is_valid_coordinate(row['Latitude'], row['Longitude']), 
        axis=1
    )
    df = df[valid_coords]
    print(f"Records with valid coordinates: {len(df)}")
    
    # 4. Standardize time format
    def standardize_time(time_str):
        if pd.isna(time_str) or time_str == '24/7':
            return '00:00-24:00'
        return time_str
    
    df['Availability'] = df['Availability'].apply(standardize_time)
    
    # 5. Normalize charger types
    charging_types = {
        'AC Level 1': 'L1',
        'AC Level 2': 'L2',
        'DC Fast Charger': 'DC'
    }
    df['Charger Type'] = df['Charger Type'].map(charging_types)
    
    # 6. Process connector types
    df['Connector Types'] = df['Connector Types'].str.split(',').apply(
        lambda x: [t.strip() for t in x] if isinstance(x, list) else []
    )
    
    # 7. Process cost range
    df['Cost (USD/kWh)'] = pd.to_numeric(df['Cost (USD/kWh)'], errors='coerce')
    df = df[df['Cost (USD/kWh)'].isna() | df['Cost (USD/kWh)'].between(0, 2)]
    
    # 8. Process rating range
    df['Reviews (Rating)'] = pd.to_numeric(df['Reviews (Rating)'], errors='coerce')
    df = df[df['Reviews (Rating)'].isna() | df['Reviews (Rating)'].between(1, 5)]
    
    # 9. Add additional fields
    df['Is24Hours'] = df['Availability'].apply(lambda x: x == '00:00-24:00')
    df['IsHighPower'] = df['Charging Capacity (kW)'].fillna(0) > 100
    
    # 10. Process installation year
    df['Installation Year'] = pd.to_numeric(df['Installation Year'], errors='coerce')
    df = df[
        df['Installation Year'].isna() | 
        df['Installation Year'].between(2000, 2024)
    ]
    
    # Create trend chart
    trend_chart = create_trend_chart(df)
    
    # Save chart as HTML
    trend_chart.save('trend_chart.html')
    
    # Print statistics
    print("\nFinal data summary:")
    print(f"Total stations: {len(df)}")
    print("\nCoordinate ranges:")
    print(df[['Latitude', 'Longitude']].describe())
    print("\nCharger type distribution:")
    print(df['Charger Type'].value_counts())
    print("\nAvailability:")
    print(f"24/7 available: {df['Is24Hours'].sum()}")
    print(f"High power stations: {df['IsHighPower'].sum()}")
    
    # Save processed data
    os.makedirs('data', exist_ok=True)
    output_filename = 'processed_' + os.path.basename(file_path)
    output_path = os.path.join('data', output_filename)
    df.to_csv(output_path, index=False, float_format='%.6f')
    print(f"\nProcessed data saved to: {output_path}")
    
    return df

if __name__ == "__main__":
    input_file = 'data/detailed_ev_charging_stations.csv'
    processed_df = process_ev_data(input_file)
    
    # Print final validation info
    print("\nSample records:")
    print(processed_df[['Latitude', 'Longitude', 'Address', 'Charger Type']].head())