import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Button, Form, Select, 
  Input, Divider, InputNumber, Spin, Tabs, Tag, 
  Space, message, Upload, Typography, Modal, Switch,
  Radio, Checkbox, Alert, Slider
} from 'antd';
import { 
  UploadOutlined, DownloadOutlined, FileTextOutlined,
  GlobalOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { 
  fetchData, postData, 
  assessRisk, assessRiskAdvanced, assessRiskMethod, generateRiskMap, generateRiskReport
} from '../utils/api';
import type { 
  RiskAssessmentRequest, AdvancedRiskAssessmentRequest,
  RiskMapRequest, RiskReportRequest, RiskMapResponse, RiskReportResponse,
  RiskMethodRequest, RiskMethodResponse
} from '../utils/api';
import { RiskLevelTag, RiskFactorAnalysis, RiskTrendChart } from '../components/risk';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { Dragger } = Upload;

// 风险评估方法名称映射
const METHOD_NAMES: Record<string, string> = {
  'prob_loss': '概率损失法',
  'iahp_critic_gt': 'IAHP-CRITIC-GT法',
  'dynamic_bayes': '动态贝叶斯网络'
};

// 风险级别对应的颜色
const RISK_COLORS: Record<string, string> = {
  'Low': '#52c41a',
  'Medium': '#faad14',
  'High': '#ff7a45',
  'Critical': '#f5222d'
};

// 接口定义
interface Dataset {
  id: number;
  name: string;
  description?: string;
  row_count: number;
  column_count: number;
}

interface Column {
  name: string;
  type: string;
  min?: number;
  max?: number;
  missing_rate?: number;
}

interface RiskAssessmentResult {
  id?: number;
  risk_level: {
    level: string;
    score: number;
    description?: string;
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
  land_use_analysis?: Record<string, any>;
  assessment_methods_comparison?: Record<string, any>;
  recommended_method?: string;
}

// 主组件 
const RiskAssess: React.FC = () => {
  // 状态
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [selectedData, setSelectedData] = useState<any[]>([]);
  
  // 风险评估方法
  const [selectedMethod, setSelectedMethod] = useState<string>('prob_loss');
  
  // 概率损失法参数
  const [probColumn, setProbColumn] = useState<string>('');
  const [lossColumn, setLossColumn] = useState<string>('');
  
  // IAHP-CRITIC-GT参数
  const [indicatorColumns, setIndicatorColumns] = useState<string[]>([]);
  const [expertWeights, setExpertWeights] = useState<Record<string, number>>({});
  const [alphaValue, setAlphaValue] = useState<number>(0.5);
  const [expertScoreText, setExpertScoreText] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [conditionRiskValue, setConditionRiskValue] = useState<number|null>(null);
  
  // 动态贝叶斯参数
  const [predictColumn, setPredictColumn] = useState<string>('');
  const [timeSteps, setTimeSteps] = useState<number>(3);
  const [sequenceColumns, setSequenceColumns] = useState<string[]>([]);
  
  // 通用参数
  const [enableLandUse, setEnableLandUse] = useState<boolean>(false);
  const [landUseFilePath, setLandUseFilePath] = useState<string>('');
  
  // 新增状态
  const [damBreakProb, setDamBreakProb] = useState<number | null>(null);
  const [terrainFilePath, setTerrainFilePath] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [assessing, setAssessing] = useState<boolean>(false);
  const [result, setResult] = useState<RiskMethodResponse | null>(null);
  
  // 报告与地图
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportFormat, setReportFormat] = useState<string>('pdf');
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportAuthor, setReportAuthor] = useState<string>('');
  const [reportOptions, setReportOptions] = useState({
    includeViz: true,
    includeRecs: true,
    includeSummary: true,
    includeAppendix: false,
    includeFormulas: false
  });
  
  const [mapModalVisible, setMapModalVisible] = useState<boolean>(false);
  const [mapFormat, setMapFormat] = useState<string>('png');
  const [resolution, setResolution] = useState<number>(100);
  const [mapOptions, setMapOptions] = useState({
    includeHeatmap: true,
    includeContours: true
  });
  
  // 新增相关useState和处理函数
  const [assessmentTarget, setAssessmentTarget] = useState('');
  const [riskThresholds, setRiskThresholds] = useState('');
  const [importantFactors, setImportantFactors] = useState<string[]>([]);
  const [featureImportances, setFeatureImportances] = useState<{name:string,importance:number}[]>([]); // 需从模型敏感性分析结果获取
  const [conditionRows, setConditionRows] = useState([{factor:'',value:''}]);
  const addConditionRow = () => setConditionRows([...conditionRows, {factor:'',value:''}]);
  const removeConditionRow = (idx:number) => setConditionRows(conditionRows.filter((_,i)=>i!==idx));
  const updateConditionRow = (idx:number, row:any) => setConditionRows(conditionRows.map((r,i)=>i===idx?row:r));
  
  // 获取数据集
  useEffect(() => {
    fetchDatasets();
  }, []);
  
  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const response = await fetchData<any>('/api/list_datasets/');
      if (response.datasets) {
        setDatasets(response.datasets);
      }
    } catch (error) {
      console.error('获取数据集失败:', error);
      message.error('获取数据集列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理数据集变化
  const handleDatasetChange = async (datasetId: number) => {
    setSelectedDataset(datasetId);
    setResult(null);
    
    try {
      // 获取列名
      const columnsResponse = await fetchData<any>(`/api/dataset_columns/?dataset_id=${datasetId}`);
      if (columnsResponse.columns) {
        setColumns(columnsResponse.columns);
      }
      
      // 获取数据
      const dataResponse = await fetchData<any>(`/api/preview_dataset/${datasetId}/`);
      if (dataResponse.data) {
        setSelectedData(dataResponse.data);
      }
    } catch (error) {
      console.error('获取数据集信息失败:', error);
      message.error('获取数据集信息失败');
    }
  };

  // 处理方法变更
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setResult(null);
  };
  
  // 处理上传土地利用图片
  const handleLandUseUpload = (info: any) => {
    if (info.file.status === 'done') {
      const response = info.file.response;
      if (response.success) {
        setLandUseFilePath(response.file_path);
        message.success(`${info.file.name} 上传成功`);
      } else {
        message.error(`${info.file.name} 上传失败`);
      }
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };
  
  // 新增上传回调
  const handleTerrainUpload = (info: any) => {
    if (info.file.status === 'done') {
      const response = info.file.response;
      if (response.success) {
        setTerrainFilePath(response.file_path);
        message.success(`${info.file.name} 上传成功`);
      } else {
        message.error(`${info.file.name} 上传失败`);
      }
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };
  
  // 执行风险评估
  const handleAssessment = async () => {
    if (selectedMethod === 'prob_loss') {
      if (damBreakProb === null || terrainFilePath === '' || landUseFilePath === '') {
        message.warning('请填写溃坝概率并上传区域地形图和土地利用图');
        return;
      }
    }
    
    if (!selectedDataset || !selectedData.length) {
      message.warning('请选择数据集');
      return;
    }
    
    // 基于选择的方法验证必要字段
    if (selectedMethod === 'prob_loss' && (!probColumn || !lossColumn)) {
      message.warning('请选择概率列和损失列');
      return;
    }
    
    if (selectedMethod === 'iahp_critic_gt' && !indicatorColumns.length) {
      message.warning('请选择指标列');
      return;
    }
    
    if (selectedMethod === 'dynamic_bayes' && (!predictColumn || !sequenceColumns.length)) {
      message.warning('请选择预测列和序列特征列');
      return;
    }
    
    setAssessing(true);
    
    try {
      const request: RiskMethodRequest = {
        method: selectedMethod,
        data: [], // 概率损失法无需数据集
        visualization: true
      };
      
      // 基于方法添加参数
      if (selectedMethod === 'prob_loss') {
        request.prob_col = undefined;
        request.loss_col = undefined;
        // 用 data 字段传递所有参数
        request.data = [{
          dam_break_prob: damBreakProb,
          terrain_file_path: terrainFilePath,
          land_use_image_path: landUseFilePath
        }];
      } else if (selectedMethod === 'iahp_critic_gt') {
        request.indicator_cols = indicatorColumns;
        if (Object.keys(expertWeights).length) {
          request.expert_weights = expertWeights;
        }
        request.alpha = alphaValue;
      } else if (selectedMethod === 'dynamic_bayes') {
        request.predict_col = predictColumn;
        request.time_steps = timeSteps;
        request.sequence_cols = sequenceColumns;
      }
      
      if (enableLandUse && landUseFilePath) {
        request.land_use_analysis = true;
        request.land_use_image_path = landUseFilePath;
      }
      
      const response = await assessRiskMethod(request);
      setResult(response);
      message.success('风险评估完成');
    } catch (error) {
      console.error('风险评估失败:', error);
      message.error('执行风险评估失败');
    } finally {
      setAssessing(false);
    }
  };
  
  // 生成风险报告
  const handleGenerateReport = async () => {
    if (!result) {
      message.warning('请先执行风险评估');
      return;
    }
    
    try {
      const request: RiskReportRequest = {
        dataset_id: selectedDataset || undefined,
        risk_factors: selectedMethod === 'iahp_critic_gt' ? indicatorColumns : 
                     (selectedMethod === 'dynamic_bayes' ? sequenceColumns : []),
        risk_thresholds: {},  // 在新的接口中不再使用具体阈值
        report_format: reportFormat,
        include_visualizations: reportOptions.includeViz,
        include_recommendations: reportOptions.includeRecs,
        include_executive_summary: reportOptions.includeSummary,
        include_appendix: reportOptions.includeAppendix,
        include_formulas: reportOptions.includeFormulas,
        report_title: reportTitle || undefined,
        report_author: reportAuthor || undefined,
        risk_assessment_method: selectedMethod
      };
      
      const response = await generateRiskReport(request);
      
      // 如果有下载链接，打开新窗口下载
      if (response.report_path) {
        // 使用报告的直接路径或者下载链接
        const downloadUrl = response.download_url || `/api/download_file?path=${encodeURIComponent(response.report_path)}`;
        window.open(downloadUrl, '_blank');
      }
      
      message.success('风险报告生成成功');
      setReportModalVisible(false);
    } catch (error) {
      console.error('生成报告失败:', error);
      message.error('风险报告生成失败');
    }
  };
  
  // 生成风险地图
  const handleGenerateMap = async () => {
    if (!landUseFilePath && !result?.land_use_analysis) {
      message.warning('请先上传土地利用图像');
      return;
    }
    
    try {
      const request: RiskMapRequest = {
        land_use_image_path: landUseFilePath,
        dataset_id: selectedDataset || undefined,
        spatial_resolution: resolution,
        include_heatmap: mapOptions.includeHeatmap,
        include_contours: mapOptions.includeContours,
        map_format: mapFormat
      };
      
      const response = await generateRiskMap(request);
      
      message.success('风险地图生成成功');
      
      // 构建地图的访问URL
      if (response.map_path) {
        window.open(`/api/download_file?path=${encodeURIComponent(response.map_path)}`, '_blank');
      }
      
      setMapModalVisible(false);
    } catch (error) {
      console.error('生成地图失败:', error);
      message.error('风险地图生成失败');
    }
  };
  
  // 渲染风险分析结果
  const renderResults = () => {
    if (!result) return null;
    
    // 解析风险级别
    const riskLevel = typeof result.risk_level === 'object' && result.risk_level.level 
      ? result.risk_level.level 
      : 'Medium';
    const riskColor = RISK_COLORS[riskLevel] || '#1890ff';
    
    return (
      <div className="risk-results">
        <Alert
          message={
            <span>风险评估结果 - <strong>{riskLevel}</strong> 风险</span>
          }
          description={
            <span>风险分数: {typeof result.risk_score === 'number' ? result.risk_score.toFixed(2) : result.risk_score}</span>
          }
          type={
            riskLevel === 'Low' ? 'success' :
            riskLevel === 'Medium' ? 'warning' :
            'error'
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Row gutter={16}>
          <Col span={12}>
            <Card title="风险因素分析">
              <RiskFactorAnalysis data={result.factor_analysis} />
            </Card>
          </Col>
          
          <Col span={12}>
            {result.visualizations && result.visualizations['risk_trend'] ? (
              <Card title="风险分布">
                <img 
                  src={`data:image/png;base64,${result.visualizations['risk_trend']}`} 
                  style={{ width: '100%' }} 
                  alt="风险分布" 
                />
              </Card>
            ) : (
              <Card title="风险级别详情">
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center',
                  background: `${riskColor}22`,
                  borderRadius: '8px'
                }}>
                  <RiskLevelTag level={riskLevel} showIcon={true} />
                  <Paragraph>
                    {typeof result.method_info === 'object' && result.method_info.description || '风险评估基于所选方法进行计算。'}
                  </Paragraph>
                </div>
              </Card>
            )}
          </Col>
        </Row>
        
        {/* 方法特定结果 */}
        {selectedMethod === 'prob_loss' && result.prob_loss_results && (
          <Card title="概率损失法分析结果" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={24}>
                {result.visualizations && result.visualizations['prob_loss_scatter'] && (
                  <img 
                    src={`data:image/png;base64,${result.visualizations['prob_loss_scatter']}`} 
                    style={{ maxWidth: '100%' }} 
                    alt="概率-损失散点图" 
                  />
                )}
              </Col>
            </Row>
          </Card>
        )}
        
        {selectedMethod === 'iahp_critic_gt' && result.iahp_critic_results && (
          <Card title="改进层次分析法结果" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                {result.visualizations && result.visualizations['indicator_contribution'] && (
                  <img 
                    src={`data:image/png;base64,${result.visualizations['indicator_contribution']}`} 
                    style={{ width: '100%' }} 
                    alt="指标贡献图" 
                  />
                )}
              </Col>
              <Col span={12}>
                <Title level={5}>指标权重</Title>
                {result.iahp_critic_results.weights && (
                  <ul>
                    {Object.entries(result.iahp_critic_results.weights).map(([indicator, weight]) => (
                      <li key={indicator}>
                        {indicator}: {typeof weight === 'number' ? weight.toFixed(4) : String(weight)}
                      </li>
                    ))}
                  </ul>
                )}
              </Col>
            </Row>
          </Card>
        )}
        
        {selectedMethod === 'dynamic_bayes' && result.dynamic_bayes_results && (
          <Card title="动态贝叶斯网络结果" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={24}>
                {result.visualizations && result.visualizations['time_series_forecast'] && (
                  <img 
                    src={`data:image/png;base64,${result.visualizations['time_series_forecast']}`} 
                    style={{ maxWidth: '100%' }} 
                    alt="时间序列预测" 
                  />
                )}
              </Col>
            </Row>
          </Card>
        )}
        
        {result.land_use_analysis && (
          <Card title="土地利用风险分析" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                {result.land_use_analysis.preview && (
                  <img 
                    src={`data:image/png;base64,${result.land_use_analysis.preview}`} 
                    style={{ width: '100%' }} 
                    alt="土地利用图" 
                  />
                )}
              </Col>
              <Col span={12}>
                <Title level={5}>土地利用类型分布</Title>
                {result.land_use_analysis.areas && (
                  <ul>
                    {Object.entries(result.land_use_analysis.areas).map(([type, value]) => (
                      <li key={type}>
                        {type}: {typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : String(value)}
                      </li>
                    ))}
                  </ul>
                )}
              </Col>
            </Row>
          </Card>
        )}
        
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Space size="large">
            <Button 
              type="primary" 
              icon={<FileTextOutlined />}
              onClick={() => setReportModalVisible(true)}
            >
              生成风险报告
            </Button>
            <Button 
              type="primary" 
              icon={<GlobalOutlined />}
              onClick={() => setMapModalVisible(true)}
            >
              生成风险地图
            </Button>
          </Space>
        </div>
      </div>
    );
  };
  
  // 渲染报告设置模态框
  const renderReportModal = () => (
    <Modal
      title="生成风险报告"
      open={reportModalVisible}
      onCancel={() => setReportModalVisible(false)}
      onOk={handleGenerateReport}
      okText="生成报告"
      cancelText="取消"
    >
      <Form layout="vertical">
        <Form.Item label="报告标题">
          <Input 
            placeholder="请输入报告标题" 
            value={reportTitle}
            onChange={e => setReportTitle(e.target.value)}
          />
        </Form.Item>
        
        <Form.Item label="报告作者">
          <Input 
            placeholder="请输入报告作者" 
            value={reportAuthor}
            onChange={e => setReportAuthor(e.target.value)}
          />
        </Form.Item>
        
        <Form.Item label="报告格式">
          <Radio.Group 
            value={reportFormat}
            onChange={e => setReportFormat(e.target.value)}
          >
            <Radio.Button value="pdf">PDF</Radio.Button>
            <Radio.Button value="docx">DOCX</Radio.Button>
            <Radio.Button value="html">HTML</Radio.Button>
          </Radio.Group>
        </Form.Item>
        
        <Form.Item label="报告选项">
          <Space direction="vertical">
            <Checkbox 
              checked={reportOptions.includeViz}
              onChange={e => setReportOptions({...reportOptions, includeViz: e.target.checked})}
            >
              包含可视化图表
            </Checkbox>
            <Checkbox 
              checked={reportOptions.includeRecs}
              onChange={e => setReportOptions({...reportOptions, includeRecs: e.target.checked})}
            >
              包含风险缓解建议
            </Checkbox>
            <Checkbox 
              checked={reportOptions.includeSummary}
              onChange={e => setReportOptions({...reportOptions, includeSummary: e.target.checked})}
            >
              包含执行摘要
            </Checkbox>
            <Checkbox 
              checked={reportOptions.includeAppendix}
              onChange={e => setReportOptions({...reportOptions, includeAppendix: e.target.checked})}
            >
              包含附录
            </Checkbox>
            <Checkbox 
              checked={reportOptions.includeFormulas}
              onChange={e => setReportOptions({...reportOptions, includeFormulas: e.target.checked})}
            >
              包含计算公式
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
  
  // 渲染地图设置模态框
  const renderMapModal = () => (
    <Modal
      title="生成风险地图"
      open={mapModalVisible}
      onCancel={() => setMapModalVisible(false)}
      onOk={handleGenerateMap}
      okText="生成地图"
      cancelText="取消"
    >
      <Form layout="vertical">
        {!landUseFilePath && !result?.land_use_analysis && (
          <Form.Item label="土地利用图像" required>
            <Upload
              name="file"
              action="/api/upload_file/"
              onChange={handleLandUseUpload}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择图像文件</Button>
            </Upload>
          </Form.Item>
        )}
        
        <Form.Item label="地图格式">
          <Radio.Group 
            value={mapFormat}
            onChange={e => setMapFormat(e.target.value)}
          >
            <Radio.Button value="png">PNG</Radio.Button>
            <Radio.Button value="jpg">JPG</Radio.Button>
            <Radio.Button value="svg">SVG</Radio.Button>
            <Radio.Button value="geotiff">GeoTIFF</Radio.Button>
          </Radio.Group>
        </Form.Item>
        
        <Form.Item label="空间分辨率 (米)">
          <InputNumber 
            min={10} 
            max={1000}
            step={10}
            value={resolution}
            onChange={value => setResolution(value as number)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Form.Item label="地图选项">
          <Space direction="vertical">
            <Checkbox
              checked={mapOptions.includeHeatmap}
              onChange={e => setMapOptions({...mapOptions, includeHeatmap: e.target.checked})}
            >
              包含热力图
            </Checkbox>
            <Checkbox
              checked={mapOptions.includeContours}
              onChange={e => setMapOptions({...mapOptions, includeContours: e.target.checked})}
            >
              包含等风险线
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
  
  // 渲染参数表单 - 根据选择的方法显示不同的参数表单
  const renderParamForm = () => {
    const numericColumns = columns.filter(col => col.type === 'numeric' || col.type === 'float' || col.type === 'integer');
    
    // 数据集选择表单项，用于每种方法
    const datasetSelector = (
      <Form.Item label="数据集" required tooltip="选择用于评估的数据集">
        <Select
          placeholder="请选择数据集"
          style={{ width: '100%' }}
          onChange={handleDatasetChange}
          loading={loading}
          disabled={assessing}
          value={selectedDataset}
        >
          {datasets.map(dataset => (
            <Option key={dataset.id} value={dataset.id}>
              {dataset.name} ({dataset.row_count}行 × {dataset.column_count}列)
            </Option>
          ))}
        </Select>
      </Form.Item>
    );
    
    switch (selectedMethod) {
      case 'prob_loss':
        return (
          <Card title="概率损失法参数输入">
            <Form layout="vertical">
              <Form.Item label="溃坝概率" required>
                <InputNumber min={0} max={1} step={0.01} value={damBreakProb} onChange={setDamBreakProb} disabled={assessing} />
              </Form.Item>
              <Form.Item label="区域地形图" required>
                <Upload
                  name="file"
                  action="/api/upload_file/"
                  onChange={handleTerrainUpload}
                  maxCount={1}
                      disabled={assessing}
                    >
                  <Button icon={<UploadOutlined />}>上传地形图</Button>
                </Upload>
                {terrainFilePath && <div style={{color:'#52c41a'}}>已上传</div>}
                  </Form.Item>
              <Form.Item label="区域土地利用图" required>
                <Upload
                  name="file"
                  action="/api/upload_file/"
                  onChange={handleLandUseUpload}
                  maxCount={1}
                      disabled={assessing}
                    >
                  <Button icon={<UploadOutlined />}>上传土地利用图</Button>
                </Upload>
                {landUseFilePath && <div style={{color:'#52c41a'}}>已上传</div>}
                  </Form.Item>
              <Form.Item>
                <Button 
                  type="primary" 
                  onClick={handleAssessment}
                  loading={assessing}
                  block
                >
                  执行概率损失风险评估
                </Button>
              </Form.Item>
            </Form>
          </Card>
        );
        
      case 'iahp_critic_gt':
        return (
          <Card title="IAHP-CRITIC-GT法参数输入">
            <Form layout="vertical">
              {/* 评估指标设置 */}
              <Form.Item label="评估目标" required tooltip="设置本次风险评估的目标或说明">
                <Input
                  placeholder="请输入评估目标，如：综合风险等级评估"
                  value={assessmentTarget}
                  onChange={e => setAssessmentTarget(e.target.value)}
                  disabled={assessing}
                />
              </Form.Item>
              <Form.Item label="风险阈值设置" tooltip="可选，设置各风险等级的分界阈值">
                <Input
                  placeholder="如：高风险>0.7, 中风险0.4-0.7, 低风险<0.4"
                  value={riskThresholds}
                  onChange={e => setRiskThresholds(e.target.value)}
                  disabled={assessing}
                />
              </Form.Item>
              {/* 因素重要性（敏感性分析结果） */}
              <Form.Item label="因素重要性（敏感性分析结果）" required tooltip="输入或选择模型敏感性分析结果，可手动调整">
                    <Select
                      mode="multiple"
                  placeholder="请选择重要因素（可多选）"
                  value={importantFactors}
                  onChange={setImportantFactors}
                      style={{ width: '100%' }}
                      disabled={assessing}
                    >
                  {featureImportances.map(f => (
                    <Option key={f.name} value={f.name}>{f.name}（重要性：{f.importance}）</Option>
                      ))}
                    </Select>
                  </Form.Item>
              {/* 权重融合系数 */}
              <Form.Item label="融合系数 (α)" tooltip="IAHP和CRITIC权重的融合系数，值越大IAHP权重占比越高">
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={alphaValue}
                      onChange={value => setAlphaValue(value as number)}
                  marks={{ 0: '完全CRITIC', 0.5: '均衡', 1: '完全IAHP' }}
                      disabled={assessing}
                    />
                  </Form.Item>
              {/* 条件值输入卡片（可动态增删行） */}
              <Form.Item label="条件值输入" tooltip="可添加多组条件，每组为一个因素及其取值">
                {conditionRows.map((row, idx) => (
                  <Input.Group compact key={idx} style={{ marginBottom: 8 }}>
                    <Select
                      style={{ width: '45%' }}
                      placeholder="选择因素"
                      value={row.factor}
                      onChange={val => updateConditionRow(idx, { ...row, factor: val })}
                      disabled={assessing}
                    >
                      {featureImportances.map(f => (
                        <Option key={f.name} value={f.name}>{f.name}</Option>
                      ))}
                    </Select>
                    <Input
                      style={{ width: '40%' }}
                      placeholder="输入取值"
                      value={row.value}
                      onChange={e => updateConditionRow(idx, { ...row, value: e.target.value })}
                      disabled={assessing}
                    />
                    <Button
                      danger
                      onClick={() => removeConditionRow(idx)}
                      disabled={assessing || conditionRows.length === 1}
                    >删除</Button>
                  </Input.Group>
                ))}
                <Button type="dashed" onClick={addConditionRow} block disabled={assessing} style={{ marginBottom: 8 }}>添加条件</Button>
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  onClick={handleConditionAssess}
                  loading={assessing}
                  disabled={!importantFactors.length || conditionRows.some(r => !r.factor || !r.value)}
                  block
                >
                  计算综合风险评估值
                </Button>
              </Form.Item>
              {conditionRiskValue !== null && (
                <Alert
                  style={{ marginBottom: 16 }}
                  message={`综合风险评估值：${conditionRiskValue}`}
                  type="info"
                  showIcon
                />
              )}
              <Form.Item>
                <Button 
                  type="primary" 
                  onClick={handleAssessment}
                  loading={assessing}
                  disabled={!importantFactors.length || !assessmentTarget}
                  block
                >
                  执行IAHP-CRITIC-GT风险评估
                </Button>
              </Form.Item>
            </Form>
          </Card>
        );
        
      case 'dynamic_bayes':
        return (
          <Card title="动态贝叶斯网络参数设置">
            <Form layout="vertical">
              {datasetSelector}
              
              {selectedDataset && (
                <>
                  <Form.Item 
                    label="预测列" 
                    required
                    tooltip="需要预测的风险列"
                  >
                    <Select
                      placeholder="选择预测列"
                      value={predictColumn}
                      onChange={setPredictColumn}
                      style={{ width: '100%' }}
                      disabled={assessing}
                    >
                      {numericColumns.map(column => (
                        <Option key={column.name} value={column.name}>{column.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item 
                    label="序列特征列" 
                    required
                    tooltip="影响风险变化的特征列"
                  >
                    <Select
                      mode="multiple"
                      placeholder="选择序列特征列"
                      value={sequenceColumns}
                      onChange={setSequenceColumns}
                      style={{ width: '100%' }}
                      disabled={assessing}
                    >
                      {columns
                        .filter(col => col.name !== predictColumn)
                        .map(column => (
                          <Option key={column.name} value={column.name}>{column.name}</Option>
                        ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item 
                    label="时间步长"
                    tooltip="预测未来的时间步数"
                  >
                    <InputNumber
                      value={timeSteps}
                      onChange={value => setTimeSteps(value as number)}
                      min={1}
                      max={10}
                      style={{ width: '100%' }}
                      disabled={assessing}
                    />
                  </Form.Item>
                  
                  {renderLandUseForm()}
                </>
              )}
              
              <Form.Item>
                <Button 
                  type="primary" 
                  onClick={handleAssessment}
                  loading={assessing}
                  disabled={!selectedDataset}
                  block
                >
                  执行动态贝叶斯风险评估
                </Button>
              </Form.Item>
            </Form>
          </Card>
        );
        
      default:
        return null;
    }
  };
  
  // 渲染土地利用分析表单
  const renderLandUseForm = () => (
    <Form.Item 
      label="土地利用分析" 
      tooltip={{
        title: '启用后需要上传土地利用图像',
        icon: <InfoCircleOutlined />
      }}
    >
      <Switch 
        checked={enableLandUse}
        onChange={setEnableLandUse}
        disabled={assessing}
      />
      
      {enableLandUse && (
        <div style={{ marginTop: 16 }}>
          <Dragger
            name="file"
            action="/api/upload_file/"
            onChange={handleLandUseUpload}
            disabled={assessing}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持PNG、JPG、TIFF、GeoTIFF格式</p>
          </Dragger>
        </div>
      )}
    </Form.Item>
  );
  
  // 新增相关处理函数
  const handleConditionAssess = async () => {
    // 这里应调用后端接口，传递指标、专家打分、条件值，获取综合风险评估值
    // 示例：
    try {
      setAssessing(true);
      const response = await postData<any>('/api/risk/condition_assess/', {
        method: 'iahp_critic_gt',
        indicator_cols: indicatorColumns,
        expert_score_text: expertScoreText,
        condition_input: conditionInput
      });
      setConditionRiskValue(response.risk_value);
    } catch (e) {
      message.error('条件风险评估失败');
    } finally {
      setAssessing(false);
    }
  };
  
  // 渲染主要内容
  return (
    <>
      <Card title="风险评估系统">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form.Item label="选择评估方法">
              <Radio.Group 
                value={selectedMethod}
                onChange={e => handleMethodChange(e.target.value)}
                buttonStyle="solid"
                disabled={assessing}
              >
                {Object.entries(METHOD_NAMES).map(([key, value]) => (
                  <Radio.Button key={key} value={key}>{value}</Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>
      </Card>
      
      {selectedMethod && (
        <Card title={`${METHOD_NAMES[selectedMethod]}评估流程`} style={{ marginTop: 16 }}>
          <div>
            {selectedMethod === 'prob_loss' && (
              <ol>
                <li>输入溃坝概率</li>
                <li>上传区域地形图，自动计算洪水演进并生成洪水淹没图</li>
                <li>上传区域土地利用图，结合淹没图自动计算区域损失</li>
                <li>风险 = 溃坝概率 × 区域损失，输出风险等级</li>
              </ol>
            )}
            {selectedMethod === 'iahp_critic_gt' && (
              <ol>
                <li>自然语言输入专家对各指标的打分</li>
                <li>设定风险评估指标</li>
                <li>大语言模型分析专家打分，自动生成权重</li>
                <li>输入预测后，对条件值进行敏感性分析</li>
                <li>GT博弈融合专家权重与模型权重</li>
                <li>输出风险评估等级分划</li>
              </ol>
            )}
            {selectedMethod === 'dynamic_bayes' && (
              <ol>
                <li>选择数据集</li>
                <li>构建动态贝叶斯网络</li>
                <li>输入时间序列数据，预测风险趋势</li>
                <li>输出风险变化结果</li>
              </ol>
            )}
          </div>
        </Card>
      )}
      
      {selectedMethod && renderParamForm()}
      
      {assessing && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin tip="正在执行风险评估..." size="large" />
        </div>
      )}
      
      {result && renderResults()}
      
      {/* 模态框 */}
      {renderReportModal()}
      {renderMapModal()}
    </>
  );
};

export default RiskAssess; 