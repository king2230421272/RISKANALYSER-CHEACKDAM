import { createBrowserRouter } from 'react-router-dom';
import { AntLayout } from './components/common';

// 导入页面组件
import Home from './pages/Home';
import DataImport from './pages/DataImport';
import DataProcess from './pages/DataProcess';
import Prediction from './pages/Prediction';
import RiskAssess from './pages/RiskAssess';
import ModelTraining from './pages/ModelTraining';

// 创建应用路由配置
const router = createBrowserRouter([
  {
    path: '/',
    element: <AntLayout title="首页"><Home /></AntLayout>,
  },
  {
    path: '/import',
    element: <AntLayout title="数据导入"><DataImport /></AntLayout>,
  },
  {
    path: '/process',
    element: <AntLayout title="数据处理"><DataProcess /></AntLayout>,
  },
  {
    path: '/training',
    element: <AntLayout title="模型训练"><ModelTraining /></AntLayout>,
  },
  {
    path: '/training/:datasetId',
    element: <AntLayout title="模型训练"><ModelTraining /></AntLayout>,
  },
  {
    path: '/prediction',
    element: <AntLayout title="预测"><Prediction /></AntLayout>,
  },
  {
    path: '/risk',
    element: <AntLayout title="风险评估"><RiskAssess /></AntLayout>,
  },
]);

export default router; 
