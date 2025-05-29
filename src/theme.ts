import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

// 定义主题颜色
const PRIMARY_COLOR = '#1890ff'; // 蓝色系主色调
const SUCCESS_COLOR = '#52c41a'; // 成功色
const WARNING_COLOR = '#faad14'; // 警告色
const ERROR_COLOR = '#f5222d';   // 错误色

// Ant Design 主题配置
export const customTheme: ThemeConfig = {
  token: {
    colorPrimary: PRIMARY_COLOR,
    colorSuccess: SUCCESS_COLOR, 
    colorWarning: WARNING_COLOR,
    colorError: ERROR_COLOR,
    colorText: '#555',
    colorTextHeading: '#333',
    colorBgBase: '#fff',
    borderRadius: 4,
    fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    Layout: {
      bodyBg: '#f5f5f5',
      headerBg: '#1f1f1f',
      headerHeight: 64,
      footerBg: '#f7f7f7',
      footerPadding: '1rem 2rem',
    },
    Menu: {
      itemHeight: 40,
      itemHoverBg: 'rgba(24, 144, 255, 0.1)',
      itemSelectedBg: 'rgba(24, 144, 255, 0.2)',
    },
    Table: {
      borderColor: '#e8e8e8',
      headerBg: '#fafafa',
    },
    Card: {
      colorBorderSecondary: '#f0f0f0',
    },
    Form: {
      itemMarginBottom: 20,
    },
    Button: {
      controlHeight: 36,
    },
  },
};

export default customTheme; 