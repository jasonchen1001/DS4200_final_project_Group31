import pandas as pd
import os

def process_ev_data(file_path):
    # Read CSV file
    df = pd.read_csv(file_path)
    
    # 1. Basic cleaning
    # Remove completely duplicate rows
    df = df.drop_duplicates()
    
    # 2. Process coordinate ranges
    # Latitude range: -90 to 90
    # Longitude range: -180 to 180
    df = df[
        (df['Latitude'].between(-90, 90)) & 
        (df['Longitude'].between(-180, 180))
    ]
    
    # 3. Standardize time format
    def standardize_time(time_str):
        if time_str == '24/7':
            return '00:00-24:00'
        return time_str
    
    df['Availability'] = df['Availability'].apply(standardize_time)
    
    # 4. Normalize charging types
    charging_types = {
        'AC Level 1': 'L1',
        'AC Level 2': 'L2',
        'DC Fast Charger': 'DC'
    }
    df['Charger Type'] = df['Charger Type'].map(charging_types)
    
    # 5. Process connector types
    # Split and standardize connector types
    df['Connector Types'] = df['Connector Types'].str.split(',').apply(
        lambda x: [t.strip() for t in x]
    )
    
    # 6. Process cost range
    # Ensure cost is within reasonable range (e.g., 0-2 USD/kWh)
    df = df[df['Cost (USD/kWh)'] <= 2]
    
    # 7. Process rating range
    # Ensure ratings are between 1-5
    df = df[df['Reviews (Rating)'].between(1, 5)]
    
    # 8. Add additional useful fields
    # Add 24-hour availability flag
    df['Is24Hours'] = df['Availability'].apply(lambda x: x == '00:00-24:00')
    
    # Add high power charging flag (>100kW)
    df['IsHighPower'] = df['Charging Capacity (kW)'] > 100
    
    # 9. Process installation year
    current_year = 2024
    df = df[df['Installation Year'].between(2000, current_year)]
    
    # 10. Save processed data
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    # Build output file path
    output_filename = os.path.basename(file_path)
    output_filename = 'processed_' + output_filename
    output_path = os.path.join('data', output_filename)
    
    # Save to CSV file
    df.to_csv(output_path, index=False)
    print(f"Processed data saved to: {output_path}")
    
    return df

# Usage example
input_file = 'data/detailed_ev_charging_stations.csv'
processed_df = process_ev_data(input_file)

# Verify time format conversion
print("\nTime format conversion verification:")
print(processed_df['Availability'].value_counts().head())

# Print basic information
print("\nFirst 5 rows of processed data:")
print(processed_df.head())