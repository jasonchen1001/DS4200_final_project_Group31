import pandas as pd
import numpy as np

def process_ev_data(file_path):
    # 读取CSV文件
    df = pd.read_csv(file_path)
    
    # 1. 基本清理
    # 删除完全重复的行
    df = df.drop_duplicates()
    
    # 2. 处理坐标范围
    # 纬度范围: -90 到 90
    # 经度范围: -180 到 180
    df = df[
        (df['Latitude'].between(-90, 90)) & 
        (df['Longitude'].between(-180, 180))
    ]
    
    # 3. 标准化时间格式
    def standardize_time(time_str):
        if time_str == '24/7':
            return '00:00-24:00'
        return time_str
    
    df['Availability'] = df['Availability'].apply(standardize_time)
    
    # 4. 规范化充电类型
    charging_types = {
        'AC Level 1': 'L1',
        'AC Level 2': 'L2',
        'DC Fast Charger': 'DC'
    }
    df['Charger Type'] = df['Charger Type'].map(charging_types)
    
    # 5. 处理连接器类型
    # 分割并标准化连接器类型
    df['Connector Types'] = df['Connector Types'].str.split(',').apply(
        lambda x: [t.strip() for t in x]
    )
    
    # 6. 处理成本范围
    # 确保成本在合理范围内 (例如 0-2 USD/kWh)
    df = df[df['Cost (USD/kWh)'] <= 2]
    
    # 7. 处理评分范围
    # 确保评分在 1-5 之间
    df = df[df['Reviews (Rating)'].between(1, 5)]
    
    # 8. 添加额外的有用字段
    # 添加24小时可用性标志
    df['Is24Hours'] = df['Availability'].apply(lambda x: x == '00:00-24:00')
    
    # 添加高功率充电标志 (>100kW)
    df['IsHighPower'] = df['Charging Capacity (kW)'] > 100
    
    # 9. 处理安装年份
    current_year = 2024
    df = df[df['Installation Year'].between(2000, current_year)]
    
    return df

# 使用示例
processed_df = process_ev_data('detailed_ev_charging_stations.csv')

# 验证时间格式转换
print("\n时间格式转换验证:")
print(processed_df['Availability'].value_counts().head())

# 打印基本信息
print("\n处理后的数据前5行:")
print(processed_df.head())