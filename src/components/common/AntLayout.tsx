import React, { useState } from 'react';
import { Layout, Menu, Button, Breadcrumb, theme } from 'antd';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  DatabaseOutlined,
  ApiOutlined,
  LineChartOutlined,
  AlertOutlined,
  RocketOutlined
} from '@ant-design/icons';

const { Header, Content, Sider, Footer } = Layout;

interface AntLayoutProps {
  children: React.ReactNode;
  title?: string;
}

// 定义菜单项
const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/import',
    icon: <DatabaseOutlined />,
    label: '数据导入',
  },
  {
    key: '/process',
    icon: <ApiOutlined />,
    label: '数据处理',
  },
  {
    key: '/training',
    icon: <RocketOutlined />,
    label: '模型训练',
  },
  {
    key: '/prediction',
    icon: <LineChartOutlined />,
    label: '预测',
  },
  {
    key: '/risk',
    icon: <AlertOutlined />,
    label: '风险评估',
  },
];

// 根据路径获取面包屑项
const getBreadcrumbItems = (pathname: string) => {
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    {
      title: <Link to="/">首页</Link>,
    },
  ];

  if (pathSegments.length > 0) {
    const currentPath = `/${pathSegments[0]}`;
    const menuItem = menuItems.find(item => item.key === currentPath);
    
    if (menuItem) {
      breadcrumbItems.push({
        title: <span>{menuItem.label}</span>,
      });
    }
  }

  return breadcrumbItems;
};

const AntLayout: React.FC<AntLayoutProps> = ({ children, title }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const selectedKey = menuItems.find(item => 
    location.pathname === '/' 
      ? item.key === '/' 
      : item.key !== '/' && location.pathname.startsWith(item.key)
  )?.key || '/';

  const breadcrumbItems = getBreadcrumbItems(location.pathname);

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          height: 64, 
          margin: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}>
          <h1 style={{ 
            color: 'white', 
            margin: 0, 
            fontSize: collapsed ? '1rem' : '1.2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {collapsed ? '风评系统' : '风险评估系统'}
          </h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header style={{ 
          padding: 0, 
          background: token.colorBgContainer,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <Breadcrumb 
            items={breadcrumbItems}
            style={{ margin: '0 16px' }}
          />
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            minHeight: 280,
          }}
        >
          {title && <h1 style={{ marginBottom: 24 }}>{title}</h1>}
          {children}
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} 风险评估系统 | 版本 1.0.0
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AntLayout; 