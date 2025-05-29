import React, { useEffect, useRef } from 'react';
import { Card, Empty, Spin } from 'antd';

interface TrendData {
  historical: number[];
  projected: number[];
  time_periods: string[];
}

interface RiskTrendChartProps {
  data: TrendData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

/**
 * 风险趋势图表组件
 * 
 * @param data 趋势数据，包括历史数据和预测数据
 * @param loading 是否处于加载状态
 * @param height 图表高度
 * @param title 图表标题
 */
const RiskTrendChart: React.FC<RiskTrendChartProps> = ({ 
  data,
  loading = false,
  height = 300,
  title = '风险趋势分析'
}) => {
  // 创建canvas引用
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 在数据变化时绘制图表
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 图表边距
    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartWidth = canvas.width - margin.left - margin.right;
    const chartHeight = canvas.height - margin.top - margin.bottom;
    
    // 数据准备
    const allData = [...data.historical, ...data.projected];
    const maxValue = Math.max(...allData) * 1.1; // 增加10%的空间
    const minValue = Math.min(...allData, 0);
    
    // 计算比例尺
    const xScale = chartWidth / (allData.length - 1);
    const yScale = chartHeight / (maxValue - minValue);
    
    // 绘制坐标轴
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    
    // x轴
    ctx.moveTo(margin.left, canvas.height - margin.bottom);
    ctx.lineTo(canvas.width - margin.right, canvas.height - margin.bottom);
    
    // y轴
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, canvas.height - margin.bottom);
    ctx.stroke();
    
    // 绘制网格线和标签
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    
    // y轴网格线和标签
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = margin.top + chartHeight - (i / yTicks) * chartHeight;
      const value = minValue + (i / yTicks) * (maxValue - minValue);
      
      // 网格线
      ctx.beginPath();
      ctx.strokeStyle = '#eee';
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
      
      // 标签
      ctx.fillText(value.toFixed(2), margin.left - 5, y + 4);
    }
    
    // x轴标签
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(data.time_periods.length / 10); // 确保不会显示太多标签
    for (let i = 0; i < data.time_periods.length; i += labelStep) {
      const x = margin.left + i * xScale;
      ctx.fillText(data.time_periods[i], x, canvas.height - margin.bottom + 15);
    }
    
    // 绘制历史数据线
    ctx.beginPath();
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < data.historical.length; i++) {
      const x = margin.left + i * xScale;
      const y = margin.top + chartHeight - (data.historical[i] - minValue) * yScale;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 绘制历史数据点
    for (let i = 0; i < data.historical.length; i++) {
      const x = margin.left + i * xScale;
      const y = margin.top + chartHeight - (data.historical[i] - minValue) * yScale;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#1890ff';
      ctx.fill();
    }
    
    // 绘制预测数据线
    if (data.projected.length > 0) {
      const startX = margin.left + (data.historical.length - 1) * xScale;
      const startY = margin.top + chartHeight - (data.historical[data.historical.length - 1] - minValue) * yScale;
      
      ctx.beginPath();
      ctx.setLineDash([5, 3]); // 设置虚线样式
      ctx.strokeStyle = '#ff4d4f';
      ctx.lineWidth = 2;
      ctx.moveTo(startX, startY);
      
      for (let i = 0; i < data.projected.length; i++) {
        const x = margin.left + (data.historical.length + i) * xScale;
        const y = margin.top + chartHeight - (data.projected[i] - minValue) * yScale;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // 恢复实线
      
      // 绘制预测数据点
      for (let i = 0; i < data.projected.length; i++) {
        const x = margin.left + (data.historical.length + i) * xScale;
        const y = margin.top + chartHeight - (data.projected[i] - minValue) * yScale;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4d4f';
        ctx.fill();
      }
    }
    
    // 添加图例
    ctx.font = '14px Arial';
    ctx.fillStyle = '#333';
    
    // 历史数据图例
    ctx.beginPath();
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 2;
    ctx.moveTo(margin.left + 10, margin.top + 15);
    ctx.lineTo(margin.left + 40, margin.top + 15);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(margin.left + 25, margin.top + 15, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#1890ff';
    ctx.fill();
    
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText('历史风险', margin.left + 45, margin.top + 20);
    
    // 预测数据图例
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.moveTo(margin.left + 130, margin.top + 15);
    ctx.lineTo(margin.left + 160, margin.top + 15);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.arc(margin.left + 145, margin.top + 15, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4d4f';
    ctx.fill();
    
    ctx.fillStyle = '#333';
    ctx.fillText('预测风险', margin.left + 165, margin.top + 20);
    
  }, [data]);

  return (
    <Card title={title} size="small">
      {loading ? (
        <div style={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin />
        </div>
      ) : data ? (
        <canvas 
          ref={canvasRef} 
          width={800}
          height={height}
          style={{ width: '100%', height }}
        />
      ) : (
        <Empty 
          description="暂无趋势数据" 
          style={{ height, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        />
      )}
    </Card>
  );
};

export default RiskTrendChart; 