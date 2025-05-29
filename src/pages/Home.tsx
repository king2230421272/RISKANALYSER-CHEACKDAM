import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Button, Typography, Statistic } from 'antd';
import { Link } from 'react-router-dom';
import {
  DatabaseOutlined,
  ApiOutlined,
  LineChartOutlined,
  AlertOutlined
} from '@ant-design/icons';
import axios from 'axios';
import './Home.css';

const { Title, Paragraph } = Typography;

// API基础URL
const API_BASE_URL = 'http://localhost:8000';

const Home: React.FC = () => {
  const [datasetCount, setDatasetCount] = useState(0);
  const [modelCount, setModelCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  
  // 获取数据集数量
  useEffect(() => {
    // 获取数据集数量
    axios.get(`${API_BASE_URL}/api/list_datasets/`).then(res => {
      setDatasetCount(res.data.total || (res.data.datasets && res.data.datasets.length) || 0);
    }).catch(() => setDatasetCount(0));

    // 获取模型数量
    axios.get(`${API_BASE_URL}/api/list_models/`).then(res => {
      setModelCount(res.data.total || (res.data.models && res.data.models.length) || 0);
    }).catch(() => setModelCount(0));

    // 获取报告数量（如无API可先写死为0）
    axios.get(`${API_BASE_URL}/api/risk/list_reports/`).then(res => {
      setReportCount(res.data.total || 0);
    }).catch(() => setReportCount(0));
  }, []);

  const features = [
    {
      title: "数据导入",
      description: "支持CSV、Excel等多种格式数据文件导入，自动识别数据类型和结构。",
      link: "/import",
      icon: <DatabaseOutlined />,
      color: "#1890ff"
    },
    {
      title: "数据处理",
      description: "提供缺失值处理、异常值检测、数据转换等多种数据预处理功能。",
      link: "/process",
      icon: <ApiOutlined />,
      color: "#52c41a"
    },
    {
      title: "预测分析",
      description: "支持多种预测模型，包括XGBoost、深度学习等，自动选择最佳模型。",
      link: "/prediction",
      icon: <LineChartOutlined />,
      color: "#722ed1"
    },
    {
      title: "风险评估",
      description: "基于预测结果进行风险评估，生成风险等级和风险分析报告。",
      link: "/risk",
      icon: <AlertOutlined />,
      color: "#fa8c16"
    }
  ];

  // 更新统计数据
  const stats = [
    { title: '已导入数据集', value: datasetCount, suffix: '个' },
    { title: '训练模型', value: modelCount, suffix: '个' },
    { title: '风险评估报告', value: reportCount, suffix: '份' },
  ];

  return (
    <div className="home-container">
      <Row gutter={[24, 24]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={8} key={index}>
            <Card>
              <Statistic 
                title={stat.title}
                value={stat.value}
                suffix={stat.suffix}
                valueStyle={{ color: index === 0 ? '#1890ff' : index === 1 ? '#52c41a' : '#fa8c16' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <div className="welcome-section">
        <Title level={2}>欢迎使用风险评估系统</Title>
        <Paragraph className="subtitle">一站式风险预测与评估解决方案</Paragraph>
      </div>
      
      <Row gutter={[24, 24]}>
        {features.map((feature, index) => (
          <Col xs={24} sm={12} md={12} lg={6} key={index}>
            <Card 
              className="feature-card"
              hoverable
              actions={[
                <Link to={feature.link} key="enter">
                  <Button type="link">开始使用</Button>
                </Link>
              ]}
            >
              <div className="card-icon-container" style={{ color: feature.color }}>
                {feature.icon}
              </div>
              <Title level={4}>{feature.title}</Title>
              <Paragraph className="card-description">{feature.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Home; 