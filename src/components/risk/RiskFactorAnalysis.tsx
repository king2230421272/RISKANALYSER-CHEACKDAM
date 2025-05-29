import React from 'react';
import { Table, Tag, Progress, Tooltip } from 'antd';
import { RiseOutlined, FallOutlined } from '@ant-design/icons';

interface RiskFactorData {
  factor: string;
  contribution: number;
  risk_index: number;
  trend: string;
}

interface RiskFactorProps {
  data: Record<string, any>;
  style?: React.CSSProperties;
}

/**
 * 风险因素分析组件
 * 
 * @param data 风险因素数据 { '因素名': { contribution: 贡献度, risk_index: 风险指数, trend: 趋势 } }
 * @param style 自定义样式
 */
const RiskFactorAnalysis: React.FC<RiskFactorProps> = ({ data, style = {} }) => {
  // 将数据转换为表格所需格式
  const tableData: RiskFactorData[] = Object.entries(data).map(([factor, values]: [string, any]) => ({
    factor,
    contribution: values.contribution,
    risk_index: values.risk_index,
    trend: values.trend
  }));

  // 表格列定义
  const columns = [
    {
      title: '风险因素',
      dataIndex: 'factor',
      key: 'factor',
      sorter: (a: RiskFactorData, b: RiskFactorData) => a.factor.localeCompare(b.factor)
    },
    {
      title: '贡献度',
      dataIndex: 'contribution',
      key: 'contribution',
      render: (value: number) => (
        <Tooltip title={`${(value * 100).toFixed(2)}%`}>
          <Progress 
            percent={value * 100} 
            size="small" 
            format={(percent) => `${percent?.toFixed(1)}%`}
            status={value > 0.3 ? "active" : "normal"}
          />
        </Tooltip>
      ),
      sorter: (a: RiskFactorData, b: RiskFactorData) => a.contribution - b.contribution
    },
    {
      title: '风险指数',
      dataIndex: 'risk_index',
      key: 'risk_index',
      render: (value: number) => {
        // 根据风险指数值设置颜色
        let color = '';
        if (value < 0.3) color = 'green';
        else if (value < 0.6) color = 'blue';
        else if (value < 0.8) color = 'orange';
        else color = 'red';
        
        return (
          <Tooltip title={`${(value * 100).toFixed(2)}%`}>
            <Progress 
              percent={value * 100} 
              size="small" 
              strokeColor={color}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
          </Tooltip>
        );
      },
      sorter: (a: RiskFactorData, b: RiskFactorData) => a.risk_index - b.risk_index
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend: string) => {
        if (trend === 'increasing') {
          return <Tag color="red" icon={<RiseOutlined />}>上升</Tag>;
        } else if (trend === 'decreasing') {
          return <Tag color="green" icon={<FallOutlined />}>下降</Tag>;
        } else {
          return <Tag color="blue">稳定</Tag>;
        }
      },
      filters: [
        { text: '上升', value: 'increasing' },
        { text: '稳定', value: 'stable' },
        { text: '下降', value: 'decreasing' }
      ],
      onFilter: (value: boolean | React.Key, record: RiskFactorData) => record.trend === value
    }
  ];

  return (
    <div style={style}>
      <Table 
        dataSource={tableData} 
        columns={columns}
        rowKey="factor"
        size="small"
        pagination={tableData.length > 10 ? { pageSize: 10 } : false}
      />
    </div>
  );
};

export default RiskFactorAnalysis; 