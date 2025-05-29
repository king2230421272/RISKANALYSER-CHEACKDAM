import React from 'react';
import { Tag } from 'antd';
import { 
  CheckCircleOutlined, 
  InfoCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined 
} from '@ant-design/icons';

// 风险等级颜色映射
const riskLevelColors = {
  'Low': '#52c41a',     // 绿色
  'Medium': '#faad14',  // 黄色
  'High': '#fa8c16',    // 橙色
  'Critical': '#f5222d' // 红色
};

// 风险等级中文映射
const riskLevelLabels = {
  'Low': '低风险',
  'Medium': '中等风险',
  'High': '高风险',
  'Critical': '极高风险'
};

interface RiskLevelTagProps {
  level: string;
  showIcon?: boolean;
  style?: React.CSSProperties;
  useChineseLabel?: boolean;
}

/**
 * 风险等级标签组件
 * 
 * @param level 风险等级 (Low, Medium, High, Critical)
 * @param showIcon 是否显示图标
 * @param style 自定义样式
 * @param useChineseLabel 是否使用中文标签
 */
const RiskLevelTag: React.FC<RiskLevelTagProps> = ({ 
  level, 
  showIcon = true, 
  style = {},
  useChineseLabel = true
}) => {
  // 获取对应颜色，如果没有匹配则使用默认蓝色
  const color = riskLevelColors[level as keyof typeof riskLevelColors] || '#108ee9';
  
  // 根据风险等级选择图标
  let icon = null;
  if (showIcon) {
    switch (level) {
      case 'Low':
        icon = <CheckCircleOutlined />;
        break;
      case 'Medium':
        icon = <InfoCircleOutlined />;
        break;
      case 'High':
        icon = <WarningOutlined />;
        break;
      case 'Critical':
        icon = <CloseCircleOutlined />;
        break;
    }
  }

  // 获取显示标签文本
  const displayText = useChineseLabel ? 
    (riskLevelLabels[level as keyof typeof riskLevelLabels] || level) : 
    level;

  return (
    <Tag 
      color={color} 
      icon={icon}
      style={{ 
        fontSize: '14px', 
        padding: '4px 8px',
        ...style 
      }}
    >
      {displayText}
    </Tag>
  );
};

export default RiskLevelTag; 