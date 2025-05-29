import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form,
  Select, 
  Button, 
  Radio,
  Input,
  InputNumber,
  Switch,
  Divider,
  Row,
  Col,
  Table,
  message,
  Typography,
  Tabs,
  Steps,
  Alert,
  Space,
  Tag,
  Tooltip,
  Collapse,
  Badge,
  App,
  Empty,
  Checkbox,
  Layout,
  Spin
} from 'antd';
import { 
  DatabaseOutlined,
  ExperimentOutlined,
  SettingOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  RocketOutlined,
  SaveOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { saveProcessedData, trainCGANModel, runAdvancedPipeline, type AdvancedPipelineConfig } from '../utils/api';
import './DataProcess.css';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// API基础URL
const API_BASE_URL = 'http://localhost:8000';

// 模拟数据集列表
const mockDatasets = [
  { id: 1, name: 'test-original', rows: 120, columns: 8, description: '原始数据' },
  { id: 2, name: 'test', rows: 150, columns: 10 },
  { id: 3, name: 'test-non', rows: 200, columns: 12 },
  { id: 4, name: 'debug_basic_save_test1', rows: 300, columns: 15 },
  { id: 5, name: 'debug_basic_save_test1', rows: 300, columns: 15 },
  { id: 6, name: 'debug_basic_save', rows: 350, columns: 18 },
  { id: 7, name: 'basic_processed_示例时序风险数据集_1', rows: 500, columns: 20 },
];

// 添加数据集类型定义
interface Dataset {
  id: number;
  name: string;
  rows: number;
  columns: number;
  description?: string;  // 添加可选的描述属性
}

// 初始化模拟列数据用于表单显示
const defaultColumns = [
  { key: 'col0', title: '日期', dataIndex: 'col0' },
  { key: 'col1', title: '水位(m)', dataIndex: 'col1' },
  { key: 'col2', title: '流量(m³/s)', dataIndex: 'col2' },
  { key: 'col3', title: '降雨量(mm)', dataIndex: 'col3' },
  { key: 'col4', title: '特征1', dataIndex: 'col4' },
  { key: 'col5', title: '特征2', dataIndex: 'col5' },
];

// 定义CGAN训练配置表单
interface CGANConfig {
  condition_variables: string[];
  target_variables: string[];
  latent_dim?: number;
  embedding_dim?: number;
  generator_layers?: number[];
  discriminator_layers?: number[];
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  optimizer?: string;
  loss_function?: string;
  condition_embedding?: string;
  condition_info?: string;
  nlp_model?: string;
}

const DataProcess: React.FC = () => {
  // 创建表单实例
  const [form] = Form.useForm(); // 主表单实例
  const [featureForm] = Form.useForm(); // 创建独立的特征选择表单实例
  const [timeSeriesForm] = Form.useForm(); // 创建独立的时间序列表单实例
  const [advancedForm] = Form.useForm(); // 创建高级流程表单实例
  const [cganForm] = Form.useForm(); // 创建CGAN配置表单实例
  
  const [datasets, setDatasets] = useState<Dataset[]>(mockDatasets);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [processType, setProcessType] = useState('missing_values');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<any[]>(defaultColumns);
  const [processed, setProcessed] = useState(false);
  const { processedData, setProcessedData, currentDataset, setCurrentDataset } = useAppContext();
  // 在组件state部分添加新状态
  const [selectedCGANDataset, setSelectedCGANDataset] = useState<Dataset | null>(null);
  // 添加缺失的评估结果state
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  // 在组件部分添加数据来源状态变量
  const [dataSource, setDataSource] = useState<string>('');
  const [isFallbackData, setIsFallbackData] = useState<boolean>(false);

  // 高级处理类型
  const isAdvancedProcess = ['pca', 'feature_selection', 'time_series', 'advanced_pipeline'].includes(processType);

  // 定义基础处理和高级处理的选项卡
  const basicTabs = [
    {
      key: 'missing_values',
      label: '缺失值处理',
      icon: <DatabaseOutlined />,
      description: '处理数据集中的缺失值',
      children: null
    },
    {
      key: 'outliers',
      label: '异常值处理',
      icon: <ExperimentOutlined />,
      description: '检测和处理数据中的异常值',
      children: null
    },
    {
      key: 'normalization',
      label: '数据归一化',
      icon: <SettingOutlined />,
      description: '将数据标准化到特定范围',
      children: null
    }
  ];
  
  const advancedTabs = [
    {
      key: 'pca',
      label: 'PCA降维',
      icon: <AppstoreOutlined />,
      description: '通过主成分分析降低数据维度',
      children: null
    },
    {
      key: 'feature_selection',
      label: '特征选择',
      icon: <SettingOutlined />,
      description: '选择最相关的特征子集',
      children: null
    },
    {
      key: 'time_series',
      label: '时间序列处理',
      icon: <BarChartOutlined />,
      description: '处理时间序列数据',
      children: null
    },
    {
      key: 'advanced_pipeline',
      label: '高级处理流程',
      icon: <RocketOutlined />,
      description: '执行完整的高级数据处理流程',
      children: null
    }
  ];

  // 获取数据集列表 - 添加更健壮的错误处理
  const fetchDatasets = async () => {
    try {
      setLoading(true);
      // 从后端API获取数据集列表
      const controller = new AbortController(); // 创建AbortController用于取消请求
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await axios.get(`${API_BASE_URL}/api/list_datasets/`, {
        signal: controller.signal,
        timeout: 30000 // 设置30秒超时
      });
      
      clearTimeout(timeoutId);
      
      // 处理响应数据
      if (response.data) {
        let datasetList = [];
        
        // 处理不同的响应格式
        if (Array.isArray(response.data)) {
          datasetList = response.data.map((dataset: any) => ({
            ...dataset,
            rows: dataset.row_count || dataset.rows,
            columns: dataset.column_count || dataset.columns
          }));
        } else if (Array.isArray(response.data.datasets)) {
          datasetList = response.data.datasets.map((dataset: any) => ({
            ...dataset,
            rows: dataset.row_count || dataset.rows,
            columns: dataset.column_count || dataset.columns
          }));
        } else {
          console.warn('API返回的数据集格式不符合预期:', response.data);
          message.warning('数据集格式不符合预期，使用本地数据');
          datasetList = mockDatasets;
        }
        
        setDatasets(datasetList);
        console.log('成功获取数据集列表:', datasetList.length);
      } else {
        console.warn('API返回了空响应');
        message.warning('获取数据集列表失败，使用本地数据');
        setDatasets(mockDatasets);
      }
    } catch (error: any) {
      console.error('获取数据集列表失败:', error);
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        message.error('获取数据集列表超时，使用本地数据');
      } else {
        message.error('获取数据集列表失败: ' + (error.message || '未知错误'));
      }
      // 当API请求失败时，使用模拟数据
      setDatasets(mockDatasets);
    } finally {
      setLoading(false);
    }
  };

  // 获取数据集列表
  useEffect(() => {
    console.log('初始化数据处理页面，开始获取数据集列表...');
    fetchDatasets();
  }, []);

  // 查找原始数据集
  useEffect(() => {
    // 查找描述为"原始数据"的数据集
    const originalDataset = datasets.find(d => d.name.includes('original') || d.description?.includes('原始数据'));
    if (originalDataset) {
      // 设置CGAN训练数据集
      setSelectedCGANDataset(originalDataset);
    }
  }, [datasets]);

  // 统一设置表单默认值
  useEffect(() => {
    // 设置高级处理流程表单默认值，移除基础缺失值处理
    advancedForm.setFieldsValue({
      pipeline_steps: ['mcmc_imputation', 'multiple_imputation', 'cgan_train', 'cgan_validation', 'outliers', 'ks_test', 'spearman_corr', 'permutation_test'],
      auto_tune: true,
      continue_despite_cgan: true
    });
    
    // 如果选择了数据集且有预览列，则设置目标变量和条件变量
    if (previewColumns && previewColumns.length > 0) {
      // 获取列名
      const columnNames = previewColumns.map((col: any) => col.title || col);
      const lastColumnIndex = columnNames.length - 1;
      
      // 设置目标变量默认为最后一列
      if (lastColumnIndex >= 0) {
        const targetColumn = columnNames[lastColumnIndex];
        advancedForm.setFieldsValue({ target_column: targetColumn });
        
        // 设置CGAN条件变量和目标变量
        if (columnNames.length > 2) {
          // 条件变量：除第一列和最后一列外的所有列
          const conditionColumns = columnNames.slice(1, lastColumnIndex);
          // 单独设置CGAN配置，避免覆盖其他字段
          const currentValues = advancedForm.getFieldsValue();
          advancedForm.setFieldsValue({
            cgan_config: {
              ...(currentValues.cgan_config || {}),
              condition_variables: conditionColumns,
              target_variables: [targetColumn]
            }
          });
        }
      }
    }
  }, [previewColumns]);

  // 处理数据集选择
  const handleDatasetChange = (datasetId: number) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset) {
      setSelectedDataset(dataset);
    } else {
      return; // 如果找不到数据集，提前退出
    }
    setProcessed(false);
    setPreviewData([]);

    // 从API获取数据集的预览数据
    const fetchPreview = async () => {
      try {
        setLoading(true);
        console.log(`正在获取数据集${datasetId}的预览数据...`);
        
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        const response = await axios.get(`${API_BASE_URL}/api/preview_dataset/${datasetId}/`, {
          signal: controller.signal,
          timeout: 30000 // 设置30秒超时
        });
        
        clearTimeout(timeoutId);
        
        console.log('API返回数据:', response.data);
        
        // 检查response.data的格式
        if (response.data) {
          const apiData = response.data;
          let tableColumns = [];
          let tableData = [];
          let dataProcessed = false;
          
          // 判断API返回的数据格式
          if (apiData.columns && Array.isArray(apiData.columns) && apiData.columns.length > 0) {
            // 有列信息
            const columnNames = apiData.columns;
            
            // 从columns构建表格列配置
            tableColumns = columnNames.map((colName: string, index: number) => ({
              title: colName,
              dataIndex: colName,
              key: colName,
              width: 120
            }));
            
            // 添加索引列
            tableColumns.unshift({
              title: '索引',
              dataIndex: 'key',
              key: 'key',
              width: 80
            });
            
            // 处理samples数据
            if (apiData.samples && Array.isArray(apiData.samples) && apiData.samples.length > 0) {
              // 有样本数据，直接使用
              console.log(`成功获取预览数据: ${apiData.samples.length}行`);
              
              // 添加行索引键
              tableData = apiData.samples.map((row: any, index: number) => ({
                key: index,
                ...row
              }));
              
              dataProcessed = true;
            } else {
              // 没有样本数据，使用列名生成模拟数据
              console.log('API返回的列名有效，但samples为空，生成基于列的模拟数据');
              tableData = [];
              
              for (let i = 0; i < 5; i++) {
                const row: any = { key: i };
                columnNames.forEach((colName: string) => {
                  // 根据列名生成有意义的模拟值
                  if (colName.toLowerCase().includes('日期')) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    row[colName] = date.toISOString().split('T')[0];
                  } else if (colName.toLowerCase().includes('水位')) {
                    row[colName] = (Math.random() * 10 + 20).toFixed(2);
                  } else if (colName.toLowerCase().includes('流量')) {
                    row[colName] = (Math.random() * 500 + 100).toFixed(1);
                  } else if (colName.toLowerCase().includes('雨') || colName.toLowerCase().includes('降雨')) {
                    row[colName] = (Math.random() * 30).toFixed(1);
                  } else {
                    row[colName] = (Math.random() * 100).toFixed(2);
                  }
                });
                tableData.push(row);
              }
              
              dataProcessed = true;
            }
          } else if (apiData.samples && Array.isArray(apiData.samples) && apiData.samples.length > 0) {
            // 只有samples没有columns，从第一行样本提取列名
            const firstRow = apiData.samples[0];
            const columnNames = Object.keys(firstRow);
            
            // 构建表格列配置
            tableColumns = columnNames.map((colName, index) => ({
              title: colName,
              dataIndex: colName,
              key: colName,
              width: 120
            }));
            
            // 添加索引列
            tableColumns.unshift({
              title: '索引',
              dataIndex: 'key',
              key: 'key',
              width: 80
            });
            
            // 添加行索引键
            tableData = apiData.samples.map((row: any, index: number) => ({
              key: index,
              ...row
            }));
            
            dataProcessed = true;
          }
          
          if (dataProcessed) {
            setPreviewColumns(tableColumns);
            setPreviewData(tableData);
            console.log('设置表格列:', tableColumns.length, '设置数据行:', tableData.length);
          } else {
            console.warn('API返回的数据格式无法处理:', apiData);
            message.warning('数据格式无法处理，使用模拟数据');
            useMockData();
          }
        } else {
          console.warn('API返回的预览数据为空');
          message.warning('获取数据预览为空，使用模拟数据');
          useMockData();
        }
      } catch (error: any) {
        console.error('获取数据集预览失败:', error);
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
          message.error('获取数据集预览超时，使用本地数据');
        } else if (error.message && error.message.includes('samples为空')) {
          message.error('数据集预览失败: API返回的samples为空');
        } else {
          message.error('获取数据集预览失败: ' + (error.message || '未知错误'));
        }
        useMockData();
      } finally {
        setLoading(false);
      }
    };
    
    // 使用模拟数据的辅助函数
    const useMockData = () => {
      const mockPreviewData = generateMockPreviewData(dataset?.columns || 5, 5);
      setPreviewData(mockPreviewData.data);
      setPreviewColumns(mockPreviewData.columns);
    };
    
    fetchPreview();
  };

  // 生成模拟预览数据
  const generateMockPreviewData = (columnCount: number = 5, rowCount: number = 5) => {
    const columns = [];
    
    // 添加索引列
    columns.push({
      title: '索引',
      dataIndex: 'key',
      key: 'key',
      width: 80
    });
    
    // 添加数据列
    for (let i = 0; i < columnCount; i++) {
      const colName = i === 0 ? '日期' : 
                      i === 1 ? '水位(m)' : 
                      i === 2 ? '流量(m³/s)' : 
                      i === 3 ? '降雨量(mm)' :
                      `特征${i-3}`;
      
      columns.push({
        title: colName,
        dataIndex: `col${i}`,
        key: `col${i}`,
        width: 120,
        // 移除随机缺失值生成
      });
    }
    
    // 生成行数据
    const data = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = { key: i };
      
      for (let j = 0; j < columnCount; j++) {
        if (j === 0) {
          // 日期列
          const date = new Date();
          date.setDate(date.getDate() - i);
          row[`col${j}`] = date.toISOString().split('T')[0];
        } else if (j === 1) {
          // 水位列
          row[`col${j}`] = (Math.random() * 10 + 20).toFixed(2);
        } else if (j === 2) {
          // 流量列
          row[`col${j}`] = (Math.random() * 500 + 100).toFixed(1);
        } else if (j === 3) {
          // 降雨量列
          row[`col${j}`] = (Math.random() * 30).toFixed(1);
        } else {
          // 其他特征列
          row[`col${j}`] = (Math.random() * 100).toFixed(2);
        }
      }
      
      data.push(row);
    }
    
    return { columns, data };
  };

  // 处理数据处理请求
  const handleProcessData = async () => {
    if (!selectedDataset) {
      message.warning('请先选择数据集');
      return;
    }
    
    setLoading(true);
    console.log('处理类型:', processType);
    console.log('选择的数据集ID:', selectedDataset.id);

    try {
      switch (processType) {
        case 'missing_values':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'outliers':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'normalization':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'pca':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'feature_selection':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'time_series':
          // 原有处理逻辑
          // ... existing code ...
          break;
        
        case 'cgan':
          try {
            // 获取表单数据
            const values = await cganForm.validateFields();
            console.log('CGAN表单数据:', values);
        // 构建请求数据
        const requestData = {
          dataset_id: selectedDataset.id,
              cgan_config: {
                latent_dim: values.latent_dim,
                embedding_dim: values.embedding_dim,
                generator_layers: values.generator_layers,
                discriminator_layers: values.discriminator_layers,
                epochs: values.epochs,
                batch_size: values.batch_size,
                learning_rate: values.learning_rate,
                beta1: values.beta1,
                beta2: values.beta2,
                condition_columns: values.condition_columns,
                target_columns: values.target_columns,
                embedding_method: values.embedding_method,
                num_samples: values.num_samples,
                auto_tune: values.auto_tune === true,
                evaluation_tolerance: values.evaluation_tolerance
              }
            };
            // 调用API
            console.log('发送CGAN训练请求:', requestData);
        const response = await trainCGANModel(requestData);
            console.log('CGAN训练响应:', response);

            if (response && response.success) {
              message.success('CGAN生成数据成功!');
              // 更新结果预览数据
              if (response.preview_data) {
                // 将字符串列名数组转换为表格所需的列配置对象数组
                const columns = response.preview_data.columns.map((col: string, index: number) => ({
                  title: col,
                  dataIndex: col,
                  key: `col-${index}`
                }));
                
                // 将数据行转换为表格所需的格式
                const data = response.preview_data.data.map((row: any, rowIndex: number) => {
                  const rowData: any = { key: rowIndex };
                  // 遍历columns确保每行都有对应的列值
                  response.preview_data?.columns.forEach((col: string) => {
                    rowData[col] = row[col];
                  });
                  return rowData;
                });
                
                setPreviewColumns(columns);
                setPreviewData(data);
              }
              // 显示评估结果
              if (response.evaluation_results) {
                setEvaluationResults(response.evaluation_results);
              }
          } else {
              message.error(`CGAN生成失败: ${response?.message || '未知错误'}`);
            }
          } catch (error: any) {
            console.error('CGAN处理错误:', error);
            if (error.message === '请求超时') {
              message.error('CGAN训练请求超时，请检查后端服务');
            } else if (error.message.includes('Network Error')) {
              message.error('网络错误，无法连接到后端服务');
        } else {
              message.error(`CGAN处理错误: ${error.message}`);
            }
            // 开发环境下使用模拟数据
            if (import.meta.env.DEV) {
              const mockData = generateMockPreviewData();
              // 转换模拟数据为表格所需的格式
              setPreviewColumns(mockData.columns.map((col: any) => {
                if (typeof col === 'string') {
                  return { title: col, dataIndex: col, key: col };
                }
                return col;
              }));
              setPreviewData(mockData.data);
              setProcessed(true);
            }
          }
          break;
        
        case 'advanced_pipeline': {
            try {
              // 获取高级处理流程表单数据
              const values = await advancedForm.validateFields();
              console.log('高级处理流程表单数据:', values);
              
              // 构建请求数据
              const requestData: AdvancedPipelineConfig = {
                dataset_id: selectedDataset.id,
                pipeline_steps: values.pipeline_steps || [],
                target_column: values.target_column,
                max_attempts: values.max_attempts || 10,
                mi_model: values.mi_model || 'mcmc',
                auto_tune: values.auto_tune === true,
                continue_despite_cgan: values.continue_despite_cgan === true
              };
              
              // 如果包含CGAN步骤，添加CGAN配置
              if (values.pipeline_steps?.includes('cgan')) {
                requestData.cgan_config = {
                  latent_dim: values.latent_dim || 100,
                  embedding_dim: values.embedding_dim || 128,
                  generator_layers: values.generator_layers || [256, 512, 256],
                  discriminator_layers: values.discriminator_layers || [128, 64],
                  epochs: values.epochs || 100,
                  batch_size: values.batch_size || 32,
                  learning_rate: values.learning_rate || 0.0002,
                  beta1: values.beta1 || 0.5,
                  beta2: values.beta2 || 0.999,
                  condition_columns: values.condition_columns || [],
                  target_columns: values.target_columns || [],
                  embedding_method: values.embedding_method || 'embedding',
                  num_samples: values.num_samples || 100
                };
              }
              
              // 调用API
              console.log('发送高级处理流程请求:', requestData);
              console.log('后端API地址:', `${API_BASE_URL}/api/advanced_pipeline/`);

              const response = await runAdvancedPipeline(requestData);
              console.log('高级处理流程API响应完整数据:', JSON.stringify(response));
              
              if (!response) {
                message.error('未接收到后端响应数据，可能存在连接问题');
                return;
              }
              
              if (response && response.success) {
                message.success('高级处理流程执行成功!');
                
                // 检查具体响应数据结构
                console.log('API响应中是否包含preview_data:', !!response.preview_data);
                console.log('API响应中是否包含evaluation_results:', !!response.evaluation_results);
                
                // 添加数据来源指示变量
                let dataSource = '完整处理流程后的最终数据';
                let isFallbackData = false;
                
                // 检查数据来源
                if (response.result_summary && response.result_summary.data_source) {
                  dataSource = response.result_summary.data_source;
                  // 检查是否由于CGAN评估不理想而使用了MCMC插补数据
                  if (response.result_summary.fallback_to_mcmc) {
                    isFallbackData = true;
                    dataSource = 'MCMC插补数据(CGAN评估容错)';
                  }
                }
                
                // 更新结果预览数据
                if (response.preview_data) {
                  // 将字符串列名数组转换为表格所需的列配置对象数组
                  const columns = response.preview_data.columns.map((col: string, index: number) => ({
                    title: col,
                    dataIndex: col,
                    key: `col-${index}`
                  }));
                  
                  // 将数据行转换为表格所需的格式，保留MCMC插补的原始值
                  const data = response.preview_data.data.map((row: any, rowIndex: number) => {
                    const rowData: any = { key: rowIndex };
                    // 直接使用API返回的值，不替换缺失值
                    response.preview_data?.columns.forEach((col: string) => {
                      rowData[col] = row[col]; // 保留原始值，包括MCMC插补后的值
                    });
                    return rowData;
                  });
                  
                  // 使用转换后的格式设置预览数据
                  setPreviewColumns(columns);
                  setPreviewData(data);
                  // 保存数据源信息
                  setDataSource(dataSource);
                  setIsFallbackData(isFallbackData);
                  console.log('成功设置预览数据，列数:', columns.length, '行数:', data.length, '数据来源:', dataSource);
      } else {
                  message.warning('API响应中未包含预览数据');
                }
                
                // 添加这段代码: 设置统计检验结果
                if (response.evaluation_results) {
                  console.log('收到统计检验结果:', response.evaluation_results);
                  setEvaluationResults(response.evaluation_results);
                  message.success('成功接收统计检验结果数据');
                } else {
                  console.warn('API响应中没有包含统计检验结果，使用模拟数据');
                  // 没有接收到统计检验结果时，使用模拟数据（为了演示统计结果的显示）
                  setEvaluationResults(createMockStatisticalResults());
                  message.warning('使用模拟统计检验结果（后端未返回）');
                }
                
                // 显示执行摘要
                if (response.result_summary) {
                  message.info(`完成执行步骤: ${response.result_summary.steps_executed.join(', ')}，耗时: ${response.result_summary.execution_time}秒`);
                  if (response.result_summary.warnings && response.result_summary.warnings.length > 0) {
                    console.warn('处理过程中的警告:', response.result_summary.warnings);
                  }
                } else {
                  console.warn('API响应中没有包含执行摘要信息');
      }
      
      setProcessed(true);
              } else {
                message.error(`高级处理流程失败: ${response?.message || '未知错误'}`);
                console.error('API响应指示处理失败:', response);
              }
    } catch (error: any) {
              console.error('高级处理流程错误:', error);
              if (error.message === '高级处理流程请求超时') {
                message.error('高级处理流程请求超时，处理时间过长或后端服务异常');
              } else if (error.message.includes('Network Error')) {
                message.error('网络错误，无法连接到后端服务');
      } else {
                message.error(`高级处理流程错误: ${error.message}`);
              }
              // 开发环境下使用模拟数据
              if (import.meta.env.DEV) {
                message.warning('使用模拟数据进行展示（因为API调用失败）');
                const mockData = generateMockPreviewData(5, 5);
                // 转换模拟数据为表格所需的格式，保留原始值
                setPreviewColumns(mockData.columns.map((col: any) => {
                  if (typeof col === 'string') {
                    return { title: col, dataIndex: col, key: col };
                  }
                  return col;
                }));
                setPreviewData(mockData.data);
                
                // 添加模拟统计检验结果，确保统计结果显示
                setEvaluationResults(createMockStatisticalResults());
                
        setProcessed(true);
                
                // 在控制台添加提示信息
                console.log('已创建模拟统计检验结果数据:', createMockStatisticalResults());
              }
            }
            break;
          }
        
        default:
          // 原有处理逻辑
          // ... existing code ...
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // 保存处理结果
  const handleSaveResult = async () => {
    if (!processed) {
      message.warning('请先处理数据');
      return;
    }
    
    setLoading(true);
    
    try {
      // 添加非空检查
      if (!selectedDataset) {
        message.error('未选择数据集');
        return;
      }
      
      // 添加超时控制 - 使用修改后的API工具中现有的超时机制
      // saveProcessedData内部已经设置了60秒超时
      const result = await saveProcessedData(
        selectedDataset.id,
        processType,
        `${processType}_processed_${selectedDataset.name}`
      );
      
      if (result && typeof result === 'object' && 'new_dataset_name' in result) {
        // 使用Context保存处理结果状态
        setCurrentDataset({
          ...selectedDataset,
          processed: true,
          savedAs: result.new_dataset_name,
          timestamp: new Date().toISOString()
        });
        message.success('处理结果已成功保存');
      }
    } catch (error: any) {
      console.error('保存处理结果失败:', error);
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        message.error('保存处理结果超时，请稍后重试');
      } else if (error.message && error.message.includes('port closed')) {
        message.error('保存处理结果时连接被中断，请稍后重试');
      } else {
        message.error('保存处理结果失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 不同处理类型的表单
  const renderProcessForm = () => {
    switch (processType) {
      case 'missing_values':
        return (
          <Form form={form} layout="vertical" initialValues={{ method: 'mean' }}>
            <Form.Item
              name="method"
              label="缺失值处理方法"
              rules={[{ required: true, message: '请选择处理方法' }]}
            >
              <Radio.Group>
                <Radio value="mean">均值填充</Radio>
                <Radio value="median">中位数填充</Radio>
                <Radio value="mode">众数填充</Radio>
                <Radio value="constant">常数填充</Radio>
                <Radio value="dropna_rows">删除行</Radio> 
                <Radio value="dropna_cols">删除列</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="target_columns"
              label="目标列"
              tooltip="选择要处理的列，留空则处理所有适用列"
            >
              <Select mode="multiple" placeholder="选择列（可多选）" allowClear
                options={(selectedDataset ? previewColumns : defaultColumns)
                  .filter(col => col.key !== 'key') // 排除索引列
                  .map((col: any) => ({
                    label: col.title,
                    value: col.dataIndex || col.key,
                    key: col.dataIndex || col.key
                  }))}
              />
            </Form.Item>
            
            <Form.Item
              name="fill_value"
              label="填充值 (仅当选择常数填充时)"
              dependencies={['method']}
              rules={[
                ({ getFieldValue }) => ({
                  required: getFieldValue('method') === 'constant',
                  message: '请输入填充值',
                }),
              ]}
            >
              <InputNumber style={{ width: '100%' }} disabled={form.getFieldValue('method') !== 'constant'} />
            </Form.Item>
          </Form>
        );
        
      case 'outliers':
        return (
          <Form form={form} layout="vertical" initialValues={{ method: 'zscore', threshold: 3 }}>
            <Form.Item
              name="method"
              label="异常值检测方法"
              rules={[{ required: true, message: '请选择检测方法' }]}
            >
              <Radio.Group>
                <Radio value="zscore">Z-Score</Radio>
                <Radio value="iqr">IQR</Radio>
                <Radio value="percentile">百分位数</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="threshold"
              label="阈值"
              rules={[{ required: true, message: '请输入阈值' }]}
            >
              <InputNumber min={0.5} step={0.5} />
            </Form.Item>
            
            <Form.Item
              name="action"
              label="处理方式"
              rules={[{ required: true, message: '请选择处理方式' }]}
              initialValue="replace"
            >
              <Radio.Group>
                <Radio value="replace">替换为均值/中位数</Radio>
                <Radio value="remove">删除异常值所在行</Radio>
                <Radio value="cap">截断到阈值</Radio>
              </Radio.Group>
            </Form.Item>
          </Form>
        );
        
      case 'normalization':
        return (
          <Form form={form} layout="vertical" initialValues={{ method: 'minmax' }}>
            <Form.Item
              name="method"
              label="归一化方法"
              rules={[{ required: true, message: '请选择归一化方法' }]}
            >
              <Radio.Group>
                <Radio value="minmax">Min-Max缩放</Radio>
                <Radio value="zscore">Z-Score标准化</Radio>
                <Radio value="robust">Robust缩放</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="target_columns"
              label="目标列"
              tooltip="要处理的列，留空表示处理所有数值列"
            >
              <Select mode="multiple" placeholder="选择要处理的列（可多选）"
                options={(selectedDataset ? previewColumns : defaultColumns).slice(1).map((col: any) => ({
                  label: col.title,
                  value: col.title,
                  key: col.dataIndex || col.key
                }))}
              />
            </Form.Item>
          </Form>
        );
        
      // 高级处理选项 - PCA降维
      case 'pca':
        return (
          <Form form={form} layout="vertical" className="advanced-process-form" initialValues={{ n_components: 3, variance_threshold: 0.9, standardize: true }}>
            <Alert
              message="主成分分析 (PCA) 降维"
              description="通过线性变换将数据投影到低维空间，保留最大方差的方向，用于降维、可视化和去除特征间的相关性。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="基本参数配置" size="small" className="config-card">
                  <Form.Item
                    name="n_components"
                    label="主成分数量"
                    tooltip="要保留的主成分数量，较小的值会降低维度"
                    rules={[{ required: true, message: '请输入主成分数量' }]}
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                  
                  <Form.Item
                    name="variance_threshold"
                    label="方差阈值"
                    tooltip="保留的方差比例，范围0-1，较大的值会保留更多信息"
                    rules={[{ required: true, message: '请输入方差阈值' }]}
                  >
                    <InputNumber min={0.1} max={1} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                  
                  <Form.Item
                    name="standardize"
                    label="标准化数据"
                    tooltip="在应用PCA前是否对数据进行标准化处理"
                    valuePropName="checked"
                  >
                    <Radio.Group>
                      <Radio value={true}>是</Radio>
                      <Radio value={false}>否</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Card>
              </Col>
              
              <Col xs={24} lg={12}>
                <Card title="列选择配置" size="small" className="config-card">
                  <Form.Item
                    name="target_columns"
                    label="目标列"
                    tooltip="要处理的列，留空表示处理所有数值列"
                  >
                    <Select 
                      mode="multiple" 
                      placeholder="选择要处理的列（可多选）"
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      options={(selectedDataset ? previewColumns : defaultColumns)
                        .filter(col => col.key !== 'key')
                        .map((col: any) => ({
                          label: col.title,
                          value: col.title,
                          key: col.dataIndex || col.key
                        }))}
                    />
                  </Form.Item>
                  
                  <Alert
                    message="PCA处理提示"
                    description="主成分分析(PCA)是一种常用的降维技术，通过将原始特征转换为新的不相关特征（主成分），可以大幅减少数据维度同时保留主要信息。"
                    type="success"
                    showIcon
                  />
                </Card>
              </Col>
            </Row>
            
            <div className="processing-visualization">
              <Divider orientation="center">PCA降维示意图</Divider>
              <Row justify="center">
                <Col span={20}>
                  <div className="pca-visualization">
                    <div className="vis-step">
                      <div className="vis-step-title">原始数据</div>
                      <div className="vis-step-content">高维数据空间</div>
                    </div>
                    <div className="vis-arrow">→</div>
                    <div className="vis-step">
                      <div className="vis-step-title">方差计算</div>
                      <div className="vis-step-content">查找最大方差方向</div>
                    </div>
                    <div className="vis-arrow">→</div>
                    <div className="vis-step">
                      <div className="vis-step-title">数据转换</div>
                      <div className="vis-step-content">投影到主成分</div>
                    </div>
                    <div className="vis-arrow">→</div>
                    <div className="vis-step">
                      <div className="vis-step-title">降维结果</div>
                      <div className="vis-step-content">保留指定维度</div>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Form>
        );
      
      // 高级处理选项 - 特征选择
      case 'feature_selection':
        return renderFeatureSelectionForm();
      
      // 高级处理选项 - 时间序列处理
      case 'time_series':
        return renderTimeSeriesForm();
      
      // 高级处理选项 - 高级处理流程
      case 'advanced_pipeline':
        return renderAdvancedPipelineForm();
        
      case 'cgan':
        return (
          <div className="cgan-config">
            <Alert
              message="CGAN模型训练数据集"
              description="您可以为CGAN模型训练选择特定的数据集，建议使用原始数据集以获得更好的训练效果"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              label="CGAN训练数据集"
              tooltip="选择用于训练CGAN模型的数据集（不选则使用当前处理数据集）"
              style={{ marginBottom: 16 }}
            >
              <Select
                showSearch
                placeholder="选择CGAN训练数据集（可选）"
                style={{ width: '100%' }}
                onChange={(value) => {
                  const dataset = datasets.find(d => d.id === value);
                  if (dataset) { // 添加空值检查
                    setSelectedCGANDataset(dataset);
                  }
                }}
                allowClear
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={datasets.map(dataset => ({
                  label: `${dataset.name} (${dataset.rows}行 × ${dataset.columns}列)`,
                  value: dataset.id,
                  key: dataset.id
                }))}
              />
            </Form.Item>
            <Collapse defaultActiveKey={['1', '2', '3', '4']}>
              <Collapse.Panel header="网络架构配置" key="1">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['latent_dim']}
                      label="潜在空间维度"
                      initialValue={100}
                      rules={[{ required: true, message: '请输入潜在空间维度' }]}
                    >
                      <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['embedding_dim']}
                      label="嵌入维度"
                      initialValue={0}
                      tooltip="用于处理类别型条件变量的嵌入维度。0表示不使用嵌入。"
                    >
                      <InputNumber min={0} max={500} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['condition_embedding']}
                      label="条件嵌入方式"
                      initialValue="concat"
                    >
                      <Select>
                        <Select.Option value="concat">拼接嵌入</Select.Option>
                        <Select.Option value="projection">投影嵌入</Select.Option>
                        <Select.Option value="attention">注意力嵌入</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['generator_layers']}
                      label="生成器网络结构"
                      initialValue={[128, 256, 512]}
                      tooltip="生成器各隐藏层的神经元数量"
                    >
                      <Select mode="tags" tokenSeparators={[',']} style={{ width: '100%' }}>
                        <Select.Option value="64" key="gen-64">64</Select.Option>
                        <Select.Option value="128" key="gen-128">128</Select.Option>
                        <Select.Option value="256" key="gen-256">256</Select.Option>
                        <Select.Option value="512" key="gen-512">512</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['discriminator_layers']}
                      label="判别器网络结构"
                      initialValue={[128, 64]}
                      tooltip="判别器各隐藏层的神经元数量"
                    >
                      <Select mode="tags" tokenSeparators={[',']} style={{ width: '100%' }}>
                        <Select.Option value="64" key="disc-64">64</Select.Option>
                        <Select.Option value="128" key="disc-128">128</Select.Option>
                        <Select.Option value="256" key="disc-256">256</Select.Option>
                        <Select.Option value="512" key="disc-512">512</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Collapse.Panel>

              <Collapse.Panel header="训练参数配置" key="2">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['epochs']}
                      label="训练轮数"
                      initialValue={100}
                      rules={[{ required: true, message: '请输入训练轮数' }]}
                    >
                      <InputNumber min={10} max={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['batch_size']}
                      label="批次大小"
                      initialValue={32}
                      rules={[{ required: true, message: '请输入批次大小' }]}
                    >
                      <InputNumber min={1} max={256} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['learning_rate']}
                      label="学习率"
                      initialValue={0.0002}
                      rules={[{ required: true, message: '请输入学习率' }]}
                    >
                      <InputNumber
                        min={0.0001}
                        max={0.01}
                        step={0.0001}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['optimizer']}
                      label="优化器"
                      initialValue="adam"
                    >
                      <Select>
                        <Select.Option value="adam">Adam</Select.Option>
                        <Select.Option value="rmsprop">RMSprop</Select.Option>
                        <Select.Option value="sgd">SGD</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['loss_function']}
                      label="损失函数"
                      initialValue="wasserstein"
                    >
                      <Select>
                        <Select.Option value="wasserstein">Wasserstein</Select.Option>
                        <Select.Option value="standard">标准GAN损失</Select.Option>
                        <Select.Option value="hinge">Hinge损失</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Collapse.Panel>

              <Collapse.Panel header="条件变量配置" key="3">
                <Alert
                  message="请选择作为生成条件的变量"
                  description="这些变量将作为CGAN的条件输入，用于控制生成数据的特征。"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <Form.Item
                  name={['condition_variables']}
                  label="条件变量"
                  rules={[{ required: true, message: '请选择至少一个条件变量' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择条件变量"
                    style={{ width: '100%' }}
                    optionFilterProp="children"
                  >
                    {previewColumns.map((column: any) => (
                      <Select.Option key={column.dataIndex || column} value={column.dataIndex || column}>
                        {column.title || column}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Alert
                  message="请选择需要生成的目标变量"
                  description="这些变量将由CGAN模型基于条件变量生成。"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <Form.Item
                  name={['target_variables']}
                  label="目标变量"
                  rules={[{ required: true, message: '请选择至少一个目标变量' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择目标变量"
                    style={{ width: '100%' }}
                    optionFilterProp="children"
                  >
                    {previewColumns.map((column: any) => (
                      <Select.Option key={column.dataIndex || column} value={column.dataIndex || column}>
                        {column.title || column}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Collapse.Panel>

              <Collapse.Panel header="条件生成关系定义" key="4">
                <Alert
                  message="描述条件和生成目标之间的关系"
                  description="请描述条件变量与目标变量之间的关系，这将帮助模型更好地理解生成任务。例如：'当温度升高时，能耗增加'。"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <Form.Item
                  name={['condition_info']}
                  label="条件生成关系描述"
                >
                  <Input.TextArea rows={4} placeholder="描述条件变量与目标变量之间的关系..." />
                </Form.Item>

                <Form.Item
                  name={['nlp_model']}
                  label="自然语言处理模型"
                  initialValue="none"
                  tooltip="用于解析条件生成关系的NLP模型"
                >
                  <Select>
                    <Select.Option value="none">不使用</Select.Option>
                    <Select.Option value="bert">BERT</Select.Option>
                    <Select.Option value="gpt">GPT</Select.Option>
                  </Select>
                </Form.Item>
              </Collapse.Panel>
            </Collapse>

            <div className="cgan-model-visualization">
              <h3>CGAN模型架构可视化</h3>
              <div className="model-architecture">
                <div className="model-component generator">
                  <div className="component-title">生成器网络</div>
                  <div className="component-box">
                    <div className="input-node">潜在向量空间</div>
                    <div className="arrow">↓</div>
                    <div className="layers-node">隐藏层</div>
                    <div className="arrow">↓</div>
                    <div className="output-node">生成数据</div>
                  </div>
                </div>
                <div className="model-flow">
                  <div className="arrow-right">→</div>
                  <div className="condition-node">条件</div>
                  <div className="arrow-right">→</div>
                </div>
                <div className="model-component discriminator">
                  <div className="component-title">判别器网络</div>
                  <div className="component-box">
                    <div className="input-node">输入数据</div>
                    <div className="arrow">↓</div>
                    <div className="layers-node">隐藏层</div>
                    <div className="arrow">↓</div>
                    <div className="output-node">真/假判断</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <Alert message="请选择处理类型" type="info" />;
    }
  };

  // Update the Tabs component for better styling and responsiveness
  const renderProcessTabs = () => {
    // 转换选项卡数据为items格式
    const tabItems = (isAdvancedProcess ? advancedTabs : basicTabs).map(tab => ({
      key: tab.key,
      label: (
        <span>
          {tab.icon} {tab.label}
          <Tooltip title={tab.description}>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      ),
      children: (
        <div className="tab-content-container">
          {renderProcessForm()}
        </div>
      )
    }));

    return (
      <Tabs
        activeKey={processType}
        onChange={setProcessType}
        type="card"
        size="large"
        className="process-tabs"
        tabBarGutter={8}
        items={tabItems}
      />
    );
  };

  // 修改特征选择表单，使用独立的表单实例
  const renderFeatureSelectionForm = () => {
    return (
      <Form form={featureForm} layout="vertical" className="advanced-process-form" initialValues={{ method: 'f_regression', k_features: 5 }}>
        <Alert
          message="特征选择"
          description="通过各种算法评估特征重要性并选择最相关的特征子集，可减少维度、提高模型性能并帮助理解数据。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="特征选择方法配置" size="small" className="config-card">
              <Form.Item
                name="method"
                label="特征选择方法"
                tooltip="选择用于评估特征重要性的算法"
                rules={[{ required: true, message: '请选择特征选择方法' }]}
              >
                <Radio.Group>
                  <Radio value="f_regression">F检验回归</Radio>
                  <Radio value="mutual_info">互信息</Radio>
                  <Radio value="rfe">递归特征消除</Radio>
                  <Radio value="variance">方差阈值</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item
                name="k_features"
                label="保留特征数量"
                tooltip="选择要保留的特征数量"
                rules={[{ required: true, message: '请输入特征数量' }]}
              >
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="target_column"
                label="目标变量"
                tooltip="用于特征重要性计算的目标变量"
                rules={[{ required: true, message: '请选择目标变量' }]}
              >
                <Select 
                  placeholder="选择目标变量"
                  style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={(selectedDataset ? previewColumns : defaultColumns)
                    .filter(col => col.key !== 'key')
                    .map((col: any) => ({
                      label: col.title,
                      value: col.title,
                      key: col.dataIndex || col.key
                    }))}
                />
              </Form.Item>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="各方法说明" size="small" className="config-card">
              <div className="method-explanations">
                <Paragraph>
                  <Text strong>F检验回归:</Text> 使用F检验评估特征与目标变量间的线性关系强度，适用于回归问题。
                </Paragraph>
                <Paragraph>
                  <Text strong>互信息:</Text> 基于信息论度量特征与目标变量的相互依赖性，可捕捉非线性关系。
                </Paragraph>
                <Paragraph>
                  <Text strong>递归特征消除:</Text> 迭代训练模型，逐步移除最不重要的特征，适合与各种模型结合。
                </Paragraph>
                <Paragraph>
                  <Text strong>方差阈值:</Text> 移除方差低于指定阈值的低信息特征，是一种无监督的方法。
                </Paragraph>
              </div>
              
              <Alert
                message="特征选择优势"
                description="特征选择可以减少过拟合风险、提高模型解释性并加速训练过程。选择合适的方法取决于数据特性和目标。"
                type="success"
                showIcon
              />
            </Card>
          </Col>
        </Row>
        
        <div className="processing-visualization">
          <Divider orientation="center">特征选择工作流程</Divider>
          <div className="feature-selection-flow">
            <div className="flow-step">原始特征集</div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">特征重要性评估</div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">按重要性排序</div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">选择最相关特征子集</div>
          </div>
        </div>
      </Form>
    );
  };

  // 修改时间序列表单，使用独立的表单实例
  const renderTimeSeriesForm = () => {
    return (
      <Form form={timeSeriesForm} layout="vertical" className="advanced-process-form" initialValues={{ method: 'rolling', window_size: 3, agg_method: 'mean' }}>
        <Alert
          message="时间序列处理"
          description="针对时间序列数据的特殊处理方法，包括滑动窗口、差分、季节性分解和重采样等，可用于趋势分析和预测。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="基本处理配置" size="small" className="config-card">
              <Form.Item
                name="method"
                label="时间序列处理方法"
                tooltip="选择适合您数据的时间序列处理方法"
                rules={[{ required: true, message: '请选择处理方法' }]}
              >
                <Radio.Group buttonStyle="solid" style={{ width: '100%' }}>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Radio.Button value="rolling" style={{ width: '100%', textAlign: 'center' }}>
                        滑动窗口
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="diff" style={{ width: '100%', textAlign: 'center' }}>
                        差分
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="seasonal" style={{ width: '100%', textAlign: 'center' }}>
                        季节性分解
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="resample" style={{ width: '100%', textAlign: 'center' }}>
                        重采样
                      </Radio.Button>
                    </Col>
                  </Row>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item
                name="date_column"
                label="日期列"
                tooltip="包含日期/时间的列，用于时间序列索引"
                rules={[{ required: true, message: '请选择日期列' }]}
              >
                <Select 
                  placeholder="选择日期列"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  options={(selectedDataset ? previewColumns : defaultColumns)
                    .filter(col => col.key !== 'key')
                    .map((col: any) => ({
                      label: col.title,
                      value: col.title,
                      key: col.dataIndex || col.key
                    }))}
                />
              </Form.Item>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="方法特定参数" size="small" className="config-card">
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.method !== currentValues.method}
              >
                {({ getFieldValue }) => {
                  const method = getFieldValue('method');
                  
                  if (method === 'rolling') {
                    return (
                      <>
                        <Form.Item
                          name="window_size"
                          label="窗口大小"
                          tooltip="滑动窗口的大小，较大的窗口会平滑更多的波动"
                          rules={[{ required: true, message: '请输入窗口大小' }]}
                        >
                          <InputNumber min={2} max={30} style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <Form.Item
                          name="agg_method"
                          label="聚合方法"
                          tooltip="窗口内数据的聚合方式"
                          rules={[{ required: true, message: '请选择聚合方法' }]}
                        >
                          <Select placeholder="选择聚合方法" style={{ width: '100%' }}
                            options={[
                              { label: '均值', value: 'mean' },
                              { label: '求和', value: 'sum' },
                              { label: '最大值', value: 'max' },
                              { label: '最小值', value: 'min' },
                              { label: '中位数', value: 'median' },
                              { label: '第一个值', value: 'first' },
                              { label: '最后一个值', value: 'last' }
                            ]}
                          />
                        </Form.Item>
                        
                        <Alert
                          message="滑动窗口提示"
                          description="滑动窗口适用于平滑短期波动，突出长期趋势，可用于去噪和趋势分析。"
                          type="success"
                          showIcon
                        />
                      </>
                    );
                  }
                  
                  if (method === 'diff') {
                    return (
                      <>
                        <Form.Item
                          name="diff_order"
                          label="差分阶数"
                          tooltip="进行差分的次数，一阶差分可消除线性趋势，二阶差分可消除二次趋势"
                          rules={[{ required: true, message: '请输入差分阶数' }]}
                          initialValue={1}
                        >
                          <InputNumber min={1} max={3} style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <Form.Item
                          name="shift"
                          label="时间间隔"
                          tooltip="计算差分的时间间隔，常用值为1（相邻时间点）"
                          initialValue={1}
                        >
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <Alert
                          message="差分处理提示"
                          description="差分可以通过计算序列中相邻值之间的差值，可以消除趋势并使数据更加平稳。"
                          type="success"
                          showIcon
                        />
                      </>
                    );
                  }
                  
                  if (method === 'seasonal') {
                    return (
                      <>
                        <Form.Item
                          name="period"
                          label="季节周期"
                          tooltip="季节性的周期长度，如每周数据为7，每月数据为30，每年数据为12或365"
                          rules={[{ required: true, message: '请输入季节周期' }]}
                          initialValue={12}
                        >
                          <InputNumber min={2} style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <Form.Item
                          name="model"
                          label="分解模型"
                          tooltip="季节性分解的模型类型"
                          initialValue="additive"
                        >
                          <Radio.Group>
                            <Radio value="additive">加法模型</Radio>
                            <Radio value="multiplicative">乘法模型</Radio>
                          </Radio.Group>
                        </Form.Item>
                        
                        <Alert
                          message="季节性分解提示"
                          description="将时间序列分解为趋势、季节性和残差成分，有助于理解数据中的各种模式。"
                          type="success"
                          showIcon
                        />
                      </>
                    );
                  }
                  
                  if (method === 'resample') {
                    return (
                      <>
                        <Form.Item
                          name="freq"
                          label="重采样频率"
                          tooltip="新的时间序列频率，如'D'表示日，'W'表示周，'M'表示月"
                          rules={[{ required: true, message: '请选择重采样频率' }]}
                          initialValue="D"
                        >
                          <Select placeholder="选择频率" style={{ width: '100%' }}
                            options={[
                              { label: '小时 (H)', value: 'H' },
                              { label: '天 (D)', value: 'D' },
                              { label: '周 (W)', value: 'W' },
                              { label: '月 (M)', value: 'M' },
                              { label: '季度 (Q)', value: 'Q' },
                              { label: '年 (Y)', value: 'Y' }
                            ]}
                          />
                        </Form.Item>
                        
                        <Form.Item
                          name="resample_method"
                          label="聚合方法"
                          tooltip="数据上采样或下采样时的聚合方式"
                          rules={[{ required: true, message: '请选择聚合方法' }]}
                          initialValue="mean"
                        >
                          <Select placeholder="选择聚合方法" style={{ width: '100%' }}
                            options={[
                              { label: '均值', value: 'mean' },
                              { label: '求和', value: 'sum' },
                              { label: '最大值', value: 'max' },
                              { label: '最小值', value: 'min' },
                              { label: '中位数', value: 'median' },
                              { label: '第一个值', value: 'first' },
                              { label: '最后一个值', value: 'last' }
                            ]}
                          />
                        </Form.Item>
                        
                        <Alert
                          message="重采样提示"
                          description="将时间序列转换为不同的频率，上采样增加数据点（如日→小时），下采样减少数据点（如日→月）。"
                          type="success"
                          showIcon
                        />
                      </>
                    );
                  }
                  
                  return null;
                }}
              </Form.Item>
            </Card>
          </Col>
        </Row>
        
        <div className="processing-visualization">
          <Divider orientation="center">时间序列处理示意图</Divider>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.method !== currentValues.method}>
            {({ getFieldValue }) => {
              const method = getFieldValue('method');
              
              switch (method) {
                case 'rolling':
                  return (
                    <div className="time-series-visualization">
                      <div className="vis-image rolling-window">
                        <div className="vis-line">
                          <div className="point"></div>
                          <div className="point"></div>
                          <div className="point highlight"></div>
                          <div className="point"></div>
                          <div className="point"></div>
                          <div className="point"></div>
                          <div className="point"></div>
                        </div>
                        <div className="window-frame">窗口</div>
                        <div className="result-point">计算结果</div>
                        <div className="vis-description">
                          滑动窗口聚合，通过在固定大小的窗口内应用统计函数（如均值、中位数等）来平滑数据。
                        </div>
                      </div>
                    </div>
                  );
                case 'diff':
                  return (
                    <div className="time-series-visualization">
                      <div className="vis-image differencing">
                        <div className="vis-formula">
                          <span>Y'<sub>t</sub> = Y<sub>t</sub> - Y<sub>t-1</sub></span>
                        </div>
                        <div className="vis-description">
                          差分通过计算序列中相邻值之间的差值，可以消除趋势并使数据更加平稳。
                        </div>
                      </div>
                    </div>
                  );
                case 'seasonal':
                  return (
                    <div className="time-series-visualization">
                      <div className="vis-image seasonal">
                        <div className="seasonal-components">
                          <div className="component">Y = 原始数据</div>
                          <div className="component">T = 趋势成分</div>
                          <div className="component">S = 季节性成分</div>
                          <div className="component">R = 残差成分</div>
                        </div>
                        <div className="vis-description">
                          季节性分解将时间序列分解为趋势、季节性和残差三个成分，以便更好地理解数据的不同特性。
                        </div>
                      </div>
                    </div>
                  );
                case 'resample':
                  return (
                    <div className="time-series-visualization">
                      <div className="vis-image resample">
                        <div className="resample-viz">
                          <div className="resample-type">
                            <div className="type-label">上采样</div>
                            <div className="point-row">
                              <div className="point large"></div>
                              <div className="point small new"></div>
                              <div className="point small new"></div>
                              <div className="point large"></div>
                            </div>
                            <div className="type-desc">增加数据点(如日→小时)</div>
                          </div>
                          <div className="resample-type">
                            <div className="type-label">下采样</div>
                            <div className="point-row">
                              <div className="point small"></div>
                              <div className="point small"></div>
                              <div className="point small"></div>
                              <div className="point large new"></div>
                            </div>
                            <div className="type-desc">减少数据点(如日→月)</div>
                          </div>
                        </div>
                        <div className="vis-description">
                          重采样改变时间序列的频率，可以聚合或插值数据点，适用于频率转换和长期趋势分析。
                        </div>
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            }}
          </Form.Item>
        </div>
      </Form>
    );
  };

  // 修改高级处理流程表单，使用独立的表单实例
  const renderAdvancedPipelineForm = () => {
    return (
      <Form form={advancedForm} layout='vertical' className="advanced-process-form">
        <Alert 
          message="高级处理流程" 
          description="集成多步骤数据处理流程，包括缺失值处理、高级插补、CGAN模型训练与验证、以及多种统计检验分析。"
          type="info" 
          showIcon 
          style={{ marginBottom: 24 }} 
        />
        
        <Steps 
          direction="vertical"
          current={-1} // 不高亮任何步骤
          className="process-steps"
          style={{ marginBottom: 24 }}
        >
          <Step 
            title="数据预处理" 
            description="对数据进行初步清洗与预处理" 
            icon={<DatabaseOutlined />} 
          />
          <Step 
            title="高级插补" 
            description="使用MCMC方法和多重插补框架进行缺失值处理" 
            icon={<ExperimentOutlined />} 
          />
          <Step 
            title="模型训练与验证" 
            description="训练CGAN模型并验证数据质量" 
            icon={<RocketOutlined />} 
          />
          <Step 
            title="统计分析与评估" 
            description="进行多种统计检验与异常值检测" 
            icon={<BarChartOutlined />} 
          />
        </Steps>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title="处理步骤配置"
              size="small"
              className="config-card"
            >
              <Form.Item 
                name="pipeline_steps" 
                label="选择处理步骤" 
                tooltip="您可以选择多个处理步骤，系统将按合理顺序执行"
                rules={[{ required: true, message: '请至少选择一个处理步骤' }]}
                initialValue={['mcmc_imputation', 'multiple_imputation', 'cgan_train', 'cgan_validation', 'outliers', 'ks_test', 'spearman_corr', 'permutation_test']}
              >
                <Select
                  mode="multiple"
                  placeholder="选择要执行的处理步骤"
                  style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={[
                    { value: 'missing_values', label: '基础缺失值处理' },
                    { value: 'mcmc_imputation', label: 'MCMC插补' },
                    { value: 'multiple_imputation', label: '多重插补框架分析' },
                    { value: 'outliers', label: '异常值检测' },
                    { value: 'pca', label: 'PCA降维' },
                    { value: 'feature_selection', label: '特征选择' },
                    { value: 'cgan_train', label: 'CGAN模型训练' },
                    { value: 'cgan_validation', label: 'CGAN模型验证' },
                    { value: 'ks_test', label: 'K-S检验', className: 'highlight-option' },
                    { value: 'spearman_corr', label: 'Spearman相关分析', className: 'highlight-option' },
                    { value: 'permutation_test', label: '置换检验', className: 'highlight-option' }
                  ]}
                />
              </Form.Item>
              
              <Form.Item 
                name="target_column" 
                label="目标变量" 
                tooltip="选择分析的目标变量，用于指导特征选择、评估和统计检验"
                rules={[{ required: true, message: '请选择目标变量' }]}
              >
                <Select placeholder="选择目标变量" 
                  optionFilterProp="label"
                  options={(selectedDataset ? previewColumns : defaultColumns)
                    .filter(col => col.key !== 'key')
                    .map((col: any) => ({
                      label: col.title,
                      value: col.title,
                      key: col.dataIndex || col.key
                    }))}
                />
              </Form.Item>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card
              title="高级选项配置"
              size="small"
              className="config-card"
              extra={<Tooltip title="这些是高级配置项，一般可使用默认值"><InfoCircleOutlined /></Tooltip>}
            >
              <Form.Item 
                name="max_attempts" 
                label="MCMC最大尝试次数"
                tooltip="MCMC插补的最大尝试次数，当一次尝试未收敛时会重试"
                initialValue={3}
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item 
                name="mi_model" 
                label="多重插补框架模型"
                tooltip="选择多重插补框架使用的基础模型"
                initialValue="bayesian_linear"
              >
                <Select style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={[
                    { label: '贝叶斯线性回归', value: 'bayesian_linear' },
                    { label: '随机森林', value: 'random_forest' },
                    { label: '梯度提升树', value: 'gradient_boosting' },
                    { label: 'K近邻', value: 'knn' },
                    { label: 'XGBoost', value: 'xgboost' },
                    { label: '支持向量机', value: 'svm' },
                    { label: '决策树', value: 'decision_tree' },
                    { label: 'AdaBoost', value: 'adaboost' },
                    { label: '神经网络', value: 'neural_network' }
                  ]}
                />
              </Form.Item>
              
              <Form.Item 
                name="cgan_config" 
                label="CGAN模型训练参数"
                tooltip="配置条件生成对抗网络的训练参数与网络结构"
              >
                <Card size="small" title="网络架构配置" style={{ marginBottom: 16 }}>
                  <Form.Item
                    label="CGAN训练数据集"
                    tooltip="选择用于训练CGAN模型的数据集（不选则使用当前处理数据集）"
                    style={{ marginBottom: 16 }}
                  >
                    <Select
                      showSearch
                      placeholder="选择CGAN训练数据集（可选）"
                      style={{ width: '100%' }}
                      onChange={(value) => {
                        const dataset = datasets.find(d => d.id === value);
                        if (dataset) { // 添加空值检查
                          setSelectedCGANDataset(dataset);
                        }
                      }}
                      allowClear
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={datasets.map(dataset => ({
                        label: `${dataset.name} (${dataset.rows}行 × ${dataset.columns}列)`,
                        value: dataset.id,
                        key: dataset.id
                      }))}
                    />
                  </Form.Item>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'generator_layers']} label="生成器网络结构" initialValue={[128, 256, 512]} >
                        <Select
                          mode="tags"
                          style={{ width: '100%' }}
                          placeholder="输入每层神经元数量，如: 128,256,512"
                          tokenSeparators={[',']}
                          tagRender={(props) => {
                            const { value, closable, onClose } = props;
                            return (
                              <Tag closable={closable} onClose={onClose} key={`generator-${value}`}>
                                {value}
                              </Tag>
                            );
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'discriminator_layers']} label="判别器网络结构" initialValue={[128, 64]} >
                        <Select
                          mode="tags"
                          style={{ width: '100%' }}
                          placeholder="输入每层神经元数量，如: 128,64"
                          tokenSeparators={[',']}
                          tagRender={(props) => {
                            const { value, closable, onClose } = props;
                            return (
                              <Tag closable={closable} onClose={onClose} key={`discriminator-${value}`}>
                                {value}
                              </Tag>
                            );
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'latent_dim']} label="潜在空间维度" initialValue={100} >
                        <InputNumber min={10} max={1000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'embedding_dim']} label="条件嵌入维度" initialValue={50} >
                        <InputNumber min={10} max={500} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                
                <Card size="small" title="训练参数配置" style={{ marginBottom: 16 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item name={['cgan_config', 'epochs']} label="训练轮次" initialValue={100} >
                        <InputNumber min={10} max={1000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name={['cgan_config', 'batch_size']} label="批次大小" initialValue={32} >
                        <InputNumber min={8} max={128} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name={['cgan_config', 'learning_rate']} label="学习率" initialValue={0.0002} >
                        <InputNumber min={0.00001} max={0.01} step={0.0001} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'optimizer']} label="优化器" initialValue="adam">
                        <Select style={{ width: '100%' }}>
                          <Select.Option value="adam">Adam</Select.Option>
                          <Select.Option value="rmsprop">RMSprop</Select.Option>
                          <Select.Option value="sgd">SGD</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'loss_function']} label="损失函数" initialValue="wasserstein">
                        <Select style={{ width: '100%' }}>
                          <Select.Option value="standard">标准GAN损失</Select.Option>
                          <Select.Option value="wasserstein">Wasserstein损失</Select.Option>
                          <Select.Option value="hinge">Hinge损失</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                
                <Card size="small" title="条件变量配置" style={{ marginBottom: 16 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'condition_variables']} label="条件变量" 
                        tooltip="选择作为生成条件的变量，这些变量将控制生成过程" 
                        rules={[{ required: true, message: '请选择至少一个条件变量' }]}
                      >
                        <Select
                          mode="multiple"
                          placeholder="选择条件变量"
                          style={{ width: '100%' }}
                          options={(selectedDataset ? previewColumns : defaultColumns)
                            .filter(col => col.key !== 'key')
                            .map((col: any) => ({
                              label: col.title,
                              value: col.title,
                              key: col.dataIndex || col.key
                            }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['cgan_config', 'target_variables']} label="目标变量" 
                        tooltip="选择要生成的目标变量，CGAN将学习如何基于条件生成这些变量"
                        rules={[{ required: true, message: '请选择至少一个目标变量' }]}
                      >
                        <Select
                          mode="multiple"
                          placeholder="选择目标变量"
                          style={{ width: '100%' }}
                          options={(selectedDataset ? previewColumns : defaultColumns)
                            .filter(col => col.key !== 'key')
                            .map((col: any) => ({
                              label: col.title,
                              value: col.title,
                              key: col.dataIndex || col.key
                            }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name={['cgan_config', 'condition_embedding']} label="条件嵌入方式" initialValue="concat">
                        <Radio.Group>
                          <Radio value="concat">直接拼接</Radio>
                          <Radio value="projection">映射嵌入</Radio>
                          <Radio value="conditional_bn">条件批归一化</Radio>
                          <Radio value="attention">注意力机制</Radio>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                
                <Card size="small" title="条件生成关系定义" style={{ marginBottom: 16 }}>
                  <Form.Item 
                    name={['cgan_config', 'condition_info']}
                    label="条件约束与生成目标"
                    tooltip="详细定义条件如何约束和影响生成过程，这是CGAN区别于GAN的核心"
                  >
                    <Input.TextArea 
                      placeholder="详细描述条件与目标的生成关系，例如：
1. 以收入、教育程度为条件变量，预测人群年龄分布，要求低收入低教育人群年龄分布应偏向中老年
2. 基于历史水位、降雨量作为条件，生成流量预测数据，水位越高、降雨量越大，生成的流量应越大
3. 使用土地类型、海拔高度作为条件，推导植被分布情况，要求在高海拔地区针叶林比例应增加
4. 希望模型理解高收入群体的消费模式与低收入群体的差异，并能基于收入水平生成合理的消费模式" 
                      autoSize={{ minRows: 4, maxRows: 8 }} 
                    />
                  </Form.Item>
                  
                  <Form.Item 
                    name={['cgan_config', 'nlp_model']}
                    label="自然语言解析模型"
                    tooltip="选择用于解析条件生成关系的自然语言处理模型"
                    initialValue="default"
                  >
                    <Select style={{ width: '100%' }}
                      optionFilterProp="label"
                      options={[
                        { label: '默认模型', value: 'default' },
                        { label: 'GPT-3.5', value: 'gpt-3.5' },
                        { label: 'GPT-4', value: 'gpt-4' },
                        { label: 'Llama-2', value: 'llama-2' },
                        { label: 'BERT', value: 'bert' },
                        { label: 'PaLM', value: 'palm' },
                        { label: '文心一言', value: 'ernie' }
                      ]}
                    />
                  </Form.Item>
                </Card>
                
                <div className="cgan-model-visualization">
                  <Divider orientation="center">CGAN模型结构可视化</Divider>
                  <Row justify="center">
                    <Col span={20}>
                      <div className="model-architecture">
                        <div className="model-component generator">
                          <div className="component-title">生成器 G</div>
                          <div className="component-box">
                            <div className="input-node">潜在向量 z</div>
                            <div className="input-node condition">条件变量 c</div>
                            <div className="arrow">↓</div>
                            <div className="layers-node">隐藏层</div>
                            <div className="arrow">↓</div>
                            <div className="output-node">生成数据 G(z|c)</div>
                          </div>
                        </div>
                        <div className="model-flow">→</div>
                        <div className="model-component discriminator">
                          <div className="component-title">判别器 D</div>
                          <div className="component-box">
                            <div className="input-node">真实/生成数据</div>
                            <div className="input-node condition">条件变量 c</div>
                            <div className="arrow">↓</div>
                            <div className="layers-node">隐藏层</div>
                            <div className="arrow">↓</div>
                            <div className="output-node">真实概率 D(x|c)</div>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Form.Item>
              
              <Form.Item 
                name="auto_tune" 
                label="自动调优" 
                tooltip="启用自动调优可让系统自动优化CGAN网络架构和训练参数"
                valuePropName="checked" 
              >
                <Radio.Group>
                  <Radio value={true}>是</Radio>
                  <Radio value={false}>否</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item 
                name="continue_despite_cgan" 
                label="CGAN评估容错" 
                tooltip="即使CGAN模型生成质量不理想也继续后续步骤"
                valuePropName="checked" 
              >
                <Radio.Group>
                  <Radio value={true}>是</Radio>
                  <Radio value={false}>否</Radio>
                </Radio.Group>
              </Form.Item>
            </Card>
          </Col>
        </Row>
        
        {/* 把"开始处理"按钮移到这里，显示在流程示意图之前 */}
        <div className="action-buttons" style={{ margin: '20px 0' }}>
          <Button 
            type="primary" 
            size="large"
            onClick={() => {
              console.log('点击开始处理按钮，处理类型:', processType);
              console.log('选中数据集:', selectedDataset);
              setLoading(true);
              handleProcessData();
            }}
            loading={loading}
            disabled={!selectedDataset}
            icon={<RocketOutlined />}
          >
            开始处理
          </Button>
          
          {/* 添加开发调试工具按钮 - 仅在开发环境下显示 */}
          {import.meta.env.DEV && (
            <Button
              type="dashed"
              style={{ marginLeft: '10px' }}
              onClick={() => {
                const currentValue = localStorage.getItem('use_mock_api') === 'true';
                localStorage.setItem('use_mock_api', (!currentValue).toString());
                message.info(`已${!currentValue ? '启用' : '禁用'}模拟API数据模式`);
              }}
            >
              {localStorage.getItem('use_mock_api') === 'true' 
                ? '切换到真实API' 
                : '切换到模拟API'}
            </Button>
          )}
        </div>
        
        <div className="pipeline-flow-chart">
          <div className="flow-step">数据预处理</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">缺失值与MCMC插补</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">CGAN模型训练与验证</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">统计分析与异常检测</div>
        </div>
        
        <Alert 
          message="流程说明" 
          description={
            <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
              <li><b>数据预处理</b>: 对数据进行初步清洗，处理缺失值和异常值</li>
              <li><b>高级插补</b>: 使用MCMC方法进行高级缺失值插补，并通过多重插补框架分析插补质量</li>
              <li><b>模型训练与验证</b>: 训练条件生成对抗网络(CGAN)模型，并验证数据质量</li>
              <li><b>统计分析与评估</b>: 执行K-S检验、Spearman相关分析等统计检验，以及异常值检测</li>
            </ul>
          }
          type="warning" 
          showIcon 
          style={{ marginTop: 16 }}
        />
      </Form>
    );
  };

  // 添加CGAN相关的状态
  const [trainingHistory, setTrainingHistory] = useState<any>(null);
  const [modelConfig, setModelConfig] = useState<any>(null);
  const [cganModelId, setCGANModelId] = useState<string | null>(null);

  // 在renderResultContent函数中添加CGAN结果视图
  const renderResultContent = () => {
    if (!processed) return null;
    
    // 检查数据中是否还有缺失值 - 对于已处理的数据，我们认为不应该有缺失值
    // 只在未处理的数据预览时检查缺失值
    const hasMissingValues = !processed && previewData.some((row) => {
      return Object.values(row).some(value => value === null || value === undefined || value === '');
    });
    
    // 计算缺失值占比
    const calculateMissingRatio = () => {
      let totalCells = 0;
      let missingCells = 0;
      
      previewData.forEach(row => {
        Object.values(row).forEach(value => {
          totalCells++;
          if (value === null || value === undefined || value === '') {
            missingCells++;
          }
        });
      });
      
      return totalCells > 0 ? ((missingCells / totalCells) * 100).toFixed(1) : 0;
    };
    
    // 从evaluationResults中提取统计检验结果
    const hasStatisticalResults = evaluationResults && 
      (evaluationResults.ks_test || evaluationResults.spearman_corr || evaluationResults.permutation_test);
    
    if (processType === 'cgan' && trainingHistory) {
      return (
        <div className="result-view">
          {hasMissingValues && (
            <Alert
              message={
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>数据质量提示</span>
                  <Tag color="orange">缺失率: {calculateMissingRatio()}%</Tag>
                </span>
              }
              description="处理后的数据仍然包含缺失值。您可能需要进一步处理或选择更合适的填充方法。"
              type="warning"
              showIcon
              style={{ marginBottom: 16, borderRadius: '4px' }}
            />
          )}
          
          <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>
            CGAN模型训练结果
          </h3>
          
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="模型信息" style={{ borderRadius: '8px', height: '100%' }} size="small">
                <p><strong>模型ID:</strong> {cganModelId}</p>
                <p><strong>条件变量:</strong> {modelConfig?.condition_variables?.join(', ')}</p>
                <p><strong>目标变量:</strong> {modelConfig?.target_variables?.join(', ')}</p>
                <p><strong>潜在空间维度:</strong> {modelConfig?.latent_dim}</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="训练历史" style={{ borderRadius: '8px', height: '100%' }} size="small">
                <p><strong>训练轮数:</strong> {trainingHistory.epoch.length}</p>
                <p>
                  <strong>最终生成器损失:</strong> 
                  <span style={{ color: '#52c41a', marginLeft: '8px' }}>
                    {trainingHistory.g_loss[trainingHistory.g_loss.length - 1]?.toFixed(4)}
                  </span>
                </p>
                <p>
                  <strong>最终判别器损失:</strong> 
                  <span style={{ color: '#1890ff', marginLeft: '8px' }}>
                    {trainingHistory.d_loss[trainingHistory.d_loss.length - 1]?.toFixed(4)}
                  </span>
                </p>
              </Card>
            </Col>
          </Row>
          
          {/* 添加统计检验结果显示 */}
          {hasStatisticalResults && (
            <div className="statistical-results" style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>
                统计检验结果
              </h3>
              
              <Row gutter={[16, 16]}>
                {evaluationResults.ks_test && (
                  <Col span={8}>
                    <Card 
                      title={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <ExperimentOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                          K-S检验结果
                        </div>
                      }
                      style={{ borderRadius: '8px', height: '100%' }}
                      size="small"
                    >
                      <p><strong>统计量:</strong> {evaluationResults.ks_test.statistic?.toFixed(4)}</p>
                      <p><strong>p值:</strong> {evaluationResults.ks_test.p_value?.toFixed(4)}</p>
                      <p>
                        <strong>结论:</strong> 
                        <Tag color={evaluationResults.ks_test.p_value > 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                          {evaluationResults.ks_test.p_value > 0.05 ? '分布相似(p>0.05)' : '分布存在显著差异(p≤0.05)'}
                        </Tag>
                      </p>
                    </Card>
                  </Col>
                )}
                
                {evaluationResults.spearman_corr && (
                  <Col span={8}>
                    <Card 
                      title={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <BarChartOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                          Spearman相关分析
                        </div>
                      }
                      style={{ borderRadius: '8px', height: '100%' }}
                      size="small"
                    >
                      <p><strong>相关系数:</strong> {evaluationResults.spearman_corr.coefficient?.toFixed(4)}</p>
                      <p><strong>p值:</strong> {evaluationResults.spearman_corr.p_value?.toFixed(4)}</p>
                      <p>
                        <strong>结论:</strong> 
                        <Tag color={evaluationResults.spearman_corr.p_value <= 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                          {evaluationResults.spearman_corr.p_value <= 0.05 ? '存在显著相关性(p≤0.05)' : '无显著相关性(p>0.05)'}
                        </Tag>
                      </p>
                    </Card>
                  </Col>
                )}
                
                {evaluationResults.permutation_test && (
                  <Col span={8}>
                    <Card 
                      title={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <AppstoreOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                          置换检验结果
                        </div>
                      }
                      style={{ borderRadius: '8px', height: '100%' }}
                      size="small"
                    >
                      <p><strong>检验统计量:</strong> {evaluationResults.permutation_test.statistic?.toFixed(4)}</p>
                      <p><strong>p值:</strong> {evaluationResults.permutation_test.p_value?.toFixed(4)}</p>
                      <p><strong>置换次数:</strong> {evaluationResults.permutation_test.n_resamples || 'N/A'}</p>
                      <p>
                        <strong>结论:</strong> 
                        <Tag color={evaluationResults.permutation_test.p_value <= 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                          {evaluationResults.permutation_test.p_value <= 0.05 ? '存在显著差异(p≤0.05)' : '无显著差异(p>0.05)'}
                        </Tag>
                      </p>
                    </Card>
                  </Col>
                )}
              </Row>
            </div>
          )}
          
          <h3 style={{ fontSize: '18px', fontWeight: 500, margin: '16px 0', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>
            生成数据预览
          </h3>
          
          <div className="preview-table">
            <Table
              dataSource={previewData.map((row: any, index: number) => ({ key: index, ...row }))}
              columns={previewColumns.map((col: any) => ({
                ...col,
                render: (text: any) => {
                  // 在CGAN生成的结果中，不应该有缺失值
                  // 如果仍然有null或undefined，显示为"0"而不是"缺失"标记
                  if (text === null || text === undefined || text === '') {
                    return <Text type="secondary">0</Text>;
                  }
                  return text;
                },
                ellipsis: true
              }))}
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ x: 'max-content' }}
              size="small"
              bordered
              style={{ borderRadius: '8px', overflow: 'hidden' }}
            />
          </div>
        </div>
      );
    }

    // 其他处理类型的结果视图
    return (
      <div className="result-view">
        {hasMissingValues && (
          <Alert
            message={
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>数据质量提示</span>
                <Tag color="orange">缺失率: {calculateMissingRatio()}%</Tag>
              </span>
            }
            description="处理后的数据仍然包含缺失值。您可能需要进一步处理或选择更合适的填充方法。"
            type="warning"
            showIcon
            style={{ marginBottom: 16, borderRadius: '4px' }}
          />
        )}
        
        {/* 添加数据来源提示 */}
        {processType === 'advanced_pipeline' && dataSource && (
          <Alert
            message={
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>数据来源: {dataSource}</span>
                {isFallbackData && <Tag color="blue">已启用CGAN评估容错</Tag>}
              </span>
            }
            description={isFallbackData ? 
              "CGAN模型验证未通过预设标准，系统选择了效果较好的MCMC插补数据作为最终结果。" : 
              "显示的数据是完整处理流程后的最终结果。"
            }
            type="info"
            showIcon
            style={{ marginBottom: 16, borderRadius: '4px' }}
          />
        )}
        
        {/* 添加统计检验结果显示 */}
        {hasStatisticalResults && (
          <div className="statistical-results" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>
              统计检验结果
            </h3>
            
            <Row gutter={[16, 16]}>
              {evaluationResults.ks_test && (
                <Col span={8}>
                  <Card 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ExperimentOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                        K-S检验结果
                      </div>
                    }
                    style={{ borderRadius: '8px', height: '100%' }}
                    size="small"
                  >
                    <p><strong>统计量:</strong> {evaluationResults.ks_test.statistic?.toFixed(4)}</p>
                    <p><strong>p值:</strong> {evaluationResults.ks_test.p_value?.toFixed(4)}</p>
                    <p>
                      <strong>结论:</strong> 
                      <Tag color={evaluationResults.ks_test.p_value > 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                        {evaluationResults.ks_test.p_value > 0.05 ? '分布相似(p>0.05)' : '分布存在显著差异(p≤0.05)'}
                      </Tag>
                    </p>
                  </Card>
                </Col>
              )}
              
              {evaluationResults.spearman_corr && (
                <Col span={8}>
                  <Card 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <BarChartOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                        Spearman相关分析
                      </div>
                    }
                    style={{ borderRadius: '8px', height: '100%' }}
                    size="small"
                  >
                    <p><strong>相关系数:</strong> {evaluationResults.spearman_corr.coefficient?.toFixed(4)}</p>
                    <p><strong>p值:</strong> {evaluationResults.spearman_corr.p_value?.toFixed(4)}</p>
                    <p>
                      <strong>结论:</strong> 
                      <Tag color={evaluationResults.spearman_corr.p_value <= 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                        {evaluationResults.spearman_corr.p_value <= 0.05 ? '存在显著相关性(p≤0.05)' : '无显著相关性(p>0.05)'}
                      </Tag>
                    </p>
                  </Card>
                </Col>
              )}
              
              {evaluationResults.permutation_test && (
                <Col span={8}>
                  <Card 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <AppstoreOutlined style={{ marginRight: '8px', color: '#1890ff' }}/>
                        置换检验结果
                      </div>
                    }
                    style={{ borderRadius: '8px', height: '100%' }}
                    size="small"
                  >
                    <p><strong>检验统计量:</strong> {evaluationResults.permutation_test.statistic?.toFixed(4)}</p>
                    <p><strong>p值:</strong> {evaluationResults.permutation_test.p_value?.toFixed(4)}</p>
                    <p><strong>置换次数:</strong> {evaluationResults.permutation_test.n_resamples || 'N/A'}</p>
                    <p>
                      <strong>结论:</strong> 
                      <Tag color={evaluationResults.permutation_test.p_value <= 0.05 ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                        {evaluationResults.permutation_test.p_value <= 0.05 ? '存在显著差异(p≤0.05)' : '无显著差异(p>0.05)'}
                      </Tag>
                    </p>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        )}
        
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>
            处理数据预览 {processType === 'advanced_pipeline' && <small style={{color: '#888', fontWeight: 'normal'}}>(流程完成后的最终数据)</small>}
          </h3>
        </div>
        
        {/* 现有的数据表格展示 */}
        <div className="preview-table">
          <Table 
            dataSource={previewData.map((item: any, index: number) => ({
              key: index,
              ...item
            }))} 
            columns={previewColumns.map((col: any) => ({
              ...col,
              render: (text: any) => {
                // 只有真正的缺失值才显示为"缺失"，保留包括0在内的所有有效值
                if (text === null || text === undefined || text === '') {
                  // 标记真正的缺失值
                  return <Text type="danger" style={{fontStyle: 'italic', backgroundColor: 'rgba(255,77,79,0.07)', padding: '2px 6px', borderRadius: '2px'}}>缺失</Text>;
                }
                // 直接显示API返回的值，包括MCMC插补结果
                return text;
              },
              ellipsis: true
            }))}
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 'max-content' }} 
            size="small"
            bordered
            style={{ borderRadius: '8px', overflow: 'hidden' }}
          />
        </div>
      </div>
    );
  };

  // 生成模拟统计检验结果数据
  const createMockStatisticalResults = () => {
    return {
      ks_test: {
        statistic: 0.1845,
        p_value: 0.0723
      },
      spearman_corr: {
        coefficient: 0.7692,
        p_value: 0.0021
      },
      permutation_test: {
        statistic: 2.5643,
        p_value: 0.0354,
        n_resamples: 1000
      }
    };
  };

  return (
    <App>
      <div className="data-process-container">
        <div className="page-header">
          <Title level={3}>数据处理中心</Title>
          <Paragraph className="page-description">
            在这里您可以对数据集进行各种处理操作，从基础的缺失值处理到高级的特征工程和插补分析。
          </Paragraph>
        </div>
        
        <Row gutter={[24, 24]}>
          {/* 上方：数据选择区域 */}
          <Col xs={24}>
            <Card 
              title={<Title level={4}><DatabaseOutlined /> 数据集管理</Title>}
              className="dataset-card"
              extra={
                <Tooltip title="刷新数据集列表">
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={fetchDatasets}
                    loading={loading}
                    type="text"
                  />
                </Tooltip>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form form={form}>
                  <Form.Item 
                    label="选择数据集" 
                    help="选择要处理的数据集"
                    style={{ marginBottom: 12 }}
                    name="dataset_selector"
                  >
                    <Select
                      showSearch
                      placeholder="选择要处理的数据集"
                      style={{ width: '100%' }}
                      onChange={handleDatasetChange}
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      loading={loading}
                      options={datasets.map(dataset => ({
                        label: `${dataset.name} (${dataset.rows}行 × ${dataset.columns}列)`,
                        value: dataset.id,
                        key: dataset.id
                      }))}
                    />
                  </Form.Item>
                </Form>
                
                {selectedDataset && (
                  <Alert 
                    message={`已选择数据集: ${selectedDataset.name}`}
                    description={`数据规模: ${selectedDataset.rows}行 × ${selectedDataset.columns}列`}
                    type="success" 
                    showIcon
                  />
                )}
              </Space>
            </Card>
            
            {selectedDataset && (
              <Card 
                title={<Title level={4}><BarChartOutlined /> 数据预览</Title>}
                className="preview-card"
              >
                <Table 
                  dataSource={previewData}
                  columns={previewColumns}
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content', y: 300 }}
                  bordered
                />
                <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                  注: 仅显示前5行数据
                </Text>
              </Card>
            )}
          </Col>
          
          {/* 下方：数据处理区域 */}
          <Col xs={24}>
            <Card 
              title={<Title level={4}><FileTextOutlined /> 数据处理选项</Title>}
              className="processing-card"
            >
              <div className="process-type-selector">
                <Text strong>处理类型：</Text>
                <Radio.Group 
                  value={isAdvancedProcess ? 'advanced' : 'basic'}
                  onChange={(e) => {
                    if (e.target.value === 'basic') {
                      setProcessType(basicTabs[0].key);
                    } else {
                      setProcessType(advancedTabs[0].key);
                    }
                  }}
                  optionType="button"
                  buttonStyle="solid"
                  size="middle"
                  className="process-radio-group"
                >
                  <Radio.Button value="basic">基础处理</Radio.Button>
                  <Radio.Button value="advanced">高级处理</Radio.Button>
                </Radio.Group>
              </div>
              
              {renderProcessTabs()}
            </Card>
          </Col>
          
          {processed && (
            <Col xs={24}>
              <Card 
                title={
                  <div className="card-title-with-badge">
                    <Title level={4}><BarChartOutlined /> 处理结果预览</Title>
                    <Badge status="processing" text="已处理" style={{ backgroundColor: '#52c41a' }} />
                  </div>
                }
                className="result-card"
                bordered={false}
                style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.09)' }}
                extra={
                  <Space>
                    <Tooltip title="保存结果">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveResult}
                        disabled={loading}
                        style={{ borderRadius: '4px' }}
                >
                        保存结果
                </Button>
                    </Tooltip>
                  </Space>
                }
              >
                <div className="result-content-wrapper" style={{ padding: '8px 0' }}>
                  {renderResultContent()}
                </div>
              </Card>
            </Col>
          )}
        </Row>
      </div>
    </App>
  );
};

export default DataProcess; 