import React, { useState, useEffect } from 'react';
import {
  Card, Button, Space, Form, Select, Input, Checkbox, Spin,
  Table, Alert, Typography, message, Row, Col, Switch, Divider,
  Tabs, Tag, Radio, Statistic, Progress, Modal
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  LineChartOutlined, 
  LoadingOutlined, 
  RocketOutlined, 
  DatabaseOutlined,
  CodeOutlined
} from '@ant-design/icons';
import axios from 'axios';
import apiService from '../api';
import { saveSensitivityAnalysis, fetchModelFeatureImportance } from '../utils/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface ColumnObject {
  title?: string;
  dataIndex?: string;
  name?: string;
  [key: string]: any;
}

interface Dataset {
  id: number;
  name: string;
  description?: string;
  row_count: number;
  column_count: number;
}

interface TrainedModel {
  id: string;
  name: string;
  model_type: string;
  created_at: string;
  features: string[];
  target: string;
  file_path: string;
  feature_importance?: Record<string, number>;
}

interface TrainModelRequest {
  dataset_id?: number;
  name?: string;
  model_type: string;
  target_column: string;
  feature_columns: string[];
  model_params: Record<string, any>;
  train_params: Record<string, any>;
  conditional_columns?: string[];
  conditional_embedding?: string;
}

interface TrainModelResponse {
  success: boolean;
  message: string;
  metrics?: Record<string, any>;
  model_path?: string;
}

// 添加模型评估的接口
interface ModelEvaluationResult {
  model_name: string;
  model_type: string;
  metrics: Record<string, any>;
  confusion_matrix?: number[][];
  feature_importance?: Record<string, number>;
  roc_curve?: { fpr: number[], tpr: number[], thresholds: number[] };
}

const ModelTraining: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { datasetId } = useParams<{ datasetId: string }>();
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [trainingResult, setTrainingResult] = useState<TrainModelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 添加selectedDataset状态
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);

  // 用于控制是否使用模拟数据
  const [useMockAPI, setUseMockAPI] = useState(localStorage.getItem('use_mock_api') === 'true');

  // 高级参数控制
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [selectedModelType, setSelectedModelType] = useState<string>('xgboost');
  
  const [datasetColumns, setDatasetColumns] = useState<string[]>([]);
  const [supportConditional, setSupportConditional] = useState<boolean>(false);
  const [conditionalColumns, setConditionalColumns] = useState<string[]>([]);
  const [conditionalEmbedding, setConditionalEmbedding] = useState<string>('concat');

  // 在state中添加自然语言条件输入相关状态
  const [conditionalTextInput, setConditionalTextInput] = useState<string>("");
  const [isParsingText, setIsParsingText] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<any>(null);

  // 添加已训练模型状态
  const [trainedModels, setTrainedModels] = useState<TrainedModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('training');
  
  // 添加评估相关状态
  const [evaluationForm] = Form.useForm();
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ModelEvaluationResult | null>(null);
  const [selectedModelForEvaluation, setSelectedModelForEvaluation] = useState<TrainedModel | null>(null);

  // 新增useState
  const [sensitivityModalVisible, setSensitivityModalVisible] = useState(false);
  const [currentSensitivityModel, setCurrentSensitivityModel] = useState<TrainedModel|null>(null);
  const [currentFeatureImportance, setCurrentFeatureImportance] = useState<{name:string,importance:number}[]>([]);

  // 在组件初始化时检查当前选择的模型是否支持条件信息
  useEffect(() => {
    const currentModelType = form.getFieldValue('model_type');
    if (currentModelType) {
      setSupportConditional(checkConditionalSupport(currentModelType));
    }
  }, []);

  // 加载数据集列表
  useEffect(() => {
    fetchDatasets();
    fetchTrainedModels();
  }, []);

  // 如果URL中有数据集ID，自动选择
  useEffect(() => {
    if (datasetId) {
      form.setFieldsValue({ dataset_id: parseInt(datasetId, 10) });
      fetchDatasetColumns(parseInt(datasetId, 10));
    }
  }, [datasetId, form]);

  // 模型切换时重置参数
  useEffect(() => {
    if (selectedModelType) {
      // 根据模型类型设置默认参数
      setModelDefaultParams(selectedModelType);
    }
  }, [selectedModelType, form]);

  const fetchDatasets = async () => {
    setDatasetLoading(true);
    try {
      if (useMockAPI) {
        // 模拟数据
        setDatasets([
          { id: 1, name: '风险评估数据集', description: '包含缺失值的风险评估数据集', row_count: 1000, column_count: 15 },
          { id: 2, name: '金融风险数据', description: '金融风险分析样本数据', row_count: 500, column_count: 10 },
        ]);
      } else {
        // 使用API服务
        const datasets = await apiService.fetchDatasets();
        setDatasets(datasets);
      }
    } catch (err: any) {
      console.error('获取数据集列表失败:', err);
      message.error(`获取数据集列表失败: ${err.message}`);
    } finally {
      setDatasetLoading(false);
    }
  };

  const fetchDatasetColumns = async (datasetId: number) => {
    try {
      setSelectedDataset(datasetId);
      setDatasetLoading(true);
      message.loading({ content: '正在加载数据集列信息...', key: 'dataset_columns' });
      
      console.log(`获取数据集 ${datasetId} 的列信息`);
      
      let columnsData: string[] = [];
      
      if (useMockAPI) {
        // 使用模拟数据
        columnsData = ['价格', '面积', '房龄', '位置', '楼层', '朝向', '装修', '学区', '交通', '环境'];
        console.log('使用模拟数据:', columnsData);
      } else {
        try {
          // 使用API服务
          const result = await apiService.fetchDatasetColumns(datasetId);
          columnsData = result.columns;
          console.log('API返回的列信息:', columnsData);
        } catch (error: any) {
          console.error('获取详细列信息失败:', error);
          message.warning('API请求失败，将使用模拟数据继续');
          
          // 切换到模拟API模式
          setUseMockAPI(true);
          
          // 使用备用模拟数据
          columnsData = ['价格', '面积', '房龄', '位置', '楼层', '朝向', '装修', '学区', '交通', '环境'];
        }
      }
      
      // 如果列信息为空，使用默认列
      if (!columnsData || columnsData.length === 0) {
        message.warning('未获取到列信息，使用默认列');
        columnsData = ['特征1', '特征2', '特征3', '目标变量'];
      }
      
      // 设置列信息
      setColumns(columnsData);
      
      // 尝试预设表单值
      try {
        form.setFieldsValue({
          target_column: columnsData[columnsData.length - 1], // 默认选择最后一列作为目标
          feature_columns: columnsData.slice(0, -1) // 默认选择除最后一列外的所有列作为特征
        });
      } catch (formError) {
        console.error('设置表单默认值失败:', formError);
      }
      
      message.success({ content: '数据集列信息加载成功', key: 'dataset_columns' });
    } catch (err) {
      console.error('处理数据集变更时出错:', err);
      message.error({ content: '数据集列信息加载失败', key: 'dataset_columns' });
    } finally {
      setDatasetLoading(false);
    }
  };

  // 修改fetchDatasetColumnsInfo函数，添加更多的错误处理
  const fetchDatasetColumnsInfo = async (datasetId: number) => {
    try {
      // 修正API路径
      const response = await axios.get(`/api/preview_dataset/${datasetId}/`, {
        timeout: 5000 // 添加超时设置
      });
      
      if (response.data && Array.isArray(response.data.columns) && response.data.columns.length > 0) {
        // 提取列名
        const columnsInfo = response.data.columns;
        let columnNames: string[] = [];
        
        // 处理不同的返回格式
        if (typeof columnsInfo[0] === 'string') {
          columnNames = columnsInfo as string[];
        } else if (typeof columnsInfo[0] === 'object') {
          columnNames = columnsInfo.map((col: ColumnObject) => col.dataIndex || col.title || col.name || '');
        }
        
        setColumns(columnNames);
        console.log('详细列信息:', columnsInfo);
        
        // 默认设置目标列为最后一列
        const targetColumn = columnNames[columnNames.length - 1];
        // 默认设置特征列为除最后一列外的所有列
        const featureColumns = columnNames.slice(0, -1);
        
        // 更新表单值
        form.setFieldsValue({
          target_column: targetColumn,
          feature_columns: featureColumns,
        });
      } else {
        throw new Error('API返回格式不正确或没有列数据');
      }
    } catch (error: any) {
      console.error('获取详细列信息失败:', error);
      
      if (error.response) {
        // 服务器响应了，但状态码不在2xx范围内
        throw new Error(`服务器返回错误状态码: ${error.response.status} - ${error.response.data?.detail || '未知服务器错误'}`);
      } else if (error.request) {
        // 请求已发出，但没有收到响应
        throw new Error('服务器无响应，请检查网络连接或服务器状态');
      } else {
        // 在设置请求时发生错误
        throw error;
      }
    }
  };

  // 修改handleDatasetChange函数
  const handleDatasetChange = async (value: number) => {
    await fetchDatasetColumns(value);
  };

  const setModelDefaultParams = (modelType: string) => {
    // 重置模型特有的参数
    const modelDefaults: Record<string, any> = {
      xgboost: {
        model_params: {
          n_estimators: 100,
          learning_rate: 0.1,
          max_depth: 3,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      random_forest: {
        model_params: {
          n_estimators: 100,
          max_depth: 10,
          random_state: 42,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      neural_network: {
        model_params: {
          hidden_layer_sizes: '64,32',
          activation: 'relu',
          learning_rate_init: 0.001,
          max_iter: 200,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
          validation_split: 0.1,
        }
      },
      svm: {
        model_params: {
          kernel: 'rbf',
          C: 1.0,
          gamma: 'scale',
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      deep_learning: {
        model_params: {
          architecture: 'mlp',
          layers: '128,64,32',
          activation: 'relu',
          dropout_rate: 0.2,
          epochs: 50,
          batch_size: 32,
        },
        train_params: {
          test_size: 0.2,
          validation_split: 0.1,
          random_state: 42,
          early_stopping: true,
          patience: 10,
        }
      },
      lightgbm: {
        model_params: {
          n_estimators: 100,
          learning_rate: 0.1,
          num_leaves: 31,
          boosting_type: 'gbdt',
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      catboost: {
        model_params: {
          iterations: 500,
          learning_rate: 0.05,
          depth: 6,
          loss_function: 'RMSE',
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      linear_regression: {
        model_params: {
          fit_intercept: true,
          normalize: false,
          n_jobs: -1,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      logistic_regression: {
        model_params: {
          C: 1.0,
          penalty: 'l2',
          solver: 'lbfgs',
          max_iter: 100,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      decision_tree: {
        model_params: {
          max_depth: 5,
          min_samples_split: 2,
          min_samples_leaf: 1,
          criterion: 'gini',
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      knn: {
        model_params: {
          n_neighbors: 5,
          weights: 'uniform',
          algorithm: 'auto',
          p: 2, // 欧氏距离
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      naive_bayes: {
        model_params: {
          var_smoothing: 1e-9,
        },
        train_params: {
          test_size: 0.2,
          random_state: 42,
        }
      },
      lstm: {
        model_params: {
          units: 50,
          dropout: 0.2,
          recurrent_dropout: 0.2,
          activation: 'tanh',
          recurrent_activation: 'sigmoid',
          epochs: 50,
          batch_size: 32,
        },
        train_params: {
          test_size: 0.2,
          validation_split: 0.1,
          random_state: 42,
          early_stopping: true,
          patience: 10,
          sequence_length: 10,
        }
      },
      gru: {
        model_params: {
          units: 50,
          dropout: 0.2,
          recurrent_dropout: 0.2,
          activation: 'tanh',
          recurrent_activation: 'sigmoid',
          epochs: 50,
          batch_size: 32,
        },
        train_params: {
          test_size: 0.2,
          validation_split: 0.1,
          random_state: 42,
          early_stopping: true,
          patience: 10,
          sequence_length: 10,
        }
      },
      transformer: {
        model_params: {
          d_model: 128,
          num_heads: 8,
          num_encoder_layers: 6,
          num_decoder_layers: 6,
          dim_feedforward: 512,
          dropout: 0.1,
          epochs: 50,
          batch_size: 32,
        },
        train_params: {
          test_size: 0.2,
          validation_split: 0.1,
          random_state: 42,
          early_stopping: true,
          patience: 10,
        }
      },
    };

    // 设置默认值
    if (modelDefaults[modelType]) {
      form.setFieldsValue({
        model_params: modelDefaults[modelType].model_params,
        train_params: modelDefaults[modelType].train_params,
      });
    }
  };

  // 处理模拟API切换
  const handleMockAPIToggle = (checked: boolean) => {
    setUseMockAPI(checked);
    localStorage.setItem('use_mock_api', checked ? 'true' : 'false');
    message.info(`${checked ? '启用' : '禁用'}模拟API`);
    
    // 重新加载数据
    fetchDatasets();
    const datasetId = form.getFieldValue('dataset_id');
    if (datasetId) {
      fetchDatasetColumns(datasetId);
    }
  };

  // 检查模型是否支持条件信息
  const checkConditionalSupport = (modelType: string) => {
    const conditionalSupportedModels = ['deep_learning', 'lightgbm', 'catboost', 'lstm', 'gru', 'transformer'];
    return conditionalSupportedModels.includes(modelType.toLowerCase());
  };

  // 在模型类型改变时检查是否支持条件信息
  const handleModelTypeChange = (value: string) => {
    setSelectedModelType(value);
    form.setFieldsValue({ model_type: value });
    setModelDefaultParams(value);
    const supportsConditional = checkConditionalSupport(value);
    setSupportConditional(supportsConditional);
    console.log(`模型${value}是否支持条件信息: ${supportsConditional}`);
    
    // 如果模型支持条件信息但高级设置隐藏，自动显示高级设置
    if (supportsConditional && !showAdvancedSettings) {
      setShowAdvancedSettings(true);
      message.info('已自动显示高级设置，您可以在"模型参数"选项卡下设置条件信息');
    }
  };

  // 文本条件信息解析函数
  const parseConditionalText = async () => {
    if (!conditionalTextInput.trim()) {
      message.warning("请先输入条件描述文本");
      return;
    }

    setIsParsingText(true);
    try {
      // 这里模拟调用语言模型API解析文本
      // 实际项目中应替换为真实的API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟解析结果
      const result = {
        parsed: true,
        condition_variables: ["FM", "DT"],
        embedding_method: "attention",
        explanation: `已解析条件描述，推荐使用 FM 和 DT 作为条件变量，采用注意力机制嵌入方法。`
      };
      
      setParsedResult(result);
      
      // 如果解析成功，自动更新条件变量和嵌入方法
      if (result.condition_variables && result.condition_variables.length > 0) {
        setConditionalColumns(result.condition_variables);
        form.setFieldsValue({ conditional_columns: result.condition_variables });
      }
      
      if (result.embedding_method) {
        setConditionalEmbedding(result.embedding_method);
        form.setFieldsValue({ conditional_embedding: result.embedding_method });
      }
      
      message.success("条件描述解析成功");
    } catch (error) {
      console.error("解析条件文本时出错:", error);
      message.error("无法解析条件描述文本");
    } finally {
      setIsParsingText(false);
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    setTrainingResult(null);
    
    try {
      // 准备训练请求数据
      const requestData: TrainModelRequest = {
        dataset_id: values.dataset_id,
        model_type: values.model_type,
        target_column: values.target_column,
        feature_columns: values.feature_columns,
        model_params: values.model_params || {},
        train_params: values.train_params || {},
      };
      
      // 添加模型名称
      if (values.model_name) {
        requestData.name = values.model_name;
      }
      
      // 如果选择了条件列
      if (supportConditional && conditionalColumns.length > 0) {
        requestData.conditional_columns = conditionalColumns;
        requestData.conditional_embedding = conditionalEmbedding || 'concat';
      }

      if (useMockAPI) {
        // 模拟API响应
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mockResult = {
          success: true,
          message: `模型 ${values.model_type} 训练成功`,
          metrics: {
            train_accuracy: 0.95,
            test_accuracy: 0.92,
            train_f1: 0.94,
            test_f1: 0.91,
          },
          model_path: `/models/${values.model_type}_model.pkl`
        };
        setTrainingResult(mockResult);
        message.success('模型训练成功');
        
        // 训练成功后刷新模型列表并切换到模型列表标签页
        await fetchTrainedModels();
        setActiveTab('models');
      } else {
        const response = await axios.post('/api/train_model/', requestData);
        setTrainingResult(response.data);
        message.success('模型训练成功');
        
        // 训练成功后刷新模型列表并切换到模型列表标签页
        await fetchTrainedModels();
        setActiveTab('models');
      }
    } catch (err: any) {
      console.error('模型训练失败:', err);
      const errorMessage = err.response?.data?.detail || err.message;
      setError(`模型训练失败: ${errorMessage}`);
      message.error(`模型训练失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 添加获取已训练模型列表的函数
  const fetchTrainedModels = async () => {
    setModelsLoading(true);
    try {
      if (useMockAPI) {
        // 模拟数据
        setTrainedModels([
          { id: 'xgboost', name: 'XGBoost风险预测模型', model_type: 'xgboost', created_at: '2023-05-20', features: ['年龄', '收入', '债务比率'], target: '风险评分', file_path: 'models/xgboost_model.pkl' },
          { id: 'deep_learning', name: '深度学习洪水预测', model_type: 'deep_learning', created_at: '2023-06-15', features: ['降雨量', '水位', '流速'], target: '洪水概率', file_path: 'models/deep_learning_model.pkl' },
          { id: 'lstm', name: 'LSTM时序风险模型', model_type: 'lstm', created_at: '2023-07-10', features: ['历史违约率', '市场波动', '利率'], target: '未来风险趋势', file_path: 'models/lstm_model.pkl' }
        ]);
        setModelsLoading(false);
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
      setModelsLoading(false);
    }
  };

  // 跳转到预测页面并选择模型
  const goToPredictionWithModel = (modelId: string) => {
    navigate(`/prediction?model=${modelId}`);
  };

  // 敏感性分析弹窗保存函数
  const handleSaveSensitivityAnalysis = async () => {
    if (!currentSensitivityModel) return;
    try {
      await saveSensitivityAnalysis({
        model_id: currentSensitivityModel.id,
        feature_importance: currentFeatureImportance,
        category: '敏感性分析'
      });
      message.success('敏感性分析结果已保存到数据库');
      setSensitivityModalVisible(false);
    } catch (e) {
      message.error('保存敏感性分析结果失败');
    }
  };

  // 敏感性分析弹窗渲染
  const renderSensitivityModal = () => (
    <Modal
      title={currentSensitivityModel ? `模型"${currentSensitivityModel.name}"的敏感性分析` : '敏感性分析'}
      open={sensitivityModalVisible}
      onCancel={() => setSensitivityModalVisible(false)}
      onOk={handleSaveSensitivityAnalysis}
      okText="保存分析结果"
      cancelText="关闭"
    >
      {currentFeatureImportance.length > 0 ? (
        <Table
          dataSource={currentFeatureImportance}
          columns={[
            { title: '因素', dataIndex: 'name', key: 'name' },
            { title: '重要性', dataIndex: 'importance', key: 'importance' }
          ]}
          rowKey="name"
          pagination={false}
          size="small"
        />
      ) : (
        <Alert message="该模型暂无敏感性分析结果（feature_importance）" type="info" />
      )}
    </Modal>
  );

  // 修改已训练模型列表，增加"敏感性分析"按钮
  const renderTrainedModelsList = () => {
    const columns = [
      {
        title: '模型名称',
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: TrainedModel) => (
          <span>
            <Text strong>{text}</Text>
            <br />
            <Tag color="blue">{record.model_type}</Tag>
          </span>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
      },
      {
        title: '目标变量',
        dataIndex: 'target',
        key: 'target',
      },
      {
        title: '特征变量',
        dataIndex: 'features',
        key: 'features',
        render: (features: string[]) => (
          <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {features && features.length > 0
              ? features.slice(0, 3).join(', ') + (features.length > 3 ? '...' : '')
              : '无特征信息'}
          </div>
        ),
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: TrainedModel) => (
          <Space size="small">
            <Button 
              type="primary" 
              size="small" 
              onClick={() => goToPredictionWithModel(record.id)}
            >
              使用此模型预测
            </Button>
            <Button 
              size="small"
              onClick={() => message.info(`查看模型 ${record.name} 的详情`)}
            >
              查看详情
            </Button>
            <Button
              size="small"
              onClick={async () => {
                // 获取feature_importance
                let fi: {name:string,importance:number}[] = [];
                if (record.feature_importance) {
                  fi = Object.entries(record.feature_importance).map(([name, importance]) => ({ name, importance: Number(importance) }));
                } else {
                  // 可选：从后端拉取
                  try {
                    const res = await fetchModelFeatureImportance(record.id);
                    fi = res.feature_importance ? Object.entries(res.feature_importance).map(([name, importance]) => ({ name, importance: Number(importance) })) : [];
                  } catch {}
                }
                setCurrentSensitivityModel(record);
                setCurrentFeatureImportance(fi);
                setSensitivityModalVisible(true);
              }}
            >
              敏感性分析
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <Card title="已训练模型" extra={<Button type="primary" onClick={fetchTrainedModels} icon={<LoadingOutlined />}>刷新</Button>}>
        <Table
          dataSource={trainedModels}
          columns={columns}
          rowKey="id"
          loading={modelsLoading}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    );
  };

  // 渲染模型参数表单
  const renderModelParamsForm = () => {
    const modelType = form.getFieldValue('model_type') || selectedModelType;
    
    return (
      <div className="model-params-form">
        {/* 移除重复的模型类型、目标变量和特征变量选择 */}
        
        {/* 保留模型特定参数设置 */}
        <Divider orientation="left">模型特定参数</Divider>
        
        {modelType === 'xgboost' && (
          <>
            <Form.Item
              name={['model_params', 'n_estimators']}
              label="树的数量"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'learning_rate']} 
              label="学习率"
              rules={[{ required: true }]}
            >
              <Input type="number" min={0.001} max={1} step={0.001} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'max_depth']} 
              label="最大深度"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
          </>
        )}
        
        {modelType === 'random_forest' && (
          <>
            <Form.Item
              name={['model_params', 'n_estimators']}
              label="决策树数量"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'max_depth']} 
              label="最大深度"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item
              name={['model_params', 'random_state']}
              label="随机种子"
            >
              <Input type="number" />
            </Form.Item>
          </>
        )}
        
        {modelType === 'neural_network' && (
          <>
            <Form.Item
              name={['model_params', 'hidden_layer_sizes']}
              label="隐藏层大小"
              tooltip="以逗号分隔的神经元数量，如'64,32'表示两个隐藏层，分别有64和32个神经元"
              rules={[{ required: true }]}
            >
              <Input placeholder="例如：64,32" />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'activation']} 
              label="激活函数"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="relu">ReLU</Option>
                <Option value="tanh">Tanh</Option>
                <Option value="sigmoid">Sigmoid</Option>
              </Select>
            </Form.Item>
            <Form.Item 
              name={['model_params', 'learning_rate_init']} 
              label="初始学习率"
              rules={[{ required: true }]}
            >
              <Input type="number" min={0.0001} step={0.0001} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'max_iter']} 
              label="最大迭代次数"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
          </>
        )}
        
        {modelType === 'deep_learning' && (
          <>
            <Form.Item
              name={['model_params', 'architecture']}
              label="网络架构"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="mlp">多层感知器</Option>
                <Option value="cnn">卷积神经网络</Option>
                <Option value="lstm">长短期记忆网络</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name={['model_params', 'layers']}
              label="层结构"
              tooltip="以逗号分隔的神经元数量，如'128,64,32'"
              rules={[{ required: true }]}
            >
              <Input placeholder="例如：128,64,32" />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'activation']} 
              label="激活函数"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="relu">ReLU</Option>
                <Option value="tanh">Tanh</Option>
                <Option value="sigmoid">Sigmoid</Option>
                <Option value="leaky_relu">Leaky ReLU</Option>
              </Select>
            </Form.Item>
            <Form.Item 
              name={['model_params', 'dropout_rate']} 
              label="Dropout比率"
            >
              <Input type="number" min={0} max={1} step={0.1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'epochs']} 
              label="训练轮数"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'batch_size']} 
              label="批次大小"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
          </>
        )}
        
        {/* 其他模型类型的参数设置保持不变 */}
        {modelType === 'svm' && (
          <>
            <Form.Item
              name={['model_params', 'kernel']}
              label="核函数"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="linear">线性</Option>
                <Option value="poly">多项式</Option>
                <Option value="rbf">径向基函数</Option>
                <Option value="sigmoid">Sigmoid</Option>
              </Select>
            </Form.Item>
            <Form.Item 
              name={['model_params', 'C']} 
              label="正则化参数C"
              rules={[{ required: true }]}
            >
              <Input type="number" min={0.1} step={0.1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'gamma']} 
              label="核系数gamma"
            >
              <Select>
                <Option value="scale">scale</Option>
                <Option value="auto">auto</Option>
              </Select>
            </Form.Item>
          </>
        )}
        
        {/* 继续保留其他模型参数设置 */}
        {modelType === 'lightgbm' && (
          <>
            <Form.Item
              name={['model_params', 'n_estimators']}
              label="迭代次数"
              rules={[{ required: true }]}
            >
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'learning_rate']} 
              label="学习率"
              rules={[{ required: true }]}
            >
              <Input type="number" min={0.001} max={1} step={0.001} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'num_leaves']} 
              label="叶子数"
              rules={[{ required: true }]}
            >
              <Input type="number" min={2} />
            </Form.Item>
            <Form.Item 
              name={['model_params', 'boosting_type']} 
              label="提升类型"
            >
              <Select>
                <Option value="gbdt">GBDT</Option>
                <Option value="dart">DART</Option>
                <Option value="goss">GOSS</Option>
                <Option value="rf">RF</Option>
              </Select>
            </Form.Item>
          </>
        )}
        
        {/* 保留其他模型类型的特定参数设置 */}
        {/* ... 其他模型的参数设置保持不变 ... */}
      </div>
    );
  };

  // 渲染训练参数表单
  const renderTrainParamsForm = () => {
    return (
      <>
        <Form.Item
          name={['train_params', 'test_size']}
          label="测试集比例"
          tooltip="用于测试的数据比例，如0.2表示20%的数据用于测试"
          rules={[{ required: true }]}
        >
          <Input type="number" min={0.1} max={0.5} step={0.05} />
        </Form.Item>
        <Form.Item
          name={['train_params', 'random_state']}
          label="随机种子"
          tooltip="用于数据分割的随机种子，确保结果可重现"
        >
          <Input type="number" />
        </Form.Item>
        {form.getFieldValue('model_type') === 'neural_network' || 
         form.getFieldValue('model_type') === 'deep_learning' ? (
          <>
            <Form.Item
              name={['train_params', 'validation_split']}
              label="验证集比例"
              tooltip="从训练集中划分验证集的比例"
            >
              <Input type="number" min={0} max={0.5} step={0.05} />
            </Form.Item>
            <Form.Item
              name={['train_params', 'early_stopping']}
              label="早停"
              valuePropName="checked"
              tooltip="启用早停可防止过拟合"
            >
              <Checkbox>启用早停</Checkbox>
            </Form.Item>
            {form.getFieldValue(['train_params', 'early_stopping']) && (
              <Form.Item
                name={['train_params', 'patience']}
                label="早停耐心值"
                tooltip="指标不再改善后继续训练的轮数"
              >
                <Input type="number" min={1} />
              </Form.Item>
            )}
          </>
        ) : null}
      </>
    );
  };

  // 渲染训练结果
  const renderTrainingResult = () => {
    if (!trainingResult) return null;
    
    return (
      <Card title="训练结果" style={{ marginTop: 16 }}>
        <Alert
          message={trainingResult.success ? "模型训练成功" : "模型训练失败"}
          description={trainingResult.message}
          type={trainingResult.success ? "success" : "error"}
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        {trainingResult.metrics && (
          <>
            <Title level={4}>性能指标</Title>
            <Row gutter={[16, 16]}>
              {Object.entries(trainingResult.metrics).map(([key, value]) => (
                <Col span={8} key={key}>
                  <Card size="small">
                    <Paragraph style={{ margin: 0 }}>
                      <Text strong>{key.replace(/_/g, ' ')}:</Text>{' '}
                      <Tag color="blue">{typeof value === 'number' ? value.toFixed(4) : value}</Tag>
                    </Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}
        
        {trainingResult.model_path && (
          <div style={{ marginTop: 16 }}>
            <Text strong>模型保存路径: </Text>
            <Text code>{trainingResult.model_path}</Text>
          </div>
        )}
        
        <div style={{ marginTop: 16 }}>
          <Space>
            <Button 
              type="primary"
              icon={<LineChartOutlined />}
              onClick={() => navigate('/prediction')}
            >
              使用模型进行预测
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className="model-training-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2}>模型训练</Title>
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

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={<span><RocketOutlined />训练新模型</span>} 
          key="training"
        >
          <Card title="配置模型训练">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                model_type: 'xgboost',
                model_params: {},
                train_params: {},
                advanced: false
              }}
            >
              <Form.Item
                name="model_name"
                label="模型名称"
                rules={[{ required: false, message: '请输入模型名称' }]}
                tooltip="给模型起一个容易识别的名称，如果不提供将使用默认名称"
              >
                <Input placeholder="输入模型名称（可选）" />
              </Form.Item>
              
              <Form.Item
                name="dataset_id"
                label="选择数据集"
                rules={[{ required: true, message: '请选择数据集' }]}
              >
                <Select 
                  placeholder="选择用于训练的数据集"
                  loading={datasetLoading}
                  onChange={handleDatasetChange}
                >
                  {datasets.map(dataset => (
                    <Option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.row_count}行 x {dataset.column_count}列)
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="target_column"
                label="目标列"
                rules={[{ required: true, message: '请选择目标列' }]}
              >
                <Select 
                  placeholder="选择要预测的目标列"
                  loading={datasetLoading}
                >
                  {columns.map(col => (
                    <Option key={col} value={col}>{col}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="feature_columns"
                label="特征列"
                rules={[{ required: true, message: '请选择至少一个特征列' }]}
              >
                <Select 
                  mode="multiple" 
                  placeholder="选择用于训练的特征列"
                  loading={datasetLoading}
                >
                  {columns.map(col => (
                    <Option key={col} value={col}>{col}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="model_type"
                label="模型类型"
                rules={[{ required: true, message: '请选择模型类型' }]}
              >
                <Select 
                  placeholder="选择要训练的模型类型" 
                  onChange={handleModelTypeChange}
                >
                  <Option value="xgboost">XGBoost</Option>
                  <Option value="random_forest">随机森林</Option>
                  <Option value="neural_network">神经网络</Option>
                  <Option value="svm">支持向量机</Option>
                  <Option value="deep_learning">深度学习 (支持条件信息)</Option>
                  <Option value="lightgbm">LightGBM (支持条件信息)</Option>
                  <Option value="catboost">CatBoost (支持条件信息)</Option>
                  <Option value="linear_regression">线性回归</Option>
                  <Option value="logistic_regression">逻辑回归</Option>
                  <Option value="decision_tree">决策树</Option>
                  <Option value="knn">K近邻</Option>
                  <Option value="naive_bayes">朴素贝叶斯</Option>
                  <Option value="lstm">长短期记忆网络 (支持条件信息)</Option>
                  <Option value="gru">门控循环单元 (支持条件信息)</Option>
                  <Option value="transformer">Transformer (支持条件信息)</Option>
                </Select>
              </Form.Item>

              {/* 高级设置部分 */}
              <Divider orientation="left">
                <a 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  style={{ cursor: 'pointer' }}
                >
                  {showAdvancedSettings ? '隐藏高级设置' : '显示高级设置'}
                </a>
              </Divider>
              
              {showAdvancedSettings && (
                <div className="advanced-settings">
                  <Alert
                    message="高级设置"
                    description="在此配置模型的高级参数，这些参数会影响模型的训练过程和性能表现"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <Tabs defaultActiveKey="model_params">
                    <TabPane tab="模型参数" key="model_params">
                      <Row gutter={16}>
                        <Col span={24}>
                          {renderModelParamsForm()}
                        </Col>
                      </Row>
                    </TabPane>
                    <TabPane tab="训练参数" key="train_params">
                      <Row gutter={16}>
                        <Col span={24}>
                          {renderTrainParamsForm()}
                        </Col>
                      </Row>
                    </TabPane>
                  </Tabs>
                </div>
              )}

              <Form.Item style={{ marginTop: 16 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<RocketOutlined />}
                >
                  开始训练
                </Button>
              </Form.Item>
            </Form>
          </Card>
          {trainingResult && renderTrainingResult()}
        </TabPane>
        <TabPane 
          tab={<span><DatabaseOutlined />已训练模型</span>} 
          key="models"
        >
          {renderTrainedModelsList()}
        </TabPane>
      </Tabs>
      {renderSensitivityModal()}
    </div>
  );
};

export default ModelTraining;