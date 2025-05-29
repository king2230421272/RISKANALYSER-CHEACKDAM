import React, { useState, useEffect } from 'react';
import {
  Card, Form, Select, Input, Button, Row, Col, Table, Tabs, Typography,
  Divider, Space, Alert, message, Upload, Radio, Spin, Tag, Tooltip, Switch,
  Progress, InputNumber
} from 'antd';
import {
  LineChartOutlined, UploadOutlined, DownloadOutlined, FileSearchOutlined,
  BarChartOutlined, PieChartOutlined, TableOutlined, DatabaseOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import type { UploadFile } from 'antd/lib/upload/interface';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface Dataset {
  id: number;
  name: string;
  description?: string;
  row_count: number;
  column_count: number;
}

const Prediction: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [visualizeForm] = Form.useForm();
  const [exportForm] = Form.useForm();

  // 状态管理
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<string[]>(['xgboost', 'lightgbm', 'catboost', 'deep_learning', 'lstm', 'transformer']);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [datasetLoading, setDatasetLoading] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [batchPredictions, setBatchPredictions] = useState<any[]>([]);
  const [visualizations, setVisualizations] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string>('single');
  const [useMockAPI, setUseMockAPI] = useState<boolean>(localStorage.getItem('use_mock_api') === 'true');
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('xgboost');
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
  const [exportPath, setExportPath] = useState<string>('');
  const [useConditions, setUseConditions] = useState<boolean>(false);
  const [conditionalColumns, setConditionalColumns] = useState<string[]>([]);
  const [trainedModels, setTrainedModels] = useState<any[]>([]);
  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [selectedModelInfo, setSelectedModelInfo] = useState<any>(null);

  // 获取数据集和模型列表
  useEffect(() => {
    fetchDatasets();
    fetchTrainedModels();
  }, []);

  // 处理URL参数中的model参数
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const modelId = searchParams.get('model');
    
    if (modelId && trainedModels.length > 0) {
      // 查找匹配的模型
      const selectedModel = trainedModels.find(model => model.id === modelId);
      if (selectedModel) {
        // 自动选择模型
        form.setFieldsValue({ trained_model_id: selectedModel.id });
        handleTrainedModelChange(selectedModel.id);
        
        // 切换到单个预测标签页
        setActiveKey('single');
        
        // 显示成功消息
        message.success(`已加载模型: ${selectedModel.name}`);
      }
    }
  }, [location.search, trainedModels]);

  const fetchDatasets = async () => {
    setDatasetLoading(true);
    try {
      if (useMockAPI) {
        // 模拟数据
        setDatasets([
          { id: 1, name: '风险评估数据集', description: '包含缺失值的风险评估数据集', row_count: 1000, column_count: 15 },
          { id: 2, name: '金融风险数据', description: '金融风险分析样本数据', row_count: 500, column_count: 10 },
        ]);
        setDatasetLoading(false);
        return;
      }

      const response = await axios.get('/api/list_datasets/');
      if (response.data && response.data.datasets) {
        setDatasets(response.data.datasets);
      }
    } catch (err: any) {
      console.error('获取数据集列表失败:', err);
      message.error(`获取数据集列表失败: ${err.message}`);
    } finally {
      setDatasetLoading(false);
    }
  };

  const fetchTrainedModels = async () => {
    setLoading(true);
    try {
      if (useMockAPI) {
        // 模拟数据
        setTrainedModels([
          { id: 1, name: 'XGBoost风险预测模型', model_type: 'xgboost', created_at: '2023-05-20', features: ['年龄', '收入', '债务比率'], target: '风险评分' },
          { id: 2, name: '深度学习洪水预测', model_type: 'deep_learning', created_at: '2023-06-15', features: ['降雨量', '水位', '流速'], target: '洪水概率' },
          { id: 3, name: 'LSTM时序风险模型', model_type: 'lstm', created_at: '2023-07-10', features: ['历史违约率', '市场波动', '利率'], target: '未来风险趋势' }
        ]);
        setLoading(false);
        return;
      }

      const response = await axios.get('/api/list_models/');
      if (response.data && response.data.models) {
        setTrainedModels(response.data.models);
      }
    } catch (err: any) {
      console.error('获取已训练模型列表失败:', err);
      message.error(`获取已训练模型列表失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatasetColumns = async (datasetId: number) => {
    setDatasetLoading(true);
    try {
      if (useMockAPI) {
        // 模拟数据
        const mockColumns = ['年龄', '收入', '债务', '资产', '信用分数', '风险评分', '历史违约次数'];
        setColumns(mockColumns);
        setDatasetLoading(false);
        return;
      }

      // 尝试使用新API获取列详情
      try {
        const response = await axios.get(`/api/dataset_columns/?dataset_id=${datasetId}`);
        
        if (response.data && Array.isArray(response.data.columns)) {
          const columnsInfo = response.data.columns;
          const columnNames = columnsInfo.map((col: any) => col.name);
          setColumns(columnNames);
        } else {
          throw new Error('API返回格式不正确');
        }
      } catch (error) {
        console.log('新API获取列信息失败，使用旧API作为回退', error);
        
        // 如果新API失败，回退到旧API
        const response = await axios.get(`/api/preview_dataset/${datasetId}/`);
        if (response.data && response.data.columns) {
          const columnsData = response.data.columns;
          let processedColumns: string[] = [];
          
          if (Array.isArray(columnsData) && columnsData.length > 0 && typeof columnsData[0] === 'object') {
            processedColumns = columnsData
              .filter(col => col && (col.title || col.dataIndex))
              .map(col => col.dataIndex || col.title)
              .filter((col: string) => col !== 'key' && col !== '索引');
          } else {
            processedColumns = columnsData.filter((col: string) => col !== 'key' && col !== '索引');
          }
          
          setColumns(processedColumns);
        }
      }
    } catch (err: any) {
      console.error('获取数据集列失败:', err);
      message.error(`获取数据集列失败: ${err.message}`);
      setColumns([]);
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleDatasetChange = (datasetId: number) => {
    setSelectedDataset(datasetId);
    fetchDatasetColumns(datasetId);
  };

  const handleTrainedModelChange = (modelId: number) => {
    const selectedModel = trainedModels.find(model => model.id === modelId);
    if (selectedModel) {
      setSelectedModelInfo(selectedModel);
      setSelectedModel(selectedModel.model_type);
      
      console.log("选中模型数据:", selectedModel); // 添加调试日志
      
      // 设置该模型的特征列和目标列
      if (selectedModel.features && Array.isArray(selectedModel.features) && selectedModel.features.length > 0) {
        console.log("模型特征列:", selectedModel.features);
        setColumns(selectedModel.features);
        
        // 重置之前的特征输入
        const featuresObj: Record<string, undefined> = {};
        selectedModel.features.forEach((feature: string) => {
          featuresObj[feature] = undefined;
        });
        form.setFieldsValue({ features: featuresObj });
      } else {
        // 如果模型缺少特征数据，使用默认特征列
        console.log("模型缺少特征数据，使用默认特征列");
        
        // 默认特征列 - 根据模型类型设置一些常见的特征列
        const defaultFeatures: Record<string, string[]> = {
          'xgboost': ['年龄', '收入', '债务比率'],
          'deep_learning': ['输入特征1', '输入特征2', '输入特征3'],
          'lstm': ['时间序列特征1', '时间序列特征2'],
          'catboost': ['类别特征1', '类别特征2', '数值特征1']
        };
        
        // 使用模型类型对应的默认特征，如果没有则使用通用特征
        const modelFeatures = defaultFeatures[selectedModel.model_type.toLowerCase()] || 
                             ['特征1', '特征2', '特征3'];
        
        setColumns(modelFeatures);
        
        // 设置默认特征的表单值
        const featuresObj: Record<string, undefined> = {};
        modelFeatures.forEach((feature: string) => {
          featuresObj[feature] = undefined;
        });
        form.setFieldsValue({ features: featuresObj });
        
        // 更新模型信息中的特征列
        setSelectedModelInfo({
          ...selectedModel,
          features: modelFeatures
        });
      }
      
      // 设置可选的预测目标
      if (selectedModel.target) {
        if (Array.isArray(selectedModel.target)) {
          setTargetOptions(selectedModel.target);
          // 如果有多个目标，默认选择第一个
          if (selectedModel.target.length > 0) {
            form.setFieldsValue({ target: selectedModel.target[0] });
          }
        } else {
          setTargetOptions([selectedModel.target]);
          form.setFieldsValue({ target: selectedModel.target });
        }
      } else {
        // 如果模型缺少目标数据，设置默认目标
        const defaultTarget = '预测值';
        setTargetOptions([defaultTarget]);
        form.setFieldsValue({ target: defaultTarget });
        
        // 更新模型信息中的目标
        setSelectedModelInfo({
          ...selectedModelInfo,
          target: defaultTarget
        });
      }
    }
  };

  const handleSinglePrediction = async (values: any) => {
    setLoading(true);
    setPredictionResult(null);
    
    try {
      const requestData: any = {
        input_features: values.features,
        model_id: values.trained_model_id,
        model_type: selectedModel,
      };
      
      // 如果选定了已训练模型，则使用根目录下的models文件夹中的模型路径
      if (selectedModelInfo && selectedModelInfo.file_path) {
        requestData.model_path = selectedModelInfo.file_path;
      } else {
        // 否则使用模型类型构建路径
        requestData.model_path = `models/${selectedModel}_model.pkl`;
      }
      
      // 如果选择了特定预测目标
      if (values.target) {
        requestData.target = values.target;
      }
      
      // 如果要计算置信区间
      if (values.confidence_interval) {
        requestData.confidence_interval = true;
      }

      if (useMockAPI) {
        // 模拟API响应
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockResult = {
          prediction: Math.random() > 0.5 ? 
            0.78 : // 单值结果
            { // 或多值结果
              'class_0': 0.15,
              'class_1': 0.78,
              'class_2': 0.07
            },
          conditions: useConditions ? conditionalColumns : undefined
        };
        setPredictionResult(mockResult);
        message.success('预测成功');
      } else {
        const response = await axios.post('/api/predict/', requestData);
        // 将条件值添加到结果中，以便显示
        const resultWithConditions = {
          ...response.data,
          conditions: useConditions ? conditionalColumns : undefined
        };
        setPredictionResult(resultWithConditions);
        message.success('预测成功');
      }
    } catch (err: any) {
      console.error('预测失败:', err);
      message.error(`预测失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 批量预测
  const handleBatchPrediction = async (values: any) => {
    setLoading(true);
    setBatchPredictions([]);
    
    try {
      const requestData = {
        dataset_id: values.dataset_id,
        model_type: values.model_type,
        model_path: `models/${values.model_type}_model.pkl`,  // 使用根目录下的models文件夹
        feature_columns: values.feature_columns,
        output_format: 'json'
      };

      if (useMockAPI) {
        // 模拟API响应
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockPredictions = Array(10).fill(0).map((_, i) => ({
          id: i + 1,
          prediction: Math.random(),
          confidence: Math.random() * 0.5 + 0.5,
          features: {}
        }));
        setBatchPredictions(mockPredictions);
        message.success('批量预测成功');
      } else {
        const response = await axios.post('/api/predict/batch/', requestData);
        setBatchPredictions(response.data.predictions);
        message.success('批量预测成功');
      }
    } catch (err: any) {
      console.error('批量预测失败:', err);
      message.error(`批量预测失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 预测可视化
  const handleVisualize = async (values: any) => {
    setLoading(true);
    setVisualizations({});
    
    try {
      const requestData = {
        dataset_id: values.dataset_id,
        model_type: values.model_type,
        model_path: `models/${values.model_type}_model.pkl`,  // 使用根目录下的models文件夹
        feature_columns: values.feature_columns,
        visualization_type: values.visualization_type,
        target_column: values.target_column
      };

      if (useMockAPI) {
        // 模拟API响应
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 使用占位图像
        const mockVisualizations = {
          'scatter_plot': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAAA1BMVEXm5+i1+/JmAAAAH0lEQVR4Xu3AAQkAAAwCwdU/9HloAAAAA0dEVFHt0PAyAAAAAElFTkSuQmCC',
          'correlation': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAAA1BMVEXm5+i1+/JmAAAAH0lEQVR4Xu3AAQkAAAwCwdU/9HloAAAAA0dEVFHt0PAyAAAAAElFTkSuQmCC',
        };
        setVisualizations(mockVisualizations);
        message.success('可视化生成成功');
      } else {
        const response = await axios.post('/api/predict/visualize/', requestData);
        setVisualizations(response.data.visualizations);
        message.success('可视化生成成功');
      }
    } catch (err: any) {
      console.error('可视化生成失败:', err);
      message.error(`可视化生成失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 导出预测结果
  const handleExport = async (values: any) => {
    setLoading(true);
    setExportPath('');
    
    try {
      const requestData = {
        dataset_id: values.dataset_id,
        model_type: values.model_type,
        model_path: `models/${values.model_type}_model.pkl`,  // 使用根目录下的models文件夹
        feature_columns: values.feature_columns,
        export_format: values.export_format,
        include_actual: values.include_actual,
        target_column: values.include_actual ? values.target_column : undefined
      };

      if (useMockAPI) {
        // 模拟API响应
        await new Promise(resolve => setTimeout(resolve, 1500));
        setExportPath('/downloads/predictions_results.csv');
        message.success('预测结果导出成功');
      } else {
        const response = await axios.post('/api/predict/export/', requestData);
        setExportPath(response.data.file_path);
        message.success('预测结果导出成功');
      }
    } catch (err: any) {
      console.error('导出失败:', err);
      message.error(`导出失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 渲染预测结果
  const renderPredictionResult = () => {
    if (predictionResult === null) return null;

    const prediction = predictionResult.prediction || predictionResult;
    const conditions = predictionResult.conditions;

    return (
      <Card title="预测结果" style={{ marginTop: 16 }}>
        {/* 条件值显示部分 */}
        {conditions && Object.keys(conditions).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Divider orientation="left">条件信息</Divider>
            <Row gutter={[16, 8]}>
              {Object.entries(conditions).map(([key, value]) => (
                <Col span={8} key={key}>
                  <Card size="small" style={{ background: '#f5f5f5' }}>
                    <Tooltip title={`条件变量: ${key}`}>
                      <div>
                        <Text strong>{key}:</Text> <Tag color="blue">{String(value)}</Tag>
                      </div>
                    </Tooltip>
                  </Card>
                </Col>
              ))}
            </Row>
            <Divider orientation="left">预测值</Divider>
          </div>
        )}

        {/* 预测值显示部分 */}
        {typeof prediction === 'number' || typeof prediction === 'string' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Title level={2}>{prediction}</Title>
            <Text type="secondary">预测值</Text>
          </div>
        ) : typeof prediction === 'object' ? (
          <div style={{ padding: '10px 0' }}>
            {Object.entries(prediction).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <Text strong>{key}:</Text>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <Progress 
                    percent={Number(value) * 100} 
                    status={getProgressStatus(Number(value))}
                    style={{flex: 1, marginRight: 12}}
                  />
                  <span>{(Number(value) * 100).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <pre>{JSON.stringify(prediction, null, 2)}</pre>
        )}
      </Card>
    );
  };

  const getProgressStatus = (value: number): 'success' | 'normal' | 'exception' | 'active' => {
    if (value >= 0.7) return 'success';
    if (value >= 0.3) return 'normal';
    return 'exception';
  };

  // 处理模拟API切换
  const handleMockAPIToggle = (checked: boolean) => {
    setUseMockAPI(checked);
    localStorage.setItem('use_mock_api', checked ? 'true' : 'false');
    message.info(`${checked ? '启用' : '禁用'}模拟API`);
  };

  // 添加此函数以修复linter错误
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    
    // 检查模型是否支持条件信息
    const conditionalSupportedModels = ['deep_learning', 'lightgbm', 'catboost', 'lstm', 'transformer'];
    if (conditionalSupportedModels.includes(model)) {
      setUseConditions(true);
    } else {
      setUseConditions(false);
      setConditionalColumns([]);
    }
  };

  // 渲染单个预测表单
  const renderSinglePredictionForm = () => {
    return (
      <Card title="单个预测">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSinglePrediction}
          requiredMark="optional"
        >
          {/* 第一步：选择已训练模型 */}
          <Form.Item
            name="trained_model_id"
            label="选择已训练模型"
            rules={[{ required: true, message: '请选择已训练模型' }]}
          >
            <Select
              placeholder="选择已训练模型"
              onChange={handleTrainedModelChange}
              loading={loading}
              optionLabelProp="label"
            >
              {trainedModels.map(model => (
                <Option 
                  key={model.id} 
                  value={model.id}
                  label={model.name}
                >
                  <div>
                    <Text strong>{model.name}</Text>
                    <div>
                      <Tag color="blue">{model.model_type}</Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>创建时间: {model.created_at}</Text>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedModelInfo && (
            <>
              {/* 显示模型信息 */}
              <Alert
                message="已选择模型信息"
                description={
                  <div>
                    <p><Text strong>模型名称:</Text> {selectedModelInfo.name}</p>
                    <p><Text strong>模型类型:</Text> {selectedModelInfo.model_type}</p>
                    <p><Text strong>创建时间:</Text> {selectedModelInfo.created_at}</p>
                    {selectedModelInfo.features && selectedModelInfo.features.length > 0 && (
                      <p><Text strong>特征变量:</Text> {selectedModelInfo.features.join(', ')}</p>
                    )}
                    {selectedModelInfo.target && (
                      <p><Text strong>预测目标:</Text> {Array.isArray(selectedModelInfo.target) ? 
                        selectedModelInfo.target.join(', ') : selectedModelInfo.target}</p>
                    )}
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              {/* 第二步：输入条件变量作为特征值 */}
              {columns.length > 0 && (
                <Form.Item
                  label="特征输入"
                  required
                  tooltip="输入与模型训练时使用的特征列对应的值"
                >
                  <Card 
                    size="small" 
                    title={<Text strong>输入条件值</Text>} 
                    style={{ marginBottom: 16 }}
                    type="inner"
                    className="feature-input-card"
                  >
                    <Row gutter={[16, 8]}>
                      {columns.map(col => (
                        <Col span={12} key={col}>
                          <Form.Item
                            name={['features', col]}
                            label={col}
                            rules={[{ required: true, message: `请输入${col}的值` }]}
                          >
                            <InputNumber style={{ width: '100%' }} placeholder={`输入${col}的值`} />
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </Form.Item>
              )}

              {/* 第三步：选择预测目标值 */}
              {targetOptions.length > 0 && (
                <Form.Item
                  name="target"
                  label="选择预测目标"
                  required
                  rules={[{ required: targetOptions.length > 1, message: '请选择预测目标' }]}
                >
                  <Card 
                    size="small" 
                    title={<Text strong>选择预测目标</Text>} 
                    style={{ marginBottom: 16 }}
                    type="inner"
                    className="target-selection-card"
                  >
                    {targetOptions.length > 1 ? (
                      <Select placeholder="选择要预测的目标">
                        {targetOptions.map(target => (
                          <Option key={target} value={target}>{target}</Option>
                        ))}
                      </Select>
                    ) : (
                      <Input value={targetOptions[0]} disabled />
                    )}
                  </Card>
                </Form.Item>
              )}

              {/* 添加其他可能需要的配置项 */}
              {selectedModel === 'deep_learning' && (
                <Form.Item
                  name="confidence_interval"
                  label="计算置信区间"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}

              {/* 第四步：预测按钮 */}
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<LineChartOutlined />}
                  style={{ width: '100%' }}
                >
                  进行预测
                </Button>
              </Form.Item>
            </>
          )}
        </Form>

        {/* 显示预测结果 */}
        {renderPredictionResult()}
      </Card>
    );
  };

  // 渲染批量预测表单
  const renderBatchPredictionForm = () => {
    return (
      <Card title="批量预测" bordered={false}>
        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchPrediction}
          initialValues={{
            model_type: 'xgboost',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dataset_id"
                label="选择数据集"
                rules={[{ required: true, message: '请选择数据集' }]}
              >
                <Select 
                  placeholder="选择用于预测的数据集"
                  onChange={handleDatasetChange}
                  loading={datasetLoading}
                >
                  {datasets.map(dataset => (
                    <Option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.row_count}行 x {dataset.column_count}列)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model_type"
                label="选择模型类型"
                rules={[{ required: true, message: '请选择模型类型' }]}
              >
                <Select 
                  placeholder="选择模型类型"
                  onChange={handleModelChange}
                >
                  <Option value="xgboost">XGBoost</Option>
                  <Option value="lightgbm">LightGBM</Option>
                  <Option value="catboost">CatBoost</Option>
                  <Option value="random_forest">随机森林</Option>
                  <Option value="deep_learning">深度学习</Option>
                  <Option value="lstm">LSTM</Option>
                  <Option value="transformer">Transformer</Option>
                  <Option value="linear_regression">线性回归</Option>
                  <Option value="logistic_regression">逻辑回归</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="feature_columns"
            label="选择特征列"
            rules={[{ required: true, message: '请选择至少一个特征列' }]}
          >
            <Select 
              mode="multiple"
              placeholder="选择用于预测的特征列"
              loading={datasetLoading}
            >
              {columns.map(col => (
                <Option key={col} value={col}>{col}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<BarChartOutlined />}>
              批量预测
            </Button>
          </Form.Item>
        </Form>

        {batchPredictions.length > 0 && (
          <Card title="批量预测结果" style={{ marginTop: 16 }}>
            <Table 
              dataSource={batchPredictions.map((item, index) => ({...item, key: index}))} 
              columns={[
                { title: 'ID', dataIndex: 'id', key: 'id' },
                { title: '预测值', dataIndex: 'prediction', key: 'prediction',
                  render: (val) => typeof val === 'number' ? val.toFixed(4) : String(val) 
                },
                { title: '置信度', dataIndex: 'confidence', key: 'confidence',
                  render: (val) => val ? `${(val * 100).toFixed(2)}%` : '-'
                },
              ]}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        )}
      </Card>
    );
  };

  // 渲染可视化表单
  const renderVisualizationForm = () => {
    return (
      <Card title="预测可视化" bordered={false}>
        <Form
          form={visualizeForm}
          layout="vertical"
          onFinish={handleVisualize}
          initialValues={{
            model_type: 'xgboost',
            visualization_type: 'scatter'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dataset_id"
                label="选择数据集"
                rules={[{ required: true, message: '请选择数据集' }]}
              >
                <Select 
                  placeholder="选择用于可视化的数据集"
                  onChange={handleDatasetChange}
                  loading={datasetLoading}
                >
                  {datasets.map(dataset => (
                    <Option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.row_count}行 x {dataset.column_count}列)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model_type"
                label="选择模型类型"
                rules={[{ required: true, message: '请选择模型类型' }]}
              >
                <Select placeholder="选择模型类型">
                  <Option value="xgboost">XGBoost</Option>
                  <Option value="lightgbm">LightGBM</Option>
                  <Option value="catboost">CatBoost</Option>
                  <Option value="random_forest">随机森林</Option>
                  <Option value="deep_learning">深度学习</Option>
                  <Option value="lstm">LSTM</Option>
                  <Option value="transformer">Transformer</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="feature_columns"
                label="选择特征列"
                rules={[{ required: true, message: '请选择至少一个特征列' }]}
              >
                <Select 
                  mode="multiple"
                  placeholder="选择用于可视化的特征列"
                  loading={datasetLoading}
                >
                  {columns.map(col => (
                    <Option key={col} value={col}>{col}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="target_column"
                label="目标列 (可选)"
              >
                <Select 
                  placeholder="选择目标列 (用于比较)"
                  loading={datasetLoading}
                  allowClear
                >
                  {columns.map(col => (
                    <Option key={col} value={col}>{col}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="visualization_type"
            label="可视化类型"
            rules={[{ required: true, message: '请选择可视化类型' }]}
          >
            <Radio.Group>
              <Radio.Button value="scatter">散点图</Radio.Button>
              <Radio.Button value="line">线图</Radio.Button>
              <Radio.Button value="bar">柱状图</Radio.Button>
              <Radio.Button value="heatmap">热力图</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<PieChartOutlined />}>
              生成可视化
            </Button>
          </Form.Item>
        </Form>

        {Object.keys(visualizations).length > 0 && (
          <Card title="可视化结果" style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              {Object.entries(visualizations).map(([key, base64Image], index) => (
                <Col span={12} key={index}>
                  <Card title={key.replace(/_/g, ' ')} size="small">
                    <img 
                      src={base64Image} 
                      alt={key}
                      style={{width: '100%', maxHeight: '400px', objectFit: 'contain'}}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Card>
    );
  };

  // 渲染导出表单
  const renderExportForm = () => {
    return (
      <Card title="导出预测结果" bordered={false}>
        <Form
          form={exportForm}
          layout="vertical"
          onFinish={handleExport}
          initialValues={{
            model_type: 'xgboost',
            export_format: 'csv',
            include_actual: false
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dataset_id"
                label="选择数据集"
                rules={[{ required: true, message: '请选择数据集' }]}
              >
                <Select 
                  placeholder="选择用于导出预测结果的数据集"
                  onChange={handleDatasetChange}
                  loading={datasetLoading}
                >
                  {datasets.map(dataset => (
                    <Option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.row_count}行 x {dataset.column_count}列)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model_type"
                label="选择模型类型"
                rules={[{ required: true, message: '请选择模型类型' }]}
              >
                <Select placeholder="选择模型类型">
                  <Option value="xgboost">XGBoost</Option>
                  <Option value="lightgbm">LightGBM</Option>
                  <Option value="catboost">CatBoost</Option>
                  <Option value="random_forest">随机森林</Option>
                  <Option value="deep_learning">深度学习</Option>
                  <Option value="lstm">LSTM</Option>
                  <Option value="transformer">Transformer</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="feature_columns"
            label="选择特征列"
            rules={[{ required: true, message: '请选择至少一个特征列' }]}
          >
            <Select 
              mode="multiple"
              placeholder="选择用于预测的特征列"
              loading={datasetLoading}
            >
              {columns.map(col => (
                <Option key={col} value={col}>{col}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="export_format"
                label="导出格式"
                rules={[{ required: true, message: '请选择导出格式' }]}
              >
                <Radio.Group>
                  <Radio.Button value="csv">CSV</Radio.Button>
                  <Radio.Button value="excel">Excel</Radio.Button>
                  <Radio.Button value="json">JSON</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="include_actual"
                label="包含实际值"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {exportForm.getFieldValue('include_actual') && (
            <Form.Item
              name="target_column"
              label="目标列"
              rules={[{ required: true, message: '包含实际值时需要选择目标列' }]}
            >
              <Select 
                placeholder="选择作为实际值的目标列"
                loading={datasetLoading}
              >
                {columns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<DownloadOutlined />}>
              导出预测结果
            </Button>
          </Form.Item>
        </Form>

        {exportPath && (
          <Alert
            message="导出成功"
            description={
              <>
                <p>预测结果已导出到: <Text code>{exportPath}</Text></p>
                <Button type="link" icon={<DownloadOutlined />} onClick={() => message.info('下载功能将在真实环境中启用')}>
                  下载文件
                </Button>
              </>
            }
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  };

  return (
    <div className="prediction-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2}>预测</Title>
        </Col>
        <Col>
          <Space>
            <Text>使用模拟API:</Text>
            <Switch 
              checked={useMockAPI} 
              onChange={handleMockAPIToggle} 
              checkedChildren="开" 
              unCheckedChildren="关"
            />
          </Space>
        </Col>
      </Row>
      
      <Tabs activeKey={activeKey} onChange={setActiveKey}>
        <TabPane 
          tab={
            <span>
              <LineChartOutlined />
              单个预测
            </span>
          } 
          key="single"
        >
          {renderSinglePredictionForm()}
        </TabPane>
        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              批量预测
            </span>
          } 
          key="batch"
        >
          {renderBatchPredictionForm()}
        </TabPane>
        <TabPane 
          tab={
            <span>
              <PieChartOutlined />
              可视化
            </span>
          } 
          key="visualize"
        >
          {renderVisualizationForm()}
        </TabPane>
        <TabPane 
          tab={
            <span>
              <DownloadOutlined />
              导出结果
            </span>
          } 
          key="export"
        >
          {renderExportForm()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Prediction; 