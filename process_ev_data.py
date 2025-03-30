import altair as alt
import pandas as pd
import json

def create_detailed_heatmap(df):
    df['Cost_Range'] = pd.cut(
        df['Cost (USD/kWh)'],
        bins=[0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, float('inf')],
        labels=['0–0.05', '0.05–0.10', '0.10–0.15', '0.15–0.20', '0.20–0.25', 
                '0.25–0.30', '0.30–0.35', '0.35–0.40', '0.40–0.45', '0.45+']
    )

    agg = df.groupby(['Cost_Range', 'Charger Type']).agg({
        'Usage Stats (avg users/day)': 'mean',
        'Station ID': 'count'
    }).reset_index()
    agg = agg[agg['Station ID'] > 0]

    base = alt.Chart(agg).encode(
        x=alt.X('Cost_Range:O',
                title='Cost per kWh (USD)',
                sort=['0–0.05', '0.05–0.10', '0.10–0.15', '0.15–0.20', '0.20–0.25', 
                      '0.25–0.30', '0.30–0.35', '0.35–0.40', '0.40–0.45', '0.45+'],
                axis=alt.Axis(
                    labelAngle=45,
                    grid=False,
                    domain=False,
                    titlePadding=15,
                    labelPadding=10
                )),
        y=alt.Y('Charger Type:N',
                title='Charger Type',
                sort=['DC Fast', 'Level 2', 'Level 1'],
                axis=alt.Axis(
                    grid=False,
                    domain=False,
                    titlePadding=15,
                    labelPadding=10
                )),
        tooltip=[
            alt.Tooltip('Cost_Range:O', title='Cost Range'),
            alt.Tooltip('Charger Type:N', title='Charger Type'),
            alt.Tooltip('Usage Stats (avg users/day):Q', title='Avg Daily Users', format='.1f'),
            alt.Tooltip('Station ID:Q', title='Number of Stations', format=',d')
        ]
    ).interactive()

    heatmap = base.mark_rect(
        stroke='white',
        strokeWidth=2
    ).encode(
        color=alt.Color('Station ID:Q',
                       title='Number of Stations',
                       scale=alt.Scale(
                           scheme='yellowgreenblue',  
                           type='symlog',  
                       ),
                       legend=alt.Legend(
                           gradientLength=150,
                           orient='right',
                           titlePadding=10,
                           labelPadding=5
                       ))
    )

    text = base.mark_text(
        font='Arial',
        fontSize=11,
        fontWeight='bold',
        color='white',  
        baseline='middle',
        align='center'
    ).encode(
        text=alt.Text('Station ID:Q', format=',d')
    )

    chart = (heatmap + text).properties(
        width=800,
        height=200,
        padding={'left': 50, 'right': 150, 'top': 40, 'bottom': 60},
        title=alt.TitleParams(
            text='Cost vs Charger Type Distribution',
            fontSize=16,
            anchor='middle',
            offset=20
        )
    ).configure_view(
        stroke=None
    ).configure_axis(
        labelFontSize=12,
        titleFontSize=14
    ).configure_legend(
        titleFontSize=12,
        labelFontSize=11,
        padding=10,
        cornerRadius=4,
        strokeColor='#ddd'
    )

    return chart

def create_distance_usage_scatter(df):
    scatter = alt.Chart(df).mark_circle(opacity=0.6).encode(
        x=alt.X('Distance to City (miles):Q',
                title='Distance to City (miles)',
                scale=alt.Scale(zero=False),
                axis=alt.Axis(
                    grid=True,
                    titlePadding=10,
                    labelPadding=5
                )),
        y=alt.Y('Usage Stats (avg users/day):Q',
                title='Average Daily Users',
                scale=alt.Scale(zero=True),
                axis=alt.Axis(
                    grid=True,
                    titlePadding=10,
                    labelPadding=5
                )),
        size=alt.Size('Number of Parking Spots:Q',
                     title='Number of Parking Spots',
                     scale=alt.Scale(range=[50, 400])),
        color=alt.Color('Renewable Energy:N',
                       title='Renewable Energy',
                       scale=alt.Scale(
                           domain=['Yes', 'No'],
                           range=['#2ecc71', '#e74c3c']
                       )),
        tooltip=[
            alt.Tooltip('Station Name:N', title='Station Name'),
            alt.Tooltip('Distance to City (miles):Q', title='Distance to City', format='.1f'),
            alt.Tooltip('Usage Stats (avg users/day):Q', title='Avg Daily Users', format='.1f'),
            alt.Tooltip('Number of Parking Spots:Q', title='Parking Spots'),
            alt.Tooltip('Renewable Energy:N', title='Renewable Energy'),
            alt.Tooltip('City:N', title='City')
        ]
    ).properties(
        width=800,
        height=500,
        title=alt.TitleParams(
            text='Distance to City vs. Usage',
            subtitle='Size indicates number of parking spots, color shows renewable energy usage',
            fontSize=16,
            subtitleFontSize=13,
            anchor='middle',
            offset=20
        )
    ).configure_axis(
        labelFontSize=11,
        titleFontSize=13
    ).configure_legend(
        titleFontSize=12,
        labelFontSize=11
    ).interactive()

    return scatter

def process_ev_data(data_file):
    try:
        df = pd.read_csv(data_file)
        print(f"Initial data shape: {df.shape}\n")

        df = df.drop_duplicates()
        print(f"Shape after removing duplicates: {df.shape}\n")

        heatmap = create_detailed_heatmap(df)
        heatmap_spec = heatmap.to_dict()
        with open('heatmap_spec.json', 'w') as f:
            json.dump(heatmap_spec, f)
        
        print("\nVisualization specifications saved successfully")
        
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        raise

if __name__ == "__main__":
    data_file = "data/processed_detailed_ev_charging_stations.csv"
    process_ev_data(data_file)
