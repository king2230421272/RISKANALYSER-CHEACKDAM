import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

const Navigation: React.FC = () => {
  return (
    <nav className="main-navigation">
      <div className="logo">
        <h1>风险评估系统</h1>
      </div>
      <ul className="nav-links">
        <li>
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
            首页
          </NavLink>
        </li>
        <li>
          <NavLink to="/import" className={({ isActive }) => isActive ? 'active' : ''}>
            数据导入
          </NavLink>
        </li>
        <li>
          <NavLink to="/process" className={({ isActive }) => isActive ? 'active' : ''}>
            数据处理
          </NavLink>
        </li>
        <li>
          <NavLink to="/prediction" className={({ isActive }) => isActive ? 'active' : ''}>
            预测
          </NavLink>
        </li>
        <li>
          <NavLink to="/risk" className={({ isActive }) => isActive ? 'active' : ''}>
            风险评估
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default Navigation; 