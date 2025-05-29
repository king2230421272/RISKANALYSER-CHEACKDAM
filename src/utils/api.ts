import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { message } from 'antd';

// 设置API基础URL
axios.defaults.baseURL = 'http://localhost:8000';

// 请求拦截器
axios.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证令牌等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一错误处理
    console.error('API响应错误:', error);
    return Promise.reject(error);
  }
);

// 定义API响应类型
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

// 通用GET请求
export const fetchData = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await axios.get(`${axios.defaults.baseURL}${url}`, {
      ...config,
      timeout: 60000, // 60秒超时
    });
    return response.data;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

// 通用POST请求
export const postData = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await axios.post(`${axios.defaults.baseURL}${url}`, data, {
      ...config,
      timeout: 60000, // 60秒超时
    });
    return response.data;
  } catch (error) {
    console.error('API post error:', error);
    throw error;
  }
};

// 带重试功能的POST请求
export const postDataWithRetry = async <T>(
  url: string, 
  data?: any, 
  config?: AxiosRequestConfig,
  retries = 1
): Promise<T> => {
  try {
    const response = await axios.post<T>(`${axios.defaults.baseURL}${url}`, data, config);
    return response.data;
  } catch (error) {
    if (retries > 0) {
      message.warning(`请求失败，正在重试...(${retries}次剩余)`);
      // 等待1秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
      return postDataWithRetry(url, data, config, retries - 1);
    }
    throw error;
  }
};

// 保存处理结果的专用函数
export const saveProcessedData = async (
  datasetId: number, 
  processType: string, 
  newName?: string
) => {
  try {
    const response = await postData('/api/save_processed_data/', {
      dataset_id: datasetId,
      process_type: processType,
      new_name: newName || `processed_${datasetId}`
    });
    return response;
  } catch (error) {
    console.error('Save processed data error:', error);
    throw error;
  }
};

// CGAN模型训练函数
export interface CGANTrainConfig {
  dataset_id: number;
  cgan_config: {
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
  };
  auto_tune?: boolean;
}

export interface CGANTrainResponse {
  success: boolean;
  message: string;
  model_id: string;
  training_history: {
    d_loss: number[];
    g_loss: number[];
    epoch: number[];
  };
  preview_data: {
    columns: string[];
    data: any[];
  };
  model_config: {
    condition_variables: string[];
    target_variables: string[];
    condition_dim: number;
    target_dim: number;
    latent_dim: number;
    generator_layers: number[];
    discriminator_layers: number[];
  };
}

export const trainCGANModel = async (data: any) => {
  console.log('trainCGANModel函数被调用，参数:', data);
  try {
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
    
    console.log('正在发送CGAN训练请求到:', `${axios.defaults.baseURL}/api/train_cgan/`);
    const response = await axios.post(`${axios.defaults.baseURL}/api/train_cgan/`, data, {
      signal: controller.signal,
      timeout: 60000
    });
    
    clearTimeout(timeoutId);
    console.log('CGAN训练API响应:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('CGAN训练API错误:', error);
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      throw new Error('CGAN训练请求超时');
    }
    throw error;
  }
};

// CGAN数据生成函数
export interface CGANGenerateConfig {
  model_id: string;
  conditions: any[];
  num_samples?: number;
}

export interface CGANGenerateResponse {
  success: boolean;
  message: string;
  model_id: string;
  generated_data: {
    condition_id: number;
    condition: any;
    samples: {
      sample_id: number;
      values: number[];
    }[];
  }[];
}

export const generateFromCGAN = async (config: CGANGenerateConfig): Promise<CGANGenerateResponse> => {
  try {
    const response = await postData<CGANGenerateResponse>('/api/process/cgan/generate/', config, {
      timeout: 120000, // 2分钟超时
    });
    return response;
  } catch (error) {
    console.error('Generate from CGAN model error:', error);
    throw error;
  }
};

// 添加高级处理流程API函数
export interface AdvancedPipelineConfig {
  dataset_id: number;
  pipeline_steps: string[];
  target_column?: string;
  max_attempts?: number;
  mi_model?: string;
  cgan_config?: any;
  auto_tune?: boolean;
  continue_despite_cgan?: boolean;
}

export interface AdvancedPipelineResponse {
  success: boolean;
  message: string;
  preview_data?: {
    columns: string[];
    data: any[];
  };
  result_summary?: {
    steps_executed: string[];
    execution_time: number;
    warnings: string[];
    data_source?: string;
    fallback_to_mcmc?: boolean;
  };
  evaluation_results?: {
    ks_test?: {
      statistic: number;
      p_value: number;
    };
    spearman_corr?: {
      coefficient: number;
      p_value: number;
    };
    permutation_test?: {
      statistic: number;
      p_value: number;
      n_resamples: number;
    };
  };
}

// 添加一个用于开发环境的模拟API调用函数
export const mockAdvancedPipeline = async (config: AdvancedPipelineConfig): Promise<AdvancedPipelineResponse> => {
  console.log('模拟高级处理流程API调用，参数:', config);
  
  // 模拟API处理时间
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // 生成模拟预览数据
  const columns = ['num', 'FM', 'DT', 'hd', 'hw', 'Wave', 'V', 'VW', 'hb', 'QP'];
  const data = [
    { num: 1, FM: 'P', DT: 'HD', hd: 34.14, hw: 28, Wave: 82.4, V: 22.5, VW: 22.2, hb: 31.1, QP: 6850 },
    { num: 2, FM: 'P', DT: 'HD', hd: 71, hw: 12.2, Wave: 59.6, V: 1.1, VW: 0.91, hb: 0, QP: 1130 },
    { num: 3, FM: 'O', DT: 'CD', hd: 24.5, hw: 31, Wave: 0, V: 492, VW: 608, hb: 29.5, QP: 78100 },
    { num: 4, FM: 'P', DT: 'HD', hd: 28.96, hw: 28, Wave: 76, V: 3.2, VW: 2.96, hb: 29, QP: 2370 },
    { num: 5, FM: 'O', DT: 'HD', hd: 7, hw: 7, Wave: 86, V: 0.05, VW: 0.05, hb: 7, QP: 9.2 }
  ];
  
  // 生成模拟统计检验结果
  const evaluation_results = {
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
  
  // 模拟执行摘要
  const result_summary = {
    steps_executed: ['mcmc_imputation', 'multiple_imputation', 'cgan_train', 'ks_test', 'spearman_corr', 'permutation_test'],
    execution_time: 12.34,
    warnings: [],
    data_source: '完整处理流程后的最终数据',
    fallback_to_mcmc: false
  };
  
  return {
    success: true,
    message: '高级处理流程执行成功',
    preview_data: {
      columns,
      data
    },
    evaluation_results,
    result_summary
  };
};

// 修改runAdvancedPipeline函数，在开发环境中可选择使用模拟数据
export const runAdvancedPipeline = async (config: AdvancedPipelineConfig): Promise<AdvancedPipelineResponse> => {
  console.log('高级处理流程API被调用，参数:', config);
  
  // 开发环境下，可以通过设置环境变量使用模拟数据
  if (import.meta.env.DEV || localStorage.getItem('use_mock_api') === 'true') {
    console.log('使用模拟API数据（开发环境）');
    return mockAdvancedPipeline(config);
  }
  
  try {
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
    
    console.log('正在发送高级处理流程请求到:', `${axios.defaults.baseURL}/api/advanced_pipeline/`);
    const startTime = Date.now();
    const response = await axios.post(`${axios.defaults.baseURL}/api/advanced_pipeline/`, config, {
      signal: controller.signal,
      timeout: 120000
    });
    const endTime = Date.now();
    
    clearTimeout(timeoutId);
    console.log(`高级处理流程API响应时间: ${(endTime - startTime)/1000}秒`);
    console.log('高级处理流程API状态码:', response.status);
    console.log('高级处理流程API响应头:', response.headers);
    console.log('高级处理流程API响应数据:', response.data);
    
    // 检查响应中是否包含预期字段
    const responseData = response.data;
    if (!responseData) {
      console.error('API响应为空');
      throw new Error('接收到空响应');
    }
    
    // 验证统计检验结果
    if (!responseData.evaluation_results) {
      console.warn('响应中缺少统计检验结果');
    } else {
      console.log('统计检验结果包含以下测试:',
        Object.keys(responseData.evaluation_results).join(', '));
    }
    
    // 验证预览数据
    if (!responseData.preview_data) {
      console.warn('响应中缺少预览数据');
    } else {
      console.log('预览数据包含:', 
        responseData.preview_data.columns?.length || 0, '列,',
        responseData.preview_data.data?.length || 0, '行');
    }
    
    return response.data;
  } catch (error: any) {
    console.error('高级处理流程API错误详情:', error);
    
    // 检查是否收到了任何响应数据
    if (error.response) {
      console.error('错误响应状态:', error.response.status);
      console.error('错误响应数据:', error.response.data);
    }
    
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      throw new Error('高级处理流程请求超时');
    }
    throw error;
  }
};

// 风险评估接口定义
export interface RiskAssessmentRequest {
  dataset_id?: number;
  name?: string;
  risk_factors: string[];
  risk_thresholds: Record<string, number>;
}

// 新增：核心风险评估方法API接口
export interface RiskMethodRequest {
  method: string;  // 评估方法: 'prob_loss', 'iahp_critic_gt', 'dynamic_bayes'
  data: any[];  // 评估数据
  visualization: boolean;  // 是否生成可视化结果
  
  // 方法特定参数
  prob_col?: string;  // 概率列名（概率损失法）
  loss_col?: string;  // 损失列名（概率损失法）
  
  indicator_cols?: string[];  // 指标列名（IAHP-CRITIC-GT）
  expert_weights?: Record<string, number>;  // 专家评定权重（IAHP-CRITIC-GT）
  alpha?: number;  // IAHP和CRITIC权重融合系数（IAHP-CRITIC-GT）
  
  predict_col?: string;  // 预测列名（动态贝叶斯）
  time_steps?: number;  // 时间步长（动态贝叶斯）
  sequence_cols?: string[];  // 序列特征列（动态贝叶斯）
  
  land_use_analysis?: boolean;  // 是否包含土地利用分析
  land_use_image_path?: string;  // 土地利用图像路径
}

export interface RiskMethodResponse {
  risk_level: Record<string, any>;  // 风险等级信息
  risk_score: number | string;  // 风险评分
  factor_analysis: Record<string, any>;  // 各因素分析结果
  visualizations?: Record<string, string>;  // 可视化结果(base64编码)
  method_info: Record<string, any>;  // 评估方法信息
  
  // 方法特定返回字段
  prob_loss_results?: Record<string, any>;  // 概率损失法结果
  iahp_critic_results?: Record<string, any>;  // IAHP-CRITIC-GT结果
  dynamic_bayes_results?: Record<string, any>;  // 动态贝叶斯结果
  
  // 土地利用分析结果
  land_use_analysis?: Record<string, any>;  // 土地利用分析结果
}

export interface AdvancedRiskAssessmentRequest extends RiskAssessmentRequest {
  assessment_method: string;  // 'comprehensive', 'factor_analysis', 'trend_analysis', etc.
  visualization: boolean;
  land_use_analysis?: boolean;
  land_use_image_path?: string;
  expert_weights?: Record<string, number>;
  conditional_variables?: string[];
}

export interface RiskAssessmentResponse {
  id?: number;
  risk_level: {
    level: string;
    score: number;
    description: string;
  };
  risk_score: number;
  factor_analysis: Record<string, any>;
  trend_analysis?: {
    trend_data: {
      historical: number[];
      projected: number[];
      time_periods: string[];
    };
  };
  visualizations?: Record<string, string>;
  land_use_analysis?: {
    land_use_preview?: string;
    land_use_areas?: Record<string, number>;
    high_risk_areas?: Array<{
      type: string;
      risk_level: string;
      percentage: number;
    }>;
  };
  assessment_methods_comparison?: Record<string, {
    risk_level: string;
    risk_score: number;
    confidence?: number;
    top_factors?: string[];
  }>;
  recommended_method?: string;
}

export interface RiskMapRequest {
  dataset_id?: number;
  name?: string;
  risk_assessment_result_id?: number;
  land_use_image_path: string;
  risk_factors?: string[];
  risk_thresholds?: Record<string, number>;
  spatial_resolution?: number;
  include_heatmap?: boolean;
  include_contours?: boolean;
  map_format?: string;
}

export interface RiskMapResponse {
  map_path: string;
  map_size: number;
  thumbnail: string;
  risk_statistics: {
    risk_level: string;
    risk_value: number;
    land_use_distribution: Record<string, number>;
    high_risk_area_percentage: number;
    average_risk_density: number;
    risk_hotspots: Array<{
      location?: string;
      risk_level: string;
      intensity: number;
    }>;
  };
  message: string;
}

export interface RiskReportRequest {
  dataset_id?: number;
  name?: string;
  risk_factors: string[];
  risk_thresholds: Record<string, number>;
  report_format: string;
  include_visualizations: boolean;
  include_recommendations: boolean;
  include_appendix?: boolean;
  include_executive_summary?: boolean;
  include_formulas?: boolean;
  report_title?: string;
  report_author?: string;
  risk_assessment_method?: string;
}

export interface RiskReportResponse {
  report_path: string;
  report_size: number;
  message: string;
  download_url?: string;
}

// 风险评估基础API调用
export const assessRisk = async (request: RiskAssessmentRequest): Promise<RiskAssessmentResponse> => {
  const response = await postData<RiskAssessmentResponse>('/api/assess_risk', request);
  return response;
};

// 高级风险评估API调用
export const assessRiskAdvanced = async (request: AdvancedRiskAssessmentRequest): Promise<RiskAssessmentResponse> => {
  const response = await postData<RiskAssessmentResponse>('/api/assess_risk/advanced/', request);
  return response;
};

// 新增：核心风险评估方法API调用
export const assessRiskMethod = async (request: RiskMethodRequest): Promise<RiskMethodResponse> => {
  const response = await postData<RiskMethodResponse>('/api/risk/method/', request);
  return response;
};

// 生成风险地图API调用
export const generateRiskMap = async (request: RiskMapRequest): Promise<RiskMapResponse> => {
  const response = await postData<RiskMapResponse>('/api/risk/generate_map/', request);
  return response;
};

// 生成风险报告API调用
export const generateRiskReport = async (request: RiskReportRequest): Promise<RiskReportResponse> => {
  const response = await postData<RiskReportResponse>('/api/risk/generate_report/', request);
  return response;
};

// 保存敏感性分析结果
export const saveSensitivityAnalysis = async (data: {model_id: string, feature_importance: {name:string,importance:number}[], category: string}) => {
  try {
    const response = await postData('/api/save_sensitivity_analysis/', data);
    return response;
  } catch (error) {
    console.error('保存敏感性分析结果失败:', error);
    throw error;
  }
};

// 获取模型敏感性分析结果
export const fetchModelFeatureImportance = async (modelId: string) => {
  try {
    const response = await fetchData<{feature_importance: Record<string, number>}>('/api/model_feature_importance/' + modelId + '/');
    return response;
  } catch (error) {
    console.error('获取模型敏感性分析结果失败:', error);
    throw error;
  }
};

export default axios; 