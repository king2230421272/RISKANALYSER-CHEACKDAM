import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000/api' 
  : '/api'; // 生产环境下假设API与前端同源

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api; 