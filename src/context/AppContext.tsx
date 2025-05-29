import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// 定义Context类型
interface AppContextType {
  processedData: any | null;
  setProcessedData: (data: any) => void;
  currentDataset: any | null;
  setCurrentDataset: (dataset: any) => void;
  processingHistory: any[];
  addToHistory: (item: any) => void;
}

// 创建Context
export const AppContext = createContext<AppContextType | null>(null);

// Context Provider组件
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 从localStorage加载初始状态
  const [processedData, setProcessedData] = useState<any | null>(() => {
    const saved = localStorage.getItem('processedData');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentDataset, setCurrentDataset] = useState<any | null>(() => {
    const saved = localStorage.getItem('currentDataset');
    return saved ? JSON.parse(saved) : null;
  });

  const [processingHistory, setProcessingHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('processingHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // 添加处理历史记录
  const addToHistory = (item: any) => {
    setProcessingHistory(prev => {
      const newHistory = [...prev, item];
      return newHistory;
    });
  };

  // 状态改变时保存到localStorage
  useEffect(() => {
    if (processedData) {
      localStorage.setItem('processedData', JSON.stringify(processedData));
    }
  }, [processedData]);

  useEffect(() => {
    if (currentDataset) {
      localStorage.setItem('currentDataset', JSON.stringify(currentDataset));
    }
  }, [currentDataset]);

  useEffect(() => {
    if (processingHistory.length > 0) {
      localStorage.setItem('processingHistory', JSON.stringify(processingHistory));
    }
  }, [processingHistory]);

  return (
    <AppContext.Provider value={{
      processedData,
      setProcessedData,
      currentDataset,
      setCurrentDataset,
      processingHistory,
      addToHistory
    }}>
      {children}
    </AppContext.Provider>
  );
};

// 使用Context的自定义Hook
export const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext必须在AppProvider内部使用');
  }
  return context;
}; 