import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

interface ApiError {
  response?: {
    status: number;
    data?: unknown;
  };
  message: string;
}

export const useApi = () => {
  const { isAuthenticated, logout } = useAuthStore();

  const makeRequest = useCallback(
    async <T = unknown>(config: AxiosRequestConfig): Promise<T> => {
      if (!isAuthenticated) {
        throw new Error('User not authenticated');
      }

      try {
        const response: AxiosResponse<T> = await api(config);
        return response.data;
      } catch (error: unknown) {
        const apiError = error as ApiError;
        // If we get a 401 and the interceptor couldn't refresh the token,
        // the user will be logged out automatically by the interceptor
        if (apiError.response?.status === 401) {
          logout();
        }
        throw error;
      }
    },
    [isAuthenticated, logout]
  );

  const get = useCallback(
    <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
      return makeRequest<T>({ ...config, method: 'GET', url });
    },
    [makeRequest]
  );

  const post = useCallback(
    <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
      return makeRequest<T>({ ...config, method: 'POST', url, data });
    },
    [makeRequest]
  );

  const put = useCallback(
    <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
      return makeRequest<T>({ ...config, method: 'PUT', url, data });
    },
    [makeRequest]
  );

  const patch = useCallback(
    <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
      return makeRequest<T>({ ...config, method: 'PATCH', url, data });
    },
    [makeRequest]
  );

  const del = useCallback(
    <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
      return makeRequest<T>({ ...config, method: 'DELETE', url });
    },
    [makeRequest]
  );

  return {
    get,
    post,
    put,
    patch,
    delete: del,
    makeRequest,
  };
};

export default useApi;
