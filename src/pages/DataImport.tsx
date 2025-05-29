import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Button, 
  Card, 
  Table, 
  Divider, 
  message, 
  Input, 
  Form,
  Space,
  Typography,
  Modal,
  Popconfirm,
  Spin,
  Empty
} from 'antd';
import type { TableColumnType } from 'antd';
import { 
  InboxOutlined, 
  UploadOutlined, 
  DatabaseOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { fetchData, postData } from '../utils/api';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import './DataImport.css';

const { Dragger } = Upload;
const { Title, Text } = Typography;

// 定义API响应类型
interface ListDatasetsResponse {
  success?: boolean;
  datasets?: Dataset[];
  total?: number;
}

// 定义上传响应类型
interface UploadResponse {
  message: string;
  dataset?: {
    id: number;
    name: string;
    description: string;
    rows: number;
    columns: number;
  };
}

// 可调整宽度的表头单元格
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={e => {
            e.stopPropagation();
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
      minConstraints={[80, 0]}
      maxConstraints={[1000, 0]}
    >
      <th {...restProps} />
    </Resizable>
  );
};

// API基础URL
const API_BASE_URL = 'http://localhost:8000';

// 模拟数据集（仅在API失败时使用）
const mockData = [
  {
    id: 1,
    name: 'test-original',
    description: null,
    created_at: '2023-04-10 10:00:00',
    rows: 120,
    columns: 8,
  },
  {
    id: 2,
    name: 'test',
    description: null,
    created_at: '2023-04-15 14:30:00',
    rows: 150,
    columns: 10,
  },
  {
    id: 3,
    name: 'test-non',
    description: null,
    created_at: '2023-04-20 09:15:00',
    rows: 200,
    columns: 12,
  },
  {
    id: 4,
    name: 'debug_basic_save_test1',
    description: 'DEBUG 基本处理后的数据集: 示例时序风险数据',
    created_at: '2023-05-05 16:20:00',
    rows: 300,
    columns: 15,
  },
  {
    id: 5,
    name: 'debug_basic_save_test1',
    description: 'DEBUG 基本处理后的数据集: 示例时序风险数据',
    created_at: '2023-05-10 11:45:00',
    rows: 300,
    columns: 15,
  },
  {
    id: 6,
    name: 'debug_basic_save',
    description: 'DEBUG 基本处理后的数据集: 示例时序风险数据',
    created_at: '2023-05-15 13:30:00',
    rows: 350,
    columns: 18,
  },
  {
    id: 7,
    name: 'basic_processed_示例时序风险数据集_1',
    description: '基本处理后的数据集: 示例时序风险数据集 (已处理)',
    created_at: '2023-06-01 09:00:00',
    rows: 500,
    columns: 20,
  },
];

// 数据集接口定义
interface Dataset {
  id: number;
  name: string;
  description: string | null;
  created_at?: string;
  rows?: number;
  columns?: number;
  row_count?: number;
  column_count?: number;
  data_type?: string;
  modified_at?: string;
}

// 创建一个自定义的删除请求函数
const deleteData = async (url: string) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}${url}`);
    return response.data;
  } catch (error) {
    console.error('Delete request failed:', error);
    throw error;
  }
};

// 定义列类型接口
interface ColumnType {
  name: string;
  type: string;
  categories?: string[];
}

const DataImport: React.FC = () => {
  const [form] = Form.useForm();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // 获取数据集列表
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('正在从API获取数据集列表...');
      // 使用通用API工具发送请求
      const response = await fetchData<ListDatasetsResponse>('/api/list_datasets/');
      console.log('API响应:', response);
      
      if (response) {
        let datasetList: Dataset[] = [];
        
        // 处理不同的响应格式
        if (Array.isArray(response)) {
          datasetList = response.map(dataset => ({
            ...dataset,
            rows: dataset.row_count,
            columns: dataset.column_count
          }));
        } else if (response.datasets && Array.isArray(response.datasets)) {
          datasetList = response.datasets.map(dataset => ({
            ...dataset,
            rows: dataset.row_count,
            columns: dataset.column_count
          }));
          console.log('获取到的数据集:', datasetList);
          // 打印每个数据集的行数和列数
          datasetList.forEach((dataset: Dataset, index: number) => {
            console.log(`数据集 ${index+1}:`, dataset.name, '行数:', dataset.rows, '列数:', dataset.columns);
          });
        } else {
          console.warn('API返回数据格式不符合预期:', response);
          message.warning('数据格式不符合预期，请检查后端API实现');
          // 使用模拟数据作为备选
          datasetList = mockData;
        }
        
        if (datasetList.length > 0) {
          console.log(`成功获取${datasetList.length}个数据集`);
          setDatasets(datasetList);
        } else {
          message.info('未找到数据集，如需添加请使用上传功能');
          setDatasets([]);
        }
      } else {
        console.warn('API返回空响应');
        message.warning('无法获取数据集列表，请检查后端服务');
        setDatasets([]);
      }
    } catch (err: any) {
      console.error('获取数据集失败:', err);
      // 提供更详细的错误信息
      let errorMsg = '连接后端API失败';
      if (err.response) {
        errorMsg += `: ${err.response.status} ${err.response.statusText}`;
        console.error('错误响应数据:', err.response.data);
      } else if (err.request) {
        errorMsg += ': 未收到响应，请检查后端服务是否运行';
      } else {
        errorMsg += `: ${err.message || '未知错误'}`;
      }
      errorMsg += '。请确保后端服务正在运行且地址配置正确。';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchDatasets();
    
    // 初始化列宽
    setColumnWidths({
      0: 200, // 数据集名称
      1: 180, // 描述
      2: 150, // 创建时间
      3: 80,  // 行数
      4: 80,  // 列数
      5: 310  // 操作
    });
  }, []);

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.xlsx,.xls',
    fileList,
    beforeUpload: (file: any) => {
      const isValidFormat = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                           file.type === 'application/vnd.ms-excel' ||
                           file.type === 'text/csv';
      if (!isValidFormat) {
        message.error('只能上传 Excel 或 CSV 文件!');
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  // 处理查看数据集
  const handleViewDataset = (record: Dataset) => {
    setCurrentDataset(record);
    setPreviewVisible(true);
    setPreviewLoading(true);
    
    // 从API获取数据预览
    fetchData<any>(`/api/preview_dataset/${record.id}/`)
      .then(response => {
        console.log('预览响应:', response);
        if (response) {
          // 处理新的API格式：{columns, samples, dataset_name}
          if (response.samples && Array.isArray(response.samples)) {
            console.log('API返回samples格式数据');
            // 添加行键
            const dataWithKeys = response.samples.map((row: any, index: number) => ({
              key: index,
              ...row
            }));
            setPreviewData(dataWithKeys);
          } else if (response.columns && Array.isArray(response.columns)) {
            console.log('API只返回了columns但没有samples');
            // API只返回了列名但没有数据，生成模拟数据
            const mockData = generatePreviewData(
              response.columns.length, 
              5, 
              record.name
            );
            setPreviewData(mockData);
          } else if (response.data && Array.isArray(response.data)) {
            // 旧格式的API响应
            console.log('API返回旧格式数据');
            setPreviewData(response.data);
          } else {
            console.warn('API返回的数据格式无法识别:', response);
            message.warning('预览数据格式不符合预期');
            // 回退到模拟数据
            const generatedData = generatePreviewData(
              record.columns || record.column_count || 10, 
              Math.min(10, record.rows || record.row_count || 100), 
              record.name
            );
            setPreviewData(generatedData);
          }
        } else {
          message.warning('预览请求返回空数据');
          // 回退到模拟数据
          const generatedData = generatePreviewData(
            record.columns || record.column_count || 10, 
            Math.min(10, record.rows || record.row_count || 100), 
            record.name
          );
          setPreviewData(generatedData);
        }
      })
      .catch((err: any) => {
        console.error('获取预览失败:', err);
        message.error(`获取预览失败: ${err.message || '未知错误'}`);
        // 回退到模拟数据
        const generatedData = generatePreviewData(
          record.columns || record.column_count || 10, 
          Math.min(10, record.rows || record.row_count || 100), 
          record.name
        );
        setPreviewData(generatedData);
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  };
  
  // 生成预览数据
  const generatePreviewData = (columnCount: number, rowCount: number, datasetName: string) => {
    const data = [];
    const columnTypes = getColumnTypes(datasetName, columnCount);
    
    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, any> = { key: i };
      
      columnTypes.forEach((colType, index) => {
        if (!colType) return; // 跳过未定义的列类型
        
        const colName = colType.name;
        
        if (colType.type === 'numeric') {
          row[colName] = +(Math.random() * 100).toFixed(2);
        } else if (colType.type === 'category') {
          const categories = colType.categories || ['类别A', '类别B', '类别C'];
          row[colName] = categories[Math.floor(Math.random() * categories.length)];
        } else if (colType.type === 'date') {
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 365));
          row[colName] = date.toISOString().split('T')[0];
        } else {
          row[colName] = `值 ${i}-${index}`;
        }
      });
      
      data.push(row);
    }
    
    return data;
  };
  
  // 根据数据集名称判断可能的列类型
  const getColumnTypes = (datasetName: string, columnCount: number): ColumnType[] => {
    if (datasetName.includes('风险数据')) {
      return [
        { name: '日期', type: 'date' },
        { name: '水位(m)', type: 'numeric' },
        { name: '流量(m³/s)', type: 'numeric' },
        { name: '降雨量(mm)', type: 'numeric' },
        { name: '地区', type: 'category', categories: ['云南', '四川', '贵州', '广西'] },
        { name: '风险等级', type: 'category', categories: ['低', '中', '高', '极高'] },
        ...Array(Math.max(0, columnCount - 6)).fill(0).map((_, i) => ({ 
          name: `特征${i + 1}`, 
          type: 'numeric' 
        }))
      ];
    } else if (datasetName.includes('test')) {
      return [
        { name: 'ID', type: 'numeric' },
        { name: '测试值', type: 'numeric' },
        { name: '测试类别', type: 'category', categories: ['A', 'B', 'C', 'D'] },
        { name: '测试日期', type: 'date' },
        ...Array(Math.max(0, columnCount - 4)).fill(0).map((_, i) => ({ 
          name: `属性${i + 1}`, 
          type: i % 2 === 0 ? 'numeric' : 'category',
          ...(i % 2 !== 0 ? { categories: ['类别A', '类别B', '类别C'] } : {})
        }))
      ];
    } else if (datasetName.includes('土地利用')) {
      return [
        { name: '区域', type: 'category', categories: ['昆明', '大理', '丽江', '曲靖', '玉溪'] },
        { name: '年份', type: 'numeric' },
        { name: '土地类型', type: 'category', categories: ['耕地', '林地', '草地', '水域', '建设用地'] },
        { name: '面积(km²)', type: 'numeric' },
        { name: '占比(%)', type: 'numeric' },
        ...Array(Math.max(0, columnCount - 5)).fill(0).map((_, i) => ({ 
          name: `指标${i + 1}`, 
          type: i % 2 === 0 ? 'numeric' : 'category',
          ...(i % 2 !== 0 ? { categories: ['低', '中', '高'] } : {})
        }))
      ];
    } else if (datasetName.includes('气象')) {
      return [
        { name: '日期', type: 'date' },
        { name: '温度(°C)', type: 'numeric' },
        { name: '湿度(%)', type: 'numeric' },
        { name: '气压(hPa)', type: 'numeric' },
        { name: '风速(m/s)', type: 'numeric' },
        { name: '降水量(mm)', type: 'numeric' },
        { name: '城市', type: 'category', categories: ['昆明', '北京', '上海', '广州', '深圳'] },
        ...Array(Math.max(0, columnCount - 7)).fill(0).map((_, i) => ({ 
          name: `指标${i + 1}`, 
          type: 'numeric' 
        }))
      ];
    } else {
      // 默认列类型
      return Array(columnCount).fill(0).map((_, i) => {
        if (i === 0) return { name: 'ID', type: 'numeric' };
        if (i === 1) return { name: '名称', type: 'text' };
        if (i === 2) return { name: '日期', type: 'date' };
        if (i % 3 === 0) return { name: `属性${Math.ceil(i / 3)}`, type: 'numeric' };
        if (i % 3 === 1) return { name: `类别${Math.ceil(i / 3)}`, type: 'category', categories: ['A', 'B', 'C'] };
        return { name: `日期${Math.ceil(i / 3)}`, type: 'date' };
      });
    }
  };

  // 处理数据处理
  const handleProcessDataset = (record: Dataset) => {
    message.info(`即将处理数据集: ${record.name}`);
    // 在实际项目中，这里可以跳转到数据处理页面
    window.location.href = `/process?id=${record.id}`;
  };

  // 处理删除数据集
  const handleDeleteDataset = async (id: number) => {
    try {
      // 使用deleteData函数删除数据集
      await deleteData(`/api/delete_dataset/${id}`);
      
      // 更新本地状态
      const newDatasets = datasets.filter(item => item.id !== id);
      setDatasets(newDatasets);
      message.success('数据集已删除');
      
      // 短暂延时后刷新数据集列表，确保后端操作完成
      setTimeout(() => {
        fetchDatasets();
      }, 300);
    } catch (err: any) {
      console.error('删除数据集失败:', err);
      let errorMsg = '删除数据集失败';
      if (err.response) {
        errorMsg += `: ${err.response.status} ${err.response.statusText}`;
        console.error('错误响应数据:', err.response.data);
      } else if (err.request) {
        errorMsg += ': 未收到响应，请检查后端服务是否运行';
      } else {
        errorMsg += `: ${err.message || '未知错误'}`;
      }
      message.error(errorMsg);
    }
  };

  const columns = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <a>{text}</a>,
      width: '20%',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '18%',
      ellipsis: {
        showTitle: false,
      },
      render: (text: string | null) => (
        <Typography.Paragraph 
          ellipsis={{ rows: 1, tooltip: text || '无描述' }}
          style={{ marginBottom: 0 }}
        >
          {text || '无描述'}
        </Typography.Paragraph>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      ellipsis: true,
    },
    {
      title: '行数',
      dataIndex: 'row_count',
      key: 'rows',
      width: '8%',
      align: 'right' as const,
    },
    {
      title: '列数',
      dataIndex: 'column_count',
      key: 'columns',
      width: '8%',
      align: 'right' as const,
    },
    {
      title: '操作',
      key: 'action',
      width: '31%',
      render: (_: any, record: Dataset) => (
        <Space size="small" wrap>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDataset(record)}
            size="small"
            style={{ padding: '0 4px' }}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleProcessDataset(record)}
            size="small"
            style={{ padding: '0 4px' }}
          >
            处理
          </Button>
          <Popconfirm
            title="确定要删除此数据集吗?"
            onConfirm={() => handleDeleteDataset(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              size="small"
              style={{ padding: '0 4px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleUpload = async () => {
    if (!fileList.length) {
      message.warning('请先选择文件');
      return;
    }

    form.validateFields().then(async values => {
      const formData = new FormData();
      formData.append('file', fileList[0]);
      formData.append('table_name', values.tableName);
      formData.append('description', values.description || '');

      setUploading(true);

      try {
        console.log('正在上传数据...');
        // 使用API工具上传文件，但由于需要发送FormData，我们需要配置特殊的headers
        const response = await postData<UploadResponse>(
          '/api/upload_data/', 
          formData, 
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        
        console.log('上传响应:', response);
        
        setUploading(false);
        setFileList([]);
        form.resetFields();
        
        if (response && response.message) {
          message.success(response.message);
          
          // 如果响应中包含了上传的数据集信息，打印出来
          if (response.dataset) {
            console.log('上传的数据集:', response.dataset);
            console.log('行数:', response.dataset.rows, '列数:', response.dataset.columns);
          }
        } else {
          message.success('数据上传成功');
        }
        
        // 上传成功后刷新数据集列表
        fetchDatasets();
      } catch (err: any) {
        console.error('上传数据失败:', err);
        let errorMsg = '上传失败';
        if (err.response) {
          errorMsg += `: ${err.response.status} ${err.response.statusText}`;
          console.error('错误响应数据:', err.response.data);
        } else if (err.request) {
          errorMsg += ': 未收到响应，请检查后端服务是否运行';
        } else {
          errorMsg += `: ${err.message || '未知错误'}`;
        }
        message.error(errorMsg);
        setUploading(false);
      }
    });
  };

  // 处理列宽调整
  const handleResize = (index: number) => (e: React.SyntheticEvent, { size }: { size: { width: number } }) => {
    const newColumnWidths = { ...columnWidths };
    newColumnWidths[index] = size.width;
    setColumnWidths(newColumnWidths);
  };
  
  // 设置表格组件
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  const resizableColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column: any) => ({
      width: columnWidths[index],
      onResize: handleResize(index),
    }),
  }));

  // 预览表格动态生成columns
  const getPreviewColumns = () => {
    if (!previewData || previewData.length === 0) return [];
    return Object.keys(previewData[0]).map((key) => ({
      title: key,
      dataIndex: key,
      key,
    }));
  };

  return (
    <div className="data-import-container">
      <Card className="upload-card">
        <Title level={4}>上传新数据集</Title>
        <Divider />
        
        <Form form={form} layout="vertical">
          <Form.Item
            name="tableName"
            label="数据集名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="输入数据集名称" prefix={<DatabaseOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="输入数据集描述（选填）" rows={2} />
          </Form.Item>
          
          <Form.Item label="选择文件">
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传。支持 Excel、CSV 格式。
              </p>
            </Dragger>
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              onClick={handleUpload} 
              loading={uploading}
              disabled={fileList.length === 0}
              icon={<UploadOutlined />}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      <Divider orientation="left">
        已上传的数据集
        <Button 
          type="link" 
          icon={<ReloadOutlined />} 
          onClick={fetchDatasets}
          loading={loading}
          style={{ marginLeft: 8 }}
        >
          刷新
        </Button>
      </Divider>
      
      <Card className="datasets-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="加载数据集..." />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Typography.Text type="danger">{error}</Typography.Text>
            <br />
            <Button onClick={fetchDatasets} style={{ marginTop: 16 }}>重试</Button>
          </div>
        ) : datasets.length === 0 ? (
          <Empty description="暂无数据集" />
        ) : (
          <Table 
            components={components}
            columns={resizableColumns} 
            dataSource={datasets}
            rowKey="id"
            pagination={false}
            size="middle"
            bordered
            scroll={{ y: 400 }}
          />
        )}
      </Card>

      {/* 数据集预览弹窗 */}
      <Modal
        title={`数据集预览: ${currentDataset?.name}`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="process" 
            type="primary" 
            onClick={() => {
              setPreviewVisible(false);
              if (currentDataset) {
                handleProcessDataset(currentDataset);
              }
            }}
          >
            处理此数据集
          </Button>,
        ]}
        width={800}
      >
        {currentDataset && (
          <div>
            <p><strong>描述:</strong> {currentDataset.description}</p>
            <p><strong>创建时间:</strong> {currentDataset.created_at}</p>
            <p><strong>数据规模:</strong> {currentDataset.row_count || currentDataset.rows} 行 × {currentDataset.column_count || currentDataset.columns} 列</p>
            <Divider />
            <div style={{ marginTop: 16 }}>
              <Typography.Title level={5}>数据内容预览:</Typography.Title>
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin tip="加载数据中..." />
                </div>
              ) : (
                <Table 
                  dataSource={previewData}
                  columns={getPreviewColumns()}
                  size="small"
                  pagination={false}
                  scroll={{ y: 400 }}
                  style={{ marginTop: 8 }}
                  bordered
                />
              )}
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                注: 向下滚动可浏览所有数据
              </Typography.Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DataImport;