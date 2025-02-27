import Axios from 'axios'
import { LS_PICX_CONFIG, AXIOS_BASE_URL, AXIOS_TIMEOUT } from '@/common/constant'

const baseURL = AXIOS_BASE_URL

const axios = Axios.create({
  baseURL,
  timeout: AXIOS_TIMEOUT
})

axios.defaults.headers['Content-Type'] = 'application/json'

// 发起请求之前的拦截器（前置拦截）
axios.interceptors.request.use(
  (config) => {
    const userConfig = localStorage.getItem(LS_PICX_CONFIG)
    if (userConfig) {
      const { token } = JSON.parse(userConfig)
      if (token) {
        config.headers.Authorization = `token ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
axios.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (!error?.response) {
      ElMessage.error({ duration: 6000, message: `${error}` })
    }
    return Promise.reject(error.response)
  }
)

export default axios
