// src/main.tsx
import React, { StrictMode } from 'react'
import type { PropsWithChildren } from 'react'
// 确保从 'react-dom/client' 导入 createRoot
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './index.css'
import router from './router'
import customTheme from './theme'
import { AppProvider } from './context/AppContext'
// 导入API配置
import './utils/api'

// 配置 dayjs 为中文
dayjs.locale('zh-cn')

// 错误边界组件类型定义
type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

type ErrorBoundaryProps = PropsWithChildren<{}>;

// 错误边界组件
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h1>发生了错误</h1>
          <pre>{this.state.error?.message || '未知错误'}</pre>
          <button onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 导入 stagewise 工具栏（仅开发环境）
import { StagewiseToolbar } from '@stagewise/toolbar-react'

// stagewise 配置
const stagewiseConfig = {
  plugins: []
};

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProvider>
          <ConfigProvider theme={customTheme} locale={zhCN}>
            <RouterProvider router={router} />
          </ConfigProvider>
        </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error('Root element with ID "root" not found.');
}

// 仅在开发环境中初始化 stagewise 工具栏
if (process.env.NODE_ENV === 'development') {
  // 为工具栏创建单独的 DOM 元素和 React 根
  const toolbarContainer = document.createElement('div');
  toolbarContainer.id = 'stagewise-toolbar-root';
  document.body.appendChild(toolbarContainer);
  
  // 在单独的 React root 中渲染工具栏
  createRoot(toolbarContainer).render(
    <StagewiseToolbar config={stagewiseConfig} />
  );
}