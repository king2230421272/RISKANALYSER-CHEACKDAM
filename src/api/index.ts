import axios from 'axios';
import type { AxiosResponse, AxiosError } from 'axios';
import { message } from 'antd';

// 定义API基础URL
const API_BASE_URL = 'http://localhost:8000/api';

// 超时设置
const TIMEOUT = 10000;

// 创建Axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // 处理错误
    console.error('API错误:', error);
    if (error.response) {
      console.error('服务器响应错误:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('服务器未响应:', error.request);
      message.error('服务器未响应，请检查后端服务是否启动');
    } else {
      console.error('请求设置错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// 导出API函数
export const apiService = {
  // 数据集相关
  fetchDatasets: async () => {
    try {
      const response = await api.get('/list_datasets/');
      return response.data.datasets || [];
    } catch (error) {
      console.error('获取数据集列表失败:', error);
      // 返回模拟数据
      return [
        { id: 1, name: '风险评估数据集', description: '包含缺失值的风险评估数据集', row_count: 1000, column_count: 15 },
        { id: 2, name: '金融风险数据', description: '金融风险分析样本数据', row_count: 500, column_count: 10 },
      ];
    }
  },
  
  fetchDatasetColumns: async (datasetId: number) => {
    try {
      const response = await api.get(`/preview_dataset/${datasetId}/`);
      console.log('API返回原始数据:', response.data);
      
      // 解析列信息
      let columns: string[] = [];
      if (response.data) {
        if (Array.isArray(response.data.columns)) {
          columns = response.data.columns;
        } else if (response.data.samples && Array.isArray(response.data.samples) && response.data.samples.length > 0) {
          columns = Object.keys(response.data.samples[0]);
        }
      }
      
      return {
        columns,
        samples: response.data.samples || [],
        dataset_name: response.data.dataset_name || `数据集-${datasetId}`
      };
    } catch (error) {
      console.error('获取数据集列信息失败:', error);
      // 返回模拟数据
      return {
        columns: ['价格', '面积', '房龄', '位置', '楼层', '朝向', '装修', '学区', '交通', '环境'],
        samples: [],
        dataset_name: `模拟数据集-${datasetId}`
      };
    }
  },
  
  // 模型相关
  fetchModels: async () => {
    try {
      const response = await api.get('/list_models/');
      return response.data.models || [];
    } catch (error) {
      console.error('获取模型列表失败:', error);
      // 返回模拟数据
      return [
        {
          id: 'xgboost_demo',
          name: 'XGBoost模型',
          model_type: 'xgboost',
          created_at: '2023-05-25 12:00:00',
          features: ['价格', '面积', '房龄', '位置', '楼层'],
          target: '评估价值'
        }
      ];
    }
  },
  
  trainModel: async (modelData: any) => {
    try {
      const response = await api.post('/train_model/', modelData);
      return response.data;
    } catch (error) {
      console.error('训练模型失败:', error);
      throw error;
    }
  },
  
  predictWithModel: async (modelId: string, features: any) => {
    try {
      const response = await api.post('/predict/', { model_id: modelId, features });
      return response.data;
    } catch (error) {
      console.error('预测失败:', error);
      throw error;
    }
  },
  
  evaluateModel: async (modelId: string) => {
    try {
      const response = await api.post('/evaluate_model/', { model_id: modelId });
      return response.data;
    } catch (error) {
      console.error('评估模型失败:', error);
      throw error;
    }
  }
};

export default apiService; 